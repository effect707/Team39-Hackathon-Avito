package checkout

import "github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"

func RegisterRoutes(r *httpapi.Router, h *Handler) {
	r.HandleAuth("POST /api/v1/grants/{grant_id}/checkout", h.StartCheckout)
	r.HandleAuth("POST /api/v1/grants/{grant_id}/payment-result", h.SubmitPaymentResult)
}
