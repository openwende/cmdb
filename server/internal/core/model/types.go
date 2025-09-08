package model

import (
	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
)

// CreateModelGroupRequest represents a request to create a model group
type CreateModelGroupRequest struct {
	Name        string `json:"name" validate:"required,max=100"`
	Identifier  string `json:"identifier" validate:"required,max=100,alphanum"`
	Description string `json:"description,omitempty" validate:"max=500"`
}

// UpdateModelGroupRequest represents a request to update a model group
type UpdateModelGroupRequest struct {
	Name        *string `json:"name,omitempty" validate:"omitempty,max=100"`
	Identifier  *string `json:"identifier,omitempty" validate:"omitempty,max=100,alphanum"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=500"`
}

// CreateModelRequest represents a request to create a model
type CreateModelRequest struct {
	Name        string `json:"name" validate:"required,max=100"`
	Identifier  string `json:"identifier" validate:"required,max=100,alphanum"`
	Description string `json:"description,omitempty" validate:"max=500"`
	GroupID     string `json:"group_id" validate:"required,uuid"`
	Icon        string `json:"icon,omitempty" validate:"max=100"`
}

// UpdateModelRequest represents a request to update a model
type UpdateModelRequest struct {
	Name        *string            `json:"name,omitempty" validate:"omitempty,max=100"`
	Identifier  *string            `json:"identifier,omitempty" validate:"omitempty,max=100,alphanum"`
	Description *string            `json:"description,omitempty" validate:"omitempty,max=500"`
	GroupID     *uuid.UUID         `json:"group_id,omitempty" validate:"omitempty,uuid"`
	Icon        *string            `json:"icon,omitempty" validate:"omitempty,max=100"`
	Status      *types.ModelStatus `json:"status,omitempty" validate:"omitempty,oneof=active inactive archived"`
}

// CreateFieldGroupRequest represents a request to create a field group
type CreateFieldGroupRequest struct {
	Name          string `json:"name" validate:"required,max=100"`
	Identifier    string `json:"identifier" validate:"required,max=100,alphanum"`
	ModelID       string `json:"model_id" validate:"required,uuid"`
	Description   string `json:"description,omitempty" validate:"max=500"`
	IsCollapsible bool   `json:"is_collapsible,omitempty"`
	IsCollapsed   bool   `json:"is_collapsed,omitempty"`
	DisplayOrder  int    `json:"display_order,omitempty"`
}

// UpdateFieldGroupRequest represents a request to update a field group
type UpdateFieldGroupRequest struct {
	Name          *string `json:"name,omitempty" validate:"omitempty,max=100"`
	Description   *string `json:"description,omitempty" validate:"omitempty,max=500"`
	IsCollapsible *bool   `json:"is_collapsible,omitempty"`
	IsCollapsed   *bool   `json:"is_collapsed,omitempty"`
	DisplayOrder  *int    `json:"display_order,omitempty"`
}

// CreateFieldRequest represents a request to create a field
type CreateFieldRequest struct {
	Name         string                `json:"name" validate:"required,max=100"`
	Identifier   string                `json:"identifier" validate:"required,max=100,alphanum"`
	ModelID      string                `json:"model_id" validate:"required,uuid"`
	GroupID      *string               `json:"group_id,omitempty" validate:"omitempty,uuid"`
	Type         types.FieldType       `json:"type" validate:"required,oneof=string longtext int float bool date datetime enum multi_enum user timezone list table"`
	Description  string                `json:"description,omitempty" validate:"max=500"`
	IsRequired   bool                  `json:"is_required,omitempty"`
	IsUnique     bool                  `json:"is_unique,omitempty"`
	IsEditable   bool                  `json:"is_editable,omitempty"`
	DefaultValue *string               `json:"default_value,omitempty"`
	Options      *types.FieldOptions   `json:"options,omitempty"`
	DisplayOrder int                   `json:"display_order,omitempty"`
}

// UpdateFieldRequest represents a request to update a field
type UpdateFieldRequest struct {
	Name         *string             `json:"name,omitempty" validate:"omitempty,max=100"`
	GroupID      *string             `json:"group_id,omitempty" validate:"omitempty,uuid"`
	Description  *string             `json:"description,omitempty" validate:"omitempty,max=500"`
	IsRequired   *bool               `json:"is_required,omitempty"`
	IsUnique     *bool               `json:"is_unique,omitempty"`
	IsEditable   *bool               `json:"is_editable,omitempty"`
	DefaultValue *string             `json:"default_value,omitempty"`
	Options      *types.FieldOptions `json:"options,omitempty"`
	DisplayOrder *int                `json:"display_order,omitempty"`
}

