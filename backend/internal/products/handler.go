package products

import (
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

func (h *Handler) List(writer http.ResponseWriter, request *http.Request) {
	views, err := h.service.List(request.Context())
	if err != nil {
		httpapi.WriteError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, map[string]any{"products": productViews(views)})
}

func (h *Handler) Get(writer http.ResponseWriter, request *http.Request) {
	productID, ok := productIDParam(writer, request)
	if !ok {
		return
	}
	view, err := h.service.Get(request.Context(), productID)
	if errors.Is(err, ErrNotFound) {
		httpapi.WriteError(writer, request, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Товар не найден")
		return
	}
	if err != nil {
		httpapi.WriteError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, productView(*view))
}

func (h *Handler) Alternatives(writer http.ResponseWriter, request *http.Request) {
	productID, ok := productIDParam(writer, request)
	if !ok {
		return
	}
	views, err := h.service.Alternatives(request.Context(), productID)
	if errors.Is(err, ErrNotFound) {
		httpapi.WriteError(writer, request, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Товар не найден")
		return
	}
	if err != nil {
		httpapi.WriteError(writer, request, http.StatusInternalServerError, "INTERNAL", "Внутренняя ошибка сервера")
		return
	}
	httpapi.WriteJSON(writer, http.StatusOK, map[string]any{"products": productViews(views)})
}

func productIDParam(writer http.ResponseWriter, request *http.Request) (string, bool) {
	raw := request.PathValue("product_id")
	if _, err := uuid.Parse(raw); err != nil {
		httpapi.WriteError(writer, request, http.StatusBadRequest, "INVALID_REQUEST", "Некорректный идентификатор товара")
		return "", false
	}
	return raw, true
}

type productResponse struct {
	ID              string            `json:"id"`
	Title           string            `json:"title"`
	Category        string            `json:"category"`
	Price           string            `json:"price"`
	ImageURL        *string           `json:"image_url"`
	QueueEnabled    bool              `json:"queue_enabled"`
	LifecycleStatus string            `json:"lifecycle_status"`
	Inventory       inventoryResponse `json:"inventory"`
}

type inventoryResponse struct {
	Available int64 `json:"available"`
	Reserved  int64 `json:"reserved"`
	Sold      int64 `json:"sold"`
}

func productViews(views []View) []productResponse {
	products := make([]productResponse, 0, len(views))
	for _, view := range views {
		products = append(products, productView(view))
	}
	return products
}

func productView(view View) productResponse {
	return productResponse{
		ID:              view.ID,
		Title:           view.Title,
		Category:        view.Category,
		Price:           string(view.Price),
		ImageURL:        view.ImageURL,
		QueueEnabled:    view.QueueEnabled,
		LifecycleStatus: view.LifecycleStatus,
		Inventory: inventoryResponse{
			Available: view.Inventory.Available,
			Reserved:  view.Inventory.Reserved,
			Sold:      view.Inventory.Sold,
		},
	}
}
