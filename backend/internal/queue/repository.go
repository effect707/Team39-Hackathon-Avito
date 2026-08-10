package queue

import (
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/team39/avito-fair-queue/backend/internal/state"
)

var ErrEntryNotFound = errors.New("queue entry not found")

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) GetActiveEntry(db *gorm.DB, productID, userID string) (*QueueEntry, error) {
	var entry QueueEntry
	err := db.
		Where("product_id = ? AND user_id = ? AND status IN ?", productID, userID, activeStatuses).
		Order("created_at DESC").
		First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrEntryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get active entry user %s product %s: %w", userID, productID, err)
	}
	return &entry, nil
}

func (r *Repository) GetLatestEntry(db *gorm.DB, productID, userID string) (*QueueEntry, error) {
	var entry QueueEntry
	err := db.
		Where("product_id = ? AND user_id = ?", productID, userID).
		Order("created_at DESC").
		First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrEntryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get latest entry user %s product %s: %w", userID, productID, err)
	}
	return &entry, nil
}

func (r *Repository) LockOldestWaiting(tx *gorm.DB, productID string) (*QueueEntry, error) {
	var entry QueueEntry
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("product_id = ? AND status = ?", productID, state.EntryWaiting).
		Order("ticket_no").
		First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("lock oldest waiting product %s: %w", productID, err)
	}
	return &entry, nil
}

func (r *Repository) LockEntryByID(tx *gorm.DB, entryID string) (*QueueEntry, error) {
	var entry QueueEntry
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ?", entryID).
		First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrEntryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("lock entry %s: %w", entryID, err)
	}
	return &entry, nil
}

func (r *Repository) CreateEntry(tx *gorm.DB, entry *QueueEntry) error {
	if err := tx.Create(entry).Error; err != nil {
		return fmt.Errorf("create queue entry: %w", err)
	}
	return nil
}

func (r *Repository) MarkEntryStatus(tx *gorm.DB, entryID, from, to string) (bool, error) {
	result := tx.Model(&QueueEntry{}).
		Where("id = ? AND status = ?", entryID, from).
		Update("status", to)
	if result.Error != nil {
		return false, fmt.Errorf("mark entry %s %s -> %s: %w", entryID, from, to, result.Error)
	}
	return result.RowsAffected == 1, nil
}

func (r *Repository) CountEarlierWaiting(db *gorm.DB, productID string, ticketNo int64) (int64, error) {
	var count int64
	err := db.Model(&QueueEntry{}).
		Where("product_id = ? AND status = ? AND ticket_no < ?", productID, state.EntryWaiting, ticketNo).
		Count(&count).Error
	if err != nil {
		return 0, fmt.Errorf("count earlier waiting product %s ticket %d: %w", productID, ticketNo, err)
	}
	return count, nil
}

func (r *Repository) ListWaitingIDs(tx *gorm.DB, productID string) ([]string, error) {
	var ids []string
	err := tx.Model(&QueueEntry{}).
		Where("product_id = ? AND status = ?", productID, state.EntryWaiting).
		Order("ticket_no").
		Pluck("id", &ids).Error
	if err != nil {
		return nil, fmt.Errorf("list waiting ids product %s: %w", productID, err)
	}
	return ids, nil
}

func (r *Repository) GetGrantByEntryID(db *gorm.DB, entryID string) (*GrantView, error) {
	var grant GrantView
	err := db.Table("purchase_grants").
		Select("id, product_id, inventory_unit_id, user_id, status, expires_at").
		Where("queue_entry_id = ?", entryID).
		Order("created_at DESC").
		First(&grant).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrEntryNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get grant for entry %s: %w", entryID, err)
	}
	return &grant, nil
}
