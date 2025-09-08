package relationship

import (
	"fmt"

	"github.com/wend/cmdb-backend/pkg/types"
)

// CreateModelRelationshipRequest represents a request to create a model relationship
type CreateModelRelationshipRequest struct {
	SourceModelID string              `json:"source_model_id" validate:"required,uuid"`
	TargetModelID string              `json:"target_model_id" validate:"required,uuid"`
	Name          string              `json:"name" validate:"required,max=100"`
	Description   string              `json:"description,omitempty" validate:"max=500"`
	Constraints   RelationshipConstraints `json:"constraints" validate:"required"`
	Properties    map[string]interface{} `json:"properties,omitempty"`
}

// UpdateModelRelationshipRequest represents a request to update a model relationship
type UpdateModelRelationshipRequest struct {
	Name        *string                  `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string                  `json:"description,omitempty" validate:"omitempty,max=500"`
	Constraints *RelationshipConstraints `json:"constraints,omitempty"`
	Properties  map[string]interface{}   `json:"properties,omitempty"`
}

// RelationshipConstraints represents constraints for a relationship
type RelationshipConstraints struct {
	Type               types.RelationshipType `json:"type" validate:"required,oneof=one_to_one one_to_many many_to_many"`
	SourceRequired     bool                   `json:"source_required,omitempty"`
	TargetRequired     bool                   `json:"target_required,omitempty"`
	SourceMultiplicity string                 `json:"source_multiplicity,omitempty" validate:"omitempty,oneof=0..1 1..1 0..* 1..*"`
	TargetMultiplicity string                 `json:"target_multiplicity,omitempty" validate:"omitempty,oneof=0..1 1..1 0..* 1..*"`
	CascadeDelete      bool                   `json:"cascade_delete,omitempty"`
}

// CreateInstanceRelationshipRequest represents a request to create an instance relationship
type CreateInstanceRelationshipRequest struct {
	SourceInstanceID   string                 `json:"source_instance_id" validate:"required,uuid"`
	TargetInstanceID   string                 `json:"target_instance_id" validate:"required,uuid"`
	RelationshipID     string                 `json:"relationship_id" validate:"required,uuid"`
	Properties         map[string]interface{} `json:"properties,omitempty"`
}

// UpdateInstanceRelationshipRequest represents a request to update an instance relationship
type UpdateInstanceRelationshipRequest struct {
	Properties map[string]interface{} `json:"properties,omitempty"`
}

// RelationshipSearchRequest represents a request to search relationships
type RelationshipSearchRequest struct {
	SourceModelIDs    []string             `json:"source_model_ids,omitempty"`
	TargetModelIDs    []string             `json:"target_model_ids,omitempty"`
	RelationshipTypes []types.RelationshipType `json:"relationship_types,omitempty"`
	Query             string               `json:"query,omitempty"`
	Pagination        *types.Pagination    `json:"pagination,omitempty"`
	Sort              []types.Sort         `json:"sort,omitempty"`
}

// RelationshipSearchResponse represents relationship search results
type RelationshipSearchResponse struct {
	Relationships []*RelationshipSummary `json:"relationships"`
	Pagination    *types.Pagination      `json:"pagination,omitempty"`
	Facets        *RelationshipFacets    `json:"facets,omitempty"`
}

// RelationshipSummary represents a summary of a relationship
type RelationshipSummary struct {
	ID               string                 `json:"id"`
	Name             string                 `json:"name"`
	SourceModelID    string                 `json:"source_model_id"`
	SourceModelName  string                 `json:"source_model_name"`
	TargetModelID    string                 `json:"target_model_id"`
	TargetModelName  string                 `json:"target_model_name"`
	Type             string                 `json:"type"`
	InstanceCount    int64                  `json:"instance_count"`
	CreatedAt        string                 `json:"created_at"`
}

// RelationshipFacets represents search result facets
type RelationshipFacets struct {
	TypeCounts        map[string]int64 `json:"type_counts"`
	SourceModelCounts map[string]int64 `json:"source_model_counts"`
	TargetModelCounts map[string]int64 `json:"target_model_counts"`
}

// RelationshipDetail represents detailed relationship information
type RelationshipDetail struct {
	*types.Relationship
	SourceModel      *types.Model           `json:"source_model,omitempty"`
	TargetModel      *types.Model           `json:"target_model,omitempty"`
	InstanceCount    int64                  `json:"instance_count"`
	RecentInstances  []InstanceRelationship `json:"recent_instances,omitempty"`
}

// InstanceRelationship represents an instance relationship with context
type InstanceRelationship struct {
	ID                  string                 `json:"id"`
	SourceInstanceID    string                 `json:"source_instance_id"`
	SourceInstanceName  string                 `json:"source_instance_name"`
	TargetInstanceID    string                 `json:"target_instance_id"`
	TargetInstanceName  string                 `json:"target_instance_name"`
	RelationshipID      string                 `json:"relationship_id"`
	RelationshipName    string                 `json:"relationship_name"`
	Properties          map[string]interface{} `json:"properties,omitempty"`
	CreatedAt           string                 `json:"created_at"`
}

// TopologyQueryRequest represents a topology query request
type TopologyQueryRequest struct {
	StartInstanceID   string                    `json:"start_instance_id,omitempty" validate:"omitempty,uuid"`
	StartModelID      string                    `json:"start_model_id,omitempty" validate:"omitempty,uuid"`
	MaxDepth          int                       `json:"max_depth,omitempty" validate:"omitempty,min=1,max=10"`
	Direction         string                    `json:"direction,omitempty" validate:"omitempty,oneof=inbound outbound both"`
	RelationshipTypes []types.RelationshipType  `json:"relationship_types,omitempty"`
	ModelFilters      []string                  `json:"model_filters,omitempty"`
	InstanceFilters   []TopologyInstanceFilter  `json:"instance_filters,omitempty"`
	IncludeProperties bool                      `json:"include_properties,omitempty"`
}

// TopologyInstanceFilter represents a filter for topology instances
type TopologyInstanceFilter struct {
	Field    string      `json:"field" validate:"required"`
	Operator string      `json:"operator" validate:"required,oneof=eq ne gt lt ge le in like"`
	Value    interface{} `json:"value" validate:"required"`
}

// TopologyQueryResponse represents topology query results
type TopologyQueryResponse struct {
	Nodes         []TopologyNode         `json:"nodes"`
	Relationships []TopologyRelationship `json:"relationships"`
	Depth         int                    `json:"depth"`
	Stats         TopologyStats          `json:"stats"`
}

// TopologyNode represents a node in topology query results
type TopologyNode struct {
	InstanceID   string                 `json:"instance_id"`
	Name         string                 `json:"name"`
	ModelID      string                 `json:"model_id"`
	ModelName    string                 `json:"model_name"`
	Status       string                 `json:"status"`
	Level        int                    `json:"level"`
	Properties   map[string]interface{} `json:"properties,omitempty"`
	KeyFields    map[string]interface{} `json:"key_fields,omitempty"`
}

// TopologyRelationship represents a relationship in topology query results
type TopologyRelationship struct {
	ID                  string                 `json:"id"`
	SourceInstanceID    string                 `json:"source_instance_id"`
	TargetInstanceID    string                 `json:"target_instance_id"`
	RelationshipID      string                 `json:"relationship_id"`
	RelationshipName    string                 `json:"relationship_name"`
	RelationshipType    string                 `json:"relationship_type"`
	Properties          map[string]interface{} `json:"properties,omitempty"`
}

// TopologyStats represents topology query statistics
type TopologyStats struct {
	NodeCount         int               `json:"node_count"`
	RelationshipCount int               `json:"relationship_count"`
	ModelCounts       map[string]int    `json:"model_counts"`
	TypeCounts        map[string]int    `json:"type_counts"`
}

// RelationshipValidationRequest represents a request to validate relationships
type RelationshipValidationRequest struct {
	RelationshipIDs []string `json:"relationship_ids,omitempty"`
	ModelIDs        []string `json:"model_ids,omitempty"`
	InstanceIDs     []string `json:"instance_ids,omitempty"`
}

// RelationshipValidationResponse represents relationship validation results
type RelationshipValidationResponse struct {
	IsValid  bool                         `json:"is_valid"`
	Errors   []RelationshipValidationError `json:"errors,omitempty"`
	Warnings []string                     `json:"warnings,omitempty"`
}

// RelationshipValidationError represents a relationship validation error
type RelationshipValidationError struct {
	RelationshipID   string `json:"relationship_id,omitempty"`
	RelationshipName string `json:"relationship_name,omitempty"`
	InstanceID       string `json:"instance_id,omitempty"`
	InstanceName     string `json:"instance_name,omitempty"`
	Message          string `json:"message"`
	Code             string `json:"code"`
}

// RelationshipAnalysisRequest represents a request for relationship analysis
type RelationshipAnalysisRequest struct {
	ModelIDs        []string `json:"model_ids,omitempty"`
	InstanceIDs     []string `json:"instance_ids,omitempty"`
	AnalysisType    string   `json:"analysis_type" validate:"required,oneof=impact dependency path cycle"`
	MaxDepth        int      `json:"max_depth,omitempty" validate:"omitempty,min=1,max=20"`
	IncludeIndirect bool     `json:"include_indirect,omitempty"`
}

// RelationshipAnalysisResponse represents relationship analysis results
type RelationshipAnalysisResponse struct {
	AnalysisType string                      `json:"analysis_type"`
	Results      []RelationshipAnalysisResult `json:"results"`
	Summary      RelationshipAnalysisSummary  `json:"summary"`
}

// RelationshipAnalysisResult represents a single analysis result
type RelationshipAnalysisResult struct {
	InstanceID     string                 `json:"instance_id"`
	InstanceName   string                 `json:"instance_name"`
	ModelID        string                 `json:"model_id"`
	ModelName      string                 `json:"model_name"`
	Level          int                    `json:"level"`
	RelationshipPath []string              `json:"relationship_path,omitempty"`
	Impact         string                 `json:"impact,omitempty"` // high, medium, low
	Properties     map[string]interface{} `json:"properties,omitempty"`
}

// RelationshipAnalysisSummary represents summary of analysis results
type RelationshipAnalysisSummary struct {
	TotalInstances    int              `json:"total_instances"`
	MaxDepthReached   int              `json:"max_depth_reached"`
	CyclesDetected    int              `json:"cycles_detected,omitempty"`
	ImpactDistribution map[string]int  `json:"impact_distribution,omitempty"`
	ModelDistribution  map[string]int  `json:"model_distribution"`
}

// RelationshipImportRequest represents a request to import relationships
type RelationshipImportRequest struct {
	Data         string `json:"data" validate:"required"`
	Format       string `json:"format" validate:"required,oneof=json csv excel"`
	ValidateOnly bool   `json:"validate_only,omitempty"`
	MergeMode    string `json:"merge_mode,omitempty" validate:"omitempty,oneof=replace merge skip"`
}

// RelationshipImportResponse represents relationship import results
type RelationshipImportResponse struct {
	Success            bool                       `json:"success"`
	ProcessedCount     int                        `json:"processed_count"`
	CreatedCount       int                        `json:"created_count"`
	UpdatedCount       int                        `json:"updated_count"`
	SkippedCount       int                        `json:"skipped_count"`
	ErrorCount         int                        `json:"error_count"`
	Errors             []RelationshipImportError  `json:"errors,omitempty"`
	Warnings           []string                   `json:"warnings,omitempty"`
	CreatedRelationships []string                 `json:"created_relationships,omitempty"`
	UpdatedRelationships []string                 `json:"updated_relationships,omitempty"`
}

// RelationshipImportError represents an error during relationship import
type RelationshipImportError struct {
	Row     int         `json:"row,omitempty"`
	Field   string      `json:"field,omitempty"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// Validation methods

// Validate validates the CreateModelRelationshipRequest
func (req *CreateModelRelationshipRequest) Validate() error {
	if req.SourceModelID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Source model ID is required",
		}
	}

	if req.TargetModelID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Target model ID is required",
		}
	}

	if req.Name == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Relationship name is required",
		}
	}

	// Validate constraints
	if err := req.Constraints.Validate(); err != nil {
		return err
	}

	return nil
}

