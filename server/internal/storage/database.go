package storage

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/wend/cmdb-backend/pkg/config"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Database represents the database connection and operations
type Database struct {
	db     *gorm.DB
	config *config.DatabaseConfig
}

// NewDatabase creates a new database connection
func NewDatabase(cfg *config.DatabaseConfig) (*Database, error) {
	// Configure GORM logger
	logLevel := logger.Silent
	if cfg.AutoMigrate {
		logLevel = logger.Info
	}
	
	gormConfig := &gorm.Config{
		Logger: logger.Default.LogMode(logLevel),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	}
	
	// Connect to database
	db, err := gorm.Open(postgres.Open(cfg.GetDSN()), gormConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}
	
	// Get underlying sql.DB
	sqlDB, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("failed to get underlying sql.DB: %w", err)
	}
	
	// Configure connection pool
	sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
	sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
	sqlDB.SetConnMaxLifetime(cfg.ConnMaxLifetime)
	sqlDB.SetConnMaxIdleTime(cfg.ConnMaxIdleTime)
	
	database := &Database{
		db:     db,
		config: cfg,
	}
	
	// Auto-migrate if enabled
	if cfg.AutoMigrate {
		if err := database.AutoMigrate(); err != nil {
			return nil, fmt.Errorf("auto migration failed: %w", err)
		}
	}
	
	return database, nil
}

// DB returns the underlying GORM database instance
func (d *Database) DB() *gorm.DB {
	return d.db
}

// Close closes the database connection
func (d *Database) Close() error {
	sqlDB, err := d.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

// Ping checks if the database connection is alive
func (d *Database) Ping() error {
	sqlDB, err := d.db.DB()
	if err != nil {
		return err
	}
	
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	
	return sqlDB.PingContext(ctx)
}

// AutoMigrate performs automatic migration for all models
func (d *Database) AutoMigrate() error {
	log.Println("Starting database auto-migration...")
	
	// Define migration order based on dependencies
	models := []interface{}{
		// Auth models
		&types.User{},
		&types.Tenant{},
		&types.TenantMembership{},
		&types.Permission{},
		&types.Role{},
		&types.RolePermission{},
		&types.UserRole{},
		
		// Model system
		&types.ModelGroup{},
		&types.Model{},
		&types.FieldGroup{},
		&types.Field{},
		&types.RelationshipType{},
		&types.Relationship{},
		
		// Business system
		&types.Business{},
		&types.BusinessSet{},
		&types.TopologyNode{},
		&types.ServiceTemplate{},
		&types.ClusterTemplate{},
		&types.DynamicGroup{},
		
		// Instance system
		&types.Instance{},
		&types.InstanceRelationship{},
		
		// Audit system
		&types.AuditLog{},
		&types.Event{},
		&types.EventSubscription{},
		&types.EventDelivery{},
	}
	
	for _, model := range models {
		if err := d.db.AutoMigrate(model); err != nil {
			return fmt.Errorf("failed to migrate %T: %w", model, err)
		}
	}
	
	log.Println("Database auto-migration completed successfully")
	return nil
}

// Transaction executes a function within a database transaction
func (d *Database) Transaction(fn func(*gorm.DB) error) error {
	return d.db.Transaction(fn)
}

// WithContext returns a new database instance with context
func (d *Database) WithContext(ctx context.Context) *gorm.DB {
	return d.db.WithContext(ctx)
}

// WithTenant returns a database instance scoped to a specific tenant
func (d *Database) WithTenant(tenantID string) *gorm.DB {
	return d.db.Where("tenant_id = ?", tenantID)
}

// GetStats returns database connection statistics
func (d *Database) GetStats() (*DatabaseStats, error) {
	sqlDB, err := d.db.DB()
	if err != nil {
		return nil, err
	}
	
	stats := sqlDB.Stats()
	return &DatabaseStats{
		MaxOpenConnections: stats.MaxOpenConnections,
		OpenConnections:    stats.OpenConnections,
		InUse:             stats.InUse,
		Idle:              stats.Idle,
		WaitCount:         stats.WaitCount,
		WaitDuration:      stats.WaitDuration,
		MaxIdleClosed:     stats.MaxIdleClosed,
		MaxLifetimeClosed: stats.MaxLifetimeClosed,
	}, nil
}

// DatabaseStats represents database connection statistics
type DatabaseStats struct {
	MaxOpenConnections int           `json:"max_open_connections"`
	OpenConnections    int           `json:"open_connections"`
	InUse             int           `json:"in_use"`
	Idle              int           `json:"idle"`
	WaitCount         int64         `json:"wait_count"`
	WaitDuration      time.Duration `json:"wait_duration"`
	MaxIdleClosed     int64         `json:"max_idle_closed"`
	MaxLifetimeClosed int64         `json:"max_lifetime_closed"`
}

// HealthCheck performs a comprehensive health check
func (d *Database) HealthCheck() error {
	// Test connection
	if err := d.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}
	
	// Test query execution
	var count int64
	if err := d.db.Raw("SELECT 1").Count(&count).Error; err != nil {
		return fmt.Errorf("database query failed: %w", err)
	}
	
	return nil
}

// Repository provides base repository functionality
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new repository instance
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Create creates a new record
func (r *Repository) Create(ctx context.Context, entity interface{}) error {
	return r.db.WithContext(ctx).Create(entity).Error
}

