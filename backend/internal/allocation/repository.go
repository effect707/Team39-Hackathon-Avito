package allocation

import (
	"context"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/team39/avito-fair-queue/backend/internal/state"
)

var (
	ErrGrantNotFound  = errors.New("grant not found")
	ErrInvalidState   = errors.New("grant is in an invalid state")
	ErrInventoryEmpty = errors.New("no available inventory unit")
	ErrNoWaitingEntry = errors.New("no waiting entry")
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) LockAvailableUnit(tx *gorm.DB, productID string) (*InventoryUnit, error) {
	var unit InventoryUnit
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("product_id = ? AND status = ? AND current_grant_id IS NULL", productID, state.UnitAvailable).
		Order("id").
		First(&unit).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInventoryEmpty
	}
	if err != nil {
		return nil, fmt.Errorf("lock available unit product %s: %w", productID, err)
	}
	return &unit, nil
}

func (r *Repository) LockUnitByID(tx *gorm.DB, unitID string) (*InventoryUnit, error) {
	var unit InventoryUnit
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", unitID).
		First(&unit).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("lock unit %s: %w", unitID, err)
	}
	if err != nil {
		return nil, fmt.Errorf("lock unit %s: %w", unitID, err)
	}
	return &unit, nil
}

func (r *Repository) LockGrantByID(tx *gorm.DB, grantID string) (*PurchaseGrant, error) {
	var grant PurchaseGrant
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

func (r *Repository) GetGrantByID(db *gorm.DB, grantID string) (*PurchaseGrant, error) {
	var grant PurchaseGrant
	err := db.Where("id = ?", grantID).First(&grant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrGrantNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get grant %s: %w", grantID, err)
	}
	return &grant, nil
}

func (r *Repository) CreateGrant(tx *gorm.DB, grant *PurchaseGrant) error {
	if err := tx.Create(grant).Error; err != nil {
		return fmt.Errorf("create grant: %w", err)
	}
	return nil
}

func (r *Repository) UpdateGrantStatus(tx *gorm.DB, grantID, from, to string, consumedAt *time.Time) (bool, error) {
	updates := map[string]any{"status": to}
	if consumedAt != nil {
		updates["consumed_at"] = consumedAt
	}
	result := tx.Model(&PurchaseGrant{}).
		Where("id = ? AND status = ?", grantID, from).
		Updates(updates)
	if result.Error != nil {
		return false, fmt.Errorf("update grant %s %s -> %s: %w", grantID, from, to, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *Repository) MarkUnitReserved(tx *gorm.DB, unitID, grantID string) (bool, error) {
	result := tx.Model(&InventoryUnit{}).
		Where("id = ? AND status = ? AND current_grant_id IS NULL", unitID, state.UnitAvailable).
		Updates(map[string]any{"status": state.UnitReserved, "current_grant_id": grantID})
	if result.Error != nil {
		return false, fmt.Errorf("reserve unit %s: %w", unitID, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *Repository) MarkUnitAvailable(tx *gorm.DB, unitID string) (bool, error) {
	result := tx.Model(&InventoryUnit{}).
		Where("id = ? AND status = ?", unitID, state.UnitReserved).
		Updates(map[string]any{"status": state.UnitAvailable, "current_grant_id": nil})
	if result.Error != nil {
		return false, fmt.Errorf("release unit %s: %w", unitID, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *Repository) MarkUnitSold(tx *gorm.DB, unitID string) (bool, error) {
	result := tx.Model(&InventoryUnit{}).
		Where("id = ? AND status = ?", unitID, state.UnitReserved).
		Update("status", state.UnitSold)
	if result.Error != nil {
		return false, fmt.Errorf("mark unit %s sold: %w", unitID, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *Repository) ExpiredActiveGrants(ctx context.Context, limit int) ([]PurchaseGrant, error) {
	var grants []PurchaseGrant
	err := r.db.WithContext(ctx).
		Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Where("status = ? AND expires_at <= now()", state.GrantActive).
		Order("expires_at").
		Limit(limit).
		Find(&grants).Error
	if err != nil {
		return nil, fmt.Errorf("select expired active grants: %w", err)
	}
	return grants, nil
}
