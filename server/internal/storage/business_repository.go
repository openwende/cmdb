package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/wend/cmdb-backend/internal/types"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

type BusinessRepository interface {
	CreateBusiness(ctx context.Context, business *types.Business) error
	GetBusinessByID(ctx context.Context, tenantID, id string) (*types.Business, error)
	GetBusinessByIdentifier(ctx context.Context, tenantID, identifier string) (*types.Business, error)
	GetBusinessByBusinessID(ctx context.Context, tenantID string, businessID int64) (*types.Business, error)
	UpdateBusiness(ctx context.Context, business *types.Business) error
	DeleteBusiness(ctx context.Context, tenantID, id string) error
	ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error)
	CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error)
	CheckBusinessIDExists(ctx context.Context, tenantID string, businessID int64, excludeID string) (bool, error)
	GetNextBusinessID(ctx context.Context, tenantID string) (int64, error)
}

type businessRepository struct {
	db *gorm.DB
}

func NewBusinessRepository(db *gorm.DB) BusinessRepository {
	return &businessRepository{db: db}
}

func (r *businessRepository) CreateBusiness(ctx context.Context, business *types.Business) error {
	// Use pure ORM: explicit columns
	// Postgres dialect uses pq.Array for UUID arrays
	// Use struct-based creation to leverage GORM's Postgres support (RETURNING id)
	// and avoid generic LastInsertId error.
	res := r.db.WithContext(ctx).Create(business)
	if err := res.Error; err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return fmt.Errorf("business with identifier '%s' already exists", business.Identifier)
		}
		return fmt.Errorf("failed to create business: %w", err)
	}
	return nil
}

func (r *businessRepository) GetBusinessByID(ctx context.Context, tenantID, id string) (*types.Business, error) {
	var business types.Business
	db := r.db.WithContext(ctx).Table("businesses").
		Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "business_id", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		Take(&business)
	if errors.Is(db.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("business with id '%s' not found", id)
	}
	if db.Error != nil {
		return nil, fmt.Errorf("failed to get business: %w", db.Error)
	}

	return &business, nil
}

func (r *businessRepository) GetBusinessByIdentifier(ctx context.Context, tenantID, identifier string) (*types.Business, error) {
	var business types.Business
	db := r.db.WithContext(ctx).Table("businesses").
		Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "business_id", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").
		Where("identifier = ? AND tenant_id = ? AND deleted_at IS NULL", identifier, tenantID).
		Take(&business)
	if errors.Is(db.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("business with identifier '%s' not found", identifier)
	}
	if db.Error != nil {
		return nil, fmt.Errorf("failed to get business: %w", db.Error)
	}

	return &business, nil
}

func (r *businessRepository) UpdateBusiness(ctx context.Context, business *types.Business) error {
	result := r.db.WithContext(ctx).
		Table("businesses").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", business.ID, business.TenantID).
		Updates(map[string]interface{}{
			"updated_at":  business.UpdatedAt,
			"name":        business.Name,
			"description": business.Description,
			"lifecycle":   business.Lifecycle,
			"timezone":    business.Timezone,
			"language":    business.Language,
			"maintainers": pq.Array(business.Maintainers),
		})
	if result.Error != nil {
		return fmt.Errorf("failed to update business: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("business with id '%s' not found or already deleted", business.ID)
	}

	return nil
}

func (r *businessRepository) DeleteBusiness(ctx context.Context, tenantID, id string) error {
	now := time.Now().UTC()
	result := r.db.WithContext(ctx).
		Table("businesses").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		Updates(map[string]interface{}{
			"deleted_at": now,
			"updated_at": now,
		})
	if result.Error != nil {
		return fmt.Errorf("failed to delete business: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("business with id '%s' not found or already deleted", id)
	}

	return nil
}

func (r *businessRepository) CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Table("businesses").
		Where("identifier = ? AND tenant_id = ? AND deleted_at IS NULL", identifier, tenantID)
	if excludeID != "" {
		query = query.Where("id != ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check identifier existence: %w", err)
	}
	return count > 0, nil
}

func (r *businessRepository) GetBusinessByBusinessID(ctx context.Context, tenantID string, businessID int64) (*types.Business, error) {
	var business types.Business
	db := r.db.WithContext(ctx).Table("businesses").
		Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "business_id", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").
		Where("business_id = ? AND tenant_id = ? AND deleted_at IS NULL", businessID, tenantID).
		Take(&business)
	if errors.Is(db.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("business with business_id '%d' not found", businessID)
	}
	if db.Error != nil {
		return nil, fmt.Errorf("failed to get business: %w", db.Error)
	}

	return &business, nil
}

func (r *businessRepository) CheckBusinessIDExists(ctx context.Context, tenantID string, businessID int64, excludeID string) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Table("businesses").
		Where("business_id = ? AND tenant_id = ? AND deleted_at IS NULL", businessID, tenantID)
	if excludeID != "" {
		query = query.Where("id != ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check business_id existence: %w", err)
	}
	return count > 0, nil
}

func (r *businessRepository) GetNextBusinessID(ctx context.Context, tenantID string) (int64, error) {
	var maxBusinessID *int64
	if err := r.db.WithContext(ctx).Table("businesses").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Select("MAX(business_id)").
		Scan(&maxBusinessID).Error; err != nil {
		return 0, fmt.Errorf("failed to get max business_id: %w", err)
	}

	const startBusinessID = 1000
	if maxBusinessID == nil {
		return startBusinessID, nil
	}
	return *maxBusinessID + 1, nil
}

func (r *businessRepository) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	var businesses []types.Business
	tx := r.db.WithContext(ctx).Table("businesses").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)

	// total count
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count businesses: %w", err)
	}

	// pagination + query
	// Fixed: add maintainers to select list
	if err := tx.Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "business_id", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").Order("created_at DESC").Limit(limit).Offset(offset).Find(&businesses).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list businesses: %w", err)
	}

	return businesses, int(total), nil
}
