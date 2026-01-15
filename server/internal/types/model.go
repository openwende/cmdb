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
	ID             uuid.UUID `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Name           string    `json:"name" db:"name" gorm:"unique"`       // machine name: host
	DisplayName    string    `json:"display_name" db:"display_name"`     // human name: 主机
	Classification string    `json:"classification" db:"classification"` // resource, business
	Icon           string    `json:"icon" db:"icon"`
	IsBuiltin      bool      `json:"is_builtin" db:"is_builtin"`
	Description    string    `json:"description" db:"description"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
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
	EnumValues []string `json:"enum_values,omitempty"`
	Min        *float64 `json:"min,omitempty"`
	Max        *float64 `json:"max,omitempty"`
	Pattern    string   `json:"pattern,omitempty"` // Regex
	Default    any      `json:"default,omitempty"`
}

// ==========================================
// 2. Instance Layer
// ==========================================

// Instance represents a concrete object of a Model
type Instance struct {
	ID         uuid.UUID       `json:"id" db:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	ModelID    uuid.UUID       `json:"model_id" db:"model_id"`
	TenantID   uuid.UUID       `json:"tenant_id" db:"tenant_id"`
	BusinessID *uuid.UUID      `json:"business_id,omitempty" db:"business_id"`
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
	Name           string `json:"name" binding:"required"`
	DisplayName    string `json:"display_name" binding:"required"`
	Classification string `json:"classification" binding:"required"`
	Icon           string `json:"icon"`
	Description    string `json:"description"`
}

type CreateAttributeRequest struct {
	Name        string                 `json:"name" binding:"required"`
	DisplayName string                 `json:"display_name" binding:"required"`
	FieldType   string                 `json:"field_type" binding:"required"`
	IsRequired  bool                   `json:"is_required"`
	IsUnique    bool                   `json:"is_unique"`
	SortOrder   int                    `json:"sort_order"`
	Options     map[string]interface{} `json:"options"`
}

type CreateInstanceRequest struct {
	Properties map[string]interface{} `json:"properties" binding:"required"`
	BusinessID *string                `json:"business_id"` // Optional business binding
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

// TableName overrides
func (Model) TableName() string {
	return "models"
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
