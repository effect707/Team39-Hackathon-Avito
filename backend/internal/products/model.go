package products

import (
	"fmt"
	"strconv"
	"time"
)

const (
	LifecycleActive  = "ACTIVE"
	LifecycleSoldOut = "SOLD_OUT"
	LifecycleRemoved = "REMOVED"
)

type Decimal string

func (decimal *Decimal) Scan(value any) error {
	if value == nil {
		*decimal = ""
		return nil
	}
	switch raw := value.(type) {
	case []byte:
		*decimal = Decimal(string(raw))
	case string:
		*decimal = Decimal(raw)
	case int64:
		*decimal = Decimal(strconv.FormatInt(raw, 10) + ".00")
	case float64:
		*decimal = Decimal(fmt.Sprintf("%.2f", raw))
	default:
		return fmt.Errorf("unsupported decimal value %T", value)
	}
	return nil
}

type Product struct {
	ID              string    `gorm:"column:id;type:uuid;primaryKey"`
	Title           string    `gorm:"column:title"`
	Category        string    `gorm:"column:category"`
	Price           Decimal   `gorm:"column:price;type:numeric"`
	ImageURL        *string   `gorm:"column:image_url"`
	QueueEnabled    bool      `gorm:"column:queue_enabled"`
	LifecycleStatus string    `gorm:"column:lifecycle_status"`
	NextTicket      int64     `gorm:"column:next_ticket"`
	CreatedAt       time.Time `gorm:"column:created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at"`
}

func (Product) TableName() string {
	return "products"
}

type InventorySummary struct {
	Available int64
	Reserved  int64
	Sold      int64
}

func (summary InventorySummary) Total() int64 {
	return summary.Available + summary.Reserved + summary.Sold
}
