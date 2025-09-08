package instance

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Service provides instance management business logic
type Service struct {
	repo *Repository
}

// NewService creates a new instance service
func NewService(db *gorm.DB) *Service {
	return &Service{
		repo: NewRepository(db),
	}
}

// CreateInstance creates a new instance
func (s *Service) CreateInstance(ctx context.Context, tenantID string, req *CreateInstanceRequest) (*types.Instance, error) {
	// Validate model exists and get its fields
	model, err := s.repo.GetModelWithFields(ctx, tenantID, req.ModelID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Model not found",
			}
		}
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	
	// Validate instance data against model fields
	if err := s.validateInstanceData(model, req.Data); err != nil {
		return nil, err
	}
	
	// Marshal data to JSON
	dataBytes, err := json.Marshal(req.Data)
	if err != nil {
		return nil, &types.AppError{
			Code:    types.ErrorCodeInvalidInput,
			Message: "Invalid instance data format",
			Details: err.Error(),
		}
	}
	
	instance := &types.Instance{
		TenantModel: types.TenantModel{
			BaseModel: types.BaseModel{
				ID: uuid.New(),
			},
			TenantID: uuid.MustParse(tenantID),
		},
		ModelID: uuid.MustParse(req.ModelID),
		Name:    req.Name,
		Status:  types.InstanceStatusActive,
		Data:    dataBytes,
	}
	
	if err := s.repo.CreateInstance(ctx, instance); err != nil {
		return nil, fmt.Errorf("failed to create instance: %w", err)
	}
	
	// Load model information
	instance.Model = model
	
	return instance, nil
}

// GetInstance retrieves an instance by ID
func (s *Service) GetInstance(ctx context.Context, tenantID, id string) (*types.Instance, error) {
	instance, err := s.repo.GetInstanceByID(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Instance not found",
			}
		}
		return nil, fmt.Errorf("failed to get instance: %w", err)
	}
	
	return instance, nil
}

// GetInstanceWithRelationships retrieves an instance with its relationships
func (s *Service) GetInstanceWithRelationships(ctx context.Context, tenantID, id string) (*types.Instance, error) {
	instance, err := s.repo.GetInstanceWithRelationships(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Instance not found",
			}
		}
		return nil, fmt.Errorf("failed to get instance with relationships: %w", err)
	}
	
	return instance, nil
}

// UpdateInstance updates an instance
func (s *Service) UpdateInstance(ctx context.Context, tenantID, id string, req *UpdateInstanceRequest) (*types.Instance, error) {
	instance, err := s.GetInstance(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	
	// Get model with fields for validation
	model, err := s.repo.GetModelWithFields(ctx, tenantID, instance.ModelID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get model: %w", err)
	}
	
	// Update fields
	if req.Name != nil {
		instance.Name = *req.Name
	}
	if req.Status != nil {
		instance.Status = *req.Status
	}
	
	// Update data if provided
	if req.Data != nil {
		// Validate instance data against model fields
		if err := s.validateInstanceData(model, req.Data); err != nil {
			return nil, err
		}
		
		// If partial update, merge with existing data
		var finalData map[string]interface{}
		if req.PartialUpdate {
			// Unmarshal existing data
			var existingData map[string]interface{}
			if err := json.Unmarshal(instance.Data, &existingData); err != nil {
				return nil, &types.AppError{
					Code:    types.ErrorCodeInternalError,
					Message: "Failed to parse existing instance data",
				}
			}
			
			// Merge with new data
			finalData = existingData
			for key, value := range req.Data {
				finalData[key] = value
			}
		} else {
			finalData = req.Data
		}
		
		// Marshal updated data
		dataBytes, err := json.Marshal(finalData)
		if err != nil {
			return nil, &types.AppError{
				Code:    types.ErrorCodeInvalidInput,
				Message: "Invalid instance data format",
				Details: err.Error(),
			}
		}
		instance.Data = dataBytes
	}
	
	if err := s.repo.UpdateInstance(ctx, instance); err != nil {
		return nil, fmt.Errorf("failed to update instance: %w", err)
	}
	
	// Load model information
	instance.Model = model
	
	return instance, nil
}

// DeleteInstance deletes an instance
func (s *Service) DeleteInstance(ctx context.Context, tenantID, id string) error {
	_, err := s.GetInstance(ctx, tenantID, id)
	if err != nil {
		return err
	}
	
	// Check if instance has relationships
	hasRelationships, err := s.repo.InstanceHasRelationships(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check instance relationships: %w", err)
	}
	if hasRelationships {
		return &types.AppError{
			Code:    types.ErrorCodeConstraintViolation,
			Message: "Cannot delete instance that has relationships",
		}
	}
	
	if err := s.repo.DeleteInstance(ctx, id); err != nil {
		return fmt.Errorf("failed to delete instance: %w", err)
	}
	
	return nil
}

// ListInstances retrieves instances with pagination
func (s *Service) ListInstances(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Instance, *types.Pagination, error) {
	instances, pagination, err := s.repo.ListInstances(ctx, tenantID, options)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list instances: %w", err)
	}
	
	return instances, pagination, nil
}

