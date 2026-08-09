package allocation

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/platform/database"
	"github.com/team39/avito-fair-queue/backend/internal/products"
	"github.com/team39/avito-fair-queue/backend/internal/queue"
	"github.com/team39/avito-fair-queue/backend/internal/state"
)

const expireBatchSize = 50

type Service struct {
	db          *gorm.DB
	repo        *Repository
	productRepo *products.Repository
	queueRepo   *queue.Repository
	notifier    *events.Notifier
	ttl         time.Duration
}

func NewService(
	db *gorm.DB,
	repo *Repository,
	productRepo *products.Repository,
	queueRepo *queue.Repository,
	notifier *events.Notifier,
	ttl time.Duration,
) *Service {
	return &Service{
		db:          db,
		repo:        repo,
		productRepo: productRepo,
		queueRepo:   queueRepo,
		notifier:    notifier,
		ttl:         ttl,
	}
}

func (s *Service) Promote(ctx context.Context, tx *gorm.DB, productID string) error {
	for {
		entry, err := s.queueRepo.LockOldestWaiting(tx, productID)
		if err != nil {
			return err
		}
		if entry == nil {
			return nil
		}
		unit, err := s.repo.LockAvailableUnit(tx, productID)
		if err != nil {
			if errors.Is(err, ErrInventoryEmpty) {
				return nil
			}
			return err
		}
		now, err := database.Now(tx)
		if err != nil {
			return err
		}
		grant := &PurchaseGrant{
			ID:              uuid.NewString(),
			QueueEntryID:    entry.ID,
			ProductID:       productID,
			InventoryUnitID: unit.ID,
			UserID:          entry.UserID,
			Status:          state.GrantActive,
			ExpiresAt:       now.Add(s.ttl),
		}
		if err := s.repo.CreateGrant(tx, grant); err != nil {
			return err
		}
		if _, err := s.repo.MarkUnitReserved(tx, unit.ID, grant.ID); err != nil {
			return err
		}
		if ok, err := s.queueRepo.MarkEntryStatus(tx, entry.ID, state.EntryWaiting, state.EntryGranted); err != nil {
			return err
		} else if !ok {
			return ErrInvalidState
		}
		if err := s.notifier.Notify(tx, events.NewEvent(productID, entry.ID, now)); err != nil {
			return err
		}
	}
}

func (s *Service) ReleaseActiveGrant(ctx context.Context, tx *gorm.DB, productID, grantID string) error {
	grant, err := s.repo.LockGrantByID(tx, grantID)
	if err != nil {
		return err
	}
	if grant.Status != state.GrantActive {
		return ErrInvalidState
	}
	now, err := database.Now(tx)
	if err != nil {
		return err
	}
	if _, err := s.repo.UpdateGrantStatus(tx, grantID, state.GrantActive, state.GrantCancelled, &now); err != nil {
		return err
	}
	if _, err := s.repo.MarkUnitAvailable(tx, grant.InventoryUnitID); err != nil {
		return err
	}
	if err := s.notifier.Notify(tx, events.NewEvent(productID, grant.QueueEntryID, now)); err != nil {
		return err
	}
	return s.Promote(ctx, tx, productID)
}

func (s *Service) CompleteCheckoutPending(ctx context.Context, tx *gorm.DB, productID, grantID string, success bool) error {
	grant, err := s.repo.LockGrantByID(tx, grantID)
	if err != nil {
		return err
	}
	if grant.Status != state.GrantCheckoutPending {
		return ErrInvalidState
	}
	now, err := database.Now(tx)
	if err != nil {
		return err
	}
	if success {
		if _, err := s.repo.UpdateGrantStatus(tx, grantID, state.GrantCheckoutPending, state.GrantPurchased, &now); err != nil {
			return err
		}
		if _, err := s.repo.MarkUnitSold(tx, grant.InventoryUnitID); err != nil {
			return err
		}
		if _, err := s.queueRepo.MarkEntryStatus(tx, grant.QueueEntryID, state.EntryCheckoutPending, state.EntryPurchased); err != nil {
			return err
		}
		if err := s.notifier.Notify(tx, events.NewEvent(productID, grant.QueueEntryID, now)); err != nil {
			return err
		}
		return s.CloseQueueIfSoldOut(ctx, tx, productID)
	}
	if _, err := s.repo.UpdateGrantStatus(tx, grantID, state.GrantCheckoutPending, state.GrantFailed, &now); err != nil {
		return err
	}
	if _, err := s.repo.MarkUnitAvailable(tx, grant.InventoryUnitID); err != nil {
		return err
	}
	if _, err := s.queueRepo.MarkEntryStatus(tx, grant.QueueEntryID, state.EntryCheckoutPending, state.EntryPaymentFailed); err != nil {
		return err
	}
	if err := s.notifier.Notify(tx, events.NewEvent(productID, grant.QueueEntryID, now)); err != nil {
		return err
	}
	return s.Promote(ctx, tx, productID)
}

func (s *Service) CloseQueueIfSoldOut(ctx context.Context, tx *gorm.DB, productID string) error {
	summary, err := s.productRepo.CountInventory(tx, productID)
	if err != nil {
		return err
	}
	if summary.Total() == 0 || summary.Sold != summary.Total() {
		return nil
	}
	ids, err := s.queueRepo.ListWaitingIDs(tx, productID)
	if err != nil {
		return err
	}
	now, err := database.Now(tx)
	if err != nil {
		return err
	}
	for _, entryID := range ids {
		if _, err := s.queueRepo.MarkEntryStatus(tx, entryID, state.EntryWaiting, state.EntrySoldOut); err != nil {
			return err
		}
		if err := s.notifier.Notify(tx, events.NewEvent(productID, entryID, now)); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) ExpireExpiredGrants(ctx context.Context) (int, error) {
	expired := 0
	for {
		grants, err := s.repo.ExpiredActiveGrants(ctx, expireBatchSize)
		if err != nil {
			return expired, err
		}
		if len(grants) == 0 {
			return expired, nil
		}
		for _, grant := range grants {
			err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
				if _, err := s.productRepo.LockByID(tx, grant.ProductID); err != nil {
					return err
				}
				current, err := s.repo.LockGrantByID(tx, grant.ID)
				if err != nil {
					return err
				}
				now, err := database.Now(tx)
				if err != nil {
					return err
				}
				if current.Status != state.GrantActive || !current.ExpiresAt.Before(now) {
					return nil
				}
				if _, err := s.repo.UpdateGrantStatus(tx, current.ID, state.GrantActive, state.GrantExpired, &now); err != nil {
					return err
				}
				if _, err := s.repo.MarkUnitAvailable(tx, current.InventoryUnitID); err != nil {
					return err
				}
				if _, err := s.queueRepo.MarkEntryStatus(tx, current.QueueEntryID, state.EntryGranted, state.EntryExpired); err != nil {
					return err
				}
				if err := s.notifier.Notify(tx, events.NewEvent(current.ProductID, current.QueueEntryID, now)); err != nil {
					return err
				}
				if err := s.Promote(ctx, tx, current.ProductID); err != nil {
					return err
				}
				expired++
				return nil
			})
			if err != nil {
				return expired, err
			}
		}
	}
}
