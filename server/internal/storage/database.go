package storage

import (
    "context"
    "fmt"
    "time"

    "github.com/wend/cmdb-backend/pkg/config"
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
    logLevel := logger.Silent
    if cfg.AutoMigrate {
        logLevel = logger.Info
    }
    gormConfig := &gorm.Config{
        Logger: logger.Default.LogMode(logLevel),
        NowFunc: func() time.Time { return time.Now().UTC() },
    }
    db, err := gorm.Open(postgres.Open(cfg.GetDSN()), gormConfig)
    if err != nil {
        return nil, fmt.Errorf("failed to connect to database: %w", err)
    }
    sqlDB, err := db.DB()
    if err != nil {
        return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
    }
    sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
    sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
    sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)
    sqlDB.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)
    return &Database{db: db, config: cfg}, nil
}

// DB returns the underlying GORM database instance.
func (d *Database) DB() *gorm.DB { return d.db }

// Close closes the database connection.
func (d *Database) Close() error {
    sqlDB, err := d.db.DB()
    if err != nil { return err }
    return sqlDB.Close()
}

// Ping checks if the database connection is alive.
func (d *Database) Ping() error {
    sqlDB, err := d.db.DB()
    if err != nil { return err }
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    return sqlDB.PingContext(ctx)
}