// CreateRelationshipTypeRequest represents a request to create a relationship type
type CreateRelationshipTypeRequest struct {
	Name        string `json:"name" validate:"required,max=100"`
	Identifier  string `json:"identifier" validate:"required,max=100,alphanum"`
	Description string `json:"description,omitempty" validate:"max=500"`
	Direction   string `json:"direction,omitempty" validate:"omitempty,oneof=forward backward bidirectional"`
}

// UpdateRelationshipTypeRequest represents a request to update a relationship type
type UpdateRelationshipTypeRequest struct {
	Name        *string `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string `json:"description,omitempty" validate:"omitempty,max=500"`
	Direction   *string `json:"direction,omitempty" validate:"omitempty,oneof=forward backward bidirectional"`
}

// CreateRelationshipRequest represents a request to create a relationship
type CreateRelationshipRequest struct {
	Name            string                `json:"name" validate:"required,max=100"`
	Description     string                `json:"description,omitempty" validate:"max=500"`
	SourceModelID   string                `json:"source_model_id" validate:"required,uuid"`
	TargetModelID   string                `json:"target_model_id" validate:"required,uuid"`
	TypeID          string                `json:"type_id" validate:"required,uuid"`
	Constraint      types.ConstraintType  `json:"constraint,omitempty" validate:"omitempty,oneof=1:1 1:N N:N"`
	IsMandatory     bool                  `json:"is_mandatory,omitempty"`
}

// UpdateRelationshipRequest represents a request to update a relationship
type UpdateRelationshipRequest struct {
	Name        *string               `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string               `json:"description,omitempty" validate:"omitempty,max=500"`
	TypeID      *string               `json:"type_id,omitempty" validate:"omitempty,uuid"`
	Constraint  *types.ConstraintType `json:"constraint,omitempty" validate:"omitempty,oneof=1:1 1:N N:N"`
	IsMandatory *bool                 `json:"is_mandatory,omitempty"`
}

// ModelSummary represents a summary of a model
type ModelSummary struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Identifier  string    `json:"identifier"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Status      string    `json:"status"`
	FieldCount  int       `json:"field_count"`
	InstanceCount int64   `json:"instance_count"`
	GroupName   string    `json:"group_name"`
	IsBuiltIn   bool      `json:"is_built_in"`
}

// FieldValidationResult represents field validation result
type FieldValidationResult struct {
	IsValid bool                   `json:"is_valid"`
	Errors  []FieldValidationError `json:"errors,omitempty"`
}

// FieldValidationError represents a field validation error
type FieldValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// ModelExportRequest represents a request to export a model
type ModelExportRequest struct {
	ModelIDs      []string `json:"model_ids" validate:"required,min=1"`
	IncludeFields bool     `json:"include_fields,omitempty"`
	IncludeRelationships bool `json:"include_relationships,omitempty"`
	Format        string   `json:"format,omitempty" validate:"omitempty,oneof=json yaml"`
}

// ModelImportRequest represents a request to import a model
type ModelImportRequest struct {
	Data        string `json:"data" validate:"required"`
	Format      string `json:"format" validate:"required,oneof=json yaml"`
	OverwriteExisting bool `json:"overwrite_existing,omitempty"`
	ValidateOnly bool   `json:"validate_only,omitempty"`
}

// ModelImportResult represents the result of a model import
type ModelImportResult struct {
	Success      bool                    `json:"success"`
	CreatedModels []string               `json:"created_models,omitempty"`
	UpdatedModels []string               `json:"updated_models,omitempty"`
	Errors       []ModelImportError     `json:"errors,omitempty"`
	Warnings     []string               `json:"warnings,omitempty"`
}

// ModelImportError represents an error during model import
type ModelImportError struct {
	Model   string `json:"model,omitempty"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
}

// ModelStats represents statistics about models
type ModelStats struct {
	TotalModels       int64                     `json:"total_models"`
	ActiveModels      int64                     `json:"active_models"`
	InactiveModels    int64                     `json:"inactive_models"`
	TotalFields       int64                     `json:"total_fields"`
	TotalInstances    int64                     `json:"total_instances"`
	ModelsByGroup     map[string]int64          `json:"models_by_group"`
	FieldsByType      map[string]int64          `json:"fields_by_type"`
	TopModelsByInstance []ModelInstanceCount    `json:"top_models_by_instance"`
}

