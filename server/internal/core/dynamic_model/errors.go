package dynamic_model

import (
	"fmt"
	"strings"
)

// BaseError 基础错误类型
type BaseError struct {
	Code    string
	Message string
	Details map[string]interface{}
}

func (e *BaseError) Error() string {
	if len(e.Details) > 0 {
		return fmt.Sprintf("[%s] %s (详情: %v)", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// ValidationError 字段校验错误
type ValidationError struct {
	BaseError
	FieldName string
	Value     interface{}
	Rule      string
}

func NewValidationError(fieldName string, value interface{}, rule, message string) *ValidationError {
	return &ValidationError{
		BaseError: BaseError{
			Code:    "VALIDATION_FAILED",
			Message: message,
			Details: map[string]interface{}{
				"field": fieldName,
				"value": value,
				"rule":  rule,
			},
		},
		FieldName: fieldName,
		Value:     value,
		Rule:      rule,
	}
}

// DuplicateError 唯一性冲突错误
type DuplicateError struct {
	BaseError
	ModelUID       string
	ConflictFields []string
	ConflictValues map[string]interface{}
}

func NewDuplicateError(modelUID string, fields []string, values map[string]interface{}) *DuplicateError {
	fieldsStr := strings.Join(fields, ", ")
	return &DuplicateError{
		BaseError: BaseError{
			Code:    "DUPLICATE_RESOURCE",
			Message: fmt.Sprintf("资源已存在，字段 [%s] 违反唯一性约束", fieldsStr),
			Details: map[string]interface{}{
				"model":           modelUID,
				"conflict_fields": fields,
				"conflict_values": values,
			},
		},
		ModelUID:       modelUID,
		ConflictFields: fields,
		ConflictValues: values,
	}
}

// ModelNotFoundError 模型不存在错误
type ModelNotFoundError struct {
	BaseError
	ModelUID string
}

func NewModelNotFoundError(modelUID string) *ModelNotFoundError {
	return &ModelNotFoundError{
		BaseError: BaseError{
			Code:    "MODEL_NOT_FOUND",
			Message: fmt.Sprintf("模型 %s 不存在", modelUID),
			Details: map[string]interface{}{
				"model_uid": modelUID,
			},
		},
		ModelUID: modelUID,
	}
}

// ResourceNotFoundError 资源不存在错误
type ResourceNotFoundError struct {
	BaseError
	ResourceID uint64
}

func NewResourceNotFoundError(resourceID uint64) *ResourceNotFoundError {
	return &ResourceNotFoundError{
		BaseError: BaseError{
			Code:    "RESOURCE_NOT_FOUND",
			Message: fmt.Sprintf("资源 %d 不存在", resourceID),
			Details: map[string]interface{}{
				"resource_id": resourceID,
			},
		},
		ResourceID: resourceID,
	}
}

// AssociationNotAllowedError 关联不允许错误
type AssociationNotAllowedError struct {
	BaseError
	SourceModelUID string
	TargetModelUID string
	AssociationUID string
}

func NewAssociationNotAllowedError(sourceModel, targetModel, assocUID string) *AssociationNotAllowedError {
	return &AssociationNotAllowedError{
		BaseError: BaseError{
			Code:    "ASSOCIATION_NOT_ALLOWED",
			Message: fmt.Sprintf("模型 %s 和 %s 之间不允许 %s 关联", sourceModel, targetModel, assocUID),
			Details: map[string]interface{}{
				"source_model":    sourceModel,
				"target_model":    targetModel,
				"association_uid": assocUID,
			},
		},
		SourceModelUID: sourceModel,
		TargetModelUID: targetModel,
		AssociationUID: assocUID,
	}
}

// CardinalityViolationError 关联基数违反错误
type CardinalityViolationError struct {
	BaseError
	Mapping        string
	AssociationUID string
}

func NewCardinalityViolationError(mapping, assocUID string) *CardinalityViolationError {
	return &CardinalityViolationError{
		BaseError: BaseError{
			Code:    "CARDINALITY_VIOLATION",
			Message: fmt.Sprintf("%s 关联已存在，违反 %s 约束", assocUID, mapping),
			Details: map[string]interface{}{
				"mapping":         mapping,
				"association_uid": assocUID,
			},
		},
		Mapping:        mapping,
		AssociationUID: assocUID,
	}
}

// RequiredFieldError 必填字段缺失错误
type RequiredFieldError struct {
	BaseError
	FieldName string
}

func NewRequiredFieldError(fieldName string) *RequiredFieldError {
	return &RequiredFieldError{
		BaseError: BaseError{
			Code:    "REQUIRED_FIELD_MISSING",
			Message: fmt.Sprintf("必填字段 %s 不能为空", fieldName),
			Details: map[string]interface{}{
				"field": fieldName,
			},
		},
		FieldName: fieldName,
	}
}

// InvalidFieldTypeError 字段类型错误
type InvalidFieldTypeError struct {
	BaseError
	FieldName    string
	ExpectedType string
	ActualType   string
}

func NewInvalidFieldTypeError(fieldName, expectedType, actualType string) *InvalidFieldTypeError {
	return &InvalidFieldTypeError{
		BaseError: BaseError{
			Code:    "INVALID_FIELD_TYPE",
			Message: fmt.Sprintf("字段 %s 类型错误，期望 %s，实际 %s", fieldName, expectedType, actualType),
			Details: map[string]interface{}{
				"field":         fieldName,
				"expected_type": expectedType,
				"actual_type":   actualType,
			},
		},
		FieldName:    fieldName,
		ExpectedType: expectedType,
		ActualType:   actualType,
	}
}

// ParseDBError 解析数据库错误，转换为业务错误
func ParseDBError(err error, modelUID string) error {
	if err == nil {
		return nil
	}

	errMsg := err.Error()

	// 检查唯一性冲突
	if strings.Contains(errMsg, "duplicate key") || strings.Contains(errMsg, "UNIQUE constraint failed") {
		// 尝试解析冲突字段
		fields := extractConflictFields(errMsg)
		return NewDuplicateError(modelUID, fields, nil)
	}

	// 检查外键约束
	if strings.Contains(errMsg, "foreign key constraint") {
		return &BaseError{
			Code:    "FOREIGN_KEY_VIOLATION",
			Message: "外键约束违反",
			Details: map[string]interface{}{
				"error": errMsg,
			},
		}
	}

	// 其他数据库错误
	return err
}

// extractConflictFields 从错误消息中提取冲突字段名
func extractConflictFields(errMsg string) []string {
	// PostgreSQL 错误格式: duplicate key value violates unique constraint "idx_unique_host_ip"
	// 尝试从索引名推断字段
	if strings.Contains(errMsg, "idx_unique_host_ip") {
		return []string{"cloud_id", "inner_ip"}
	}

	// 通用处理：返回空列表
	return []string{"未知字段"}
}
