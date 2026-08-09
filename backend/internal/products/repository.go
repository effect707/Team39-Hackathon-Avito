package products

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrNotFound = errors.New("product not found")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListActive() ([]Product, error) {
	var products []Product
	err := r.db.
		Where("lifecycle_status = ?", LifecycleActive).
		Order("created_at, id").
		Find(&products).Error
	if err != nil {
		return nil, fmt.Errorf("list active products: %w", err)
	}
	return products, nil
}

func (r *Repository) GetByID(productID string) (*Product, error) {
	var product Product
	err := r.db.Where("id = ?", productID).First(&product).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get product %s: %w", productID, err)
	}
	return &product, nil
}

func (r *Repository) LockByID(tx *gorm.DB, productID string) (*Product, error) {
	var product Product
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", productID).First(&product).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock product %s: %w", productID, err)
	}
	return &product, nil
}

func (r *Repository) CountInventory(tx *gorm.DB, productID string) (InventorySummary, error) {
	var counts []struct {
		Status string
		Count  int64
	}
	err := tx.Table("inventory_units").
		Select("status, count(*) AS count").
		Where("product_id = ?", productID).
		Group("status").
		Scan(&counts).Error
	if err != nil {
		return InventorySummary{}, fmt.Errorf("count inventory product %s: %w", productID, err)
	}
	var summary InventorySummary
	for _, count := range counts {
		switch count.Status {
		case "AVAILABLE":
			summary.Available = count.Count
		case "RESERVED":
			summary.Reserved = count.Count
		case "SOLD":
			summary.Sold = count.Count
		}
	}
	return summary, nil
}

func (r *Repository) IncrementNextTicket(tx *gorm.DB, productID string) error {
	result := tx.Model(&Product{}).
		Where("id = ?", productID).
		Update("next_ticket", gorm.Expr("next_ticket + 1"))
	if result.Error != nil {
		return fmt.Errorf("increment next ticket product %s: %w", productID, result.Error)
	}
	if result.RowsAffected != 1 {
		return ErrNotFound
	}
	return nil
}

func (r *Repository) FindAlternatives(productID string, category string, price string, limit int) ([]Product, error) {
	var products []Product
	err := r.db.
		Where("lifecycle_status = ? AND category = ? AND id <> ?", LifecycleActive, category, productID).
		Order(gorm.Expr("abs(price - CAST(? AS numeric)), id", price)).
		Limit(limit).
		Find(&products).Error
	if err != nil {
		return nil, fmt.Errorf("find alternatives for %s: %w", productID, err)
	}
	return products, nil
}
