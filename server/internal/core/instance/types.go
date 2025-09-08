package instance

import (
	"fmt"
	"strings"

	"github.com/wend/cmdb-backend/pkg/types"
)

// CreateInstanceRequest represents a request to create an instance
type CreateInstanceRequest struct {
	ModelID string                 `json:"model_id" validate:"required,uuid"`
	Name    string                 `json:"name" validate:"required,max=200"`
	Data    map[string]interface{} `json:"data" validate:"required"`
}

// UpdateInstanceRequest represents a request to update an instance
type UpdateInstanceRequest struct {
	Name          *string                `json:"name,omitempty" validate:"omitempty,max=200"`
	Status        *types.InstanceStatus  `json:"status,omitempty" validate:"omitempty,oneof=active inactive deleted"`
	Data          map[string]interface{} `json:"data,omitempty"`
	PartialUpdate bool                   `json:"partial_update,omitempty"` // If true, merge with existing data
}

// SearchInstancesRequest represents a request to search instances
type SearchInstancesRequest struct {
	Query      string               `json:"query,omitempty"`      // Text search across name and data
	ModelIDs   []string             `json:"model_ids,omitempty"`  // Filter by model IDs
	Filters    []InstanceFilter     `json:"filters,omitempty"`    // Field-based filters
	Pagination *types.Pagination    `json:"pagination,omitempty"`
	Sort       []types.Sort         `json:"sort,omitempty"`
}

// InstanceFilter represents a filter for instance data
type InstanceFilter struct {
	Field    string      `json:"field" validate:"required"`    // Data field name
	Operator string      `json:"operator" validate:"required,oneof=eq ne gt lt ge le in like"` // Comparison operator
	Value    interface{} `json:"value" validate:"required"`    // Filter value
}

// CreateInstanceRelationshipRequest represents a request to create a relationship between instances
type CreateInstanceRelationshipRequest struct {
	SourceInstanceID string `json:"source_instance_id" validate:"required,uuid"`
	TargetInstanceID string `json:"target_instance_id" validate:"required,uuid"`
	RelationshipID   string `json:"relationship_id" validate:"required,uuid"`
}

// InstanceSummary represents a summary of an instance
type InstanceSummary struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	ModelID          string                 `json:"model_id"`
	ModelName        string                 `json:"model_name"`
	Status           string                 `json:"status"`
	KeyFields        map[string]interface{} `json:"key_fields,omitempty"`        // Important fields for display
	RelationshipCount int                   `json:"relationship_count"`
	CreatedAt        string                 `json:"created_at"`
	UpdatedAt        string                 `json:"updated_at"`
}

// InstanceDetail represents detailed instance information
type InstanceDetail struct {
	*types.Instance
	FieldValues       map[string]InstanceFieldValue `json:"field_values,omitempty"`
	SourceRelationships []RelationshipSummary       `json:"source_relationships,omitempty"`
	TargetRelationships []RelationshipSummary       `json:"target_relationships,omitempty"`
}

// InstanceFieldValue represents a field value with metadata
type InstanceFieldValue struct {
	Value       interface{}      `json:"value"`
	DisplayValue string          `json:"display_value,omitempty"` // Human-readable value
	Field       *types.Field     `json:"field,omitempty"`
}

// RelationshipSummary represents a relationship summary
type RelationshipSummary struct {
	ID                string `json:"id"`
	RelationshipID    string `json:"relationship_id"`
	RelationshipName  string `json:"relationship_name"`
	RelatedInstanceID string `json:"related_instance_id"`
	RelatedInstanceName string `json:"related_instance_name"`
	RelatedModelName  string `json:"related_model_name"`
	Direction         string `json:"direction"` // "source" or "target"
}

// InstanceExportRequest represents a request to export instances
type InstanceExportRequest struct {
	ModelIDs       []string `json:"model_ids,omitempty"`
	InstanceIDs    []string `json:"instance_ids,omitempty"`
	IncludeRelationships bool `json:"include_relationships,omitempty"`
	Format         string   `json:"format,omitempty" validate:"omitempty,oneof=json csv excel"`
}

// InstanceImportRequest represents a request to import instances
type InstanceImportRequest struct {
	ModelID       string `json:"model_id" validate:"required,uuid"`
	Data          string `json:"data" validate:"required"`
	Format        string `json:"format" validate:"required,oneof=json csv excel"`
	UpdateExisting bool  `json:"update_existing,omitempty"`
	ValidateOnly  bool   `json:"validate_only,omitempty"`
}

// InstanceImportResult represents the result of an instance import
type InstanceImportResult struct {
	Success         bool                    `json:"success"`
	ProcessedCount  int                     `json:"processed_count"`
	CreatedCount    int                     `json:"created_count"`
	UpdatedCount    int                     `json:"updated_count"`
	SkippedCount    int                     `json:"skipped_count"`
	ErrorCount      int                     `json:"error_count"`
	Errors          []InstanceImportError   `json:"errors,omitempty"`
	Warnings        []string                `json:"warnings,omitempty"`
	CreatedInstances []string               `json:"created_instances,omitempty"`
	UpdatedInstances []string               `json:"updated_instances,omitempty"`
}

