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
	mux *http.ServeMux
}

type contextKey string

const demoUserIDKey contextKey = "demo-user-id"
const readinessTimeout = 2 * time.Second

func NewRouter(checker Checker) *Router {
	router := &Router{mux: http.NewServeMux()}
	router.Handle("GET /api/v1/health", healthHandler)
	router.Handle("GET /api/v1/ready", readyHandler(checker))
	router.mux.Handle("GET /metrics", promhttp.Handler())
	return router
}

func (router *Router) Handle(pattern string, handler http.HandlerFunc) {
	router.mux.HandleFunc(pattern, handler)
}

func (router *Router) HandleAuth(pattern string, handler http.HandlerFunc) {
	router.mux.Handle(pattern, demoAuth(handler))
}

func (router *Router) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	requestID(accessLog(http.HandlerFunc(router.recoverPanic))).ServeHTTP(writer, request)
}

func (router *Router) recoverPanic(writer http.ResponseWriter, request *http.Request) {
	defer func() {
		if recovered := recover(); recovered != nil {
			slog.Error("panic while serving request", "request_id", RequestID(request.Context()), "panic", recovered)
			writeError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
		}
	}()
	router.mux.ServeHTTP(writer, request)
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
	request     *http.Request
	replaced    bool
}

func (writer *loggingResponseWriter) WriteHeader(status int) {
	if writer.wroteHeader {
		return
	}
	writer.wroteHeader = true
	writer.status = status
	if writer.request.Pattern == "" {
		switch status {
		case http.StatusNotFound:
			writer.writeRouteError("NOT_FOUND", "Маршрут не найден")
			return
		case http.StatusMethodNotAllowed:
			writer.writeRouteError("METHOD_NOT_ALLOWED", "Метод не поддерживается для этого маршрута")
			return
		}
	}
	writer.ResponseWriter.WriteHeader(status)
}

func (writer *loggingResponseWriter) Write(body []byte) (int, error) {
	if writer.replaced {
		return len(body), nil
	}
	if !writer.wroteHeader {
		writer.wroteHeader = true
	}
	bytes, err := writer.ResponseWriter.Write(body)
	writer.bytes += bytes
	return bytes, err
}

func (writer *loggingResponseWriter) Unwrap() http.ResponseWriter {
	return writer.ResponseWriter
}

func (writer *loggingResponseWriter) Flush() {
	if !writer.wroteHeader {
		writer.wroteHeader = true
	}
	_ = http.NewResponseController(writer.ResponseWriter).Flush()
}

func (writer *loggingResponseWriter) writeRouteError(code, message string) {
	writer.replaced = true
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.ResponseWriter.WriteHeader(writer.status)
	body, err := json.Marshal(errorEnvelope(writer.request, code, message))
	if err != nil {
		return
	}
	body = append(body, '\n')
	written, _ := writer.ResponseWriter.Write(body)
	writer.bytes += written
}

func accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		started := time.Now()
		recorded := &loggingResponseWriter{ResponseWriter: writer, status: http.StatusOK, request: request}
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
		ctx, cancel := context.WithTimeout(request.Context(), readinessTimeout)
		defer cancel()
		if checker == nil || checker.Check(ctx) != nil {
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

func WriteError(writer http.ResponseWriter, request *http.Request, status int, code, message string) {
	writeError(writer, request, status, code, message)
}

func WriteJSON(writer http.ResponseWriter, status int, body any) {
	writeJSON(writer, status, body)
}

func writeError(writer http.ResponseWriter, request *http.Request, status int, code, message string) {
	writeJSON(writer, status, errorEnvelope(request, code, message))
}

func errorEnvelope(request *http.Request, code, message string) map[string]map[string]string {
	return map[string]map[string]string{"error": {
		"code":       code,
		"message":    message,
		"request_id": RequestID(request.Context()),
	}}
}

func writeJSON(writer http.ResponseWriter, status int, body any) {
	writer.Header().Set("Content-Type", "application/json; charset=utf-8")
	writer.WriteHeader(status)
	_ = json.NewEncoder(writer).Encode(body)
}
