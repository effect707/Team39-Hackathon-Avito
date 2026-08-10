package products

import "github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"

func RegisterRoutes(r *httpapi.Router, h *Handler) {
	r.Handle("GET /api/v1/products", h.List)
	r.Handle("GET /api/v1/products/{product_id}", h.Get)
	r.Handle("GET /api/v1/products/{product_id}/alternatives", h.Alternatives)
}