// InstanceImportError represents an error during instance import
type InstanceImportError struct {
	Row     int    `json:"row,omitempty"`
	Field   string `json:"field,omitempty"`
	Message string `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// InstanceStats represents statistics about instances
type InstanceStats struct {
	TotalInstances     int64                    `json:"total_instances"`
	ActiveInstances    int64                    `json:"active_instances"`
	InactiveInstances  int64                    `json:"inactive_instances"`
	DeletedInstances   int64                    `json:"deleted_instances"`
	InstancesByModel   map[string]int64         `json:"instances_by_model"`
	InstancesByStatus  map[string]int64         `json:"instances_by_status"`
	TopModelsByInstance []ModelInstanceCount    `json:"top_models_by_instance"`
	RecentInstances    []InstanceSummary        `json:"recent_instances"`
	GrowthTrend        []InstanceGrowthPoint    `json:"growth_trend,omitempty"`
}

// ModelInstanceCount represents instance count by model
type ModelInstanceCount struct {
	ModelID       string `json:"model_id"`
	ModelName     string `json:"model_name"`
	InstanceCount int64  `json:"instance_count"`
}

// InstanceGrowthPoint represents a point in instance growth trend
type InstanceGrowthPoint struct {
	Date  string `json:"date"`
	Count int64  `json:"count"`
}

// InstanceValidationResult represents instance validation result
type InstanceValidationResult struct {
	IsValid bool                       `json:"is_valid"`
	Errors  []InstanceValidationError  `json:"errors,omitempty"`
}

// InstanceValidationError represents an instance validation error
type InstanceValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
	Code    string `json:"code,omitempty"`
}

// InstanceCloneRequest represents a request to clone an instance
type InstanceCloneRequest struct {
	Name              string                 `json:"name" validate:"required,max=200"`
	Data              map[string]interface{} `json:"data,omitempty"`              // Override specific fields
	CloneRelationships bool                  `json:"clone_relationships,omitempty"` // Whether to clone relationships
}

// InstanceBatchRequest represents a batch operation request
type InstanceBatchRequest struct {
	InstanceIDs []string    `json:"instance_ids" validate:"required,min=1"`
	Operation   string      `json:"operation" validate:"required,oneof=delete update_status export"`
	Parameters  interface{} `json:"parameters,omitempty"` // Operation-specific parameters
}

// InstanceBatchResult represents the result of a batch operation
type InstanceBatchResult struct {
	Success      bool     `json:"success"`
	ProcessedCount int    `json:"processed_count"`
	SuccessCount int      `json:"success_count"`
	ErrorCount   int      `json:"error_count"`
	Errors       []BatchError `json:"errors,omitempty"`
}

// BatchError represents an error in batch operations
type BatchError struct {
	InstanceID string `json:"instance_id"`
	Message    string `json:"message"`
}

// InstanceRelationshipFilter represents filters for instance relationships
type InstanceRelationshipFilter struct {
	RelationshipTypes []string `json:"relationship_types,omitempty"`
	RelatedModelIDs   []string `json:"related_model_ids,omitempty"`
	Direction         string   `json:"direction,omitempty" validate:"omitempty,oneof=source target both"`
}

// InstanceTopologyRequest represents a request for instance topology
type InstanceTopologyRequest struct {
	InstanceID   string                       `json:"instance_id" validate:"required,uuid"`
	MaxDepth     int                          `json:"max_depth,omitempty" validate:"omitempty,min=1,max=10"`
	Filters      *InstanceRelationshipFilter  `json:"filters,omitempty"`
	IncludeData  bool                         `json:"include_data,omitempty"`
}

// InstanceTopologyResponse represents instance topology
type InstanceTopologyResponse struct {
	RootInstance *InstanceSummary      `json:"root_instance"`
	Nodes        []TopologyNode        `json:"nodes"`
	Relationships []TopologyRelationship `json:"relationships"`
	Depth        int                   `json:"depth"`
}

// TopologyNode represents a node in instance topology
type TopologyNode struct {
	InstanceID   string                 `json:"instance_id"`
	Name         string                 `json:"name"`
	ModelID      string                 `json:"model_id"`
	ModelName    string                 `json:"model_name"`
	Status       string                 `json:"status"`
	Level        int                    `json:"level"`
	Data         map[string]interface{} `json:"data,omitempty"`
}

// TopologyRelationship represents a relationship in instance topology
type TopologyRelationship struct {
	ID               string `json:"id"`
	SourceInstanceID string `json:"source_instance_id"`
	TargetInstanceID string `json:"target_instance_id"`
	RelationshipID   string `json:"relationship_id"`
	RelationshipName string `json:"relationship_name"`
	RelationshipType string `json:"relationship_type"`
}

// InstanceCompareRequest represents a request to compare instances
type InstanceCompareRequest struct {
	InstanceIDs []string `json:"instance_ids" validate:"required,min=2,max=10"`
	CompareFields []string `json:"compare_fields,omitempty"` // Specific fields to compare
}

// InstanceCompareResponse represents instance comparison result
type InstanceCompareResponse struct {
	Instances    []InstanceSummary      `json:"instances"`
	Differences  []FieldDifference      `json:"differences"`
	CommonFields map[string]interface{} `json:"common_fields"`
}

// FieldDifference represents a difference between instance fields
type FieldDifference struct {
	Field  string                 `json:"field"`
	Values map[string]interface{} `json:"values"` // instance_id -> value
}

// InstanceHistoryRequest represents a request for instance change history
type InstanceHistoryRequest struct {
	InstanceID string           `json:"instance_id" validate:"required,uuid"`
	StartDate  *string          `json:"start_date,omitempty"`
	EndDate    *string          `json:"end_date,omitempty"`
	Pagination *types.Pagination `json:"pagination,omitempty"`
}

// InstanceHistoryResponse represents instance change history
type InstanceHistoryResponse struct {
	InstanceID string           `json:"instance_id"`
	Changes    []InstanceChange `json:"changes"`
	Pagination *types.Pagination `json:"pagination,omitempty"`
}

// InstanceChange represents a change to an instance
type InstanceChange struct {
	ID        string                 `json:"id"`
	Action    string                 `json:"action"` // create, update, delete
	UserID    string                 `json:"user_id"`
	UserName  string                 `json:"user_name,omitempty"`
	Timestamp string                 `json:"timestamp"`
	Changes   map[string]FieldChange `json:"changes,omitempty"`
	Comment   string                 `json:"comment,omitempty"`
}

// FieldChange represents a change to a specific field
type FieldChange struct {
	OldValue interface{} `json:"old_value"`
	NewValue interface{} `json:"new_value"`
	Action   string      `json:"action"` // added, modified, removed
}

// Validation methods

// Validate validates the CreateInstanceRequest
func (req *CreateInstanceRequest) Validate() error {
	if req.ModelID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Model ID is required",
		}
	}
	
	if req.Name == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Instance name is required",
		}
	}
	
	if req.Data == nil {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Instance data is required",
		}
	}
	
	return nil
}

// Validate validates the SearchInstancesRequest
func (req *SearchInstancesRequest) Validate() error {
	// Validate filters
	for i, filter := range req.Filters {
		if filter.Field == "" {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Filter %d: field is required", i+1),
			}
		}
		
		validOperators := map[string]bool{
			"eq": true, "ne": true, "gt": true, "lt": true,
			"ge": true, "le": true, "in": true, "like": true,
		}
		if !validOperators[filter.Operator] {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Filter %d: invalid operator '%s'", i+1, filter.Operator),
			}
		}
		
		if filter.Value == nil {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Filter %d: value is required", i+1),
			}
		}
	}
	
	return nil
}

// GetDisplayValue returns a human-readable display value for a field
func (fv *InstanceFieldValue) GetDisplayValue() string {
	if fv.DisplayValue != "" {
		return fv.DisplayValue
	}
	
	if fv.Value == nil {
		return ""
	}
	
	// Generate display value based on field type
	if fv.Field != nil {
		switch fv.Field.Type {
		case types.FieldTypeEnum, types.FieldTypeMultiEnum:
			return fv.getEnumDisplayValue()
		case types.FieldTypeBool:
			if val, ok := fv.Value.(bool); ok {
				if val {
					return "Yes"
				}
				return "No"
			}
		}
	}
	
	return fmt.Sprintf("%v", fv.Value)
}

// getEnumDisplayValue returns display value for enum fields
func (fv *InstanceFieldValue) getEnumDisplayValue() string {
	if fv.Field == nil || fv.Field.Options == nil {
		return fmt.Sprintf("%v", fv.Value)
	}
	
	// Create enum map
	enumMap := make(map[string]string)
	for _, option := range fv.Field.Options.EnumValues {
		enumMap[option.Key] = option.Value
	}
	
	switch fv.Field.Type {
	case types.FieldTypeEnum:
		if key, ok := fv.Value.(string); ok {
			if value, exists := enumMap[key]; exists {
				return value
			}
		}
	case types.FieldTypeMultiEnum:
		if keys, ok := fv.Value.([]interface{}); ok {
			var values []string
			for _, k := range keys {
				if key, ok := k.(string); ok {
					if value, exists := enumMap[key]; exists {
						values = append(values, value)
					} else {
						values = append(values, key)
					}
				}
			}
			return fmt.Sprintf("[%s]", strings.Join(values, ", "))
		}
	}
	
	return fmt.Sprintf("%v", fv.Value)
}