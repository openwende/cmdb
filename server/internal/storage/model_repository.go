package storage

import (
	"context"
	"errors"
	"fmt"

	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/gorm"
)

type ModelRepository interface {
	// Models
	CreateModel(ctx context.Context, model *types.Model) error
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
// Model Operations
// ==========================================

func (r *modelRepository) CreateModel(ctx context.Context, model *types.Model) error {
	res := r.db.WithContext(ctx).Create(model)
	if err := res.Error; err != nil {
		return fmt.Errorf("failed to create model: %w", err)
	}
	return nil
}

func (r *modelRepository) GetModelByID(ctx context.Context, id string) (*types.Model, error) {
	var model types.Model
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("model with id '%s' not found", id)
		}
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return &model, nil
}

func (r *modelRepository) GetModelByName(ctx context.Context, name string) (*types.Model, error) {
	var model types.Model
	if err := r.db.WithContext(ctx).Where("name = ?", name).First(&model).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("model with name '%s' not found", name)
		}
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	return &model, nil
}

func (r *modelRepository) ListModels(ctx context.Context) ([]types.Model, error) {
	var models []types.Model
	if err := r.db.WithContext(ctx).Order("created_at DESC").Find(&models).Error; err != nil {
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