// ListInstancesByModel retrieves instances for a specific model
func (s *Service) ListInstancesByModel(ctx context.Context, tenantID, modelID string, options *types.QueryOptions) ([]*types.Instance, *types.Pagination, error) {
	// Validate model exists
	if _, err := s.repo.GetModelByID(ctx, tenantID, modelID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Model not found",
			}
		}
		return nil, nil, fmt.Errorf("failed to get model: %w", err)
	}
	
	instances, pagination, err := s.repo.ListInstancesByModel(ctx, tenantID, modelID, options)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list instances by model: %w", err)
	}
	
	return instances, pagination, nil
}

// SearchInstances searches instances across models
func (s *Service) SearchInstances(ctx context.Context, tenantID string, req *SearchInstancesRequest) ([]*types.Instance, *types.Pagination, error) {
	instances, pagination, err := s.repo.SearchInstances(ctx, tenantID, req)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to search instances: %w", err)
	}
	
	return instances, pagination, nil
}

// CreateInstanceRelationship creates a relationship between instances
func (s *Service) CreateInstanceRelationship(ctx context.Context, tenantID string, req *CreateInstanceRelationshipRequest) (*types.InstanceRelationship, error) {
	// Validate instances exist
	sourceInstance, err := s.GetInstance(ctx, tenantID, req.SourceInstanceID)
	if err != nil {
		return nil, err
	}
	
	targetInstance, err := s.GetInstance(ctx, tenantID, req.TargetInstanceID)
	if err != nil {
		return nil, err
	}
	
	// Validate relationship exists and is compatible with instance models
	relationship, err := s.repo.GetRelationshipByID(ctx, tenantID, req.RelationshipID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Relationship not found",
			}
		}
		return nil, fmt.Errorf("failed to get relationship: %w", err)
	}
	
	// Check if relationship is compatible with instance models
	if relationship.SourceModelID != sourceInstance.ModelID || relationship.TargetModelID != targetInstance.ModelID {
		return nil, &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Relationship is not compatible with instance models",
		}
	}
	
	// Check relationship constraints
	if err := s.validateRelationshipConstraints(ctx, tenantID, relationship, req.SourceInstanceID, req.TargetInstanceID); err != nil {
		return nil, err
	}
	
	instanceRel := &types.InstanceRelationship{
		TenantModel: types.TenantModel{
			BaseModel: types.BaseModel{
				ID: uuid.New(),
			},
			TenantID: uuid.MustParse(tenantID),
		},
		SourceInstanceID: uuid.MustParse(req.SourceInstanceID),
		TargetInstanceID: uuid.MustParse(req.TargetInstanceID),
		RelationshipID:   uuid.MustParse(req.RelationshipID),
	}
	
	if err := s.repo.CreateInstanceRelationship(ctx, instanceRel); err != nil {
		return nil, fmt.Errorf("failed to create instance relationship: %w", err)
	}
	
	// Load related objects
	instanceRel.SourceInstance = sourceInstance
	instanceRel.TargetInstance = targetInstance
	instanceRel.Relationship = relationship
	
	return instanceRel, nil
}

