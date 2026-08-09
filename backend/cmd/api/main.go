package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/team39/avito-fair-queue/backend/internal/events"
	"github.com/team39/avito-fair-queue/backend/internal/handlers"
	"github.com/team39/avito-fair-queue/backend/internal/platform/config"
	"github.com/team39/avito-fair-queue/backend/internal/platform/database"
	"github.com/team39/avito-fair-queue/backend/internal/platform/server"
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

	app := handlers.New(handlers.Deps{
		DB:       db,
		GrantTTL: config.GrantTTL,
	})

	listener := events.NewListener(config.DatabaseURL, app.Hub)
	go listener.Run(ctx)

	slog.Info("api started", "address", config.HTTPAddress)
	return server.Run(ctx, config.HTTPAddress, app.Router)
}
