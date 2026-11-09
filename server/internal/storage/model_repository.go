package storage

import (
	"context"
	"errors"
	"fmt"

	"github.com/openwende/cmdb-server/internal/types"
	"gorm.io/gorm"
)

type ModelRepository interface {
	// Model Groups
	CreateModelGroup(ctx context.Context, group *types.ModelGroup) error
	GetModelGroupByID(ctx context.Context, id string) (*types.ModelGroup, error)
	GetModelGroupByName(ctx context.Context, name string) (*types.ModelGroup, error)
	ListModelGroups(ctx context.Context) ([]types.ModelGroup, error)

	// Models
	CreateModel(ctx context.Context, model *types.Model) error
	EnsureInstancePartition(ctx context.Context, model *types.Model) error
	GetModelByID(ctx context.Context, id string) (*types.Model, error)
	GetModelByName(ctx context.Context, name string) (*types.Model, error)
	ListModels(ctx context.Context) ([]types.Model, error)
	UpdateModel(ctx context.Context, model *types.Model) error
	DeleteModel(ctx context.Context, id string) error

	// Attributes
	CreateAttribute(ctx context.Context, attr *types.Attribute) error
	GetAttributeByID(ctx context.Context, id string) (*types.Attribute, error)
	UpdateAttribute(ctx context.Context, attr *types.Attribute) error
	ListAttributesByModel(ctx context.Context, modelID string) ([]types.Attribute, error)
	// Helper to get all attributes for validation
	GetModelWithAttributes(ctx context.Context, modelName string) (*types.Model, []types.Attribute, error)
}

type modelRepository struct {
	db *gorm.DB
}

func NewModelRepository(db *gorm.DB) ModelRepository {
	return &modelRepository{db: db}
}

// ==========================================
// Model Group Operations
// ==========================================

func (r *modelRepository) CreateModelGroup(ctx context.Context, group *types.ModelGroup) error {
	res := r.db.WithContext(ctx).Create(group)
	if err := res.Error; err != nil {
		return fmt.Errorf("failed to create model group: %w", err)
	}
	return nil
}

func (r *modelRepository) GetModelGroupByID(ctx context.Context, id string) (*types.ModelGroup, error) {
	var group types.ModelGroup
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("model group with id '%s' not found", id)
		}
		return nil, fmt.Errorf("failed to get model group: %w", err)
	}
	return &group, nil
}

func (r *modelRepository) GetModelGroupByName(ctx context.Context, name string) (*types.ModelGroup, error) {
	var group types.ModelGroup
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&group).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("model group with name '%s' not found", name)
		}
		return nil, fmt.Errorf("failed to get model group: %w", err)
	}
	return &group, nil
}

func (r *modelRepository) ListModelGroups(ctx context.Context) ([]types.ModelGroup, error) {
	var groups []types.ModelGroup
	if err := r.db.WithContext(ctx).
		Table("model_groups").
		Select("model_groups.*, COUNT(models.id) AS model_count").
		Joins("LEFT JOIN models ON models.group_id = model_groups.id").
		Group("model_groups.id").
		Order("model_groups.sort_order ASC, model_groups.created_at ASC").
		Find(&groups).Error; err != nil {
		return nil, fmt.Errorf("failed to list model groups: %w", err)
	}
	return groups, nil
}

// ==========================================
// Model Operations
// ==========================================

func (r *modelRepository) modelQuery(ctx context.Context) *gorm.DB {
	return r.db.WithContext(ctx).
		Table("models").
		Select("models.*, model_groups.name AS group_name, model_groups.display_name AS group_display_name").
		Joins("LEFT JOIN model_groups ON model_groups.id = models.group_id")
}

func (r *modelRepository) CreateModel(ctx context.Context, model *types.Model) error {
	res := r.db.WithContext(ctx).Create(model)
	if err := res.Error; err != nil {
		return fmt.Errorf("failed to create model: %w", err)
	}
	return nil
}

func (r *modelRepository) EnsureInstancePartition(ctx context.Context, model *types.Model) error {
	return EnsureModelInstancePartition(r.db.WithContext(ctx), model)
}

func (r *modelRepository) GetModelByID(ctx context.Context, id string) (*types.Model, error) {
	var model types.Model
	if err := r.modelQuery(ctx).Where("models.id = ?", id).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("model with id '%s' not found", id)
		}
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return &model, nil
}

func (r *modelRepository) GetModelByName(ctx context.Context, name string) (*types.Model, error) {
	var model types.Model
	if err := r.modelQuery(ctx).Where("models.name = ?", name).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("model with name '%s' not found", name)
		}
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return &model, nil
}

func (r *modelRepository) ListModels(ctx context.Context) ([]types.Model, error) {
	var models []types.Model
	if err := r.modelQuery(ctx).Order("models.created_at DESC").Find(&models).Error; err != nil {
		return nil, fmt.Errorf("failed to list models: %w", err)
	}
	return models, nil
}

func (r *modelRepository) UpdateModel(ctx context.Context, model *types.Model) error {
	res := r.db.WithContext(ctx).Model(model).Updates(model)
	if res.Error != nil {
		return fmt.Errorf("failed to update model: %w", res.Error)
	}
	return nil
}

func (r *modelRepository) DeleteModel(ctx context.Context, id string) error {
	// TODO: Add check for existing instances or relations before deleting?
	// For now, rely on database constraints or service layer logic.
	res := r.db.WithContext(ctx).Where("id = ?", id).Delete(&types.Model{})
	if res.Error != nil {
		return fmt.Errorf("failed to delete model: %w", res.Error)
	}
	return nil
}

// ==========================================
// Attribute Operations
// ==========================================

func (r *modelRepository) CreateAttribute(ctx context.Context, attr *types.Attribute) error {
	res := r.db.WithContext(ctx).Create(attr)
	if err := res.Error; err != nil {
		return fmt.Errorf("failed to create attribute: %w", err)
	}
	return nil
}

func (r *modelRepository) GetAttributeByID(ctx context.Context, id string) (*types.Attribute, error) {
	var attr types.Attribute
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&attr).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("attribute with id '%s' not found", id)
		}
		return nil, fmt.Errorf("failed to get attribute: %w", err)
	}
	return &attr, nil
}

func (r *modelRepository) UpdateAttribute(ctx context.Context, attr *types.Attribute) error {
	res := r.db.WithContext(ctx).Model(attr).Updates(attr)
	if res.Error != nil {
		return fmt.Errorf("failed to update attribute: %w", res.Error)
	}
	return nil
}

func (r *modelRepository) ListAttributesByModel(ctx context.Context, modelID string) ([]types.Attribute, error) {
	var attrs []types.Attribute
	if err := r.db.WithContext(ctx).Where("model_id = ?", modelID).Order("sort_order ASC").Find(&attrs).Error; err != nil {
		return nil, fmt.Errorf("failed to list attributes: %w", err)
	}
	return attrs, nil
}

func (r *modelRepository) GetModelWithAttributes(ctx context.Context, modelName string) (*types.Model, []types.Attribute, error) {
	model, err := r.GetModelByName(ctx, modelName)
	if err != nil {
		return nil, nil, err
	}
	attrs, err := r.ListAttributesByModel(ctx, model.ID.String())
	if err != nil {
		return nil, nil, err
	}
	return model, attrs, nil
}
