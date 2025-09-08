package model

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Service provides model management business logic
type Service struct {
	repo *Repository
}

// NewService creates a new model service
func NewService(db *gorm.DB) *Service {
	return &Service{
		repo: NewRepository(db),
	}
}

// CreateModelGroup creates a new model group
func (s *Service) CreateModelGroup(ctx context.Context, tenantID string, req *CreateModelGroupRequest) (*types.ModelGroup, error) {
	// Check if identifier already exists
	if exists, err := s.repo.ModelGroupExistsByIdentifier(ctx, tenantID, req.Identifier); err != nil {
		return nil, err
	} else if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "Model group with this identifier already exists",
		}
	}
	
	group := &types.ModelGroup{
		TenantModel: types.TenantModel{
			BaseModel: types.BaseModel{
				ID: uuid.New(),
			},
			TenantID: uuid.MustParse(tenantID),
		},
		Name:        req.Name,
		Identifier:  req.Identifier,
		Description: req.Description,
		IsBuiltIn:   false,
	}
	
	if err := s.repo.CreateModelGroup(ctx, group); err != nil {
		return nil, fmt.Errorf("failed to create model group: %w", err)
	}
	
	return group, nil
}

// GetModelGroup retrieves a model group by ID
func (s *Service) GetModelGroup(ctx context.Context, tenantID, id string) (*types.ModelGroup, error) {
	group, err := s.repo.GetModelGroupByID(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Model group not found",
			}
		}
		return nil, fmt.Errorf("failed to get model group: %w", err)
	}
	
	return group, nil
}

// UpdateModelGroup updates a model group
func (s *Service) UpdateModelGroup(ctx context.Context, tenantID, id string, req *UpdateModelGroupRequest) (*types.ModelGroup, error) {
	group, err := s.GetModelGroup(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	
	if group.IsBuiltIn {
		return nil, &types.AppError{
			Code:    types.ErrorCodePermissionDenied,
			Message: "Built-in model groups cannot be modified",
		}
	}
	
	// Check identifier uniqueness if changing
	if req.Identifier != nil && *req.Identifier != group.Identifier {
		if exists, err := s.repo.ModelGroupExistsByIdentifier(ctx, tenantID, *req.Identifier); err != nil {
			return nil, err
		} else if exists {
			return nil, &types.AppError{
				Code:    types.ErrorCodeAlreadyExists,
				Message: "Model group with this identifier already exists",
			}
		}
		group.Identifier = *req.Identifier
	}
	
	if req.Name != nil {
		group.Name = *req.Name
	}
	if req.Description != nil {
		group.Description = *req.Description
	}
	
	if err := s.repo.UpdateModelGroup(ctx, group); err != nil {
		return nil, fmt.Errorf("failed to update model group: %w", err)
	}
	
	return group, nil
}

// DeleteModelGroup deletes a model group
func (s *Service) DeleteModelGroup(ctx context.Context, tenantID, id string) error {
	group, err := s.GetModelGroup(ctx, tenantID, id)
	if err != nil {
		return err
	}
	
	if group.IsBuiltIn {
		return &types.AppError{
			Code:    types.ErrorCodePermissionDenied,
			Message: "Built-in model groups cannot be deleted",
		}
	}
	
	// Check if group has models
	hasModels, err := s.repo.ModelGroupHasModels(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check if model group has models: %w", err)
	}
	if hasModels {
		return &types.AppError{
			Code:    types.ErrorCodeConstraintViolation,
			Message: "Cannot delete model group that contains models",
		}
	}
	
	if err := s.repo.DeleteModelGroup(ctx, id); err != nil {
		return fmt.Errorf("failed to delete model group: %w", err)
	}
	
	return nil
}

// ListModelGroups retrieves model groups with pagination
func (s *Service) ListModelGroups(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.ModelGroup, *types.Pagination, error) {
	groups, pagination, err := s.repo.ListModelGroups(ctx, tenantID, options)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list model groups: %w", err)
	}
	
	return groups, pagination, nil
}

