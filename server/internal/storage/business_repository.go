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
	UpdateBusiness(ctx context.Context, business *types.Business) error
	DeleteBusiness(ctx context.Context, tenantID, id string) error
	ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error)
	CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error)
}

type businessRepository struct {
	db *gorm.DB
}

func NewBusinessRepository(db *gorm.DB) BusinessRepository {
	return &businessRepository{db: db}
}

func (r *businessRepository) CreateBusiness(ctx context.Context, business *types.Business) error {
	// 使用纯 ORM：通过 Table + Create(map) 显式列出字段，避免零值被忽略
    res := r.db.WithContext(ctx).Table("businesses").Create(map[string]interface{}{
        "id":          business.ID,
        "created_at":  business.CreatedAt,
        "updated_at":  business.UpdatedAt,
        "tenant_id":   business.TenantID,
        "name":        business.Name,
        "identifier":  business.Identifier,
        "description": business.Description,
        "lifecycle":   business.Lifecycle,
        "timezone":    business.Timezone,
        "language":    business.Language,
        "maintainers": pq.Array(business.Maintainers),
        "is_built_in": business.IsBuiltIn,
        "sres":        business.Sres,
        "developers":  business.Developers,
        "testers":     business.Testers,
        "bizops":      business.Bizops,
    })
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
            "sres":        business.Sres,
            "developers":  business.Developers,
            "testers":     business.Testers,
            "bizops":      business.Bizops,
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
	if err := tx.Order("created_at DESC").Limit(limit).Offset(offset).Find(&businesses).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list businesses: %w", err)
	}

	return businesses, int(total), nil
}
