package events

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"
)

const heartbeatInterval = 15 * time.Second

type Handler struct {
	hub *Hub
}

func NewHandler(hub *Hub) *Handler {
	return &Handler{hub: hub}
}

func (h *Handler) Stream(writer http.ResponseWriter, request *http.Request) {
	flusher, ok := writer.(http.Flusher)
	if !ok {
		httpapi.WriteError(writer, request, http.StatusInternalServerError, "INTERNAL", "SSE недоступен")
		return
	}
	productID := request.PathValue("product_id")
	subscriber := h.hub.Subscribe(productID)
	defer h.hub.Unsubscribe(productID, subscriber)

	writer.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	writer.Header().Set("Cache-Control", "no-cache")
	writer.Header().Set("X-Accel-Buffering", "no")
	writer.Header().Set("Connection", "keep-alive")

	heartbeat := time.NewTicker(heartbeatInterval)
	defer heartbeat.Stop()
	for {
		select {
		case <-request.Context().Done():
			return
		case event := <-subscriber:
			if err := writeSSE(writer, event); err != nil {
				return
			}
			flusher.Flush()
		case <-heartbeat.C:
			if _, err := io.WriteString(writer, ": ping\n\n"); err != nil {
				return
			}
			flusher.Flush()
		}
	}
}

func writeSSE(writer io.Writer, event Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal sse event: %w", err)
	}
	if _, err := fmt.Fprintf(writer, "event: %s\ndata: %s\n\n", SSEEventName, payload); err != nil {
		return err
	}
	return nil
}
