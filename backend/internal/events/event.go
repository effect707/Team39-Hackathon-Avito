package events

import "time"

const (
	Channel      = "queue_changes"
	SSEEventName = "queue.changed"
)

type Event struct {
	ProductID    string    `json:"product_id"`
	QueueEntryID string    `json:"queue_entry_id"`
	OccurredAt   time.Time `json:"occurred_at"`
}

func NewEvent(productID, queueEntryID string, occurredAt time.Time) Event {
	return Event{
		ProductID:    productID,
		QueueEntryID: queueEntryID,
		OccurredAt:   occurredAt,
	}
}
