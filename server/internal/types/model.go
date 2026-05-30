package types

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

// ==========================================
// 1. Meta-Model Layer
// ==========================================

// Model represents a resource definition (e.g., Host, Module)
type Model struct {
	ID                    uuid.UUID  `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Name                  string     `json:"name" db:"name" gorm:"unique"`       // machine name: host
	DisplayName           string     `json:"display_name" db:"display_name"`     // human name: 主机
	Classification        string     `json:"classification" db:"classification"` // resource, business
	GroupID               *uuid.UUID `json:"group_id,omitempty" db:"group_id"`
	GroupName             string     `json:"group_name,omitempty" gorm:"column:group_name;->"`
	GroupDisplayName      string     `json:"group_display_name,omitempty" gorm:"column:group_display_name;->"`
	Icon                  string     `json:"icon" db:"icon"`
	IsBuiltin             bool       `json:"is_builtin" db:"is_builtin"`
	IsMainline            bool       `json:"is_mainline" db:"is_mainline"`
	MainlineScope         string     `json:"mainline_scope" db:"mainline_scope"`
	MainlineLevel         *int       `json:"mainline_level,omitempty" db:"mainline_level"`
	IsTopologyBuiltin     bool       `json:"is_topology_builtin" db:"is_topology_builtin"`
	MainlineParentModelID *uuid.UUID `json:"mainline_parent_model_id,omitempty" db:"mainline_parent_model_id"`
	Description           string     `json:"description" db:"description"`
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
}

type ModelGroup struct {
	ID          uuid.UUID `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Name        string    `json:"name" db:"name" gorm:"unique"`
	DisplayName string    `json:"display_name" db:"display_name"`
	Description string    `json:"description" db:"description"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	IsBuiltin   bool      `json:"is_builtin" db:"is_builtin"`
	ModelCount  int64     `json:"model_count,omitempty" gorm:"column:model_count;->"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// Attribute represents a field in a model
type Attribute struct {
	ID          uuid.UUID       `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ModelID     uuid.UUID       `json:"model_id" db:"model_id"`
	Name        string          `json:"name" db:"name"`
	DisplayName string          `json:"display_name" db:"display_name"`
	FieldType   string          `json:"field_type" db:"field_type"` // string, int, enum, bool
	IsRequired  bool            `json:"is_required" db:"is_required"`
	IsUnique    bool            `json:"is_unique" db:"is_unique"`
	IsEditable  bool            `json:"is_editable" db:"is_editable"`
	IsSystem    bool            `json:"is_system" db:"is_system"`
	SortOrder   int             `json:"sort_order" db:"sort_order"`
	Options     json.RawMessage `json:"options" db:"options" gorm:"type:jsonb"` // Validation rules, enum values
	CreatedAt   time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

// AttributeOptions defines the structure for attribute configuration
type AttributeOptions struct {
	EnumValues  []string `json:"enum_values,omitempty"`
	Min         *float64 `json:"min,omitempty"`
	Max         *float64 `json:"max,omitempty"`
	MinLength   *int     `json:"min_length,omitempty"`
	MaxLength   *int     `json:"max_length,omitempty"`
	Pattern     string   `json:"pattern,omitempty"` // Regex
	Default     any      `json:"default,omitempty"`
	Placeholder string   `json:"placeholder,omitempty"`
	HelpText    string   `json:"help_text,omitempty"`
	Group       string   `json:"group,omitempty"`
	Unit        string   `json:"unit,omitempty"`
	Preview     any      `json:"preview,omitempty"`
}

// ==========================================
// 2. Instance Layer
// ==========================================

// Instance represents a concrete object of a Model
type Instance struct {
	ID         uuid.UUID       `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ModelID    uuid.UUID       `json:"model_id" db:"model_id"`
	TenantID   uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	BusinessID *uint64         `json:"business_id,omitempty" db:"business_id"`
	Properties json.RawMessage `json:"properties" db:"properties" gorm:"type:jsonb"`
	Path       string          `json:"path,omitempty" db:"path" gorm:"type:ltree"` // ltree stored as string
	CreatedAt  time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time       `json:"updated_at" db:"updated_at"`
	DeletedAt  *time.Time      `json:"deleted_at,omitempty" db:"deleted_at"`

	// Derived/Joined fields
	ModelName string `json:"model_name,omitempty" gorm:"-"`
}

// ==========================================
// 3. API Requests
// ==========================================

type CreateModelRequest struct {
	Name                string `json:"name" binding:"required"`
	DisplayName         string `json:"display_name" binding:"required"`
	Classification      string `json:"classification" binding:"required"`
	GroupID             string `json:"group_id,omitempty"`
	Icon                string `json:"icon"`
	Description         string `json:"description"`
	IsMainline          bool   `json:"is_mainline"`
	MainlineScope       string `json:"mainline_scope,omitempty"`
	MainlineLevel       *int   `json:"mainline_level,omitempty"`
	MainlineParentModel string `json:"mainline_parent_model,omitempty"`
}

type CreateModelGroupRequest struct {
	Name        string `json:"name" binding:"required"`
	DisplayName string `json:"display_name" binding:"required"`
	Description string `json:"description"`
	SortOrder   int    `json:"sort_order"`
}

type UpdateModelRequest struct {
	DisplayName         *string `json:"display_name"`
	Classification      *string `json:"classification"`
	Icon                *string `json:"icon"`
	Description         *string `json:"description"`
	IsMainline          *bool   `json:"is_mainline"`
	MainlineScope       *string `json:"mainline_scope,omitempty"`
	MainlineLevel       *int    `json:"mainline_level,omitempty"`
	MainlineParentModel *string `json:"mainline_parent_model,omitempty"`
}

type CreateAttributeRequest struct {
	Name        string                 `json:"name" binding:"required"`
	DisplayName string                 `json:"display_name" binding:"required"`
	FieldType   string                 `json:"field_type" binding:"required"`
	IsRequired  bool                   `json:"is_required"`
	IsUnique    bool                   `json:"is_unique"`
	IsEditable  *bool                  `json:"is_editable,omitempty"`
	SortOrder   int                    `json:"sort_order"`
	Options     map[string]interface{} `json:"options"`
}

type UpdateAttributeRequest struct {
	DisplayName *string                `json:"display_name"`
	FieldType   *string                `json:"field_type"`
	IsRequired  *bool                  `json:"is_required"`
	IsUnique    *bool                  `json:"is_unique"`
	IsEditable  *bool                  `json:"is_editable"`
	SortOrder   *int                   `json:"sort_order"`
	Options     map[string]interface{} `json:"options"`
}

type CreateInstanceRequest struct {
	Properties          map[string]interface{} `json:"properties" binding:"required"`
	BusinessID          *string                `json:"business_id"`                      // Optional business binding
	MainlineParentRefID *string                `json:"mainline_parent_ref_id,omitempty"` // Required for non-root mainline models
}

type BatchCreateInstanceRequest struct {
	Instances []CreateInstanceRequest `json:"instances" binding:"required,min=1,max=1000"`
}

type UpdateInstanceRequest struct {
	Properties map[string]interface{} `json:"properties" binding:"required"`
}

// QueryParams for searching instances
type QueryParams struct {
	Page     int
	PageSize int
	Filters  map[string]interface{} // JSONB filters: property_name -> value
}

type ModelFormSchema struct {
	Model       *Model               `json:"model"`
	Mainline    *MainlineFormContext `json:"mainline,omitempty"`
	Fields      []ModelFormField     `json:"fields"`
	PreviewPath []ModelPreviewNode   `json:"preview_path,omitempty"`
}

type ModelFormField struct {
	Name        string                 `json:"name"`
	DisplayName string                 `json:"display_name"`
	FieldType   string                 `json:"field_type"`
	IsRequired  bool                   `json:"is_required"`
	IsUnique    bool                   `json:"is_unique"`
	IsEditable  bool                   `json:"is_editable"`
	IsSystem    bool                   `json:"is_system"`
	SortOrder   int                    `json:"sort_order"`
	Group       string                 `json:"group,omitempty"`
	Placeholder string                 `json:"placeholder,omitempty"`
	HelpText    string                 `json:"help_text,omitempty"`
	Unit        string                 `json:"unit,omitempty"`
	Default     any                    `json:"default,omitempty"`
	EnumValues  []string               `json:"enum_values,omitempty"`
	Options     map[string]interface{} `json:"options,omitempty"`
}

type MainlineFormContext struct {
	Scope            string `json:"scope"`
	Level            *int   `json:"level,omitempty"`
	ParentModel      string `json:"parent_model,omitempty"`
	RequiresBusiness bool   `json:"requires_business"`
	RequiresParent   bool   `json:"requires_parent"`
}

type ModelPreviewNode struct {
	ModelName    string `json:"model_name"`
	DisplayName  string `json:"display_name"`
	Level        *int   `json:"level,omitempty"`
	IsCurrent    bool   `json:"is_current"`
	IsTopologyUI bool   `json:"is_topology_ui"`
}

// TableName overrides
func (Model) TableName() string {
	return "models"
}

func (ModelGroup) TableName() string {
	return "model_groups"
}

func (Attribute) TableName() string {
	return "model_attributes"
}

func (Instance) TableName() string {
	return "model_instances"
}

// StringArray is a helper for pq.Array
type StringArray []string

func (a *StringArray) Scan(src interface{}) error {
	return pq.Array(a).Scan(src)
}
