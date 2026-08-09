package events

import (
	"encoding/json"
	"fmt"

	"gorm.io/gorm"
)

type Notifier struct {
	channel string
}

func NewNotifier() *Notifier {
	return &Notifier{channel: Channel}
}

func (n *Notifier) Notify(tx *gorm.DB, event Event) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("marshal queue event: %w", err)
	}
	if err := tx.Exec("SELECT pg_notify($1, $2)", n.channel, string(payload)).Error; err != nil {
		return fmt.Errorf("notify queue event: %w", err)
	}
	return nil
}
