package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

type checkerFunc func(context.Context) error

func (fn checkerFunc) Check(ctx context.Context) error { return fn(ctx) }

func TestRouterPropagatesRequestIDToSuccessResponse(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/health", nil)
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
	req := httptest.NewRequest(http.MethodGet, "/panic", nil)
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
		NewRouter(checkerFunc(func(context.Context) error { return nil }), true).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/ready", nil))
		if rec.Code != http.StatusOK {
			t.Errorf("status = %d, want 200", rec.Code)
		}
	})

	t.Run("unhealthy", func(t *testing.T) {
		rec := httptest.NewRecorder()
		NewRouter(checkerFunc(func(context.Context) error { return errors.New("database unavailable") }), true).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/ready", nil))
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("status = %d, want 503", rec.Code)
		}
		if got := rec.Body.String(); got == "" || !strings.Contains(got, "SERVICE_UNAVAILABLE") {
			t.Errorf("body = %q, want service-unavailable error envelope", got)
		}
	})
}

func TestDomainEndpointsRequireDemoIdentityAndPropagateIt(t *testing.T) {
	router := NewRouter(checkerFunc(func(context.Context) error { return nil }), true)

	t.Run("missing identity", func(t *testing.T) {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", nil))
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("status = %d, want 401", rec.Code)
		}
		want := "{\"error\":{\"code\":\"UNAUTHORIZED\",\"message\":\"Необходима demo-идентичность пользователя\",\"request_id\":"
		if got := rec.Body.String(); !strings.HasPrefix(got, want) {
			t.Errorf("body = %q, want unauthorized JSON error envelope", got)
		}
	})

	t.Run("valid identity reaches the domain stub", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/v1/products/10000000-0000-4000-8000-000000000001/queue/join", nil)
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
		req := httptest.NewRequest(http.MethodGet, "/demo-probe", nil)
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
			req := httptest.NewRequest(tc.method, tc.path, nil)
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

	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", rec.Code)
	}
	if got := rec.Header().Get("Content-Type"); !strings.HasPrefix(got, "text/plain") {
		t.Errorf("Content-Type = %q, want Prometheus text format", got)
	}
}
