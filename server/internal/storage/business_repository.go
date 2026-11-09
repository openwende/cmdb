package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"
	"github.com/openwende/cmdb/server/internal/types"
	"github.com/openwende/cmdb/server/pkg/apperrors"
	"gorm.io/gorm"
)

type BusinessRepository interface {
	CreateBusiness(ctx context.Context, business *types.Business) error
	GetBusinessByID(ctx context.Context, tenantID string, id uint64) (*types.Business, error)
	GetBusinessByIdentifier(ctx context.Context, tenantID, identifier string) (*types.Business, error)
	UpdateBusiness(ctx context.Context, business *types.Business) error
	DeleteBusiness(ctx context.Context, tenantID string, id uint64) error
	ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error)
	CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID uint64) (bool, error)
}

type businessRepository struct {
	db *gorm.DB
}

func NewBusinessRepository(db *gorm.DB) BusinessRepository {
	return &businessRepository{db: db}
}

func (r *businessRepository) CreateBusiness(ctx context.Context, business *types.Business) error {
	res := r.db.WithContext(ctx).Create(business)
	if err := res.Error; err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return apperrors.AlreadyExistsError("business", business.Identifier)
		}
		return apperrors.InternalError("create business", err)
	}
	return nil
}

func (r *businessRepository) GetBusinessByID(ctx context.Context, tenantID string, id uint64) (*types.Business, error) {
	var business types.Business
	db := r.db.WithContext(ctx).Table("businesses").
		Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		Take(&business)
	if errors.Is(db.Error, gorm.ErrRecordNotFound) {
		return nil, apperrors.NotFoundError("business", fmt.Sprint(id))
	}
	if db.Error != nil {
		return nil, apperrors.InternalError("get business", db.Error)
	}

	return &business, nil
}

func (r *businessRepository) GetBusinessByIdentifier(ctx context.Context, tenantID, identifier string) (*types.Business, error) {
	var business types.Business
	db := r.db.WithContext(ctx).Table("businesses").
		Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").
		Where("identifier = ? AND tenant_id = ? AND deleted_at IS NULL", identifier, tenantID).
		Take(&business)
	if errors.Is(db.Error, gorm.ErrRecordNotFound) {
		return nil, apperrors.NotFoundError("business", identifier)
	}
	if db.Error != nil {
		return nil, apperrors.InternalError("get business by identifier", db.Error)
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
			"maintainers": business.Maintainers,
		})
	if result.Error != nil {
		return apperrors.InternalError("update business", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFoundError("business", fmt.Sprint(business.ID))
	}

	return nil
}

func (r *businessRepository) DeleteBusiness(ctx context.Context, tenantID string, id uint64) error {
	now := time.Now().UTC()
	result := r.db.WithContext(ctx).
		Table("businesses").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		Updates(map[string]interface{}{
			"deleted_at": now,
			"updated_at": now,
		})
	if result.Error != nil {
		return apperrors.InternalError("delete business", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFoundError("business", fmt.Sprint(id))
	}

	return nil
}

func (r *businessRepository) CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID uint64) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Table("businesses").
		Where("identifier = ? AND tenant_id = ? AND deleted_at IS NULL", identifier, tenantID)
	if excludeID != 0 {
		query = query.Where("id != ?", excludeID)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, apperrors.InternalError("check identifier exists", err)
	}
	return count > 0, nil
}

func (r *businessRepository) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	var businesses []types.Business
	tx := r.db.WithContext(ctx).Table("businesses").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, apperrors.InternalError("count businesses", err)
	}

	if err := tx.Select("id", "created_at", "updated_at", "deleted_at", "created_by", "updated_by", "tenant_id", "name", "identifier", "description", "lifecycle", "timezone", "language", "maintainers", "is_built_in").Order("created_at DESC").Limit(limit).Offset(offset).Find(&businesses).Error; err != nil {
		return nil, 0, apperrors.InternalError("list businesses", err)
	}

	return businesses, int(total), nil
}
