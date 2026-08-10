package queue

import "github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"

func RegisterRoutes(r *httpapi.Router, h *Handler) {
	r.HandleAuth("POST /api/v1/products/{product_id}/queue/join", h.Join)
	r.HandleAuth("GET /api/v1/products/{product_id}/queue/me", h.GetMe)
	r.HandleAuth("DELETE /api/v1/products/{product_id}/queue/me", h.Leave)
}