// DeleteInstanceRelationship deletes a relationship between instances
func (s *Service) DeleteInstanceRelationship(ctx context.Context, tenantID, id string) error {
	// Check if relationship exists
	if _, err := s.repo.GetInstanceRelationshipByID(ctx, tenantID, id); err != nil {
		if err == gorm.ErrRecordNotFound {
			return &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Instance relationship not found",
			}
		}
		return fmt.Errorf("failed to get instance relationship: %w", err)
	}
	
	if err := s.repo.DeleteInstanceRelationship(ctx, id); err != nil {
		return fmt.Errorf("failed to delete instance relationship: %w", err)
	}
	
	return nil
}

// validateInstanceData validates instance data against model fields
func (s *Service) validateInstanceData(model *types.Model, data map[string]interface{}) error {
	if model.Fields == nil {
		return nil
	}
	
	// Create field map for quick lookup
	fieldMap := make(map[string]*types.Field)
	for i := range model.Fields {
		fieldMap[model.Fields[i].Identifier] = &model.Fields[i]
	}
	
	// Check required fields
	for _, field := range model.Fields {
		if field.IsRequired {
			if _, exists := data[field.Identifier]; !exists {
				return &types.AppError{
					Code:    types.ErrorCodeValidationFailed,
					Message: fmt.Sprintf("Required field '%s' is missing", field.Identifier),
				}
			}
		}
	}
	
	// Validate field values
	for fieldIdentifier, value := range data {
		field, exists := fieldMap[fieldIdentifier]
		if !exists {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Unknown field '%s'", fieldIdentifier),
			}
		}
		
		if err := s.validateFieldValue(field, value); err != nil {
			return err
		}
	}
	
	return nil
}

// validateFieldValue validates a field value against its type and options
func (s *Service) validateFieldValue(field *types.Field, value interface{}) error {
	if value == nil {
		if field.IsRequired {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' is required", field.Identifier),
			}
		}
		return nil
	}
	
	switch field.Type {
	case types.FieldTypeString, types.FieldTypeLongText:
		return s.validateStringField(field, value)
	case types.FieldTypeInt:
		return s.validateIntField(field, value)
	case types.FieldTypeFloat:
		return s.validateFloatField(field, value)
	case types.FieldTypeBool:
		return s.validateBoolField(field, value)
	case types.FieldTypeEnum:
		return s.validateEnumField(field, value)
	case types.FieldTypeMultiEnum:
		return s.validateMultiEnumField(field, value)
	case types.FieldTypeList:
		return s.validateListField(field, value)
	case types.FieldTypeTable:
		return s.validateTableField(field, value)
	default:
		return nil // Unknown types are allowed for flexibility
	}
}

// validateStringField validates string field values
func (s *Service) validateStringField(field *types.Field, value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be a string", field.Identifier),
		}
	}
	
	if field.Options != nil {
		if field.Options.MinLength != nil && len(str) < *field.Options.MinLength {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be at least %d characters", field.Identifier, *field.Options.MinLength),
			}
		}
		
		if field.Options.MaxLength != nil && len(str) > *field.Options.MaxLength {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be at most %d characters", field.Identifier, *field.Options.MaxLength),
			}
		}
	}
	
	return nil
}

// validateIntField validates integer field values
func (s *Service) validateIntField(field *types.Field, value interface{}) error {
	var num float64
	switch v := value.(type) {
	case int:
		num = float64(v)
	case int64:
		num = float64(v)
	case float64:
		if v != float64(int64(v)) {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be an integer", field.Identifier),
			}
		}
		num = v
	default:
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be an integer", field.Identifier),
		}
	}
	
	if field.Options != nil {
		if field.Options.Min != nil && num < *field.Options.Min {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be at least %v", field.Identifier, *field.Options.Min),
			}
		}
		
		if field.Options.Max != nil && num > *field.Options.Max {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be at most %v", field.Identifier, *field.Options.Max),
			}
		}
	}
	
	return nil
}

// validateFloatField validates float field values
func (s *Service) validateFloatField(field *types.Field, value interface{}) error {
	var num float64
	switch v := value.(type) {
	case int:
		num = float64(v)
	case int64:
		num = float64(v)
	case float64:
		num = v
	default:
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be a number", field.Identifier),
		}
	}
	
	if field.Options != nil {
		if field.Options.Min != nil && num < *field.Options.Min {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be at least %v", field.Identifier, *field.Options.Min),
			}
		}
		
		if field.Options.Max != nil && num > *field.Options.Max {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must be at most %v", field.Identifier, *field.Options.Max),
			}
		}
	}
	
	return nil
}

