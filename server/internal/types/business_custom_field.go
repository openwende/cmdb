package types

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

const (
	BusinessObjectTypeSet    = "set"
	BusinessObjectTypeModule = "module"
	BusinessObjectTypeHost   = "host"
)

type BusinessCustomFieldGroup struct {
	ID                 uint64         `gorm:"primaryKey" json:"id"`
	BusinessID         uint64         `gorm:"index;not null" json:"business_id"`
	ObjectType         string         `gorm:"size:20;index;not null" json:"object_type"`
	Name               string         `gorm:"size:100;not null" json:"name"`
	CollapsedByDefault bool           `gorm:"default:false" json:"collapsed_by_default"`
	SortOrder          int            `gorm:"default:0" json:"sort_order"`
	CreatedBy          string         `gorm:"size:100" json:"created_by"`
	UpdatedBy          string         `gorm:"size:100" json:"updated_by"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (BusinessCustomFieldGroup) TableName() string {
	return "business_custom_field_groups"
}

type BusinessCustomField struct {
	ID           uint64          `gorm:"primaryKey" json:"id"`
	BusinessID   uint64          `gorm:"index;not null" json:"business_id"`
	ObjectType   string          `gorm:"size:20;index;not null" json:"object_type"`
	GroupID      *uint64         `gorm:"index" json:"group_id,omitempty"`
	FieldUID     string          `gorm:"size:50;not null" json:"field_uid"`
	FieldName    string          `gorm:"size:100;not null" json:"field_name"`
	FieldType    string          `gorm:"size:20;not null" json:"field_type"`
	IsRequired   bool            `gorm:"default:false" json:"is_required"`
	IsEditable   bool            `gorm:"default:true" json:"is_editable"`
	IsUnique     bool            `gorm:"default:false" json:"is_unique"`
	DefaultValue *string         `gorm:"size:500" json:"default_value,omitempty"`
	Placeholder  string          `gorm:"size:200" json:"placeholder,omitempty"`
	Validators   json.RawMessage `gorm:"type:jsonb" json:"validators,omitempty"`
	Options      json.RawMessage `gorm:"type:jsonb" json:"options,omitempty"`
	SortOrder    int             `gorm:"default:0" json:"sort_order"`
	CreatedBy    string          `gorm:"size:100" json:"created_by"`
	UpdatedBy    string          `gorm:"size:100" json:"updated_by"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
	DeletedAt    gorm.DeletedAt  `gorm:"index" json:"deleted_at,omitempty"`
}

func (BusinessCustomField) TableName() string {
	return "business_custom_fields"
}

type BusinessCustomFieldPayload struct {
	ObjectType   string                 `json:"object_type"`
	GroupID      *uint64                `json:"group_id,omitempty"`
	FieldUID     string                 `json:"field_uid"`
	FieldName    string                 `json:"field_name"`
	FieldType    string                 `json:"field_type"`
	IsRequired   bool                   `json:"is_required"`
	IsEditable   bool                   `json:"is_editable"`
	IsUnique     bool                   `json:"is_unique"`
	DefaultValue *string                `json:"default_value,omitempty"`
	Placeholder  string                 `json:"placeholder,omitempty"`
	Validators   map[string]interface{} `json:"validators,omitempty"`
	Options      map[string]interface{} `json:"options,omitempty"`
	SortOrder    int                    `json:"sort_order"`
}

type BusinessCustomFieldGroupPayload struct {
	ObjectType         string `json:"object_type"`
	Name               string `json:"name"`
	CollapsedByDefault bool   `json:"collapsed_by_default"`
	SortOrder          int    `json:"sort_order"`
}

type BusinessCustomFieldGroupDetail struct {
	ID                 uint64                `json:"id"`
	ObjectType         string                `json:"object_type"`
	Name               string                `json:"name"`
	CollapsedByDefault bool                  `json:"collapsed_by_default"`
	SortOrder          int                   `json:"sort_order"`
	Fields             []BusinessCustomField `json:"fields"`
}

type BusinessFormSchemaField struct {
	Name         string                 `json:"name"`
	DisplayName  string                 `json:"display_name"`
	FieldType    string                 `json:"field_type"`
	IsRequired   bool                   `json:"is_required"`
	IsUnique     bool                   `json:"is_unique"`
	IsEditable   bool                   `json:"is_editable"`
	IsSystem     bool                   `json:"is_system"`
	SortOrder    int                    `json:"sort_order"`
	Placeholder  string                 `json:"placeholder,omitempty"`
	DefaultValue interface{}            `json:"default_value,omitempty"`
	Options      map[string]interface{} `json:"options,omitempty"`
	Validators   map[string]interface{} `json:"validators,omitempty"`
}

type BusinessFormSchemaGroup struct {
	GroupName          string                    `json:"group_name"`
	CollapsedByDefault bool                      `json:"collapsed_by_default"`
	Fields             []BusinessFormSchemaField `json:"fields"`
}
