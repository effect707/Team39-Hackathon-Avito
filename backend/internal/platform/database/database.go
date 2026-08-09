package database

import (
	"context"
	"fmt"
	"time"

	"github.com/team39/avito-fair-queue/backend/internal/platform/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(ctx context.Context, config config.Config) (*gorm.DB, error) {
	db, err := gorm.Open(postgres.Open(config.DatabaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Error)})
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("get database pool: %w", err)
	}
	sqlDB.SetMaxOpenConns(config.DBMaxOpenConns)
	sqlDB.SetMaxIdleConns(config.DBMaxIdleConns)
	sqlDB.SetConnMaxLifetime(config.DBConnMaxLifetime)
	pingContext, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := sqlDB.PingContext(pingContext); err != nil {
		_ = sqlDB.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return db, nil
}

type Checker struct {
	DB *gorm.DB
}

func (checker Checker) Check(ctx context.Context) error {
	return checker.DB.WithContext(ctx).Exec("SELECT 1").Error
}

func Now(tx *gorm.DB) (time.Time, error) {
	var now time.Time
	if err := tx.Raw("SELECT now()").Scan(&now).Error; err != nil {
		return time.Time{}, fmt.Errorf("read database time: %w", err)
	}
	return now, nil
}

func Close(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
