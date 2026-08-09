package checkout

import "time"

type CheckoutAttempt struct {
	ID             string    `gorm:"column:id;type:uuid;primaryKey"`
	GrantID        string    `gorm:"column:grant_id;type:uuid"`
	IdempotencyKey string    `gorm:"column:idempotency_key;type:uuid"`
	PaymentResult  string    `gorm:"column:payment_result"`
	ProcessedAt    time.Time `gorm:"column:processed_at"`
	CreatedAt      time.Time `gorm:"column:created_at"`
}

func (CheckoutAttempt) TableName() string {
	return "checkout_attempts"
}

type GrantView struct {
	ID              string
	ProductID       string
	InventoryUnitID string
	UserID          string
	Status          string
	ExpiresAt       time.Time
}