// validateBoolField validates boolean field values
func (s *Service) validateBoolField(field *types.Field, value interface{}) error {
	if _, ok := value.(bool); !ok {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be a boolean", field.Identifier),
		}
	}
	return nil
}

// validateEnumField validates enum field values
func (s *Service) validateEnumField(field *types.Field, value interface{}) error {
	str, ok := value.(string)
	if !ok {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be a string", field.Identifier),
		}
	}
	
	if field.Options != nil && len(field.Options.EnumValues) > 0 {
		for _, option := range field.Options.EnumValues {
			if option.Key == str {
				return nil
			}
		}
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' has invalid enum value '%s'", field.Identifier, str),
		}
	}
	
	return nil
}

// validateMultiEnumField validates multi-enum field values
func (s *Service) validateMultiEnumField(field *types.Field, value interface{}) error {
	values, ok := value.([]interface{})
	if !ok {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be an array", field.Identifier),
		}
	}
	
	if field.Options != nil && len(field.Options.EnumValues) > 0 {
		validKeys := make(map[string]bool)
		for _, option := range field.Options.EnumValues {
			validKeys[option.Key] = true
		}
		
		for _, v := range values {
			str, ok := v.(string)
			if !ok {
				return &types.AppError{
					Code:    types.ErrorCodeValidationFailed,
					Message: fmt.Sprintf("Field '%s' must contain only strings", field.Identifier),
				}
			}
			
			if !validKeys[str] {
				return &types.AppError{
					Code:    types.ErrorCodeValidationFailed,
					Message: fmt.Sprintf("Field '%s' has invalid enum value '%s'", field.Identifier, str),
				}
			}
		}
	}
	
	return nil
}

// validateListField validates list field values
func (s *Service) validateListField(field *types.Field, value interface{}) error {
	values, ok := value.([]interface{})
	if !ok {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be an array", field.Identifier),
		}
	}
	
	if field.Options != nil {
		if field.Options.ListMinItems != nil && len(values) < *field.Options.ListMinItems {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must have at least %d items", field.Identifier, *field.Options.ListMinItems),
			}
		}
		
		if field.Options.ListMaxItems != nil && len(values) > *field.Options.ListMaxItems {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Field '%s' must have at most %d items", field.Identifier, *field.Options.ListMaxItems),
			}
		}
	}
	
	return nil
}

// validateTableField validates table field values
func (s *Service) validateTableField(field *types.Field, value interface{}) error {
	rows, ok := value.([]interface{})
	if !ok {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Field '%s' must be an array of objects", field.Identifier),
		}
	}
	
	if field.Options != nil && len(field.Options.TableColumns) > 0 {
		for i, row := range rows {
			rowMap, ok := row.(map[string]interface{})
			if !ok {
				return &types.AppError{
					Code:    types.ErrorCodeValidationFailed,
					Message: fmt.Sprintf("Field '%s' row %d must be an object", field.Identifier, i+1),
				}
			}
			
			// Validate each column
			for _, column := range field.Options.TableColumns {
				if column.IsRequired {
					if _, exists := rowMap[column.Name]; !exists {
						return &types.AppError{
							Code:    types.ErrorCodeValidationFailed,
							Message: fmt.Sprintf("Field '%s' row %d missing required column '%s'", field.Identifier, i+1, column.Name),
						}
					}
				}
			}
		}
	}
	
	return nil
}