// Validate validates the RelationshipConstraints
func (c *RelationshipConstraints) Validate() error {
	// Note: RelationshipType validation would be handled by the actual type
	// For now, we'll skip the detailed validation as it requires the actual relationship type implementation

	// Validate multiplicities if provided
	validMultiplicities := map[string]bool{
		"0..1": true, "1..1": true, "0..*": true, "1..*": true,
	}

	if c.SourceMultiplicity != "" && !validMultiplicities[c.SourceMultiplicity] {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Invalid source multiplicity",
		}
	}

	if c.TargetMultiplicity != "" && !validMultiplicities[c.TargetMultiplicity] {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Invalid target multiplicity",
		}
	}

	return nil
}

// Validate validates the TopologyQueryRequest
func (req *TopologyQueryRequest) Validate() error {
	if req.StartInstanceID == "" && req.StartModelID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Either start_instance_id or start_model_id is required",
		}
	}

	if req.MaxDepth < 0 || req.MaxDepth > 10 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Max depth must be between 1 and 10",
		}
	}

	validDirections := map[string]bool{
		"inbound": true, "outbound": true, "both": true,
	}

	if req.Direction != "" && !validDirections[req.Direction] {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Invalid direction",
		}
	}

	// Validate instance filters
	for i, filter := range req.InstanceFilters {
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

// Helper methods

// GetMultiplicityRange returns the numeric range for a multiplicity string
func (c *RelationshipConstraints) GetMultiplicityRange(multiplicity string) (min, max int) {
	switch multiplicity {
	case "0..1":
		return 0, 1
	case "1..1":
		return 1, 1
	case "0..*":
		return 0, -1 // -1 means unlimited
	case "1..*":
		return 1, -1 // -1 means unlimited
	default:
		return 0, -1
	}
}

// IsMultiplicityViolated checks if a count violates the multiplicity constraint
func (c *RelationshipConstraints) IsMultiplicityViolated(multiplicity string, count int) bool {
	min, max := c.GetMultiplicityRange(multiplicity)
	
	if count < min {
		return true
	}
	
	if max != -1 && count > max {
		return true
	}
	
	return false
}