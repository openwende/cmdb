package business

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
)

// CreateBusinessRequest represents a request to create a business
type CreateBusinessRequest struct {
	Name        string   `json:"name" validate:"required,max=100"`
	Identifier  string   `json:"identifier" validate:"required,max=100,alphanum"`
	Description string   `json:"description,omitempty" validate:"max=500"`
	Lifecycle   string   `json:"lifecycle,omitempty" validate:"omitempty,oneof=development testing staging production maintenance retired"`
	Timezone    string   `json:"timezone,omitempty" validate:"max=50"`
	Language    string   `json:"language,omitempty" validate:"omitempty,oneof=en zh ja ko"`
	Maintainers []string `json:"maintainers" validate:"required,min=1,dive,uuid"`
}

// UpdateBusinessRequest represents a request to update a business
type UpdateBusinessRequest struct {
	Name        *string  `json:"name,omitempty" validate:"omitempty,max=100"`
	Identifier  *string  `json:"identifier,omitempty" validate:"omitempty,max=100,alphanum"`
	Description *string  `json:"description,omitempty" validate:"omitempty,max=500"`
	Lifecycle   *string  `json:"lifecycle,omitempty" validate:"omitempty,oneof=development testing staging production maintenance retired"`
	Timezone    *string  `json:"timezone,omitempty" validate:"omitempty,max=50"`
	Language    *string  `json:"language,omitempty" validate:"omitempty,oneof=en zh ja ko"`
	Maintainers []string `json:"maintainers,omitempty" validate:"omitempty,min=1,dive,uuid"`
}

// CreateTopologyNodeRequest represents a request to create a topology node
type CreateTopologyNodeRequest struct {
	BusinessID   string                `json:"business_id" validate:"required,uuid"`
	ParentID     *string               `json:"parent_id,omitempty" validate:"omitempty,uuid"`
	ModelID      string                `json:"model_id" validate:"required,uuid"`
	InstanceID   *string               `json:"instance_id,omitempty" validate:"omitempty,uuid"`
	Name         string                `json:"name" validate:"required,max=200"`
	DisplayOrder int                   `json:"display_order,omitempty"`
	TopologyType types.TopologyType    `json:"topology_type,omitempty" validate:"omitempty,oneof=business cluster module host custom"`
}

// UpdateTopologyNodeRequest represents a request to update a topology node
type UpdateTopologyNodeRequest struct {
	Name         *string `json:"name,omitempty" validate:"omitempty,max=200"`
	InstanceID   *string `json:"instance_id,omitempty" validate:"omitempty,uuid"`
	DisplayOrder *int    `json:"display_order,omitempty"`
}

// MoveTopologyNodeRequest represents a request to move a topology node
type MoveTopologyNodeRequest struct {
	NewParentID *string `json:"new_parent_id,omitempty" validate:"omitempty,uuid"`
}

// CloneTopologyNodeRequest represents a request to clone a topology node
type CloneTopologyNodeRequest struct {
	NewName        string  `json:"new_name" validate:"required,max=200"`
	NewParentID    *string `json:"new_parent_id,omitempty" validate:"omitempty,uuid"`
	CloneChildren  bool    `json:"clone_children,omitempty"`
	CloneInstances bool    `json:"clone_instances,omitempty"`
}

// TopologyRequest represents filters for topology queries
type TopologyRequest struct {
	MaxDepth        int                     `json:"max_depth,omitempty" validate:"omitempty,min=1,max=10"`
	ModelIDs        []uuid.UUID             `json:"model_ids,omitempty"`
	TopologyTypes   []types.TopologyType    `json:"topology_types,omitempty"`
	IncludeInstances bool                   `json:"include_instances,omitempty"`
}

// TopologyResponse represents a business topology structure
type TopologyResponse struct {
	BusinessID   string                   `json:"business_id"`
	BusinessName string                   `json:"business_name"`
	Topology     []*TopologyNodeHierarchy `json:"topology"`
	TotalNodes   int                      `json:"total_nodes"`
	MaxDepth     int                      `json:"max_depth"`
}

