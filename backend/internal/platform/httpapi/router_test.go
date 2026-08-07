package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

type checkerFunc func(context.Context) error

func (fn checkerFunc) Check(ctx context.Context) error { return fn(ctx) }

func TestRouterPropagatesRequestIDToSuccessResponse(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/v1/health", nil)
	req.Header.Set("X-Request-ID", "request-123")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("X-Request-ID"); got != "request-123" {
		t.Errorf("X-Request-ID = %q, want request-123", got)
	}
	if got := rec.Body.String(); got != "{\"status\":\"ok\"}\n" {
		t.Errorf("body = %q, want health JSON", got)
	}
}

func TestRecoveryReturnsRequestIDErrorEnvelope(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	router.Handle("GET /panic", func(http.ResponseWriter, *http.Request) { panic("boom") })
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/panic", nil)
	req.Header.Set("X-Request-ID", "recover-123")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
	want := "{\"error\":{\"code\":\"INTERNAL\",\"message\":\"Внутренняя ошибка сервера\",\"request_id\":\"recover-123\"}}\n"
	if got := rec.Body.String(); got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestReadyReportsDependencyState(t *testing.T) {
	t.Run("healthy", func(t *testing.T) {
		rec := httptest.NewRecorder()
		NewRouter(checkerFunc(func(context.Context) error { return nil }), true).ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/v1/ready", nil))
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want 200", rec.Code)
		}
	})

	t.Run("unhealthy", func(t *testing.T) {
		rec := httptest.NewRecorder()
		NewRouter(checkerFunc(func(context.Context) error { return errors.New("database unavailable") }), true).ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/v1/ready", nil))
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503", rec.Code)
		}
		if got := rec.Body.String(); got == "" || !strings.Contains(got, "SERVICE_UNAVAILABLE") {
			t.Errorf("body = %q, want service-unavailable error envelope", got)
		}
	})
}

func TestReadyLimitsDependencyCheckDuration(t *testing.T) {
	var deadline time.Time
	checker := checkerFunc(func(ctx context.Context) error {
		var ok bool
		deadline, ok = ctx.Deadline()
		if !ok {
			t.Fatal("readiness checker context has no deadline")
		}
		return errors.New("database unavailable")
	})
	recorder := httptest.NewRecorder()

	NewRouter(checker, true).ServeHTTP(
		recorder,
		httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/api/v1/ready", nil),
	)

	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", recorder.Code)
	}
	remaining := time.Until(deadline)
	if remaining <= 0 || remaining > readinessTimeout {
		t.Errorf("readiness deadline remaining = %s, want within (0, %s]", remaining, readinessTimeout)
	}
}

func TestDomainEndpointsRequireDemoIdentityAndPropagateIt(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)

	t.Run("missing identity", func(t *testing.T) {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
		want := "{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Необходима demo-идентичность пользователя\",\"request_id\":"
		if got := rec.Body.String(); !strings.HasPrefix(got, want) {
			t.Errorf("body = %q, want unauthorized JSON error envelope", got)
		}
	})

	t.Run("valid identity reaches the domain stub", func(t *testing.T) {
		req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", nil)
		req.Header.Set("X-Demo-User-ID", "40000000-0000-4000-8000-000000000001")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotImplemented {
			t.Errorf("status = %d, want 501", rec.Code)
		}
		if got := rec.Body.String(); got == "" || !strings.Contains(got, "NOT_IMPLEMENTED") {
			t.Errorf("body = %q, want not-implemented error envelope", got)
		}
	})

	t.Run("valid identity is available to a protected handler", func(t *testing.T) {
		router.HandleDemo("GET /demo-probe", func(w http.ResponseWriter, r *http.Request) {
			userID, ok := DemoUserID(r.Context())
			if !ok {
				t.Fatal("demo identity missing from handler context")
			}
			_, _ = w.Write([]byte(userID))
		})
		req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/demo-probe", nil)
		req.Header.Set("X-Demo-User-ID", "40000000-0000-4000-8000-000000000001")
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if got := rec.Body.String(); got != "40000000-0000-4000-8000-000000000001" {
			t.Errorf("protected handler identity = %q, want demo user UUID", got)
		}
	})
}

