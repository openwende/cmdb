package types

import (
	"github.com/google/uuid"
)

// Business represents a business unit in CMDB
type Business struct {
	TenantModel
	Name        string         `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string         `json:"identifier" gorm:"size:100;not null;uniqueIndex:idx_tenant_business_identifier" validate:"required,max=100,alphanum"`
	Description string         `json:"description" gorm:"size:500"`
	Lifecycle   string         `json:"lifecycle" gorm:"size:50;default:'production'" validate:"oneof=development testing staging production maintenance retired"`
	Timezone    string         `json:"timezone" gorm:"size:50;default:'UTC'"`
	Language    string         `json:"language" gorm:"size:10;default:'en'" validate:"oneof=en zh ja ko"`
	Maintainers []uuid.UUID    `json:"maintainers" gorm:"type:uuid[];not null" swaggertype:"array,string"`
	IsBuiltIn   bool           `json:"is_built_in" gorm:"default:false"`
	
	// Relationships
	BusinessSets []BusinessSet `json:"business_sets,omitempty" gorm:"many2many:business_set_members;"`
	Topology     []TopologyNode `json:"topology,omitempty" gorm:"foreignKey:BusinessID"`
}

// BusinessSet represents a collection of businesses for cross-business management
type BusinessSet struct {
	TenantModel
	Name        string      `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string      `json:"identifier" gorm:"size:100;not null;uniqueIndex:idx_tenant_businessset_identifier" validate:"required,max=100,alphanum"`
	Description string      `json:"description" gorm:"size:500"`
	Scope       ScopeConfig `json:"scope" gorm:"type:jsonb;not null"` // Configuration for business scope
	Maintainers []uuid.UUID `json:"maintainers" gorm:"type:uuid[];not null" swaggertype:"array,string"`
	
	// Relationships
	Businesses []Business `json:"businesses,omitempty" gorm:"many2many:business_set_members;"`
}

// ScopeConfig defines how a business set determines its member businesses
type ScopeConfig struct {
	Type      ScopeType         `json:"type" validate:"required,oneof=all manual dynamic"`
	Businesses []uuid.UUID      `json:"businesses,omitempty" swaggertype:"array,string"` // For manual scope
	Filters   []BusinessFilter  `json:"filters,omitempty"` // For dynamic scope
}

// ScopeType represents the type of business set scope
type ScopeType string

const (
	ScopeTypeAll     ScopeType = "all"     // Include all businesses
	ScopeTypeManual  ScopeType = "manual"  // Manually selected businesses
	ScopeTypeDynamic ScopeType = "dynamic" // Dynamic filtering based on criteria
)

// BusinessFilter represents a filter for dynamic business set scope
type BusinessFilter struct {
	Field    string      `json:"field" validate:"required"`
	Operator string      `json:"operator" validate:"required,oneof=eq ne in not_in like not_like"`
	Value    interface{} `json:"value" validate:"required"`
}

// TopologyNode represents a node in business topology
type TopologyNode struct {
	TenantModel
	BusinessID   uuid.UUID      `json:"business_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	ParentID     *uuid.UUID     `json:"parent_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	ModelID      uuid.UUID      `json:"model_id" gorm:"type:uuid;not null" swaggertype:"string" validate:"required"`
	InstanceID   *uuid.UUID     `json:"instance_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	Name         string         `json:"name" gorm:"size:200;not null" validate:"required,max=200"`
	Level        int            `json:"level" gorm:"not null;index"`
	Path         string         `json:"path" gorm:"size:1000;not null;index"` // Materialized path like "/business:123/cluster:456/module:789"
	DisplayOrder int            `json:"display_order" gorm:"default:0"`
	
	// Topology specific fields
	TopologyType TopologyType   `json:"topology_type" gorm:"size:20;default:'custom'" validate:"oneof=business cluster module host custom"`
	
	// Relationships
	Business *Business      `json:"business,omitempty" gorm:"foreignKey:BusinessID"`
	Parent   *TopologyNode  `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children []TopologyNode `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Model    *Model         `json:"model,omitempty" gorm:"foreignKey:ModelID"`
	Instance *Instance      `json:"instance,omitempty" gorm:"foreignKey:InstanceID"`
}

// TopologyType represents the type of topology node
type TopologyType string

const (
	TopologyTypeBusiness TopologyType = "business"
	TopologyTypeCluster  TopologyType = "cluster"
	TopologyTypeModule   TopologyType = "module"
	TopologyTypeHost     TopologyType = "host"
	TopologyTypeCustom   TopologyType = "custom"
)

// ServiceTemplate represents a template for creating service modules
type ServiceTemplate struct {
	TenantModel
	Name        string    `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description string    `json:"description" gorm:"size:500"`
	BusinessID  uuid.UUID `json:"business_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	ModelID     uuid.UUID `json:"model_id" gorm:"type:uuid;not null" swaggertype:"string" validate:"required"`
	Template    Template  `json:"template" gorm:"type:jsonb;not null"`
	
	// Relationships
	Business *Business `json:"business,omitempty" gorm:"foreignKey:BusinessID"`
	Model    *Model    `json:"model,omitempty" gorm:"foreignKey:ModelID"`
}

// ClusterTemplate represents a template for creating clusters
type ClusterTemplate struct {
	TenantModel
	Name        string    `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description string    `json:"description" gorm:"size:500"`
	BusinessID  uuid.UUID `json:"business_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	ModelID     uuid.UUID `json:"model_id" gorm:"type:uuid;not null" swaggertype:"string" validate:"required"`
	Template    Template  `json:"template" gorm:"type:jsonb;not null"`
	
	// Relationships
	Business *Business `json:"business,omitempty" gorm:"foreignKey:BusinessID"`
	Model    *Model    `json:"model,omitempty" gorm:"foreignKey:ModelID"`
}

// Template represents a template configuration
type Template struct {
	Fields     map[string]interface{} `json:"fields"`                // Default field values
	Children   []ChildTemplate        `json:"children,omitempty"`    // Child node templates
	Validation map[string]interface{} `json:"validation,omitempty"`  // Validation rules
}

// ChildTemplate represents a child node template
type ChildTemplate struct {
	ModelID     uuid.UUID              `json:"model_id" swaggertype:"string"`
	Name        string                 `json:"name"`
	Fields      map[string]interface{} `json:"fields"`
	IsRequired  bool                   `json:"is_required,omitempty"`
	MinCount    int                    `json:"min_count,omitempty"`
	MaxCount    int                    `json:"max_count,omitempty"`
}

// DynamicGroup represents a dynamic grouping of resources
type DynamicGroup struct {
	TenantModel
	Name        string       `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description string       `json:"description" gorm:"size:500"`
	TargetType  string       `json:"target_type" gorm:"size:50;not null" validate:"required,oneof=instance topology host"`
	ModelID     *uuid.UUID   `json:"model_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	BusinessID  *uuid.UUID   `json:"business_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	Query       QueryConfig  `json:"query" gorm:"type:jsonb;not null"`
	IsActive    bool         `json:"is_active" gorm:"default:true"`
	
	// Relationships
	Model    *Model    `json:"model,omitempty" gorm:"foreignKey:ModelID"`
	Business *Business `json:"business,omitempty" gorm:"foreignKey:BusinessID"`
}