// validateRelationshipConstraints validates relationship constraints
func (s *Service) validateRelationshipConstraints(ctx context.Context, tenantID string, relationship *types.Relationship, sourceInstanceID, targetInstanceID string) error {
	switch relationship.Constraint {
	case types.ConstraintOneToOne:
		// Check if source instance already has a relationship of this type
		hasSource, err := s.repo.InstanceHasSourceRelationship(ctx, sourceInstanceID, relationship.ID.String())
		if err != nil {
			return fmt.Errorf("failed to check source relationship: %w", err)
		}
		if hasSource {
			return &types.AppError{
				Code:    types.ErrorCodeConstraintViolation,
				Message: "Source instance already has a relationship of this type (1:1 constraint)",
			}
		}
		
		// Check if target instance already has a relationship of this type
		hasTarget, err := s.repo.InstanceHasTargetRelationship(ctx, targetInstanceID, relationship.ID.String())
		if err != nil {
			return fmt.Errorf("failed to check target relationship: %w", err)
		}
		if hasTarget {
			return &types.AppError{
				Code:    types.ErrorCodeConstraintViolation,
				Message: "Target instance already has a relationship of this type (1:1 constraint)",
			}
		}
		
	case types.ConstraintOneToMany:
		// Check if target instance already has a relationship of this type
		hasTarget, err := s.repo.InstanceHasTargetRelationship(ctx, targetInstanceID, relationship.ID.String())
		if err != nil {
			return fmt.Errorf("failed to check target relationship: %w", err)
		}
		if hasTarget {
			return &types.AppError{
				Code:    types.ErrorCodeConstraintViolation,
				Message: "Target instance already has a relationship of this type (1:N constraint)",
			}
		}
	}
	
	return nil
}

// Repository provides data access for instance operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new instance repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateInstance creates a new instance
func (r *Repository) CreateInstance(ctx context.Context, instance *types.Instance) error {
	return r.db.WithContext(ctx).Create(instance).Error
}

// GetInstanceByID retrieves an instance by ID
func (r *Repository) GetInstanceByID(ctx context.Context, tenantID, id string) (*types.Instance, error) {
	var instance types.Instance
	err := r.db.WithContext(ctx).
		Preload("Model").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&instance).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

// GetInstanceWithRelationships retrieves an instance with its relationships
func (r *Repository) GetInstanceWithRelationships(ctx context.Context, tenantID, id string) (*types.Instance, error) {
	var instance types.Instance
	err := r.db.WithContext(ctx).
		Preload("Model").
		Preload("SourceRels.TargetInstance").
		Preload("SourceRels.Relationship").
		Preload("TargetRels.SourceInstance").
		Preload("TargetRels.Relationship").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&instance).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

// UpdateInstance updates an instance
func (r *Repository) UpdateInstance(ctx context.Context, instance *types.Instance) error {
	return r.db.WithContext(ctx).Save(instance).Error
}

// DeleteInstance deletes an instance
func (r *Repository) DeleteInstance(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.Instance{}, "id = ?", id).Error
}

// ListInstances retrieves instances with pagination
func (r *Repository) ListInstances(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Instance, *types.Pagination, error) {
	var instances []*types.Instance
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &instances, options)
	if err != nil {
		return nil, nil, err
	}
	
	// Preload model information
	if len(instances) > 0 {
		var modelIDs []uuid.UUID
		for _, instance := range instances {
			modelIDs = append(modelIDs, instance.ModelID)
		}
		
		var models []types.Model
		if err := r.db.WithContext(ctx).Where("id IN ?", modelIDs).Find(&models).Error; err != nil {
			return nil, nil, err
		}
		
		modelMap := make(map[uuid.UUID]*types.Model)
		for i := range models {
			modelMap[models[i].ID] = &models[i]
		}
		
		for _, instance := range instances {
			if model, ok := modelMap[instance.ModelID]; ok {
				instance.Model = model
			}
		}
	}
	
	return instances, pagination, nil
}

// ListInstancesByModel retrieves instances for a specific model
func (r *Repository) ListInstancesByModel(ctx context.Context, tenantID, modelID string, options *types.QueryOptions) ([]*types.Instance, *types.Pagination, error) {
	// Add model filter
	if options == nil {
		options = &types.QueryOptions{}
	}
	options.Filters = append(options.Filters, types.Filter{
		Field:    "model_id",
		Operator: "eq",
		Value:    modelID,
	})
	
	return r.ListInstances(ctx, tenantID, options)
}

