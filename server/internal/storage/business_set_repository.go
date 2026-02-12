package storage

import (
	"context"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

type BusinessSetRepository interface {
	CreateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error
	CreateBusinessSetMember(ctx context.Context, member *types.BusinessSetMember) error
	CreateBusinessSetWithMember(ctx context.Context, businessSet *types.BusinessSet, member *types.BusinessSetMember) error
	GetBusinessSetByID(ctx context.Context, tenantID, id string) (*types.BusinessSet, error)
	ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error)
	UpdateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error
	DeleteBusinessSet(ctx context.Context, tenantID, id string) error
	ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uuid.UUID, error)
	AddBusinessToSet(ctx context.Context, member *types.BusinessSetMember) error
	RemoveBusinessFromSet(ctx context.Context, businessSetID, businessID uuid.UUID) error
	CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error)
}

type businessSetRepository struct {
	db *gorm.DB
}

func NewBusinessSetRepository(db *gorm.DB) BusinessSetRepository {
	return &businessSetRepository{db: db}
}

func (r *businessSetRepository) CreateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error {
	// Postgres only: use pq.Array
	err := r.db.WithContext(ctx).Table("business_sets").Create(map[string]interface{}{
		"id":          businessSet.ID,
		"created_at":  businessSet.CreatedAt,
		"updated_at":  businessSet.UpdatedAt,
		"tenant_id":   businessSet.TenantID,
		"name":        businessSet.Name,
		"identifier":  businessSet.Identifier,
		"description": businessSet.Description,
		"scope":       businessSet.Scope,
		"maintainers": pq.Array(businessSet.Maintainers),
	}).Error
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return apperrors.AlreadyExistsError("business set", businessSet.Identifier)
		}
		return apperrors.InternalError("create business set", err)
	}
	return nil
}

func (r *businessSetRepository) CreateBusinessSetMember(ctx context.Context, member *types.BusinessSetMember) error {
	return r.db.WithContext(ctx).Table("business_set_members").Create(map[string]interface{}{
		"id":              member.ID,
		"created_at":      member.CreatedAt,
		"business_set_id": member.BusinessSetID,
		"business_id":     member.BusinessID,
	}).Error
}

func (r *businessSetRepository) CreateBusinessSetWithMember(ctx context.Context, businessSet *types.BusinessSet, member *types.BusinessSetMember) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("business_sets").Create(map[string]interface{}{
			"id":          businessSet.ID,
			"created_at":  businessSet.CreatedAt,
			"updated_at":  businessSet.UpdatedAt,
			"tenant_id":   businessSet.TenantID,
			"name":        businessSet.Name,
			"identifier":  businessSet.Identifier,
			"description": businessSet.Description,
			"scope":       businessSet.Scope,
			"maintainers": pq.Array(businessSet.Maintainers),
		}).Error; err != nil {
			if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
				return apperrors.AlreadyExistsError("business set", businessSet.Identifier)
			}
			return apperrors.InternalError("create business set", err)
		}

		if err := tx.Table("business_set_members").Create(map[string]interface{}{
			"id":              member.ID,
			"created_at":      member.CreatedAt,
			"business_set_id": member.BusinessSetID,
			"business_id":     member.BusinessID,
		}).Error; err != nil {
			return apperrors.InternalError("create business set member", err)
		}
		return nil
	})
}

func (r *businessSetRepository) GetBusinessSetByID(ctx context.Context, tenantID, id string) (*types.BusinessSet, error) {
	var businessSet types.BusinessSet
	err := r.db.WithContext(ctx).Table("business_sets").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&businessSet).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, apperrors.NotFoundError("business set", id)
		}
		return nil, apperrors.InternalError("get business set", err)
	}

	return &businessSet, nil
}

func (r *businessSetRepository) ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error) {
	var businessSets []types.BusinessSet
	var total int64

	query := r.db.WithContext(ctx).Table("business_sets").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)

	// Get total count
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, apperrors.InternalError("count business sets", err)
	}

	// Get paginated results
	if err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&businessSets).Error; err != nil {
		return nil, 0, apperrors.InternalError("list business sets", err)
	}

	return businessSets, int(total), nil
}

func (r *businessSetRepository) UpdateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error {
	result := r.db.WithContext(ctx).Table("business_sets").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", businessSet.ID, businessSet.TenantID).
		Updates(map[string]interface{}{
			"updated_at":  businessSet.UpdatedAt,
			"name":        businessSet.Name,
			"description": businessSet.Description,
			"scope":       businessSet.Scope,
			"maintainers": pq.Array(businessSet.Maintainers),
		})

	if result.Error != nil {
		return apperrors.InternalError("update business set", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFoundError("business set", businessSet.ID.String())
	}

	return nil
}

func (r *businessSetRepository) DeleteBusinessSet(ctx context.Context, tenantID, id string) error {
	// Soft delete
	result := r.db.WithContext(ctx).Table("business_sets").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		Updates(map[string]interface{}{
			"deleted_at": gorm.Expr("NOW()"),
			"updated_at": gorm.Expr("NOW()"),
		})

	if result.Error != nil {
		return apperrors.InternalError("delete business set", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NotFoundError("business set", id)
	}

	return nil
}

func (r *businessSetRepository) ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uuid.UUID, error) {
	var members []struct {
		BusinessID uuid.UUID `db:"business_id"`
	}

	err := r.db.WithContext(ctx).Table("business_set_members").
		Select("business_id").
		Where("business_set_id = ?", businessSetID).
		Find(&members).Error

	if err != nil {
		return nil, apperrors.InternalError("list business set members", err)
	}

	businessIDs := make([]uuid.UUID, len(members))
	for i, m := range members {
		businessIDs[i] = m.BusinessID
	}

	return businessIDs, nil
}

func (r *businessSetRepository) AddBusinessToSet(ctx context.Context, member *types.BusinessSetMember) error {
	err := r.db.WithContext(ctx).Table("business_set_members").Create(map[string]interface{}{
		"id":              member.ID,
		"created_at":      member.CreatedAt,
		"business_set_id": member.BusinessSetID,
		"business_id":     member.BusinessID,
	}).Error

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return apperrors.AlreadyAMemberError("business", "business set")
		}
		return apperrors.InternalError("add business to set", err)
	}

	return nil
}

func (r *businessSetRepository) RemoveBusinessFromSet(ctx context.Context, businessSetID, businessID uuid.UUID) error {
	result := r.db.WithContext(ctx).Table("business_set_members").
		Where("business_set_id = ? AND business_id = ?", businessSetID, businessID).
		Delete(nil)

	if result.Error != nil {
		return apperrors.InternalError("remove business from set", result.Error)
	}
	if result.RowsAffected == 0 {
		return apperrors.NotAMemberError("business", "business set")
	}

	return nil
}

func (r *businessSetRepository) CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error) {
	var count int64
	query := r.db.WithContext(ctx).Table("business_sets").
		Where("identifier = ? AND tenant_id = ? AND deleted_at IS NULL", identifier, tenantID)

	if excludeID != "" {
		query = query.Where("id != ?", excludeID)
	}

	if err := query.Count(&count).Error; err != nil {
		return false, apperrors.InternalError("check identifier exists", err)
	}

	return count > 0, nil
}
