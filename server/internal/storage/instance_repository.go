package storage

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/openwende/cmdb-server/internal/types"
	"gorm.io/gorm"
)

type InstanceRepository interface {
	CreateInstance(ctx context.Context, instance *types.Instance) error
	GetInstanceByID(ctx context.Context, tenantID, modelID, id string) (*types.Instance, error)
	UpdateInstance(ctx context.Context, instance *types.Instance) error
	DeleteInstance(ctx context.Context, tenantID, modelID, id string) error

	// Complex Query
	ListInstances(ctx context.Context, tenantID, modelID string, params types.QueryParams) ([]types.Instance, int64, error)

	// Batch
	BatchCreateInstance(ctx context.Context, instances []types.Instance) error
}

type instanceRepository struct {
	db *gorm.DB
}

func NewInstanceRepository(db *gorm.DB) InstanceRepository {
	return &instanceRepository{db: db}
}

func (r *instanceRepository) CreateInstance(ctx context.Context, instance *types.Instance) error {
	// GORM creates into partitioned table correctly as long as partition key (model_id) is present
	res := r.db.WithContext(ctx).Create(instance)
	if err := res.Error; err != nil {
		return fmt.Errorf("failed to create instance: %w", err)
	}
	return nil
}

func (r *instanceRepository) BatchCreateInstance(ctx context.Context, instances []types.Instance) error {
	// GORM Create with slice for batch insert
	res := r.db.WithContext(ctx).Create(&instances)
	if err := res.Error; err != nil {
		return fmt.Errorf("failed to batch create instances: %w", err)
	}
	return nil
}

func (r *instanceRepository) GetInstanceByID(ctx context.Context, tenantID, modelID, id string) (*types.Instance, error) {
	var instance types.Instance
	// Must include model_id in query for partition pruning
	db := r.db.WithContext(ctx).Table("model_instances").
		Where("id = ? AND model_id = ? AND tenant_id = ? AND deleted_at IS NULL", id, modelID, tenantID).
		Take(&instance)

	if errors.Is(db.Error, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("instance not found")
	}
	if db.Error != nil {
		return nil, fmt.Errorf("failed to get instance: %w", db.Error)
	}
	return &instance, nil
}

func (r *instanceRepository) UpdateInstance(ctx context.Context, instance *types.Instance) error {
	// We use map to avoid zero-value issues, but here we probably want to replace properties?
	// Or merge? Standard practice for dynamic fields is typically merge or replace.
	// We'll implement REPLACE logic for top-level properties map via simple update for now.

	// Note: Updating partition key (model_id) is generally not allowed or heavy. We assume model_id doesn't change.
	result := r.db.WithContext(ctx).
		Table("model_instances").
		Where("id = ? AND model_id = ? AND tenant_id = ? AND deleted_at IS NULL", instance.ID, instance.ModelID, instance.TenantID).
		Updates(map[string]interface{}{
			"updated_at":  time.Now(),
			"properties":  instance.Properties,
			"business_id": instance.BusinessID,
			"path":        instance.Path,
		})

	if result.Error != nil {
		return fmt.Errorf("failed to update instance: %w", result.Error)
	}
	return nil
}

func (r *instanceRepository) DeleteInstance(ctx context.Context, tenantID, modelID, id string) error {
	now := time.Now()
	result := r.db.WithContext(ctx).
		Table("model_instances").
		Where("id = ? AND model_id = ? AND tenant_id = ? AND deleted_at IS NULL", id, modelID, tenantID).
		Update("deleted_at", now)

	if result.Error != nil {
		return fmt.Errorf("failed to delete instance: %w", result.Error)
	}
	return nil
}

func (r *instanceRepository) ListInstances(ctx context.Context, tenantID, modelID string, params types.QueryParams) ([]types.Instance, int64, error) {
	var instances []types.Instance
	var total int64

	tx := r.db.WithContext(ctx).Table("model_instances").
		Where("model_id = ? AND tenant_id = ? AND deleted_at IS NULL", modelID, tenantID)

	// Apply JSONB filters
	// params.Filters is map[string]interface{}
	// We support simple equality matches: properties ->> 'key' = 'value'
	// Or @> for subset

	if len(params.Filters) > 0 {
		// Example: Convert filters to JSONB containment query
		// This is efficient with GIN index
		filterJSON, err := json.Marshal(params.Filters)
		if err == nil {
			tx = tx.Where("properties @> ?", string(filterJSON))
		}
	}

	// Count
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to count instances: %w", err)
	}

	// Pagination
	offset := (params.Page - 1) * params.PageSize
	if offset < 0 {
		offset = 0
	}

	if err := tx.Order("created_at DESC").Limit(params.PageSize).Offset(offset).Find(&instances).Error; err != nil {
		return nil, 0, fmt.Errorf("failed to list instances: %w", err)
	}

	return instances, total, nil
}