func TestAllDeclaredDomainStubsReturnNotImplementedForAuthenticatedUser(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	paths := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/v1/products"},
		{http.MethodGet, "/api/v1/products/10000000-0000-4000-8000-000000000001"},
		{http.MethodGet, "/api/v1/products/10000000-0000-4000-8000-000000000001/alternatives"},
		{http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join"},
		{http.MethodGet, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/me"},
		{http.MethodDelete, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/me"},
		{http.MethodGet, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/events"},
		{http.MethodPost, "/api/v1/grants/50000000-0000-4000-8000-000000000001/checkout"},
		{http.MethodPost, "/api/v1/demo/grants/50000000-0000-4000-8000-000000000001/payment-result"},
	}

	for _, tc := range paths {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			req := httptest.NewRequestWithContext(context.Background(), tc.method, tc.path, nil)
			req.Header.Set("X-Demo-User-ID", "40000000-0000-4000-8000-000000000001")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)
			if rec.Code != http.StatusNotImplemented {
				t.Errorf("status = %d, want 501", rec.Code)
			}
		})
	}
}

func TestMetricsIsAvailableAtInternalMetricsPath(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/metrics", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/plain") {
		t.Errorf("Content-Type = %q, want Prometheus text format", got)
	}
}

func TestBusinessRoutesDoNotRequireDemoIdentityWhenDemoIsDisabled(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), false)
	t.Run("business route bypasses demo middleware", func(t *testing.T) {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", nil))
		if rec.Code != http.StatusNotImplemented {
			t.Errorf("status = %d, want 501 when demo middleware is disabled", rec.Code)
		}
	})

	t.Run("demo payment endpoint remains unavailable", func(t *testing.T) {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/api/v1/demo/grants/50000000-0000-4000-8000-000000000001/payment-result", nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", rec.Code)
		}
		if got := rec.Body.String(); !strings.Contains(got, "\"code\":\"NOT_FOUND\"") {
			t.Errorf("body = %q, want JSON not-found envelope", got)
		}
	})
}

func TestRouterReturnsJSONErrorEnvelopeForUnknownPathAndMethod(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	cases := []struct {
		name   string
		method string
		path   string
		status int
		code   string
	}{
		{"unknown path", http.MethodGet, "/api/v1/not-a-route", http.StatusNotFound, "NOT_FOUND"},
		{"wrong method", http.MethodPost, "/api/v1/health", http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(context.Background(), tc.method, tc.path, nil)
			req.Header.Set("X-Request-ID", "route-error-123")
			rec := httptest.NewRecorder()

			router.ServeHTTP(rec, req)

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			want := "{\"error\":{\"code\":\"" + tc.code + "\",\"message\":"
			if got := rec.Body.String(); !strings.HasPrefix(got, want) || !strings.Contains(got, "\"request_id\":\"route-error-123\"") {
				t.Errorf("body = %q, want JSON ErrorEnvelope with request ID", got)
			}
		})
	}
}

func TestRouterPreservesServeMuxRouteMetadata(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	var pattern string
	var pathValue string
	router.Handle("GET /route-metadata/{id}", func(writer http.ResponseWriter, request *http.Request) {
		pattern = request.Pattern
		pathValue = request.PathValue("id")
		writer.WriteHeader(http.StatusNoContent)
	})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/route-metadata/42", nil))

	if pattern != "GET /route-metadata/{id}" || pathValue != "42" {
		t.Errorf("route metadata = %q|%q, want pattern and path value", pattern, pathValue)
	}
}

func TestRouterPreservesStreamingFlusher(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	router.Handle("GET /stream", func(writer http.ResponseWriter, _ *http.Request) {
		flusher, ok := writer.(http.Flusher)
		if !ok {
			t.Error("response writer does not implement http.Flusher")
			return
		}
		_, _ = writer.Write([]byte("data: ready\n\n"))
		flusher.Flush()
	})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/stream", nil))

	if !recorder.Flushed {
		t.Error("underlying response writer was not flushed")
	}
	if got := recorder.Body.String(); got != "data: ready\n\n" {
		t.Errorf("stream body = %q, want SSE event", got)
	}
}