// GetByID retrieves a record by ID
func (r *Repository) GetByID(ctx context.Context, id string, entity interface{}) error {
	return r.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", id).First(entity).Error
}

// Update updates a record
func (r *Repository) Update(ctx context.Context, entity interface{}) error {
	return r.db.WithContext(ctx).Save(entity).Error
}

// Delete soft deletes a record
func (r *Repository) Delete(ctx context.Context, id string, entity interface{}) error {
	return r.db.WithContext(ctx).Where("id = ?", id).Delete(entity).Error
}

// List retrieves records with pagination and filtering
func (r *Repository) List(ctx context.Context, entities interface{}, options *types.QueryOptions) (*types.Pagination, error) {
	query := r.db.WithContext(ctx).Where("deleted_at IS NULL")
	
	// Apply filters
	if options != nil && len(options.Filters) > 0 {
		for _, filter := range options.Filters {
			query = r.applyFilter(query, filter)
		}
	}
	
	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	
	// Apply pagination
	pagination := &types.Pagination{Total: total}
	if options != nil && options.Pagination != nil {
		pagination = options.Pagination
		pagination.Total = total
		query = query.Offset(pagination.GetOffset()).Limit(pagination.PageSize)
	}
	
	// Apply sorting
	if options != nil && len(options.Sort) > 0 {
		for _, sort := range options.Sort {
			query = query.Order(fmt.Sprintf("%s %s", sort.Field, sort.Order))
		}
	}
	
	// Execute query
	if err := query.Find(entities).Error; err != nil {
		return nil, err
	}
	
	return pagination, nil
}

// applyFilter applies a filter to the query
func (r *Repository) applyFilter(query *gorm.DB, filter types.Filter) *gorm.DB {
	switch filter.Operator {
	case "eq":
		return query.Where(fmt.Sprintf("%s = ?", filter.Field), filter.Value)
	case "ne":
		return query.Where(fmt.Sprintf("%s != ?", filter.Field), filter.Value)
	case "gt":
		return query.Where(fmt.Sprintf("%s > ?", filter.Field), filter.Value)
	case "lt":
		return query.Where(fmt.Sprintf("%s < ?", filter.Field), filter.Value)
	case "ge":
		return query.Where(fmt.Sprintf("%s >= ?", filter.Field), filter.Value)
	case "le":
		return query.Where(fmt.Sprintf("%s <= ?", filter.Field), filter.Value)
	case "in":
		return query.Where(fmt.Sprintf("%s IN ?", filter.Field), filter.Value)
	case "like":
		return query.Where(fmt.Sprintf("%s LIKE ?", filter.Field), fmt.Sprintf("%%%v%%", filter.Value))
	case "is_null":
		return query.Where(fmt.Sprintf("%s IS NULL", filter.Field))
	case "is_not_null":
		return query.Where(fmt.Sprintf("%s IS NOT NULL", filter.Field))
	default:
		return query
	}
}

// TenantRepository provides tenant-scoped repository functionality
type TenantRepository struct {
	*Repository
	tenantID string
}

// NewTenantRepository creates a new tenant-scoped repository
func NewTenantRepository(db *gorm.DB, tenantID string) *TenantRepository {
	return &TenantRepository{
		Repository: NewRepository(db),
		tenantID:   tenantID,
	}
}

// Create creates a new tenant-scoped record
func (tr *TenantRepository) Create(ctx context.Context, entity interface{}) error {
	// Set tenant ID if the entity supports it
	if tenantModel, ok := entity.(interface{ SetTenantID(string) }); ok {
		tenantModel.SetTenantID(tr.tenantID)
	}
	return tr.Repository.Create(ctx, entity)
}

// GetByID retrieves a tenant-scoped record by ID
func (tr *TenantRepository) GetByID(ctx context.Context, id string, entity interface{}) error {
	return tr.db.WithContext(ctx).Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tr.tenantID).First(entity).Error
}

// List retrieves tenant-scoped records
func (tr *TenantRepository) List(ctx context.Context, entities interface{}, options *types.QueryOptions) (*types.Pagination, error) {
	query := tr.db.WithContext(ctx).Where("tenant_id = ? AND deleted_at IS NULL", tr.tenantID)
	
	// Apply filters
	if options != nil && len(options.Filters) > 0 {
		for _, filter := range options.Filters {
			query = tr.applyFilter(query, filter)
		}
	}
	
	// Count total records
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}
	
	// Apply pagination
	pagination := &types.Pagination{Total: total}
	if options != nil && options.Pagination != nil {
		pagination = options.Pagination
		pagination.Total = total
		query = query.Offset(pagination.GetOffset()).Limit(pagination.PageSize)
	}
	
	// Apply sorting
	if options != nil && len(options.Sort) > 0 {
		for _, sort := range options.Sort {
			query = query.Order(fmt.Sprintf("%s %s", sort.Field, sort.Order))
		}
	}
	
	// Execute query
	if err := query.Find(entities).Error; err != nil {
		return nil, err
	}
	
	return pagination, nil
}

// Delete soft deletes a tenant-scoped record
func (tr *TenantRepository) Delete(ctx context.Context, id string, entity interface{}) error {
	return tr.db.WithContext(ctx).Where("id = ? AND tenant_id = ?", id, tr.tenantID).Delete(entity).Error
}