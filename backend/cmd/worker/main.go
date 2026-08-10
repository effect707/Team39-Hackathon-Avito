package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/team39/avito-fair-queue/backend/internal/allocation"
	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/platform/config"
	"github.com/team39/avito-fair-queue/backend/internal/platform/database"
	"github.com/team39/avito-fair-queue/backend/internal/platform/worker"
	"github.com/team39/avito-fair-queue/backend/internal/products"
	"github.com/team39/avito-fair-queue/backend/internal/queue"
)

func main() {
	if err := run(); err != nil {
		slog.Error("worker stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	config, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	db, err := database.Open(ctx, config)
	if err != nil {
		return err
	}
	defer func() { _ = database.Close(db) }()

	notifier := events.NewNotifier()
	allocationService := allocation.NewService(
		db,
		allocation.NewRepository(db),
		products.NewRepository(db),
		queue.NewRepository(db),
		notifier,
		config.GrantTTL,
	)

	slog.Info("worker started", "interval", config.WorkerInterval)
	return worker.Run(ctx, config.WorkerInterval, func(ctx context.Context) error {
		expired, err := allocationService.ExpireExpiredGrants(ctx)
		if err != nil {
			return err
		}
		if expired > 0 {
			slog.Info("expired grants", "count", expired)
		}
		return nil
	})
}
