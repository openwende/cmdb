package dynamic_model

import (
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/openwende/cmdb/server/internal/types"
)

// Validator 字段校验器
type Validator struct {
	attributes map[string]types.DynamicAttribute // fieldUID -> Attribute
}

// NewValidator 创建校验器
func NewValidator(attributes []types.DynamicAttribute) *Validator {
	attrMap := make(map[string]types.DynamicAttribute)
	for _, attr := range attributes {
		attrMap[attr.FieldUID] = attr
	}
	return &Validator{attributes: attrMap}
}

// ValidateData 校验数据
// data: 用户提交的原始数据
// 返回: 校验后的数据（类型转换后）和错误
func (v *Validator) ValidateData(data map[string]interface{}) (map[string]interface{}, error) {
	validated := make(map[string]interface{})

	// 1. 检查必填字段
	for fieldUID, attr := range v.attributes {
		value, exists := data[fieldUID]

		if !exists || value == nil {
			if attr.IsRequired {
				return nil, NewRequiredFieldError(attr.FieldName)
			}
			// 使用默认值
			if attr.DefaultValue != "" {
				validated[fieldUID] = attr.DefaultValue
			}
			continue
		}

		// 2. 类型校验和转换
		convertedValue, err := v.validateAndConvertType(fieldUID, value, attr)
		if err != nil {
			return nil, err
		}

		// 3. 规则校验
		if err := v.validateRules(fieldUID, convertedValue, attr); err != nil {
			return nil, err
		}

		validated[fieldUID] = convertedValue
	}

	// 4. 检查未定义字段
	for fieldUID := range data {
		if _, exists := v.attributes[fieldUID]; !exists {
			// 可选：是否允许未定义字段
			// 这里选择忽略，也可以返回错误
			// return nil, fmt.Errorf("未定义字段: %s", fieldUID)
		}
	}

	return validated, nil
}

// validateAndConvertType 校验并转换类型
func (v *Validator) validateAndConvertType(fieldUID string, value interface{}, attr types.DynamicAttribute) (interface{}, error) {
	_ = reflect.TypeOf(value).Kind().String() // 保留用于调试

	switch attr.FieldType {
	case "string":
		return v.convertToString(value, fieldUID, attr.FieldName)

	case "int":
		return v.convertToInt(value, fieldUID, attr.FieldName)

	case "float":
		return v.convertToFloat(value, fieldUID, attr.FieldName)

	case "bool":
		return v.convertToBool(value, fieldUID, attr.FieldName)

	case "enum":
		return v.validateEnum(value, fieldUID, attr)

	case "date":
		return v.convertToDate(value, fieldUID, attr.FieldName)

	default:
		return nil, fmt.Errorf("不支持的字段类型: %s", attr.FieldType)
	}
}

// convertToString 转换为字符串
func (v *Validator) convertToString(value interface{}, fieldUID, fieldName string) (string, error) {
	switch val := value.(type) {
	case string:
		return val, nil
	case float64:
		return strconv.FormatFloat(val, 'f', -1, 64), nil
	case int, int64:
		return fmt.Sprintf("%d", val), nil
	case bool:
		return strconv.FormatBool(val), nil
	default:
		return "", NewInvalidFieldTypeError(fieldName, "string", reflect.TypeOf(value).String())
	}
}

// convertToInt 转换为整数
func (v *Validator) convertToInt(value interface{}, fieldUID, fieldName string) (int64, error) {
	switch val := value.(type) {
	case float64:
		return int64(val), nil
	case int:
		return int64(val), nil
	case int64:
		return val, nil
	case string:
		i, err := strconv.ParseInt(val, 10, 64)
		if err != nil {
			return 0, NewInvalidFieldTypeError(fieldName, "int", "string(无法转换)")
		}
		return i, nil
	default:
		return 0, NewInvalidFieldTypeError(fieldName, "int", reflect.TypeOf(value).String())
	}
}

// convertToFloat 转换为浮点数
func (v *Validator) convertToFloat(value interface{}, fieldUID, fieldName string) (float64, error) {
	switch val := value.(type) {
	case float64:
		return val, nil
	case float32:
		return float64(val), nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case string:
		f, err := strconv.ParseFloat(val, 64)
		if err != nil {
			return 0, NewInvalidFieldTypeError(fieldName, "float", "string(无法转换)")
		}
		return f, nil
	default:
		return 0, NewInvalidFieldTypeError(fieldName, "float", reflect.TypeOf(value).String())
	}
}

// convertToBool 转换为布尔值
func (v *Validator) convertToBool(value interface{}, fieldUID, fieldName string) (bool, error) {
	switch val := value.(type) {
	case bool:
		return val, nil
	case string:
		b, err := strconv.ParseBool(val)
		if err != nil {
			return false, NewInvalidFieldTypeError(fieldName, "bool", "string(无法转换)")
		}
		return b, nil
	case float64:
		return val != 0, nil
	case int, int64:
		return val != 0, nil
	default:
		return false, NewInvalidFieldTypeError(fieldName, "bool", reflect.TypeOf(value).String())
	}
}

