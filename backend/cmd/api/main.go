package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/team39/avito-fair-queue/backend/internal/allocation"
	"github.com/team39/avito-fair-queue/backend/internal/checkout"
	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/platform/config"
	"github.com/team39/avito-fair-queue/backend/internal/platform/database"
	"github.com/team39/avito-fair-queue/backend/internal/platform/httpapi"
	"github.com/team39/avito-fair-queue/backend/internal/platform/server"
	"github.com/team39/avito-fair-queue/backend/internal/products"
	"github.com/team39/avito-fair-queue/backend/internal/queue"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api stopped", "error", err)
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
	hub := events.NewHub()

	productRepo := products.NewRepository(db)
	productService := products.NewService(productRepo)
	productHandler := products.NewHandler(productService)

	queueRepo := queue.NewRepository(db)
	allocationRepo := allocation.NewRepository(db)
	allocationService := allocation.NewService(db, allocationRepo, productRepo, queueRepo, notifier, config.GrantTTL)
	queueService := queue.NewService(db, queueRepo, productRepo, allocationService, notifier)
	queueHandler := queue.NewHandler(queueService)

	checkoutRepo := checkout.NewRepository(db)
	checkoutService := checkout.NewService(db, checkoutRepo, queueRepo, productRepo, allocationService, notifier)
	checkoutHandler := checkout.NewHandler(checkoutService)

	eventsHandler := events.NewHandler(hub)

	router := httpapi.NewRouter(database.Checker{DB: db}).WithCORS(config.CORSAllowedOrigins)
	products.RegisterRoutes(router, productHandler)
	queue.RegisterRoutes(router, queueHandler)
	events.RegisterRoutes(router, eventsHandler)
	checkout.RegisterRoutes(router, checkoutHandler)

	listener := events.NewListener(config.DatabaseURL, hub)
	go listener.Run(ctx)

	slog.Info("api started", "address", config.HTTPAddress)
	return server.Run(ctx, config.HTTPAddress, router)
}
