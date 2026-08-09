package events

import "sync"

type Hub struct {
	mu          sync.RWMutex
	subscribers map[string]map[chan Event]struct{}
}

func NewHub() *Hub {
	return &Hub{subscribers: make(map[string]map[chan Event]struct{})}
}

func (h *Hub) Subscribe(productID string) chan Event {
	channel := make(chan Event, 16)
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.subscribers[productID] == nil {
		h.subscribers[productID] = make(map[chan Event]struct{})
	}
	h.subscribers[productID][channel] = struct{}{}
	return channel
}

func (h *Hub) Unsubscribe(productID string, channel chan Event) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.subscribers[productID], channel)
	if len(h.subscribers[productID]) == 0 {
		delete(h.subscribers, productID)
	}
}

func (h *Hub) Publish(event Event) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for channel := range h.subscribers[event.ProductID] {
		select {
		case channel <- event:
		default:
		}
	}
}