// TopologyNodeHierarchy represents a hierarchical topology node
type TopologyNodeHierarchy struct {
	Node     *types.TopologyNode       `json:"node"`
	Children []*TopologyNodeHierarchy  `json:"children"`
}

// CreateBusinessSetRequest represents a request to create a business set
type CreateBusinessSetRequest struct {
	Name        string              `json:"name" validate:"required,max=100"`
	Identifier  string              `json:"identifier" validate:"required,max=100,alphanum"`
	Description string              `json:"description,omitempty" validate:"max=500"`
	Scope       BusinessSetScope    `json:"scope" validate:"required"`
	Maintainers []string            `json:"maintainers" validate:"required,min=1,dive,uuid"`
}

// UpdateBusinessSetRequest represents a request to update a business set
type UpdateBusinessSetRequest struct {
	Name        *string           `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string           `json:"description,omitempty" validate:"omitempty,max=500"`
	Scope       *BusinessSetScope `json:"scope,omitempty"`
	Maintainers []string          `json:"maintainers,omitempty" validate:"omitempty,min=1,dive,uuid"`
}

// BusinessSetScope represents the scope configuration for a business set
type BusinessSetScope struct {
	Type       types.ScopeType      `json:"type" validate:"required,oneof=all manual dynamic"`
	Businesses []string             `json:"businesses,omitempty" validate:"dive,uuid"`
	Filters    []BusinessSetFilter  `json:"filters,omitempty"`
}

// BusinessSetFilter represents a filter for dynamic business set scope
type BusinessSetFilter struct {
	Field    string      `json:"field" validate:"required"`
	Operator string      `json:"operator" validate:"required,oneof=eq ne in not_in like not_like"`
	Value    interface{} `json:"value" validate:"required"`
}

// CreateServiceTemplateRequest represents a request to create a service template
type CreateServiceTemplateRequest struct {
	Name        string                    `json:"name" validate:"required,max=100"`
	Description string                    `json:"description,omitempty" validate:"max=500"`
	BusinessID  string                    `json:"business_id" validate:"required,uuid"`
	ModelID     string                    `json:"model_id" validate:"required,uuid"`
	Template    ServiceTemplateConfig     `json:"template" validate:"required"`
}

// UpdateServiceTemplateRequest represents a request to update a service template
type UpdateServiceTemplateRequest struct {
	Name        *string                `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string                `json:"description,omitempty" validate:"omitempty,max=500"`
	Template    *ServiceTemplateConfig `json:"template,omitempty"`
}

// ServiceTemplateConfig represents service template configuration
type ServiceTemplateConfig struct {
	Fields     map[string]interface{} `json:"fields" validate:"required"`
	Children   []ChildNodeTemplate    `json:"children,omitempty"`
	Validation map[string]interface{} `json:"validation,omitempty"`
}

// ChildNodeTemplate represents a child node template configuration
type ChildNodeTemplate struct {
	ModelID     string                 `json:"model_id" validate:"required,uuid"`
	Name        string                 `json:"name" validate:"required"`
	Fields      map[string]interface{} `json:"fields"`
	IsRequired  bool                   `json:"is_required,omitempty"`
	MinCount    int                    `json:"min_count,omitempty" validate:"min=0"`
	MaxCount    int                    `json:"max_count,omitempty" validate:"min=1"`
}

// CreateClusterTemplateRequest represents a request to create a cluster template
type CreateClusterTemplateRequest struct {
	Name        string                    `json:"name" validate:"required,max=100"`
	Description string                    `json:"description,omitempty" validate:"max=500"`
	BusinessID  string                    `json:"business_id" validate:"required,uuid"`
	ModelID     string                    `json:"model_id" validate:"required,uuid"`
	Template    ClusterTemplateConfig     `json:"template" validate:"required"`
}