// ModelInstanceCount represents model instance count statistics
type ModelInstanceCount struct {
	ModelID       uuid.UUID `json:"model_id"`
	ModelName     string    `json:"model_name"`
	InstanceCount int64     `json:"instance_count"`
}

// ValidateFieldOptions validates field options based on field type
func (req *CreateFieldRequest) ValidateFieldOptions() error {
	if req.Options == nil {
		return nil
	}
	
	switch req.Type {
	case types.FieldTypeString, types.FieldTypeLongText:
		return req.validateStringOptions()
	case types.FieldTypeInt, types.FieldTypeFloat:
		return req.validateNumberOptions()
	case types.FieldTypeEnum, types.FieldTypeMultiEnum:
		return req.validateEnumOptions()
	case types.FieldTypeList:
		return req.validateListOptions()
	case types.FieldTypeTable:
		return req.validateTableOptions()
	}
	
	return nil
}

func (req *CreateFieldRequest) validateStringOptions() error {
	if req.Options.MinLength != nil && *req.Options.MinLength < 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "MinLength must be non-negative",
		}
	}
	
	if req.Options.MaxLength != nil && *req.Options.MaxLength <= 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "MaxLength must be positive",
		}
	}
	
	if req.Options.MinLength != nil && req.Options.MaxLength != nil && *req.Options.MinLength > *req.Options.MaxLength {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "MinLength cannot be greater than MaxLength",
		}
	}
	
	return nil
}

func (req *CreateFieldRequest) validateNumberOptions() error {
	if req.Options.Min != nil && req.Options.Max != nil && *req.Options.Min > *req.Options.Max {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Min value cannot be greater than Max value",
		}
	}
	
	return nil
}

func (req *CreateFieldRequest) validateEnumOptions() error {
	if len(req.Options.EnumValues) == 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Enum fields must have at least one option",
		}
	}
	
	keys := make(map[string]bool)
	defaultCount := 0
	
	for _, option := range req.Options.EnumValues {
		if option.Key == "" {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Enum option key cannot be empty",
			}
		}
		
		if option.Value == "" {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Enum option value cannot be empty",
			}
		}
		
		if keys[option.Key] {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Duplicate enum option key: " + option.Key,
			}
		}
		keys[option.Key] = true
		
		if option.IsDefault {
			defaultCount++
		}
	}
	
	if req.Type == types.FieldTypeEnum && defaultCount > 1 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Single enum fields can have only one default option",
		}
	}
	
	return nil
}

func (req *CreateFieldRequest) validateListOptions() error {
	if req.Options.ListItemType == nil {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "List fields must specify item type",
		}
	}
	
	if req.Options.ListMinItems != nil && *req.Options.ListMinItems < 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "ListMinItems must be non-negative",
		}
	}
	
	if req.Options.ListMaxItems != nil && *req.Options.ListMaxItems <= 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "ListMaxItems must be positive",
		}
	}
	
	if req.Options.ListMinItems != nil && req.Options.ListMaxItems != nil && 
		*req.Options.ListMinItems > *req.Options.ListMaxItems {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "ListMinItems cannot be greater than ListMaxItems",
		}
	}
	
	return nil
}

func (req *CreateFieldRequest) validateTableOptions() error {
	if len(req.Options.TableColumns) == 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Table fields must have at least one column",
		}
	}
	
	names := make(map[string]bool)
	
	for _, column := range req.Options.TableColumns {
		if column.Name == "" {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Table column name cannot be empty",
			}
		}
		
		if names[column.Name] {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Duplicate table column name: " + column.Name,
			}
		}
		names[column.Name] = true
		
		// Validate column type
		validTypes := map[types.FieldType]bool{
			types.FieldTypeString:   true,
			types.FieldTypeInt:      true,
			types.FieldTypeFloat:    true,
			types.FieldTypeBool:     true,
			types.FieldTypeDate:     true,
			types.FieldTypeDateTime: true,
			types.FieldTypeEnum:     true,
		}
		
		if !validTypes[column.Type] {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Invalid table column type: " + string(column.Type),
			}
		}
	}
	
	return nil
}