func TestRouterJSONMethodNotAllowedPreservesNativeAllowHeader(t *testing.T) {
	native := http.NewServeMux()
	native.HandleFunc("GET /allow/{id}", func(http.ResponseWriter, *http.Request) {})
	nativeRecorder := httptest.NewRecorder()
	native.ServeHTTP(nativeRecorder, httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/allow/42", nil))
	if got := nativeRecorder.Header().Get("Allow"); got != "GET, HEAD" {
		t.Fatalf("native ServeMux Allow = %q, want %q", got, "GET, HEAD")
	}

	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	router.Handle("GET /allow/{id}", func(http.ResponseWriter, *http.Request) {})
	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/allow/42", nil)
	request.Header.Set("X-Request-ID", "allow-123")

	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
	}
	if got := recorder.Header().Get("Allow"); got != "GET, HEAD" {
		t.Errorf("Allow = %q, want native ServeMux value %q", got, "GET, HEAD")
	}
	want := `{"error":{"code":"METHOD_NOT_ALLOWED","message":"Метод не поддерживается для этого маршрута","request_id":"allow-123"}}` + "\n"
	if got := recorder.Body.String(); got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
}

func TestRouterWritesStructuredAccessLogForEveryOutcome(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	router.Handle("GET /panic-for-access-log", func(http.ResponseWriter, *http.Request) { panic("boom") })
	requests := []struct {
		method string
		path   string
		status int
		demo   bool
	}{
		{http.MethodGet, "/api/v1/health", http.StatusOK, false},
		{http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", http.StatusUnauthorized, false},
		{http.MethodGet, "/missing", http.StatusNotFound, false},
		{http.MethodPost, "/api/v1/health", http.StatusMethodNotAllowed, false},
		{http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", http.StatusNotImplemented, true},
		{http.MethodGet, "/panic-for-access-log", http.StatusInternalServerError, false},
	}

	for index, tc := range requests {
		req := httptest.NewRequestWithContext(context.Background(), tc.method, tc.path, nil)
		req.Header.Set("X-Request-ID", "access-"+strconv.Itoa(index))
		if tc.demo {
			req.Header.Set("X-Demo-User-ID", "40000000-0000-4000-8000-000000000001")
		}
		rec := httptest.NewRecorder()

		router.ServeHTTP(rec, req)

		if rec.Code != tc.status {
			t.Errorf("request %d status = %d, want %d", index, rec.Code, tc.status)
		}
	}

	if strings.Contains(output.String(), "40000000-0000-4000-8000-000000000001") {
		t.Fatal("access log contains demo user data")
	}
	entries := accessLogEntries(t, output.String())
	if len(entries) != len(requests) {
		t.Fatalf("access log entries = %d, want %d; output = %s", len(entries), len(requests), output.String())
	}
	for index, entry := range entries {
		if got := entry["request_id"]; got != "access-"+strconv.Itoa(index) {
			t.Errorf("entry %d request_id = %v", index, got)
		}
		if got := entry["method"]; got != requests[index].method {
			t.Errorf("entry %d method = %v, want %s", index, got, requests[index].method)
		}
		if got := entry["path"]; got != requests[index].path {
			t.Errorf("entry %d path = %v, want %s", index, got, requests[index].path)
		}
		if got := entry["status"]; got != float64(requests[index].status) {
			t.Errorf("entry %d status = %v, want %d", index, got, requests[index].status)
		}
		if _, ok := entry["duration"]; !ok {
			t.Errorf("entry %d has no duration", index)
		}
		if got, ok := entry["bytes"].(float64); !ok || got <= 0 {
			t.Errorf("entry %d bytes = %v, want positive", index, entry["bytes"])
		}
	}
}

func TestRouterAccessLogRecordsFirstResponseStatus(t *testing.T) {
	var output bytes.Buffer
	previous := slog.Default()
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	t.Cleanup(func() { slog.SetDefault(previous) })

	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	router.Handle("GET /first-response-status", func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusCreated)
		writer.WriteHeader(http.StatusInternalServerError)
	})
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/first-response-status", nil))

	if recorder.Code != http.StatusCreated {
		t.Fatalf("response status = %d, want %d", recorder.Code, http.StatusCreated)
	}
	entries := accessLogEntries(t, output.String())
	if len(entries) != 1 {
		t.Fatalf("access log entries = %d, want 1; output = %s", len(entries), output.String())
	}
	if got := entries[0]["status"]; got != float64(http.StatusCreated) {
		t.Errorf("access log status = %v, want %d", got, http.StatusCreated)
	}
}

func accessLogEntries(t *testing.T, output string) []map[string]any {
	t.Helper()
	var entries []map[string]any
	for _, line := range strings.Split(strings.TrimSpace(output), "\n") {
		var entry map[string]any
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			t.Fatalf("unmarshal access log entry: %v", err)
		}
		if entry["msg"] == "http request" {
			entries = append(entries, entry)
		}
	}
	return entries
}
