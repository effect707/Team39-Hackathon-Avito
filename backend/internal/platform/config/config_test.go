package config

import (
	"testing"
	"time"
)

func TestLoadUsesSafeDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://queue:queue@localhost:5432/queue?sslmode=disable")

	got, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if got.HTTPAddress != ":8080" {
		t.Errorf("HTTPAddress = %q, want :8080", got.HTTPAddress)
	}
	if !got.DemoEnabled {
		t.Error("DemoEnabled = false, want true")
	}
	if got.WorkerInterval != 30*time.Second {
		t.Errorf("WorkerInterval = %s, want 30s", got.WorkerInterval)
	}
	if got.DBMaxOpenConns != 20 {
		t.Errorf("DBMaxOpenConns = %d, want 20", got.DBMaxOpenConns)
	}
}

func TestLoadRejectsInvalidConfiguration(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("WORKER_INTERVAL", "not-a-duration")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want validation error")
	}
}

func TestLoadDisablesDemoMiddleware(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://queue:queue@localhost:5432/queue?sslmode=disable")
	t.Setenv("DEMO_MODE", "false")

	got, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got.DemoEnabled {
		t.Fatal("DemoEnabled = true, want false")
	}
}
