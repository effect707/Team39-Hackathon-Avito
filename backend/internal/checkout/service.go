package checkout

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/team39/avito-fair-queue/backend/internal/allocation"
	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/platform/database"
	"github.com/team39/avito-fair-queue/backend/internal/products"
	"github.com/team39/avito-fair-queue/backend/internal/queue"
	"github.com/team39/avito-fair-queue/backend/internal/state"
)

var (
	ErrGrantForbidden   = errors.New("grant does not belong to the user")
	ErrGrantExpired     = errors.New("grant has expired")
	ErrGrantAlreadyUsed = errors.New("grant has already been used")
	ErrInvalidState     = errors.New("grant is in an invalid state")
)

type Service struct {
	db          *gorm.DB
	repo        *Repository
	queueRepo   *queue.Repository
	productRepo *products.Repository
	allocation  *allocation.Service
	notifier    *events.Notifier
}

func NewService(
	db *gorm.DB,
	repo *Repository,
	queueRepo *queue.Repository,
	productRepo *products.Repository,
	allocation *allocation.Service,
	notifier *events.Notifier,
) *Service {
	return &Service{
		db:          db,
		repo:        repo,
		queueRepo:   queueRepo,
		productRepo: productRepo,
		allocation:  allocation,
		notifier:    notifier,
	}
}

type PaymentResult struct {
	Grant            *GrantView
	IdempotencyKey   string
	AlreadyProcessed bool
}

func (s *Service) StartCheckout(ctx context.Context, grantID, userID string) (*GrantView, error) {
	var view *GrantView
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		grant, err := s.repo.LockGrantByID(tx, grantID)
		if err != nil {
			return err
		}
		if grant.UserID != userID {
			return ErrGrantForbidden
		}
		if grant.Status != state.GrantActive {
			return ErrGrantAlreadyUsed
		}
		now, err := database.Now(tx)
		if err != nil {
			return err
		}
		if !grant.ExpiresAt.After(now) {
			return ErrGrantExpired
		}
		entry, err := s.queueRepo.LockEntryByID(tx, grant.QueueEntryID)
		if err != nil {
			return err
		}
		if entry.Status != state.EntryGranted {
			return ErrGrantAlreadyUsed
		}
		if _, err := s.repo.UpdateGrantStatus(tx, grantID, state.GrantActive, state.GrantCheckoutPending, &now); err != nil {
			return err
		}
		if ok, err := s.queueRepo.MarkEntryStatus(tx, entry.ID, state.EntryGranted, state.EntryCheckoutPending); err != nil {
			return err
		} else if !ok {
			return ErrInvalidState
		}
		if err := s.notifier.Notify(tx, events.NewEvent(grant.ProductID, grant.QueueEntryID, now)); err != nil {
			return err
		}
		view = &GrantView{
			ID:              grant.ID,
			ProductID:       grant.ProductID,
			InventoryUnitID: grant.InventoryUnitID,
			UserID:          grant.UserID,
			Status:          state.GrantCheckoutPending,
			ExpiresAt:       grant.ExpiresAt,
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("start checkout: %w", err)
	}
	return view, nil
}

func (s *Service) SubmitPaymentResult(ctx context.Context, grantID, userID, idempotencyKey, result string) (*PaymentResult, error) {
	var outcome *PaymentResult
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		stored, err := s.repo.GetAttemptByKey(tx, idempotencyKey)
		if err == nil {
			if stored.GrantID != grantID {
				return ErrGrantNotFound
			}
			grant, err := s.repo.GetGrantByID(tx, stored.GrantID)
			if err != nil {
				return err
			}
			outcome = &PaymentResult{Grant: grantView(grant), IdempotencyKey: idempotencyKey, AlreadyProcessed: true}
			return nil
		}
		if !errors.Is(err, ErrAttemptNotFound) {
			return err
		}
		grant, err := s.repo.GetGrantByID(tx, grantID)
		if err != nil {
			return err
		}
		if grant.UserID != userID {
			return ErrGrantForbidden
		}
		if _, err := s.productRepo.LockByID(tx, grant.ProductID); err != nil {
			return err
		}
		current, err := s.repo.LockGrantByID(tx, grantID)
		if err != nil {
			return err
		}
		if current.Status != state.GrantCheckoutPending {
			return ErrGrantAlreadyUsed
		}
		attempt := &CheckoutAttempt{
			ID:             uuid.NewString(),
			GrantID:        grantID,
			IdempotencyKey: idempotencyKey,
			PaymentResult:  result,
		}
		created, err := s.repo.CreateAttempt(tx, attempt)
		if err != nil {
			return err
		}
		if !created {
			stored, err := s.repo.GetAttemptByKey(tx, idempotencyKey)
			if err != nil {
				return err
			}
			if stored.GrantID != grantID {
				return ErrGrantNotFound
			}
			outcome = &PaymentResult{Grant: grantView(current), IdempotencyKey: idempotencyKey, AlreadyProcessed: true}
			return nil
		}
		if err := s.allocation.CompleteCheckoutPending(ctx, tx, grant.ProductID, grantID, result == "success"); err != nil {
			return err
		}
		final, err := s.repo.GetGrantByID(tx, grantID)
		if err != nil {
			return err
		}
		outcome = &PaymentResult{Grant: grantView(final), IdempotencyKey: idempotencyKey}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("submit payment result: %w", err)
	}
	return outcome, nil
}

func grantView(grant *allocation.PurchaseGrant) *GrantView {
	return &GrantView{
		ID:              grant.ID,
		ProductID:       grant.ProductID,
		InventoryUnitID: grant.InventoryUnitID,
		UserID:          grant.UserID,
		Status:          grant.Status,
		ExpiresAt:       grant.ExpiresAt,
	}
}
