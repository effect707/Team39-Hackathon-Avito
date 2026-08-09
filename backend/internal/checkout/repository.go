package checkout

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/team39/avito-fair-queue/backend/internal/allocation"
)

var (
	ErrGrantNotFound   = errors.New("grant not found")
	ErrAttemptNotFound = errors.New("checkout attempt not found")
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) LockGrantByID(tx *gorm.DB, grantID string) (*allocation.PurchaseGrant, error) {
	var grant allocation.PurchaseGrant
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", grantID).
		First(&grant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrGrantNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock grant %s: %w", grantID, err)
	}
	return &grant, nil
}

func (r *Repository) GetGrantByID(db *gorm.DB, grantID string) (*allocation.PurchaseGrant, error) {
	var grant allocation.PurchaseGrant
	err := db.Where("id = ?", grantID).First(&grant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrGrantNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get grant %s: %w", grantID, err)
	}
	return &grant, nil
}

func (r *Repository) UpdateGrantStatus(tx *gorm.DB, grantID, from, to string, consumedAt *time.Time) (bool, error) {
	updates := map[string]any{"status": to}
	if consumedAt != nil {
		updates["consumed_at"] = consumedAt
	}
	result := tx.Model(&allocation.PurchaseGrant{}).
		Where("id = ? AND status = ?", grantID, from).
		Updates(updates)
	if result.Error != nil {
		return false, fmt.Errorf("update grant %s %s -> %s: %w", grantID, from, to, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *Repository) GetAttemptByKey(db *gorm.DB, idempotencyKey string) (*CheckoutAttempt, error) {
	var attempt CheckoutAttempt
	err := db.Where("idempotency_key = ?", idempotencyKey).First(&attempt).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrAttemptNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get checkout attempt %s: %w", idempotencyKey, err)
	}
	return &attempt, nil
}

func (r *Repository) CreateAttempt(tx *gorm.DB, attempt *CheckoutAttempt) (bool, error) {
	result := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "idempotency_key"}},
		DoNothing: true,
	}).Create(attempt)
	if result.Error != nil {
		return false, fmt.Errorf("create checkout attempt: %w", result.Error)
	}
	return result.RowsAffected == 1, nil
}
