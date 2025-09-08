package types

import (
	"encoding/json"

	"github.com/google/uuid"
)

// ModelGroup represents a group of related models
type ModelGroup struct {
	TenantModel
	Name        string      `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string      `json:"identifier" gorm:"size:100;not null;uniqueIndex:idx_tenant_group_identifier" validate:"required,max=100,alphanum"`
	Description string      `json:"description" gorm:"size:500"`
	IsBuiltIn   bool        `json:"is_built_in" gorm:"default:false"`
	Models      []Model     `json:"models,omitempty" gorm:"foreignKey:GroupID"`
}

// Model represents a CMDB model (like host, application, etc.)
type Model struct {
	TenantModel
	Name        string       `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string       `json:"identifier" gorm:"size:100;not null;uniqueIndex:idx_tenant_model_identifier" validate:"required,max=100,alphanum"`
	Description string       `json:"description" gorm:"size:500"`
	GroupID     uuid.UUID    `json:"group_id" gorm:"type:uuid;not null" swaggertype:"string" validate:"required"`
	Icon        string       `json:"icon" gorm:"size:100"`
	Status      ModelStatus  `json:"status" gorm:"size:20;default:'active'" validate:"oneof=active inactive archived"`
	IsBuiltIn   bool         `json:"is_built_in" gorm:"default:false"`
	
	// Relationships
	Group         *ModelGroup     `json:"group,omitempty" gorm:"foreignKey:GroupID"`
	Fields        []Field         `json:"fields,omitempty" gorm:"foreignKey:ModelID"`
	FieldGroups   []FieldGroup    `json:"field_groups,omitempty" gorm:"foreignKey:ModelID"`
	SourceRels    []Relationship  `json:"source_relationships,omitempty" gorm:"foreignKey:SourceModelID"`
	TargetRels    []Relationship  `json:"target_relationships,omitempty" gorm:"foreignKey:TargetModelID"`
}

// FieldGroup represents a logical grouping of fields within a model
type FieldGroup struct {
	TenantModel
	Name            string    `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier      string    `json:"identifier" gorm:"size:100;not null" validate:"required,max=100,alphanum"`
	ModelID         uuid.UUID `json:"model_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	Description     string    `json:"description" gorm:"size:500"`
	IsCollapsible   bool      `json:"is_collapsible" gorm:"default:false"`
	IsCollapsed     bool      `json:"is_collapsed" gorm:"default:false"`
	DisplayOrder    int       `json:"display_order" gorm:"default:0"`
	
	// Relationships
	Model  *Model  `json:"model,omitempty" gorm:"foreignKey:ModelID"`
	Fields []Field `json:"fields,omitempty" gorm:"foreignKey:GroupID"`
}

// Field represents a field within a model
type Field struct {
	TenantModel
	Name         string      `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier   string      `json:"identifier" gorm:"size:100;not null" validate:"required,max=100,alphanum"`
	ModelID      uuid.UUID   `json:"model_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	GroupID      *uuid.UUID  `json:"group_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	Type         FieldType   `json:"type" gorm:"size:20;not null" validate:"required,oneof=string longtext int float bool date datetime enum multi_enum user timezone list table"`
	Description  string      `json:"description" gorm:"size:500"`
	IsRequired   bool        `json:"is_required" gorm:"default:false"`
	IsUnique     bool        `json:"is_unique" gorm:"default:false"`
	IsEditable   bool        `json:"is_editable" gorm:"default:true"`
	IsBuiltIn    bool        `json:"is_built_in" gorm:"default:false"`
	DefaultValue *string     `json:"default_value,omitempty" gorm:"type:text"`
	Options      *FieldOptions `json:"options,omitempty" gorm:"type:jsonb"`
	DisplayOrder int         `json:"display_order" gorm:"default:0"`
	
	// Relationships
	Model *Model      `json:"model,omitempty" gorm:"foreignKey:ModelID"`
	Group *FieldGroup `json:"group,omitempty" gorm:"foreignKey:GroupID"`
}

// FieldOptions represents field-specific options stored as JSON
type FieldOptions struct {
	// String/LongText options
	MinLength *int `json:"min_length,omitempty"`
	MaxLength *int `json:"max_length,omitempty"`
	Pattern   *string `json:"pattern,omitempty"` // Regex pattern
	
	// Number options
	Min *float64 `json:"min,omitempty"`
	Max *float64 `json:"max,omitempty"`
	
	// Enum options
	EnumValues []EnumOption `json:"enum_values,omitempty"`
	
	// List options
	ListItemType  *FieldType `json:"list_item_type,omitempty"`
	ListMinItems  *int       `json:"list_min_items,omitempty"`
	ListMaxItems  *int       `json:"list_max_items,omitempty"`
	
	// Table options
	TableColumns []TableColumn `json:"table_columns,omitempty"`
	
	// Display options
	Placeholder *string `json:"placeholder,omitempty"`
	HelpText    *string `json:"help_text,omitempty"`
}

// EnumOption represents an enumeration option
type EnumOption struct {
	Key         string `json:"key" validate:"required"`
	Value       string `json:"value" validate:"required"`
	Description string `json:"description,omitempty"`
	IsDefault   bool   `json:"is_default,omitempty"`
}

