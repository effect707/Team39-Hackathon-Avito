package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	HTTPAddress       string
	DatabaseURL       string
	DemoEnabled       bool
	WorkerInterval    time.Duration
	DBMaxOpenConns    int
	DBMaxIdleConns    int
	DBConnMaxLifetime time.Duration
}

func Load() (Config, error) {
	config := Config{
		HTTPAddress:       valueOrDefault("HTTP_ADDRESS", ":8080"),
		DatabaseURL:       strings.TrimSpace(os.Getenv("DATABASE_URL")),
		DemoEnabled:       true,
		WorkerInterval:    30 * time.Second,
		DBMaxOpenConns:    20,
		DBMaxIdleConns:    10,
		DBConnMaxLifetime: 5 * time.Minute,
	}

	var err error
	if config.DemoEnabled, err = boolFromEnv("DEMO_MODE", config.DemoEnabled); err != nil {
		return Config{}, err
	}
	if config.WorkerInterval, err = durationFromEnv("WORKER_INTERVAL", config.WorkerInterval); err != nil {
		return Config{}, err
	}
	if config.DBMaxOpenConns, err = intFromEnv("DB_MAX_OPEN_CONNS", config.DBMaxOpenConns); err != nil {
		return Config{}, err
	}
	if config.DBMaxIdleConns, err = intFromEnv("DB_MAX_IDLE_CONNS", config.DBMaxIdleConns); err != nil {
		return Config{}, err
	}
	if config.DBConnMaxLifetime, err = durationFromEnv("DB_CONN_MAX_LIFETIME", config.DBConnMaxLifetime); err != nil {
		return Config{}, err
	}

	if config.DatabaseURL == "" {
		return Config{}, fmt.Errorf("DATABASE_URL is required")
	}
	if config.HTTPAddress == "" {
		return Config{}, fmt.Errorf("HTTP_ADDRESS must not be empty")
	}
	if config.WorkerInterval <= 0 {
		return Config{}, fmt.Errorf("WORKER_INTERVAL must be positive")
	}
	if config.DBMaxOpenConns <= 0 || config.DBMaxIdleConns < 0 || config.DBMaxIdleConns > config.DBMaxOpenConns {
		return Config{}, fmt.Errorf("database pool limits are invalid")
	}
	if config.DBConnMaxLifetime <= 0 {
		return Config{}, fmt.Errorf("DB_CONN_MAX_LIFETIME must be positive")
	}
	return config, nil
}

func valueOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func durationFromEnv(key string, fallback time.Duration) (time.Duration, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := time.ParseDuration(value)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}
	return parsed, nil
}

func intFromEnv(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", key, err)
	}
	return parsed, nil
}

func boolFromEnv(key string, fallback bool) (bool, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return false, fmt.Errorf("parse %s: %w", key, err)
	}
	return parsed, nil
}
