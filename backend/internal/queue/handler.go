package queue

import (
	"errors"
	"net/http"

	"github.com/google/uuid"

	"github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"
	"github.com/team39/avito-fair-queue/backend/internal/products"
)

type Handler struct {
	service *Service
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) Join(writer http.ResponseWriter, request *http.Request) {
	userID, productID, ok := h.identityAndProduct(writer, request)
	if !ok {
		return
	}
	queueState, err := h.service.JoinQueue(request.Context(), userID, productID)
	if h.writeStateError(writer, request, err) {
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, stateResponse(queueState))
}

func (h *Handler) GetMe(writer http.ResponseWriter, request *http.Request) {
	userID, productID, ok := h.identityAndProduct(writer, request)
	if !ok {
		return
	}
	queueState, err := h.service.GetQueueStatus(request.Context(), userID, productID)
	if h.writeStateError(writer, request, err) {
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, stateResponse(queueState))
}

func (h *Handler) Leave(writer http.ResponseWriter, request *http.Request) {
	userID, productID, ok := h.identityAndProduct(writer, request)
	if !ok {
		return
	}
	queueState, err := h.service.LeaveQueue(request.Context(), userID, productID)
	if h.writeStateError(writer, request, err) {
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, stateResponse(queueState))
}

func (h *Handler) identityAndProduct(writer http.ResponseWriter, request *http.Request) (string, string, bool) {
	userID, ok := httpapi.DemoUserID(request.Context())
	if !ok {
		httpapi.WriteError(writer, request, http.StatusUnauthorized, "UNAUTHORIZED", "Необходима demo-идентичность пользователя")
		return "", "", false
	}
	raw := request.PathValue("product_id")
	if _, err := uuid.Parse(raw); err != nil {
		httpapi.WriteError(writer, request, http.StatusBadRequest, "INVALID_REQUEST", "Некорректный идентификатор товара")
		return "", "", false
	}
	return userID, raw, true
}

func (h *Handler) writeStateError(writer http.ResponseWriter, request *http.Request, err error) bool {
	if err == nil {
		return false
	}
	switch {
	case errors.Is(err, products.ErrNotFound):
		httpapi.WriteError(writer, request, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Товар не найден")
	case errors.Is(err, ErrEntryNotFound):
		httpapi.WriteError(writer, request, http.StatusNotFound, "QUEUE_ENTRY_NOT_FOUND", "Заявка не найдена")
	case errors.Is(err, ErrSoldOut):
		httpapi.WriteError(writer, request, http.StatusConflict, "PRODUCT_SOLD_OUT", "Товар закончился")
	case errors.Is(err, ErrQueueRequired):
		httpapi.WriteError(writer, request, http.StatusConflict, "QUEUE_REQUIRED", "Для этого товара очередь не требуется")
	case errors.Is(err, ErrInvalidState):
		httpapi.WriteError(writer, request, http.StatusConflict, "INVALID_STATE", "Операция невозможна в текущем состоянии")
	default:
		httpapi.WriteError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
	}
	return true
}

func stateResponse(queueState *State) map[string]any {
	var grant any
	if queueState.Grant != nil {
		grant = map[string]any{
			"id":                queueState.Grant.ID,
			"product_id":        queueState.Grant.ProductID,
			"inventory_unit_id": queueState.Grant.InventoryUnitID,
			"status":            queueState.Grant.Status,
			"expires_at":        queueState.Grant.ExpiresAt,
		}
	}
	return map[string]any{
		"queue_entry_id": queueState.EntryID,
		"product_id":     queueState.ProductID,
		"ticket_no":      queueState.TicketNo,
		"status":         queueState.Status,
		"position":       queueState.Position,
		"message":        queueState.Message,
		"next_action":    queueState.NextAction,
		"grant":          grant,
	}
}
