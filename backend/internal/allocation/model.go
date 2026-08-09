package allocation

import "time"

type InventoryUnit struct {
	ID             string    `gorm:"column:id;type:uuid;primaryKey"`
	ProductID      string    `gorm:"column:product_id;type:uuid;index"`
	Status         string    `gorm:"column:status"`
	CurrentGrantID *string   `gorm:"column:current_grant_id"`
	CreatedAt      time.Time `gorm:"column:created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at"`
}

func (InventoryUnit) TableName() string {
	return "inventory_units"
}

type PurchaseGrant struct {
	ID              string     `gorm:"column:id;type:uuid;primaryKey"`
	QueueEntryID    string     `gorm:"column:queue_entry_id;type:uuid"`
	ProductID       string     `gorm:"column:product_id;type:uuid"`
	InventoryUnitID string     `gorm:"column:inventory_unit_id;type:uuid"`
	UserID          string     `gorm:"column:user_id;type:uuid"`
	Status          string     `gorm:"column:status"`
	ExpiresAt       time.Time  `gorm:"column:expires_at"`
	ConsumedAt      *time.Time `gorm:"column:consumed_at"`
	CreatedAt       time.Time  `gorm:"column:created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at"`
}

func (PurchaseGrant) TableName() string {
	return "purchase_grants"
}
