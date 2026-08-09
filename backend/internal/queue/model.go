package queue

import (
	"time"

	"github.com/team39/avito-fair-queue/backend/internal/state"
)

type QueueEntry struct {
	ID        string    `gorm:"column:id;type:uuid;primaryKey"`
	ProductID string    `gorm:"column:product_id;type:uuid;index"`
	UserID    string    `gorm:"column:user_id;type:uuid;index"`
	TicketNo  int64     `gorm:"column:ticket_no"`
	Status    string    `gorm:"column:status"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (QueueEntry) TableName() string {
	return "queue_entries"
}

var activeStatuses = []string{
	state.EntryJoining,
	state.EntryWaiting,
	state.EntryGranted,
	state.EntryCheckoutPending,
	state.EntryError,
}

type GrantView struct {
	ID              string
	ProductID       string
	InventoryUnitID string
	UserID          string
	Status          string
	ExpiresAt       time.Time
}