// QueryConfig represents a dynamic query configuration
type QueryConfig struct {
	Conditions []QueryCondition `json:"conditions"`
	Logic      string           `json:"logic" validate:"oneof=and or"` // How to combine conditions
}

// QueryCondition represents a single query condition
type QueryCondition struct {
	Field    string      `json:"field" validate:"required"`
	Operator string      `json:"operator" validate:"required,oneof=eq ne gt lt ge le in not_in like not_like is_null is_not_null"`
	Value    interface{} `json:"value"`
}

// GetBusinessPath returns the path for business topology
func (tn *TopologyNode) GetBusinessPath() string {
	return tn.Path
}

// IsRoot returns true if this is a root topology node
func (tn *TopologyNode) IsRoot() bool {
	return tn.ParentID == nil
}

// GetLevel returns the topology level (0 = business, 1 = cluster, 2 = module, etc.)
func (tn *TopologyNode) GetLevel() int {
	return tn.Level
}

// BusinessTree represents a business topology tree
type BusinessTree struct {
	TenantModel
	Name        string         `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description string         `json:"description" gorm:"size:500"`
	RootNodeID  *uuid.UUID     `json:"root_node_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	
	// Relationships
	RootNode *BusinessNode   `json:"root_node,omitempty" gorm:"foreignKey:RootNodeID"`
	Nodes    []BusinessNode  `json:"nodes,omitempty" gorm:"foreignKey:TreeID"`
}

// BusinessNode represents a node in a business tree
type BusinessNode struct {
	TenantModel
	TreeID       uuid.UUID      `json:"tree_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	ParentID     *uuid.UUID     `json:"parent_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	Name         string         `json:"name" gorm:"size:200;not null" validate:"required,max=200"`
	Type         string         `json:"type" gorm:"size:50;not null" validate:"required"`
	Description  string         `json:"description" gorm:"size:500"`
	Path         string         `json:"path" gorm:"size:1000;not null;index"` // Materialized path
	Level        int            `json:"level" gorm:"not null;index"`
	
	// Relationships
	Tree      *BusinessTree   `json:"tree,omitempty" gorm:"foreignKey:TreeID"`
	Parent    *BusinessNode   `json:"parent,omitempty" gorm:"foreignKey:ParentID"`
	Children  []BusinessNode  `json:"children,omitempty" gorm:"foreignKey:ParentID"`
	Instances []Instance      `json:"instances,omitempty" gorm:"many2many:business_node_instances;"`
}

// TableNames for GORM
func (Business) TableName() string           { return "businesses" }
func (BusinessSet) TableName() string        { return "business_sets" }
func (BusinessTree) TableName() string       { return "business_trees" }
func (BusinessNode) TableName() string       { return "business_nodes" }
func (TopologyNode) TableName() string       { return "topology_nodes" }
func (ServiceTemplate) TableName() string    { return "service_templates" }
func (ClusterTemplate) TableName() string    { return "cluster_templates" }
func (DynamicGroup) TableName() string       { return "dynamic_groups" }