package config

import (
	"fmt"
	"time"

	"github.com/caarlos0/env/v11"
)

type Config struct {
	HTTPAddress        string        `env:"HTTP_ADDRESS,notEmpty" envDefault:":8080"`
	MetricsAddress     string        `env:"METRICS_ADDRESS,notEmpty" envDefault:":9090"`
	DatabaseURL        string        `env:"DATABASE_URL,required,notEmpty"`
	DemoEnabled        bool          `env:"DEMO_MODE" envDefault:"true"`
	WorkerInterval     time.Duration `env:"WORKER_INTERVAL" envDefault:"30s"`
	GrantTTL           time.Duration `env:"GRANT_TTL" envDefault:"2m"`
	DBMaxOpenConns     int           `env:"DB_MAX_OPEN_CONNS" envDefault:"20"`
	DBMaxIdleConns     int           `env:"DB_MAX_IDLE_CONNS" envDefault:"10"`
	DBConnMaxLifetime  time.Duration `env:"DB_CONN_MAX_LIFETIME" envDefault:"5m"`
	CORSAllowedOrigins []string      `env:"CORS_ALLOWED_ORIGINS" envDefault:"http://localhost:5173"`
}

func Load() (Config, error) {
	var cfg Config
	if err := env.Parse(&cfg); err != nil {
		return Config{}, fmt.Errorf("parse environment: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func (cfg Config) validate() error {
	switch {
	case cfg.WorkerInterval <= 0:
		return fmt.Errorf("WORKER_INTERVAL must be positive, got %s", cfg.WorkerInterval)
	case cfg.GrantTTL <= 0:
		return fmt.Errorf("GRANT_TTL must be positive, got %s", cfg.GrantTTL)
	case cfg.DBMaxOpenConns <= 0:
		return fmt.Errorf("DB_MAX_OPEN_CONNS must be positive, got %d", cfg.DBMaxOpenConns)
	case cfg.DBMaxIdleConns < 0:
		return fmt.Errorf("DB_MAX_IDLE_CONNS must be non-negative, got %d", cfg.DBMaxIdleConns)
	case cfg.DBMaxIdleConns > cfg.DBMaxOpenConns:
		return fmt.Errorf("DB_MAX_IDLE_CONNS (%d) must not exceed DB_MAX_OPEN_CONNS (%d)", cfg.DBMaxIdleConns, cfg.DBMaxOpenConns)
	case cfg.DBConnMaxLifetime <= 0:
		return fmt.Errorf("DB_CONN_MAX_LIFETIME must be positive, got %s", cfg.DBConnMaxLifetime)
	default:
		return nil
	}
}
