package queue

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/products"
	"github.com/team39/avito-fair-queue/backend/internal/state"
)

var (
	ErrProductNotFound = errors.New("product not found")
	ErrSoldOut         = errors.New("product is sold out")
	ErrQueueRequired   = errors.New("queue is disabled for this product")
	ErrInvalidState    = errors.New("queue entry is in an invalid state")
)

type Allocation interface {
	Promote(ctx context.Context, tx *gorm.DB, productID string) error
	ReleaseActiveGrant(ctx context.Context, tx *gorm.DB, productID, grantID string) error
}

type Service struct {
	db          *gorm.DB
	repo        *Repository
	productRepo *products.Repository
	allocation  Allocation
	notifier    *events.Notifier
}

func NewService(db *gorm.DB, repo *Repository, productRepo *products.Repository, allocation Allocation, notifier *events.Notifier) *Service {
	return &Service{
		db:          db,
		repo:        repo,
		productRepo: productRepo,
		allocation:  allocation,
		notifier:    notifier,
	}
}

type State struct {
	EntryID    string
	ProductID  string
	TicketNo   int64
	Status     string
	Position   *int64
	Message    string
	NextAction string
	Grant      *GrantView
}

func (s *Service) JoinQueue(ctx context.Context, userID, productID string) (*State, error) {
	existing, err := s.repo.GetActiveEntry(s.db.WithContext(ctx), productID, userID)
	if err == nil {
		return s.buildState(ctx, existing)
	}
	if !errors.Is(err, ErrEntryNotFound) {
		return nil, err
	}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		product, err := s.productRepo.LockByID(tx, productID)
		if err != nil {
			return err
		}
		if product.LifecycleStatus != products.LifecycleActive {
			return ErrSoldOut
		}
		if !product.QueueEnabled {
			return ErrQueueRequired
		}
		summary, err := s.productRepo.CountInventory(tx, productID)
		if err != nil {
			return err
		}
		if summary.Total() > 0 && summary.Sold == summary.Total() {
			return ErrSoldOut
		}
		if _, err := s.repo.GetActiveEntry(tx, productID, userID); err == nil {
			return nil
		} else if !errors.Is(err, ErrEntryNotFound) {
			return err
		}
		entry := &QueueEntry{
			ID:        uuid.NewString(),
			ProductID: productID,
			UserID:    userID,
			TicketNo:  product.NextTicket,
			Status:    state.EntryWaiting,
		}
		if err := s.repo.CreateEntry(tx, entry); err != nil {
			return err
		}
		if err := s.productRepo.IncrementNextTicket(tx, productID); err != nil {
			return err
		}
		if err := s.allocation.Promote(ctx, tx, productID); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("join queue: %w", err)
	}
	entry, err := s.repo.GetLatestEntry(s.db.WithContext(ctx), productID, userID)
	if err != nil {
		return nil, err
	}
	return s.buildState(ctx, entry)
}

func (s *Service) GetQueueStatus(ctx context.Context, userID, productID string) (*State, error) {
	entry, err := s.repo.GetLatestEntry(s.db.WithContext(ctx), productID, userID)
	if err != nil {
		return nil, err
	}
	return s.buildState(ctx, entry)
}

func (s *Service) LeaveQueue(ctx context.Context, userID, productID string) (*State, error) {
	entry, err := s.repo.GetActiveEntry(s.db.WithContext(ctx), productID, userID)
	if err != nil {
		return nil, err
	}
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := s.productRepo.LockByID(tx, productID); err != nil {
			return err
		}
		current, err := s.repo.LockEntryByID(tx, entry.ID)
		if err != nil {
			return err
		}
		switch current.Status {
		case state.EntryWaiting:
			ok, err := s.repo.MarkEntryStatus(tx, entry.ID, state.EntryWaiting, state.EntryCancelled)
			if err != nil {
				return err
			}
			if !ok {
				return ErrInvalidState
			}
			return nil
		case state.EntryGranted:
			grant, err := s.repo.GetGrantByEntryID(tx, entry.ID)
			if err != nil {
				return err
			}
			if err := s.allocation.ReleaseActiveGrant(ctx, tx, productID, grant.ID); err != nil {
				return err
			}
			ok, err := s.repo.MarkEntryStatus(tx, entry.ID, state.EntryGranted, state.EntryCancelled)
			if err != nil {
				return err
			}
			if !ok {
				return ErrInvalidState
			}
			return nil
		default:
			return ErrInvalidState
		}
	})
	if err != nil {
		return nil, fmt.Errorf("leave queue: %w", err)
	}
	entry.Status = state.EntryCancelled
	return s.buildState(ctx, entry)
}

func (s *Service) buildState(ctx context.Context, entry *QueueEntry) (*State, error) {
	queueState := &State{
		EntryID:   entry.ID,
		ProductID: entry.ProductID,
		TicketNo:  entry.TicketNo,
		Status:    entry.Status,
	}
	switch entry.Status {
	case state.EntryWaiting:
		earlier, err := s.repo.CountEarlierWaiting(s.db.WithContext(ctx), entry.ProductID, entry.TicketNo)
		if err != nil {
			return nil, err
		}
		position := earlier + 1
		queueState.Position = &position
	case state.EntryGranted, state.EntryCheckoutPending:
		grant, err := s.repo.GetGrantByEntryID(s.db.WithContext(ctx), entry.ID)
		if err != nil && !errors.Is(err, ErrEntryNotFound) {
			return nil, err
		}
		queueState.Grant = grant
	}
	queueState.Message, queueState.NextAction = messageFor(queueState)
	return queueState, nil
}
