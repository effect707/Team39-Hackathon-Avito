package checkout

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/google/uuid"

	"github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) StartCheckout(writer http.ResponseWriter, request *http.Request) {
	userID, ok := httpapi.DemoUserID(request.Context())
	if !ok {
		httpapi.WriteError(writer, request, http.StatusUnauthorized, "UNAUTHORIZED", "Необходима demo-идентичность пользователя")
		return
	}
	grantID, ok := grantIDParam(writer, request)
	if !ok {
		return
	}
	grant, err := h.service.StartCheckout(request.Context(), grantID, userID)
	if h.writeGrantError(writer, request, err) {
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, map[string]any{"grant": grantResponse(grant)})
}

func (h *Handler) SubmitPaymentResult(writer http.ResponseWriter, request *http.Request) {
	userID, ok := httpapi.DemoUserID(request.Context())
	if !ok {
		httpapi.WriteError(writer, request, http.StatusUnauthorized, "UNAUTHORIZED", "Необходима demo-идентичность пользователя")
		return
	}
	grantID, ok := grantIDParam(writer, request)
	if !ok {
		return
	}
	var body struct {
		IdempotencyKey string `json:"idempotency_key"`
		Result         string `json:"result"`
	}
	decoder := json.NewDecoder(request.Body)
	if err := decoder.Decode(&body); err != nil {
		httpapi.WriteError(writer, request, http.StatusBadRequest, "INVALID_REQUEST", "Некорректное тело запроса")
		return
	}
	if _, err := uuid.Parse(body.IdempotencyKey); err != nil {
		httpapi.WriteError(writer, request, http.StatusBadRequest, "INVALID_REQUEST", "Некорректный idempotency_key")
		return
	}
	if !validPaymentResult(body.Result) {
		httpapi.WriteError(writer, request, http.StatusBadRequest, "INVALID_REQUEST", "Некорректный результат оплаты")
		return
	}
	result, err := h.service.SubmitPaymentResult(request.Context(), grantID, userID, body.IdempotencyKey, body.Result)
	if h.writeGrantError(writer, request, err) {
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, map[string]any{
		"grant":             grantResponse(result.Grant),
		"idempotency_key":   result.IdempotencyKey,
		"already_processed": result.AlreadyProcessed,
	})
}

func (h *Handler) writeGrantError(writer http.ResponseWriter, request *http.Request, err error) bool {
	if err == nil {
		return false
	}
	switch {
	case errors.Is(err, ErrGrantForbidden), errors.Is(err, ErrGrantNotFound):
		httpapi.WriteError(writer, request, http.StatusNotFound, "GRANT_NOT_FOUND", "Право не найдено или недоступно")
	case errors.Is(err, ErrGrantExpired):
		httpapi.WriteError(writer, request, http.StatusConflict, "GRANT_EXPIRED", "Время на покупку истекло")
	case errors.Is(err, ErrGrantAlreadyUsed):
		httpapi.WriteError(writer, request, http.StatusConflict, "GRANT_ALREADY_USED", "Право уже использовано")
	case errors.Is(err, ErrInvalidState):
		httpapi.WriteError(writer, request, http.StatusConflict, "INVALID_STATE", "Операция невозможна в текущем состоянии")
	default:
		httpapi.WriteError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
	}
	return true
}

func grantIDParam(writer http.ResponseWriter, request *http.Request) (string, bool) {
	raw := request.PathValue("grant_id")
	if _, err := uuid.Parse(raw); err != nil {
		httpapi.WriteError(writer, request, http.StatusBadRequest, "INVALID_REQUEST", "Некорректный идентификатор права")
		return "", false
	}
	return raw, true
}

func validPaymentResult(result string) bool {
	switch result {
	case "success", "failure", "timeout":
		return true
	default:
		return false
	}
}

func grantResponse(grant *GrantView) map[string]any {
	return map[string]any{
		"id":                grant.ID,
		"product_id":        grant.ProductID,
		"inventory_unit_id": grant.InventoryUnitID,
		"status":            grant.Status,
		"expires_at":        grant.ExpiresAt,
	}
}