// validateEnum 校验枚举类型
func (v *Validator) validateEnum(value interface{}, fieldUID string, attr types.DynamicAttribute) (string, error) {
	strValue, err := v.convertToString(value, fieldUID, attr.FieldName)
	if err != nil {
		return "", err
	}

	// 解析枚举值列表
	var validators types.FieldValidators
	if attr.Validators != nil {
		if err := json.Unmarshal(attr.Validators, &validators); err != nil {
			return "", fmt.Errorf("解析校验规则失败: %w", err)
		}
	}

	if len(validators.EnumValues) == 0 {
		return "", fmt.Errorf("枚举类型字段 %s 未定义枚举值", attr.FieldName)
	}

	// 检查是否在枚举值中
	for _, enumValue := range validators.EnumValues {
		if strValue == enumValue {
			return strValue, nil
		}
	}

	errMsg := validators.ErrorMessage
	if errMsg == "" {
		errMsg = fmt.Sprintf("字段 %s 的值必须是以下之一: %v", attr.FieldName, validators.EnumValues)
	}
	return "", NewValidationError(attr.FieldName, strValue, "enum", errMsg)
}

// convertToDate 转换为日期（RFC3339 格式字符串）
func (v *Validator) convertToDate(value interface{}, fieldUID, fieldName string) (string, error) {
	strValue, err := v.convertToString(value, fieldUID, fieldName)
	if err != nil {
		return "", err
	}

	if strings.TrimSpace(strValue) == "" {
		return strValue, nil
	}
	if !isValidDateString(strValue) {
		return "", NewValidationError(fieldName, strValue, "date",
			fmt.Sprintf("字段 %s 的值不是合法的日期，需为 YYYY-MM-DD、YYYY-MM-DD HH:MM:SS 或 RFC3339 格式", fieldName))
	}
	return strValue, nil
}

// dateLayouts 是日期字段允许的输入格式。
var dateLayouts = []string{
	"2006-01-02",
	"2006-01-02 15:04:05",
	time.RFC3339,
}

// isValidDateString 判断字符串是否符合任一允许的日期格式。
func isValidDateString(s string) bool {
	s = strings.TrimSpace(s)
	for _, layout := range dateLayouts {
		if _, err := time.Parse(layout, s); err == nil {
			return true
		}
	}
	return false
}

// validateRules 校验规则
func (v *Validator) validateRules(fieldUID string, value interface{}, attr types.DynamicAttribute) error {
	if attr.Validators == nil {
		return nil
	}

	var validators types.FieldValidators
	if err := json.Unmarshal(attr.Validators, &validators); err != nil {
		return fmt.Errorf("解析校验规则失败: %w", err)
	}

	switch attr.FieldType {
	case "string":
		return v.validateStringRules(value.(string), attr.FieldName, validators)
	case "int":
		return v.validateNumberRules(float64(value.(int64)), attr.FieldName, validators)
	case "float":
		return v.validateNumberRules(value.(float64), attr.FieldName, validators)
	}

	return nil
}

// validateStringRules 校验字符串规则
func (v *Validator) validateStringRules(value, fieldName string, validators types.FieldValidators) error {
	// 最小长度
	if validators.MinLength != nil && len(value) < *validators.MinLength {
		msg := validators.ErrorMessage
		if msg == "" {
			msg = fmt.Sprintf("字段 %s 长度不能小于 %d", fieldName, *validators.MinLength)
		}
		return NewValidationError(fieldName, value, "min_length", msg)
	}

	// 最大长度
	if validators.MaxLength != nil && len(value) > *validators.MaxLength {
		msg := validators.ErrorMessage
		if msg == "" {
			msg = fmt.Sprintf("字段 %s 长度不能大于 %d", fieldName, *validators.MaxLength)
		}
		return NewValidationError(fieldName, value, "max_length", msg)
	}

	// 正则表达式
	if validators.Pattern != nil {
		matched, err := regexp.MatchString(*validators.Pattern, value)
		if err != nil {
			return fmt.Errorf("正则表达式错误: %w", err)
		}
		if !matched {
			msg := validators.ErrorMessage
			if msg == "" {
				msg = fmt.Sprintf("字段 %s 格式不正确", fieldName)
			}
			return NewValidationError(fieldName, value, "pattern", msg)
		}
	}

	return nil
}

// validateNumberRules 校验数值规则
func (v *Validator) validateNumberRules(value float64, fieldName string, validators types.FieldValidators) error {
	// 最小值
	if validators.Min != nil && value < *validators.Min {
		msg := validators.ErrorMessage
		if msg == "" {
			msg = fmt.Sprintf("字段 %s 不能小于 %v", fieldName, *validators.Min)
		}
		return NewValidationError(fieldName, value, "min", msg)
	}

	// 最大值
	if validators.Max != nil && value > *validators.Max {
		msg := validators.ErrorMessage
		if msg == "" {
			msg = fmt.Sprintf("字段 %s 不能大于 %v", fieldName, *validators.Max)
		}
		return NewValidationError(fieldName, value, "max", msg)
	}

	return nil
}

// SplitDataByCategory 根据 category 分流数据
// 返回: configData, stateData
func SplitDataByCategory(data map[string]interface{}, attributes []types.DynamicAttribute) (map[string]interface{}, map[string]interface{}) {
	configData := make(map[string]interface{})
	stateData := make(map[string]interface{})

	attrMap := make(map[string]types.DynamicAttribute)
	for _, attr := range attributes {
		attrMap[attr.FieldUID] = attr
	}

	for fieldUID, value := range data {
		attr, exists := attrMap[fieldUID]
		if !exists {
			// 未定义字段，默认放入 config
			configData[fieldUID] = value
			continue
		}

		if attr.Category == "state" {
			stateData[fieldUID] = value
		} else {
			configData[fieldUID] = value
		}
	}

	return configData, stateData
}