// UpdateClusterTemplateRequest represents a request to update a cluster template
type UpdateClusterTemplateRequest struct {
	Name        *string                `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string                `json:"description,omitempty" validate:"omitempty,max=500"`
	Template    *ClusterTemplateConfig `json:"template,omitempty"`
}

// ClusterTemplateConfig represents cluster template configuration
type ClusterTemplateConfig struct {
	Fields           map[string]interface{} `json:"fields" validate:"required"`
	ModuleTemplates  []ModuleTemplate       `json:"module_templates,omitempty"`
	DefaultModules   []string               `json:"default_modules,omitempty"`
	Validation       map[string]interface{} `json:"validation,omitempty"`
}

// ModuleTemplate represents a module template within a cluster
type ModuleTemplate struct {
	Name        string                 `json:"name" validate:"required"`
	ModelID     string                 `json:"model_id" validate:"required,uuid"`
	Fields      map[string]interface{} `json:"fields"`
	IsRequired  bool                   `json:"is_required,omitempty"`
	Order       int                    `json:"order,omitempty"`
}

// CreateDynamicGroupRequest represents a request to create a dynamic group
type CreateDynamicGroupRequest struct {
	Name        string                    `json:"name" validate:"required,max=100"`
	Description string                    `json:"description,omitempty" validate:"max=500"`
	TargetType  string                    `json:"target_type" validate:"required,oneof=instance topology host"`
	ModelID     *string                   `json:"model_id,omitempty" validate:"omitempty,uuid"`
	BusinessID  *string                   `json:"business_id,omitempty" validate:"omitempty,uuid"`
	Query       DynamicGroupQuery         `json:"query" validate:"required"`
	IsActive    bool                      `json:"is_active,omitempty"`
}

// UpdateDynamicGroupRequest represents a request to update a dynamic group
type UpdateDynamicGroupRequest struct {
	Name        *string            `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string            `json:"description,omitempty" validate:"omitempty,max=500"`
	Query       *DynamicGroupQuery `json:"query,omitempty"`
	IsActive    *bool              `json:"is_active,omitempty"`
}

// DynamicGroupQuery represents a dynamic group query configuration
type DynamicGroupQuery struct {
	Conditions []DynamicGroupCondition `json:"conditions" validate:"required,min=1"`
	Logic      string                  `json:"logic" validate:"required,oneof=and or"`
}

// DynamicGroupCondition represents a single condition in a dynamic group query
type DynamicGroupCondition struct {
	Field    string      `json:"field" validate:"required"`
	Operator string      `json:"operator" validate:"required,oneof=eq ne gt lt ge le in not_in like not_like is_null is_not_null"`
	Value    interface{} `json:"value"`
}

// TopologySearchRequest represents a request to search topology
type TopologySearchRequest struct {
	Query         string                  `json:"query,omitempty"`         // Text search
	BusinessIDs   []string                `json:"business_ids,omitempty"`  // Filter by businesses
	ModelIDs      []string                `json:"model_ids,omitempty"`     // Filter by models
	TopologyTypes []types.TopologyType    `json:"topology_types,omitempty"`// Filter by topology types
	Levels        []int                   `json:"levels,omitempty"`        // Filter by levels
	HasInstances  *bool                   `json:"has_instances,omitempty"` // Filter nodes with/without instances
	Pagination    *types.Pagination       `json:"pagination,omitempty"`
	Sort          []types.Sort            `json:"sort,omitempty"`
}

// TopologySearchResponse represents topology search results
type TopologySearchResponse struct {
	Nodes      []*TopologyNodeSummary `json:"nodes"`
	Pagination *types.Pagination      `json:"pagination,omitempty"`
	Facets     *TopologySearchFacets  `json:"facets,omitempty"`
}

// TopologyNodeSummary represents a summary of a topology node
type TopologyNodeSummary struct {
	ID            string                `json:"id"`
	Name          string                `json:"name"`
	BusinessID    string                `json:"business_id"`
	BusinessName  string                `json:"business_name"`
	ModelID       string                `json:"model_id"`
	ModelName     string                `json:"model_name"`
	Level         int                   `json:"level"`
	Path          string                `json:"path"`
	TopologyType  types.TopologyType    `json:"topology_type"`
	HasInstance   bool                  `json:"has_instance"`
	ChildrenCount int                   `json:"children_count"`
	CreatedAt     string                `json:"created_at"`
}

