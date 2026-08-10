package checkout

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"
)

func TestPaymentResultRouteIsDemoOnly(t *testing.T) {
	const demoPath = "/api/v1/demo/grants/50000000-0000-4000-8000-000000000001/payment-result"
	const publicPath = "/api/v1/grants/50000000-0000-4000-8000-000000000001/payment-result"

	t.Run("uses the demo prefix and requires demo identity", func(t *testing.T) {
		router := httpapi.NewRouter(nil, true)
		RegisterRoutes(router, &Handler{})

		demoResponse := httptest.NewRecorder()
		router.ServeHTTP(demoResponse, httptest.NewRequestWithContext(context.Background(), http.MethodPost, demoPath, nil))
		if demoResponse.Code != http.StatusUnauthorized {
			t.Fatalf("demo route status = %d, want 401", demoResponse.Code)
		}

		publicResponse := httptest.NewRecorder()
		router.ServeHTTP(publicResponse, httptest.NewRequestWithContext(context.Background(), http.MethodPost, publicPath, nil))
		if publicResponse.Code != http.StatusNotFound {
			t.Fatalf("public route status = %d, want 404", publicResponse.Code)
		}
	})

	t.Run("is unavailable when demo mode is disabled", func(t *testing.T) {
		router := httpapi.NewRouter(nil, false)
		RegisterRoutes(router, &Handler{})
		request := httptest.NewRequestWithContext(context.Background(), http.MethodPost, demoPath, nil)
		request.Header.Set("X-Demo-User-ID", "40000000-0000-4000-8000-000000000001")
		response := httptest.NewRecorder()

		router.ServeHTTP(response, request)

		if response.Code != http.StatusNotFound {
			t.Fatalf("disabled demo route status = %d, want 404", response.Code)
		}
	})
}