// SearchInstances searches instances across models
func (r *Repository) SearchInstances(ctx context.Context, tenantID string, req *SearchInstancesRequest) ([]*types.Instance, *types.Pagination, error) {
	query := r.db.WithContext(ctx).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)
	
	// Apply model filter
	if len(req.ModelIDs) > 0 {
		query = query.Where("model_id IN ?", req.ModelIDs)
	}
	
	// Apply text search
	if req.Query != "" {
		query = query.Where("name ILIKE ? OR data::text ILIKE ?", "%"+req.Query+"%", "%"+req.Query+"%")
	}
	
	// Apply filters
	for _, filter := range req.Filters {
		switch filter.Operator {
		case "eq":
			query = query.Where("data->>? = ?", filter.Field, filter.Value)
		case "ne":
			query = query.Where("data->>? != ?", filter.Field, filter.Value)
		case "gt":
			query = query.Where("(data->>?)::numeric > ?", filter.Field, filter.Value)
		case "lt":
			query = query.Where("(data->>?)::numeric < ?", filter.Field, filter.Value)
		case "ge":
			query = query.Where("(data->>?)::numeric >= ?", filter.Field, filter.Value)
		case "le":
			query = query.Where("(data->>?)::numeric <= ?", filter.Field, filter.Value)
		case "in":
			query = query.Where("data->>? = ANY(?)", filter.Field, filter.Value)
		case "like":
			query = query.Where("data->>? ILIKE ?", filter.Field, "%"+fmt.Sprintf("%v", filter.Value)+"%")
		}
	}
	
	// Count total
	var total int64
	if err := query.Model(&types.Instance{}).Count(&total).Error; err != nil {
		return nil, nil, err
	}
	
	// Apply pagination
	pagination := &types.Pagination{Total: total}
	if req.Pagination != nil {
		pagination = req.Pagination
		pagination.Total = total
		query = query.Offset(pagination.GetOffset()).Limit(pagination.PageSize)
	}
	
	// Apply sorting
	if len(req.Sort) > 0 {
		for _, sort := range req.Sort {
			if sort.Field == "name" || sort.Field == "created_at" || sort.Field == "updated_at" {
				query = query.Order(fmt.Sprintf("%s %s", sort.Field, sort.Order))
			} else {
				// Sort by JSON field
				query = query.Order(fmt.Sprintf("data->>%s %s", sort.Field, sort.Order))
			}
		}
	} else {
		query = query.Order("created_at DESC")
	}
	
	// Execute query
	var instances []*types.Instance
	if err := query.Preload("Model").Find(&instances).Error; err != nil {
		return nil, nil, err
	}
	
	return instances, pagination, nil
}

// Helper methods for checking relationships and models
func (r *Repository) GetModelByID(ctx context.Context, tenantID, id string) (*types.Model, error) {
	var model types.Model
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *Repository) GetModelWithFields(ctx context.Context, tenantID, id string) (*types.Model, error) {
	var model types.Model
	err := r.db.WithContext(ctx).
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

func (r *Repository) InstanceHasRelationships(ctx context.Context, instanceID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.InstanceRelationship{}).
		Where("(source_instance_id = ? OR target_instance_id = ?) AND deleted_at IS NULL", instanceID, instanceID).
		Count(&count).Error
	return count > 0, err
}

// Instance relationship methods
func (r *Repository) CreateInstanceRelationship(ctx context.Context, rel *types.InstanceRelationship) error {
	return r.db.WithContext(ctx).Create(rel).Error
}

func (r *Repository) GetInstanceRelationshipByID(ctx context.Context, tenantID, id string) (*types.InstanceRelationship, error) {
	var rel types.InstanceRelationship
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&rel).Error
	if err != nil {
		return nil, err
	}
	return &rel, nil
}

func (r *Repository) DeleteInstanceRelationship(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.InstanceRelationship{}, "id = ?", id).Error
}

func (r *Repository) GetRelationshipByID(ctx context.Context, tenantID, id string) (*types.Relationship, error) {
	var rel types.Relationship
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&rel).Error
	if err != nil {
		return nil, err
	}
	return &rel, nil
}

func (r *Repository) InstanceHasSourceRelationship(ctx context.Context, instanceID, relationshipID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.InstanceRelationship{}).
		Where("source_instance_id = ? AND relationship_id = ? AND deleted_at IS NULL", instanceID, relationshipID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) InstanceHasTargetRelationship(ctx context.Context, instanceID, relationshipID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.InstanceRelationship{}).
		Where("target_instance_id = ? AND relationship_id = ? AND deleted_at IS NULL", instanceID, relationshipID).
		Count(&count).Error
	return count > 0, err
}