// CreateModel creates a new model
func (s *Service) CreateModel(ctx context.Context, tenantID string, req *CreateModelRequest) (*types.Model, error) {
	// Validate group exists
	if _, err := s.GetModelGroup(ctx, tenantID, req.GroupID); err != nil {
		return nil, err
	}
	
	// Check if identifier already exists
	if exists, err := s.repo.ModelExistsByIdentifier(ctx, tenantID, req.Identifier); err != nil {
		return nil, err
	} else if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "Model with this identifier already exists",
		}
	}
	
	model := &types.Model{
		TenantModel: types.TenantModel{
			BaseModel: types.BaseModel{
				ID: uuid.New(),
			},
			TenantID: uuid.MustParse(tenantID),
		},
		Name:        req.Name,
		Identifier:  req.Identifier,
		Description: req.Description,
		GroupID:     uuid.MustParse(req.GroupID),
		Icon:        req.Icon,
		Status:      types.ModelStatusActive,
		IsBuiltIn:   false,
	}
	
	// Create model and default field group in transaction
	err := s.repo.db.Transaction(func(tx *gorm.DB) error {
		// Create model
		if err := tx.Create(model).Error; err != nil {
			return err
		}
		
		// Create default field group
		defaultGroup := &types.FieldGroup{
			TenantModel: types.TenantModel{
				BaseModel: types.BaseModel{
					ID: uuid.New(),
				},
				TenantID: uuid.MustParse(tenantID),
			},
			Name:        "Default",
			Identifier:  "default",
			ModelID:     model.ID,
			Description: "Default field group",
		}
		
		if err := tx.Create(defaultGroup).Error; err != nil {
			return err
		}
		
		// Create default instance name field
		instanceNameField := &types.Field{
			TenantModel: types.TenantModel{
				BaseModel: types.BaseModel{
					ID: uuid.New(),
				},
				TenantID: uuid.MustParse(tenantID),
			},
			Name:         "Instance Name",
			Identifier:   "instance_name",
			ModelID:      model.ID,
			GroupID:      &defaultGroup.ID,
			Type:         types.FieldTypeString,
			Description:  "Name of the instance",
			IsRequired:   true,
			IsEditable:   true,
			IsBuiltIn:    true,
			DisplayOrder: 1,
		}
		
		return tx.Create(instanceNameField).Error
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to create model: %w", err)
	}
	
	return model, nil
}

// GetModel retrieves a model by ID
func (s *Service) GetModel(ctx context.Context, tenantID, id string) (*types.Model, error) {
	model, err := s.repo.GetModelByID(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Model not found",
			}
		}
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	
	return model, nil
}

// GetModelWithFields retrieves a model with its fields
func (s *Service) GetModelWithFields(ctx context.Context, tenantID, id string) (*types.Model, error) {
	model, err := s.repo.GetModelWithFields(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Model not found",
			}
		}
		return nil, fmt.Errorf("failed to get model with fields: %w", err)
	}
	
	return model, nil
}

// UpdateModel updates a model
func (s *Service) UpdateModel(ctx context.Context, tenantID, id string, req *UpdateModelRequest) (*types.Model, error) {
	model, err := s.GetModel(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	
	if model.IsBuiltIn {
		return nil, &types.AppError{
			Code:    types.ErrorCodePermissionDenied,
			Message: "Built-in models cannot be modified",
		}
	}
	
	// Check identifier uniqueness if changing
	if req.Identifier != nil && *req.Identifier != model.Identifier {
		if exists, err := s.repo.ModelExistsByIdentifier(ctx, tenantID, *req.Identifier); err != nil {
			return nil, err
		} else if exists {
			return nil, &types.AppError{
				Code:    types.ErrorCodeAlreadyExists,
				Message: "Model with this identifier already exists",
			}
		}
		model.Identifier = *req.Identifier
	}
	
	// Validate group if changing
	if req.GroupID != nil && req.GroupID.String() != model.GroupID.String() {
		if _, err := s.GetModelGroup(ctx, tenantID, req.GroupID.String()); err != nil {
			return nil, err
		}
		model.GroupID = *req.GroupID
	}
	
	if req.Name != nil {
		model.Name = *req.Name
	}
	if req.Description != nil {
		model.Description = *req.Description
	}
	if req.Icon != nil {
		model.Icon = *req.Icon
	}
	if req.Status != nil {
		model.Status = *req.Status
	}
	
	if err := s.repo.UpdateModel(ctx, model); err != nil {
		return nil, fmt.Errorf("failed to update model: %w", err)
	}
	
	return model, nil
}

// DeleteModel deletes a model
func (s *Service) DeleteModel(ctx context.Context, tenantID, id string) error {
	model, err := s.GetModel(ctx, tenantID, id)
	if err != nil {
		return err
	}
	
	if model.IsBuiltIn {
		return &types.AppError{
			Code:    types.ErrorCodePermissionDenied,
			Message: "Built-in models cannot be deleted",
		}
	}
	
	// Check if model has instances
	hasInstances, err := s.repo.ModelHasInstances(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check if model has instances: %w", err)
	}
	if hasInstances {
		return &types.AppError{
			Code:    types.ErrorCodeConstraintViolation,
			Message: "Cannot delete model that has instances",
		}
	}
	
	// Check if model is used in relationships
	hasRelationships, err := s.repo.ModelHasRelationships(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check if model has relationships: %w", err)
	}
	if hasRelationships {
		return &types.AppError{
			Code:    types.ErrorCodeConstraintViolation,
			Message: "Cannot delete model that is used in relationships",
		}
	}
	
	// Delete model and related data in transaction
	err = s.repo.db.Transaction(func(tx *gorm.DB) error {
		// Delete fields
		if err := tx.Where("model_id = ?", id).Delete(&types.Field{}).Error; err != nil {
			return err
		}
		
		// Delete field groups
		if err := tx.Where("model_id = ?", id).Delete(&types.FieldGroup{}).Error; err != nil {
			return err
		}
		
		// Delete model
		return tx.Delete(&types.Model{}, "id = ?", id).Error
	})
	
	if err != nil {
		return fmt.Errorf("failed to delete model: %w", err)
	}
	
	return nil
}

// ListModels retrieves models with pagination
func (s *Service) ListModels(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Model, *types.Pagination, error) {
	models, pagination, err := s.repo.ListModels(ctx, tenantID, options)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list models: %w", err)
	}
	
	return models, pagination, nil
}

