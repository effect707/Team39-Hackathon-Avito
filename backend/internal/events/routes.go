package events

import "github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"

func RegisterRoutes(r *httpapi.Router, h *Handler) {
	r.HandleAuth("GET /api/v1/products/{product_id}/queue/events", h.Stream)
}
