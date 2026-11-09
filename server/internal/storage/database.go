package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/openwende/cmdb/server/pkg/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Database provides a minimal DB wrapper used by the business server.
type Database struct {
	db     *gorm.DB
	config *config.DatabaseConfig
}

// NewDatabase opens a PostgreSQL connection using the provided config.
func NewDatabase(cfg *config.DatabaseConfig) (*Database, error) {
	// In production, migrations are handled externally.
	logLevel := logger.Error
	// if cfg.Log.Level == "debug" { logLevel = logger.Info } // Optimization: could fetch log config if passed, but keep simple

	gormConfig := &gorm.Config{
		Logger:  logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time { return time.Now().UTC() },
	}

	dsn := cfg.GetDSN()
	db, err := gorm.Open(postgres.Open(dsn), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}
	if cfg.MaxOpenConns > 0 {
		sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	}
	if cfg.MaxIdleConns > 0 {
		sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	}
	if cfg.ConnMaxLifetime > 0 {
		sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	}
	if cfg.ConnMaxIdleTime > 0 {
		sqlDB.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)
	}
	return &Database{db: db, config: cfg}, nil
}

// DB returns the underlying GORM database instance.
func (d *Database) DB() *gorm.DB { return d.db }

// Close closes the database connection.
func (d *Database) Close() error {
	sqlDB, err := d.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// Ping checks if the database connection is alive.
func (d *Database) Ping() error {
	sqlDB, err := d.db.DB()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return sqlDB.PingContext(ctx)
}