// Repository provides data access for model operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new model repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateModelGroup creates a new model group
func (r *Repository) CreateModelGroup(ctx context.Context, group *types.ModelGroup) error {
	return r.db.WithContext(ctx).Create(group).Error
}

// GetModelGroupByID retrieves a model group by ID
func (r *Repository) GetModelGroupByID(ctx context.Context, tenantID, id string) (*types.ModelGroup, error) {
	var group types.ModelGroup
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&group).Error
	if err != nil {
		return nil, err
	}
	return &group, nil
}

// UpdateModelGroup updates a model group
func (r *Repository) UpdateModelGroup(ctx context.Context, group *types.ModelGroup) error {
	return r.db.WithContext(ctx).Save(group).Error
}

// DeleteModelGroup deletes a model group
func (r *Repository) DeleteModelGroup(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.ModelGroup{}, "id = ?", id).Error
}

// ListModelGroups retrieves model groups with pagination
func (r *Repository) ListModelGroups(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.ModelGroup, *types.Pagination, error) {
	var groups []*types.ModelGroup
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &groups, options)
	if err != nil {
		return nil, nil, err
	}
	return groups, pagination, nil
}

// ModelGroupExistsByIdentifier checks if a model group exists by identifier
func (r *Repository) ModelGroupExistsByIdentifier(ctx context.Context, tenantID, identifier string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.ModelGroup{}).
		Where("tenant_id = ? AND identifier = ? AND deleted_at IS NULL", tenantID, identifier).
		Count(&count).Error
	return count > 0, err
}

// ModelGroupHasModels checks if a model group has models
func (r *Repository) ModelGroupHasModels(ctx context.Context, groupID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Model{}).
		Where("group_id = ? AND deleted_at IS NULL", groupID).
		Count(&count).Error
	return count > 0, err
}

// CreateModel creates a new model
func (r *Repository) CreateModel(ctx context.Context, model *types.Model) error {
	return r.db.WithContext(ctx).Create(model).Error
}

// GetModelByID retrieves a model by ID
func (r *Repository) GetModelByID(ctx context.Context, tenantID, id string) (*types.Model, error) {
	var model types.Model
	err := r.db.WithContext(ctx).
		Preload("Group").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

// GetModelWithFields retrieves a model with its fields
func (r *Repository) GetModelWithFields(ctx context.Context, tenantID, id string) (*types.Model, error) {
	var model types.Model
	err := r.db.WithContext(ctx).
		Preload("Group").
		Preload("FieldGroups", func(db *gorm.DB) *gorm.DB {
			return db.Order("display_order ASC")
		}).
		Preload("Fields", func(db *gorm.DB) *gorm.DB {
			return db.Order("display_order ASC")
		}).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

// UpdateModel updates a model
func (r *Repository) UpdateModel(ctx context.Context, model *types.Model) error {
	return r.db.WithContext(ctx).Save(model).Error
}

// DeleteModel deletes a model
func (r *Repository) DeleteModel(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.Model{}, "id = ?", id).Error
}

// ListModels retrieves models with pagination
func (r *Repository) ListModels(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Model, *types.Pagination, error) {
	var models []*types.Model
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &models, options)
	if err != nil {
		return nil, nil, err
	}
	
	// Preload group information
	if len(models) > 0 {
		var modelIDs []uuid.UUID
		for _, model := range models {
			modelIDs = append(modelIDs, model.ID)
		}
		
		var groups []types.ModelGroup
		if err := r.db.WithContext(ctx).Where("id IN ?", modelIDs).Find(&groups).Error; err != nil {
			return nil, nil, err
		}
		
		groupMap := make(map[uuid.UUID]*types.ModelGroup)
		for i := range groups {
			groupMap[groups[i].ID] = &groups[i]
		}
		
		for _, model := range models {
			if group, ok := groupMap[model.GroupID]; ok {
				model.Group = group
			}
		}
	}
	
	return models, pagination, nil
}

// ModelExistsByIdentifier checks if a model exists by identifier
func (r *Repository) ModelExistsByIdentifier(ctx context.Context, tenantID, identifier string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Model{}).
		Where("tenant_id = ? AND identifier = ? AND deleted_at IS NULL", tenantID, identifier).
		Count(&count).Error
	return count > 0, err
}

// ModelHasInstances checks if a model has instances
func (r *Repository) ModelHasInstances(ctx context.Context, modelID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Instance{}).
		Where("model_id = ? AND deleted_at IS NULL", modelID).
		Count(&count).Error
	return count > 0, err
}

// ModelHasRelationships checks if a model is used in relationships
func (r *Repository) ModelHasRelationships(ctx context.Context, modelID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Relationship{}).
		Where("(source_model_id = ? OR target_model_id = ?) AND deleted_at IS NULL", modelID, modelID).
		Count(&count).Error
	return count > 0, err
}