package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/golang-migrate/migrate/v4"
	postgresmigration "github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/team39/avito-fair-queue/backend/internal/platform/config"
	migrationfiles "github.com/team39/avito-fair-queue/backend/migrations"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		slog.Error("migration command failed", "error", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) != 1 {
		return fmt.Errorf("usage: migrate <up|version|seed>")
	}
	config, err := config.Load()
	if err != nil {
		return err
	}
	db, err := sql.Open("pgx", config.DatabaseURL)
	if err != nil {
		return fmt.Errorf("open database: %w", err)
	}
	defer func() { _ = db.Close() }()
	switch args[0] {
	case "up":
		return up(db)
	case "version":
		return version(db)
	case "seed":
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_, err := db.ExecContext(ctx, string(migrationfiles.SeedSQL))
		return err
	default:
		return fmt.Errorf("usage: migrate <up|version|seed>")
	}
}

func newMigrator(db *sql.DB) (*migrate.Migrate, error) {
	source, err := iofs.New(migrationfiles.Files, ".")
	if err != nil {
		return nil, fmt.Errorf("load embedded migrations: %w", err)
	}
	driver, err := postgresmigration.WithInstance(db, &postgresmigration.Config{})
	if err != nil {
		return nil, fmt.Errorf("create migration database driver: %w", err)
	}
	migrator, err := migrate.NewWithInstance("iofs", source, "postgres", driver)
	if err != nil {
		return nil, fmt.Errorf("create migrator: %w", err)
	}
	return migrator, nil
}

func up(db *sql.DB) error {
	migrator, err := newMigrator(db)
	if err != nil {
		return err
	}
	defer func() { _, _ = migrator.Close() }()
	if err := migrator.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}

func version(db *sql.DB) error {
	migrator, err := newMigrator(db)
	if err != nil {
		return err
	}
	defer func() { _, _ = migrator.Close() }()
	current, dirty, err := migrator.Version()
	if errors.Is(err, migrate.ErrNilVersion) {
		fmt.Println("version: none dirty: false")
		return nil
	}
	if err != nil {
		return fmt.Errorf("read migration version: %w", err)
	}
	fmt.Printf("version: %d dirty: %t\n", current, dirty)
	return nil
}
