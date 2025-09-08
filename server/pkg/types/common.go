package types

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseModel provides common fields for all models
type BaseModel struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()" swaggertype:"string"`
	CreatedAt time.Time      `json:"created_at" gorm:"not null"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"not null"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`
	CreatedBy uuid.UUID      `json:"created_by,omitempty" gorm:"type:uuid" swaggertype:"string"`
	UpdatedBy uuid.UUID      `json:"updated_by,omitempty" gorm:"type:uuid" swaggertype:"string"`
}

// TenantModel adds tenant isolation to base model
type TenantModel struct {
	BaseModel
	TenantID uuid.UUID `json:"tenant_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
}

// FieldType represents the type of a model field
type FieldType string

const (
	FieldTypeString     FieldType = "string"
	FieldTypeLongText   FieldType = "longtext"
	FieldTypeInt        FieldType = "int"
	FieldTypeFloat      FieldType = "float"
	FieldTypeBool       FieldType = "bool"
	FieldTypeDate       FieldType = "date"
	FieldTypeDateTime   FieldType = "datetime"
	FieldTypeEnum       FieldType = "enum"
	FieldTypeMultiEnum  FieldType = "multi_enum"
	FieldTypeUser       FieldType = "user"
	FieldTypeTimezone   FieldType = "timezone"
	FieldTypeList       FieldType = "list"
	FieldTypeTable      FieldType = "table"
)

// RelationType represents the type of relationship between models
type RelationType string

const (
	RelationTypeBelongsTo   RelationType = "belongs_to"   // 属于
	RelationTypeComposedOf  RelationType = "composed_of"  // 组成
	RelationTypeRunning     RelationType = "running"      // 运行
	RelationTypeUplink      RelationType = "uplink"       // 上联
	RelationTypeDefault     RelationType = "default"      // 默认
	RelationTypeCustom      RelationType = "custom"       // 自定义
)

// ConstraintType represents relationship constraints
type ConstraintType string

const (
	ConstraintOneToOne   ConstraintType = "1:1"  // 1-1 relationship
	ConstraintOneToMany  ConstraintType = "1:N"  // 1-N relationship
	ConstraintManyToMany ConstraintType = "N:N"  // N-N relationship (default)
)

// ModelStatus represents the status of a model
type ModelStatus string

const (
	ModelStatusActive   ModelStatus = "active"
	ModelStatusInactive ModelStatus = "inactive"
	ModelStatusArchived ModelStatus = "archived"
)

// InstanceStatus represents the status of an instance
type InstanceStatus string

const (
	InstanceStatusActive   InstanceStatus = "active"
	InstanceStatusInactive InstanceStatus = "inactive"
	InstanceStatusDeleted  InstanceStatus = "deleted"
)

// AuditAction represents the type of audit action
type AuditAction string

const (
	AuditActionCreate AuditAction = "create"
	AuditActionUpdate AuditAction = "update"
	AuditActionDelete AuditAction = "delete"
	AuditActionRead   AuditAction = "read"
)

// ErrorCode represents application error codes
type ErrorCode string

const (
	ErrorCodeInvalidInput     ErrorCode = "INVALID_INPUT"
	ErrorCodeNotFound         ErrorCode = "NOT_FOUND"
	ErrorCodeAlreadyExists    ErrorCode = "ALREADY_EXISTS"
	ErrorCodeUnauthorized     ErrorCode = "UNAUTHORIZED"
	ErrorCodePermissionDenied ErrorCode = "PERMISSION_DENIED"
	ErrorCodeInternalError    ErrorCode = "INTERNAL_ERROR"
	ErrorCodeValidationFailed ErrorCode = "VALIDATION_FAILED"
	ErrorCodeConstraintViolation ErrorCode = "CONSTRAINT_VIOLATION"
)

// AppError represents application error with code and message
type AppError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

func (e AppError) Error() string {
	return string(e.Code) + ": " + e.Message
}

// Pagination represents pagination parameters
type Pagination struct {
	Page     int `json:"page" form:"page" validate:"min=1"`
	PageSize int `json:"page_size" form:"page_size" validate:"min=1,max=100"`
	Total    int64 `json:"total"`
}

// GetOffset returns the offset for database queries
func (p *Pagination) GetOffset() int {
	if p.Page <= 0 {
		p.Page = 1
	}
	if p.PageSize <= 0 {
		p.PageSize = 20
	}
	return (p.Page - 1) * p.PageSize
}

// SortOrder represents sort order
type SortOrder string

const (
	SortOrderAsc  SortOrder = "asc"
	SortOrderDesc SortOrder = "desc"
)

// Sort represents sorting parameters
type Sort struct {
	Field string    `json:"field" form:"field"`
	Order SortOrder `json:"order" form:"order" validate:"oneof=asc desc"`
}

// Filter represents query filter
type Filter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"` // eq, ne, gt, lt, ge, le, in, like, is_null, is_not_null
	Value    interface{} `json:"value"`
}

// QueryOptions represents query options
type QueryOptions struct {
	Pagination *Pagination `json:"pagination,omitempty"`
	Sort       []Sort      `json:"sort,omitempty"`
	Filters    []Filter    `json:"filters,omitempty"`
	Include    []string    `json:"include,omitempty"` // Related fields to include
}

// Response represents a standard API response
type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *AppError   `json:"error,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

// ListResponse represents a paginated list response
type ListResponse struct {
	Items      interface{} `json:"items"`
	Pagination *Pagination `json:"pagination"`
}

// JSON represents a JSON data type that can be stored in the database
type JSON interface{}

// JSONMap represents a JSON object as a map
type JSONMap map[string]interface{}

// Value implements the driver.Valuer interface for database storage
func (j JSONMap) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for database retrieval
func (j *JSONMap) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into JSONMap", value)
	}
	
	if len(bytes) == 0 {
		*j = nil
		return nil
	}
	
	return json.Unmarshal(bytes, j)
}

// JSONArray represents a JSON array
type JSONArray []interface{}

// Value implements the driver.Valuer interface for database storage
func (j JSONArray) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

// Scan implements the sql.Scanner interface for database retrieval
func (j *JSONArray) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	
	var bytes []byte
	switch v := value.(type) {
	case []byte:
		bytes = v
	case string:
		bytes = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into JSONArray", value)
	}
	
	if len(bytes) == 0 {
		*j = nil
		return nil
	}
	
	return json.Unmarshal(bytes, j)
}