// TableColumn represents a column in a table field
type TableColumn struct {
	Name        string    `json:"name" validate:"required"`
	Type        FieldType `json:"type" validate:"required"`
	IsRequired  bool      `json:"is_required,omitempty"`
	Description string    `json:"description,omitempty"`
}

// RelationshipType represents a type of relationship between models
type RelationshipType struct {
	TenantModel
	Name        string       `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string       `json:"identifier" gorm:"size:100;not null;uniqueIndex:idx_tenant_reltype_identifier" validate:"required,max=100,alphanum"`
	Description string       `json:"description" gorm:"size:500"`
	Direction   string       `json:"direction" gorm:"size:20;default:'bidirectional'" validate:"oneof=forward backward bidirectional"`
	IsBuiltIn   bool         `json:"is_built_in" gorm:"default:false"`
	
	// Relationships
	Relationships []Relationship `json:"relationships,omitempty" gorm:"foreignKey:TypeID"`
}

// Relationship represents a relationship between two models
type Relationship struct {
	TenantModel
	Name            string           `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description     string           `json:"description" gorm:"size:500"`
	SourceModelID   uuid.UUID        `json:"source_model_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	TargetModelID   uuid.UUID        `json:"target_model_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	TypeID          uuid.UUID        `json:"type_id" gorm:"type:uuid;not null" swaggertype:"string" validate:"required"`
	Constraint      ConstraintType   `json:"constraint" gorm:"size:10;default:'N:N'" validate:"oneof=1:1 1:N N:N"`
	IsMandatory     bool             `json:"is_mandatory" gorm:"default:false"`
	IsBuiltIn       bool             `json:"is_built_in" gorm:"default:false"`
	
	// Relationships
	SourceModel *Model            `json:"source_model,omitempty" gorm:"foreignKey:SourceModelID"`
	TargetModel *Model            `json:"target_model,omitempty" gorm:"foreignKey:TargetModelID"`
	Type        *RelationshipType `json:"type,omitempty" gorm:"foreignKey:TypeID"`
}

// Instance represents a model instance (actual data)
type Instance struct {
	TenantModel
	ModelID    uuid.UUID       `json:"model_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	Name       string          `json:"name" gorm:"size:200;not null" validate:"required,max=200"`
	Status     InstanceStatus  `json:"status" gorm:"size:20;default:'active'" validate:"oneof=active inactive deleted"`
	Data       json.RawMessage `json:"data" gorm:"type:jsonb;not null"` // Instance field values
	
	// Relationships
	Model       *Model                `json:"model,omitempty" gorm:"foreignKey:ModelID"`
	SourceRels  []InstanceRelationship `json:"source_relationships,omitempty" gorm:"foreignKey:SourceInstanceID"`
	TargetRels  []InstanceRelationship `json:"target_relationships,omitempty" gorm:"foreignKey:TargetInstanceID"`
}

// InstanceRelationship represents a relationship between two instances
type InstanceRelationship struct {
	TenantModel
	SourceInstanceID uuid.UUID `json:"source_instance_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	TargetInstanceID uuid.UUID `json:"target_instance_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	RelationshipID   uuid.UUID `json:"relationship_id" gorm:"type:uuid;not null" swaggertype:"string" validate:"required"`
	
	// Relationships
	SourceInstance *Instance     `json:"source_instance,omitempty" gorm:"foreignKey:SourceInstanceID"`
	TargetInstance *Instance     `json:"target_instance,omitempty" gorm:"foreignKey:TargetInstanceID"`
	Relationship   *Relationship `json:"relationship,omitempty" gorm:"foreignKey:RelationshipID"`
}

// ValidateFieldType validates if the field type is supported
func (f *Field) ValidateFieldType() error {
	validTypes := map[FieldType]bool{
		FieldTypeString:     true,
		FieldTypeLongText:   true,
		FieldTypeInt:        true,
		FieldTypeFloat:      true,
		FieldTypeBool:       true,
		FieldTypeDate:       true,
		FieldTypeDateTime:   true,
		FieldTypeEnum:       true,
		FieldTypeMultiEnum:  true,
		FieldTypeUser:       true,
		FieldTypeTimezone:   true,
		FieldTypeList:       true,
		FieldTypeTable:      true,
	}
	
	if !validTypes[f.Type] {
		return &AppError{
			Code:    ErrorCodeValidationFailed,
			Message: "Invalid field type",
			Details: map[string]interface{}{"type": f.Type},
		}
	}
	return nil
}

// GetDefaultFieldGroup returns the default field group identifier
func GetDefaultFieldGroup() string {
	return "default"
}

// TableNames for GORM
func (ModelGroup) TableName() string        { return "model_groups" }
func (Model) TableName() string             { return "models" }
func (FieldGroup) TableName() string        { return "field_groups" }
func (Field) TableName() string             { return "fields" }
func (RelationshipType) TableName() string  { return "relationship_types" }
func (Relationship) TableName() string      { return "relationships" }
func (Instance) TableName() string          { return "instances" }
func (InstanceRelationship) TableName() string { return "instance_relationships" }