// TopologySearchFacets represents search result facets
type TopologySearchFacets struct {
	BusinessCounts    map[string]int64            `json:"business_counts"`
	ModelCounts       map[string]int64            `json:"model_counts"`
	TopologyTypeCounts map[types.TopologyType]int64 `json:"topology_type_counts"`
	LevelCounts       map[int]int64               `json:"level_counts"`
}

// BusinessStats represents business statistics
type BusinessStats struct {
	TotalBusinesses     int64                 `json:"total_businesses"`
	ActiveBusinesses    int64                 `json:"active_businesses"`
	BusinessesByLifecycle map[string]int64    `json:"businesses_by_lifecycle"`
	BusinessesByTimezone  map[string]int64    `json:"businesses_by_timezone"`
	TotalTopologyNodes  int64                 `json:"total_topology_nodes"`
	TopologyNodesByType map[string]int64      `json:"topology_nodes_by_type"`
	TopologyNodesByLevel map[int]int64        `json:"topology_nodes_by_level"`
	RecentBusinesses    []BusinessSummary     `json:"recent_businesses"`
}

// BusinessSummary represents a summary of a business
type BusinessSummary struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Identifier      string `json:"identifier"`
	Lifecycle       string `json:"lifecycle"`
	TopologyNodeCount int64 `json:"topology_node_count"`
	MaintainerCount int    `json:"maintainer_count"`
	CreatedAt       string `json:"created_at"`
}

