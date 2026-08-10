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
	if got.MetricsAddress != ":9090" {
		t.Errorf("MetricsAddress = %q, want :9090", got.MetricsAddress)
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
	if len(got.CORSAllowedOrigins) != 1 || got.CORSAllowedOrigins[0] != "http://localhost:5173" {
		t.Errorf("CORSAllowedOrigins = %v, want [http://localhost:5173]", got.CORSAllowedOrigins)
	}
}

func TestLoadRejectsInvalidConfiguration(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("WORKER_INTERVAL", "not-a-duration")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want validation error")
	}
}

func TestLoadRejectsEmptyDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want DATABASE_URL required error")
	}
}

func TestLoadRejectsNonPositiveGrantTTL(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://queue:queue@localhost:5432/queue?sslmode=disable")
	t.Setenv("GRANT_TTL", "0s")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want GRANT_TTL > 0 validation error")
	}
}

func TestLoadRejectsNonPositiveWorkerInterval(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://queue:queue@localhost:5432/queue?sslmode=disable")
	t.Setenv("WORKER_INTERVAL", "-1s")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want WORKER_INTERVAL > 0 validation error")
	}
}

func TestLoadRejectsIdleConnsAboveOpenConns(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://queue:queue@localhost:5432/queue?sslmode=disable")
	t.Setenv("DB_MAX_OPEN_CONNS", "5")
	t.Setenv("DB_MAX_IDLE_CONNS", "10")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want idle <= open validation error")
	}
}

func TestLoadOverridesEveryField(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://custom@db.example:5433/custom?sslmode=disable")
	t.Setenv("HTTP_ADDRESS", ":9090")
	t.Setenv("METRICS_ADDRESS", ":9091")
	t.Setenv("DEMO_MODE", "false")
	t.Setenv("WORKER_INTERVAL", "5s")
	t.Setenv("GRANT_TTL", "90s")
	t.Setenv("DB_MAX_OPEN_CONNS", "30")
	t.Setenv("DB_MAX_IDLE_CONNS", "7")
	t.Setenv("DB_CONN_MAX_LIFETIME", "10m")
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")

	got, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if got.HTTPAddress != ":9090" {
		t.Errorf("HTTPAddress = %q, want :9090", got.HTTPAddress)
	}
	if got.MetricsAddress != ":9091" {
		t.Errorf("MetricsAddress = %q, want :9091", got.MetricsAddress)
	}
	if got.DatabaseURL != "postgres://custom@db.example:5433/custom?sslmode=disable" {
		t.Errorf("DatabaseURL = %q, want custom URL", got.DatabaseURL)
	}
	if got.DemoEnabled {
		t.Error("DemoEnabled = true, want false")
	}
	if got.WorkerInterval != 5*time.Second {
		t.Errorf("WorkerInterval = %s, want 5s", got.WorkerInterval)
	}
	if got.GrantTTL != 90*time.Second {
		t.Errorf("GrantTTL = %s, want 90s", got.GrantTTL)
	}
	if got.DBMaxOpenConns != 30 {
		t.Errorf("DBMaxOpenConns = %d, want 30", got.DBMaxOpenConns)
	}
	if got.DBMaxIdleConns != 7 {
		t.Errorf("DBMaxIdleConns = %d, want 7", got.DBMaxIdleConns)
	}
	if got.DBConnMaxLifetime != 10*time.Minute {
		t.Errorf("DBConnMaxLifetime = %s, want 10m", got.DBConnMaxLifetime)
	}
	wantOrigins := []string{"http://localhost:5173", "http://127.0.0.1:5173"}
	if len(got.CORSAllowedOrigins) != len(wantOrigins) {
		t.Fatalf("CORSAllowedOrigins = %v, want %v", got.CORSAllowedOrigins, wantOrigins)
	}
	for index, origin := range wantOrigins {
		if got.CORSAllowedOrigins[index] != origin {
			t.Errorf("CORSAllowedOrigins[%d] = %q, want %q", index, got.CORSAllowedOrigins[index], origin)
		}
	}
}

func TestLoadRejectsSharedHTTPAndMetricsAddress(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://queue:queue@localhost:5432/queue?sslmode=disable")
	t.Setenv("HTTP_ADDRESS", ":8080")
	t.Setenv("METRICS_ADDRESS", ":8080")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil, want distinct listener validation error")
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
