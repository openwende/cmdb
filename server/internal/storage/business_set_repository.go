package storage

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/types"

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
			return fmt.Errorf("business set with identifier '%s' already exists", businessSet.Identifier)
		}
		return fmt.Errorf("failed to create business set: %w", err)
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
				return fmt.Errorf("business set with identifier '%s' already exists", businessSet.Identifier)
			}
			return fmt.Errorf("failed to create business set: %w", err)
		}

		if err := tx.Table("business_set_members").Create(map[string]interface{}{
			"id":              member.ID,
			"created_at":      member.CreatedAt,
			"business_set_id": member.BusinessSetID,
			"business_id":     member.BusinessID,
		}).Error; err != nil {
			return fmt.Errorf("failed to create business set member: %w", err)
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
			return nil, fmt.Errorf("business set with id '%s' not found", id)
		}
		return nil, fmt.Errorf("failed to get business set: %w", err)
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
		return nil, 0, fmt.Errorf("failed to count business sets: %w", err)
	}

	// Get paginated results
	if err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&businessSets).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list business sets: %w", err)
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
		return fmt.Errorf("failed to update business set: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("business set with id '%s' not found or already deleted", businessSet.ID)
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
		return fmt.Errorf("failed to delete business set: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("business set with id '%s' not found or already deleted", id)
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
		return nil, fmt.Errorf("failed to list business set members: %w", err)
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
			return fmt.Errorf("business is already a member of this business set")
		}
		return fmt.Errorf("failed to add business to set: %w", err)
	}

	return nil
}

func (r *businessSetRepository) RemoveBusinessFromSet(ctx context.Context, businessSetID, businessID uuid.UUID) error {
	result := r.db.WithContext(ctx).Table("business_set_members").
		Where("business_set_id = ? AND business_id = ?", businessSetID, businessID).
		Delete(nil)

	if result.Error != nil {
		return fmt.Errorf("failed to remove business from set: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return fmt.Errorf("business is not a member of this business set")
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
		return false, fmt.Errorf("failed to check identifier existence: %w", err)
	}

	return count > 0, nil
}