// BusinessTreeNode represents a node in business tree structure
type BusinessTreeNode struct {
	ID            string              `json:"id"`
	Name          string              `json:"name"`
	Type          string              `json:"type"` // "business", "cluster", "module", etc.
	ModelID       string              `json:"model_id,omitempty"`
	ModelName     string              `json:"model_name,omitempty"`
	InstanceID    string              `json:"instance_id,omitempty"`
	Level         int                 `json:"level"`
	HasChildren   bool                `json:"has_children"`
	Children      []*BusinessTreeNode `json:"children,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// TopologyValidationResult represents topology validation result
type TopologyValidationResult struct {
	IsValid   bool                        `json:"is_valid"`
	Errors    []TopologyValidationError   `json:"errors,omitempty"`
	Warnings  []TopologyValidationWarning `json:"warnings,omitempty"`
}

// TopologyValidationError represents a topology validation error
type TopologyValidationError struct {
	NodeID   string `json:"node_id,omitempty"`
	NodeName string `json:"node_name,omitempty"`
	Message  string `json:"message"`
	Code     string `json:"code"`
}

// TopologyValidationWarning represents a topology validation warning
type TopologyValidationWarning struct {
	NodeID   string `json:"node_id,omitempty"`
	NodeName string `json:"node_name,omitempty"`
	Message  string `json:"message"`
	Code     string `json:"code"`
}

// TopologyExportRequest represents a request to export topology
type TopologyExportRequest struct {
	BusinessIDs      []string `json:"business_ids,omitempty"`
	IncludeInstances bool     `json:"include_instances,omitempty"`
	IncludeTemplates bool     `json:"include_templates,omitempty"`
	Format           string   `json:"format,omitempty" validate:"omitempty,oneof=json yaml excel"`
	MaxDepth         int      `json:"max_depth,omitempty" validate:"omitempty,min=1,max=10"`
}

// TopologyImportRequest represents a request to import topology
type TopologyImportRequest struct {
	Data         string `json:"data" validate:"required"`
	Format       string `json:"format" validate:"required,oneof=json yaml excel"`
	BusinessID   string `json:"business_id" validate:"required,uuid"`
	MergeMode    string `json:"merge_mode,omitempty" validate:"omitempty,oneof=replace merge skip"`
	ValidateOnly bool   `json:"validate_only,omitempty"`
}

// TopologyImportResult represents the result of topology import
type TopologyImportResult struct {
	Success         bool                      `json:"success"`
	ProcessedNodes  int                       `json:"processed_nodes"`
	CreatedNodes    int                       `json:"created_nodes"`
	UpdatedNodes    int                       `json:"updated_nodes"`
	SkippedNodes    int                       `json:"skipped_nodes"`
	ErrorCount      int                       `json:"error_count"`
	Errors          []TopologyImportError     `json:"errors,omitempty"`
	Warnings        []string                  `json:"warnings,omitempty"`
	CreatedNodeIDs  []string                  `json:"created_node_ids,omitempty"`
	UpdatedNodeIDs  []string                  `json:"updated_node_ids,omitempty"`
}

// TopologyImportError represents an error during topology import
type TopologyImportError struct {
	NodeName string `json:"node_name,omitempty"`
	Path     string `json:"path,omitempty"`
	Message  string `json:"message"`
	Data     interface{} `json:"data,omitempty"`
}

// Validation methods

// Validate validates the CreateBusinessRequest
func (req *CreateBusinessRequest) Validate() error {
	if req.Name == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Business name is required",
		}
	}
	
	if req.Identifier == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Business identifier is required",
		}
	}
	
	if len(req.Maintainers) == 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "At least one maintainer is required",
		}
	}
	
	// Set defaults
	if req.Lifecycle == "" {
		req.Lifecycle = "production"
	}
	if req.Timezone == "" {
		req.Timezone = "UTC"
	}
	if req.Language == "" {
		req.Language = "en"
	}
	
	return nil
}

// Validate validates the CreateTopologyNodeRequest
func (req *CreateTopologyNodeRequest) Validate() error {
	if req.BusinessID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Business ID is required",
		}
	}
	
	if req.ModelID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Model ID is required",
		}
	}
	
	if req.Name == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Node name is required",
		}
	}
	
	// Set default topology type
	if req.TopologyType == "" {
		req.TopologyType = types.TopologyTypeCustom
	}
	
	return nil
}

// Validate validates the BusinessSetScope
func (scope *BusinessSetScope) Validate() error {
	switch scope.Type {
	case types.ScopeTypeManual:
		if len(scope.Businesses) == 0 {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Manual scope requires at least one business",
			}
		}
	case types.ScopeTypeDynamic:
		if len(scope.Filters) == 0 {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Dynamic scope requires at least one filter",
			}
		}
		
		for i, filter := range scope.Filters {
			if filter.Field == "" {
				return &types.AppError{
					Code:    types.ErrorCodeValidationFailed,
					Message: fmt.Sprintf("Filter %d: field is required", i+1),
				}
			}
			
			validOperators := map[string]bool{
				"eq": true, "ne": true, "in": true, "not_in": true,
				"like": true, "not_like": true,
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
	}
	
	return nil
}

// Validate validates the DynamicGroupQuery
func (query *DynamicGroupQuery) Validate() error {
	if len(query.Conditions) == 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "At least one condition is required",
		}
	}
	
	if query.Logic != "and" && query.Logic != "or" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Logic must be 'and' or 'or'",
		}
	}
	
	for i, condition := range query.Conditions {
		if condition.Field == "" {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Condition %d: field is required", i+1),
			}
		}
		
		validOperators := map[string]bool{
			"eq": true, "ne": true, "gt": true, "lt": true,
			"ge": true, "le": true, "in": true, "not_in": true,
			"like": true, "not_like": true, "is_null": true, "is_not_null": true,
		}
		if !validOperators[condition.Operator] {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Condition %d: invalid operator '%s'", i+1, condition.Operator),
			}
		}
		
		// Value is not required for is_null and is_not_null operators
		if condition.Operator != "is_null" && condition.Operator != "is_not_null" && condition.Value == nil {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: fmt.Sprintf("Condition %d: value is required for operator '%s'", i+1, condition.Operator),
			}
		}
	}
	
	return nil
}

// Helper methods

// GetFullPath returns the full topology path for display
func (summary *TopologyNodeSummary) GetFullPath() string {
	return summary.Path
}

// GetParentPath returns the parent path
func (summary *TopologyNodeSummary) GetParentPath() string {
	parts := strings.Split(summary.Path, "/")
	if len(parts) <= 2 {
		return "/"
	}
	return strings.Join(parts[:len(parts)-1], "/")
}

// IsRootNode returns true if this is a root topology node
func (summary *TopologyNodeSummary) IsRootNode() bool {
	return summary.Level == 0
}