package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

type Checker interface {
	Check(context.Context) error
}

type Router struct {
	mux         *http.ServeMux
	demoEnabled bool
}

type contextKey string

const demoUserIDKey contextKey = "demo-user-id"

func NewRouter(checker Checker, demoEnabled bool) *Router {
	router := &Router{mux: http.NewServeMux(), demoEnabled: demoEnabled}
	router.Handle("GET /api/v1/health", healthHandler)
	router.Handle("GET /api/v1/ready", readyHandler(checker))
	router.mux.Handle("GET /metrics", promhttp.Handler())
	router.Handle("GET /api/v1/products", notImplemented)
	router.Handle("GET /api/v1/products/{product_id}", notImplemented)
	router.Handle("GET /api/v1/products/{product_id}/alternatives", notImplemented)
	router.HandleDemo("POST /api/v1/products/{product_id}/queue/join", notImplemented)
	router.HandleDemo("GET /api/v1/products/{product_id}/queue/me", notImplemented)
	router.HandleDemo("DELETE /api/v1/products/{product_id}/queue/me", notImplemented)
	router.HandleDemo("GET /api/v1/products/{product_id}/queue/events", notImplemented)
	router.HandleDemo("POST /api/v1/grants/{grant_id}/checkout", notImplemented)
	if demoEnabled {
		router.HandleDemo("POST /api/v1/demo/grants/{grant_id}/payment-result", notImplemented)
	} else {
		router.Handle("POST /api/v1/demo/grants/{grant_id}/payment-result", notFound)
	}
	return router
}

func (router *Router) Handle(pattern string, handler http.HandlerFunc) {
	router.mux.HandleFunc(pattern, handler)
}

func (router *Router) HandleDemo(pattern string, handler http.HandlerFunc) {
	if router.demoEnabled {
		router.mux.Handle(pattern, demoAuth(handler))
		return
	}
	router.mux.HandleFunc(pattern, handler)
}

func (router *Router) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	accessLog(requestID(http.HandlerFunc(router.recoverPanic))).ServeHTTP(writer, request)
}

func (router *Router) recoverPanic(writer http.ResponseWriter, request *http.Request) {
	defer func() {
		if recovered := recover(); recovered != nil {
			slog.Error("panic while serving request", "request_id", RequestID(request.Context()), "panic", recovered)
			writeError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
		}
	}()
	router.dispatch(writer, request)
}

func (router *Router) dispatch(writer http.ResponseWriter, request *http.Request) {
	handler, pattern := router.mux.Handler(request)
	if pattern == "" {
		if router.matchesAnyMethod(request) {
			writeError(writer, request, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", "Метод не поддерживается для этого маршрута")
			return
		}
		writeError(writer, request, http.StatusNotFound, "NOT_FOUND", "Маршрут не найден")
		return
	}
	handler.ServeHTTP(writer, request)
}

func (router *Router) matchesAnyMethod(request *http.Request) bool {
	for _, method := range []string{
		http.MethodGet,
		http.MethodHead,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
		http.MethodConnect,
		http.MethodOptions,
	} {
		candidate := request.Clone(request.Context())
		candidate.Method = method
		if _, pattern := router.mux.Handler(candidate); pattern != "" {
			return true
		}
	}
	return false
}

func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		requestID := request.Header.Get("X-Request-ID")
		if requestID == "" {
			requestID = newRequestID()
		}
		writer.Header().Set("X-Request-ID", requestID)
		next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), requestIDKey, requestID)))
	})
}

type loggingResponseWriter struct {
	http.ResponseWriter
	status      int
	bytes       int
	wroteHeader bool
}

func (writer *loggingResponseWriter) WriteHeader(status int) {
	if writer.wroteHeader {
		return
	}
	writer.wroteHeader = true
	writer.status = status
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *loggingResponseWriter) Write(body []byte) (int, error) {
	if !writer.wroteHeader {
		writer.wroteHeader = true
	}
	bytes, err := writer.ResponseWriter.Write(body)
	writer.bytes += bytes
	return bytes, err
}

func accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		recorded := &loggingResponseWriter{ResponseWriter: writer, status: http.StatusOK}
		next.ServeHTTP(recorded, request)
		slog.Info(
			"http request",
			"request_id", recorded.Header().Get("X-Request-ID"),
			"method", request.Method,
			"path", request.URL.Path,
			"status", recorded.status,
			"duration", time.Since(started),
			"bytes", recorded.bytes,
		)
	})
}

const requestIDKey contextKey = "request-id"

func RequestID(ctx context.Context) string {
	requestID, _ := ctx.Value(requestIDKey).(string)
	return requestID
}

func newRequestID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return uuid.NewString()
	}
	return hex.EncodeToString(bytes)
}

func healthHandler(writer http.ResponseWriter, _ *http.Request) {
	writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
}

func readyHandler(checker Checker) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		if checker == nil || checker.Check(request.Context()) != nil {
			writeError(writer, request, http.StatusServiceUnavailable, "SERVICE_UNAVAILABLE", "Сервис временно недоступен")
			return
		}
		writeJSON(writer, http.StatusOK, map[string]string{"status": "ok"})
	}
}

func demoAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		userID := request.Header.Get("X-Demo-User-ID")
		if _, err := uuid.Parse(userID); err != nil {
			writeError(writer, request, http.StatusUnauthorized, "UNAUTHORIZED", "Необходима demo-идентичность пользователя")
			return
		}
		next.ServeHTTP(writer, request.WithContext(context.WithValue(request.Context(), demoUserIDKey, userID)))
	})
}

func DemoUserID(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(demoUserIDKey).(string)
	return userID, ok
}

func notImplemented(writer http.ResponseWriter, request *http.Request) {
	writeError(writer, request, http.StatusNotImplemented, "NOT_IMPLEMENTED", "Маршрут ещё не реализован")
}

func notFound(writer http.ResponseWriter, request *http.Request) {
	writeError(writer, request, http.StatusNotFound, "NOT_FOUND", "Маршрут недоступен")
}

func writeError(writer http.ResponseWriter, request *http.Request, status int, code, message string) {
	writeJSON(writer, status, map[string]map[string]string{"error": {
		"code":       code,
		"message":    message,
		"request_id": RequestID(request.Context()),
	}})
}

func writeJSON(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}
