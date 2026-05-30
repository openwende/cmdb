package business_custom_field

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

type Service interface {
	ListGroups(ctx context.Context, businessID uint64, objectType string) ([]types.BusinessCustomFieldGroupDetail, error)
	CreateGroup(ctx context.Context, businessID uint64, payload *types.BusinessCustomFieldGroupPayload, operator string) (*types.BusinessCustomFieldGroup, error)
	UpdateGroup(ctx context.Context, businessID uint64, groupID uint64, payload *types.BusinessCustomFieldGroupPayload, operator string) (*types.BusinessCustomFieldGroup, error)
	DeleteGroup(ctx context.Context, businessID uint64, groupID uint64) error
	CreateField(ctx context.Context, businessID uint64, payload *types.BusinessCustomFieldPayload, operator string) (*types.BusinessCustomField, error)
	UpdateField(ctx context.Context, businessID uint64, fieldID uint64, payload *types.BusinessCustomFieldPayload, operator string) (*types.BusinessCustomField, error)
	DeleteField(ctx context.Context, businessID uint64, fieldID uint64) error
	GetFormSchema(ctx context.Context, businessID uint64, objectType string) (map[string]interface{}, error)
}

type service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

func (s *service) ListGroups(ctx context.Context, businessID uint64, objectType string) ([]types.BusinessCustomFieldGroupDetail, error) {
	if err := validateObjectType(objectType); err != nil {
		return nil, err
	}

	var groups []types.BusinessCustomFieldGroup
	if err := s.db.WithContext(ctx).
		Where("business_id = ? AND object_type = ? AND deleted_at IS NULL", businessID, objectType).
		Order("sort_order ASC, id ASC").
		Find(&groups).Error; err != nil {
		return nil, err
	}

	var fields []types.BusinessCustomField
	if err := s.db.WithContext(ctx).
		Where("business_id = ? AND object_type = ? AND deleted_at IS NULL", businessID, objectType).
		Order("sort_order ASC, id ASC").
		Find(&fields).Error; err != nil {
		return nil, err
	}

	fieldsByGroup := make(map[uint64][]types.BusinessCustomField)
	for _, field := range fields {
		if field.GroupID != nil {
			fieldsByGroup[*field.GroupID] = append(fieldsByGroup[*field.GroupID], field)
		}
	}

	result := make([]types.BusinessCustomFieldGroupDetail, 0, len(groups))
	for _, group := range groups {
		result = append(result, types.BusinessCustomFieldGroupDetail{
			ID:                 group.ID,
			ObjectType:         group.ObjectType,
			Name:               group.Name,
			CollapsedByDefault: group.CollapsedByDefault,
			SortOrder:          group.SortOrder,
			Fields:             fieldsByGroup[group.ID],
		})
	}
	return result, nil
}

func (s *service) CreateGroup(ctx context.Context, businessID uint64, payload *types.BusinessCustomFieldGroupPayload, operator string) (*types.BusinessCustomFieldGroup, error) {
	if err := validateObjectType(payload.ObjectType); err != nil {
		return nil, err
	}
	group := &types.BusinessCustomFieldGroup{
		BusinessID:         businessID,
		ObjectType:         payload.ObjectType,
		Name:               strings.TrimSpace(payload.Name),
		CollapsedByDefault: payload.CollapsedByDefault,
		SortOrder:          payload.SortOrder,
		CreatedBy:          operator,
		UpdatedBy:          operator,
	}
	if group.Name == "" {
		return nil, fmt.Errorf("group name is required")
	}
	if err := s.db.WithContext(ctx).Create(group).Error; err != nil {
		return nil, err
	}
	return group, nil
}

func (s *service) UpdateGroup(ctx context.Context, businessID uint64, groupID uint64, payload *types.BusinessCustomFieldGroupPayload, operator string) (*types.BusinessCustomFieldGroup, error) {
	if err := validateObjectType(payload.ObjectType); err != nil {
		return nil, err
	}

	var group types.BusinessCustomFieldGroup
	if err := s.db.WithContext(ctx).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", groupID, businessID).
		First(&group).Error; err != nil {
		return nil, err
	}

	updates := map[string]interface{}{
		"object_type":          payload.ObjectType,
		"name":                 strings.TrimSpace(payload.Name),
		"collapsed_by_default": payload.CollapsedByDefault,
		"sort_order":           payload.SortOrder,
		"updated_by":           operator,
	}
	if strings.TrimSpace(payload.Name) == "" {
		return nil, fmt.Errorf("group name is required")
	}
	if err := s.db.WithContext(ctx).Model(&group).Updates(updates).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).First(&group, groupID).Error; err != nil {
		return nil, err
	}
	return &group, nil
}

func (s *service) DeleteGroup(ctx context.Context, businessID uint64, groupID uint64) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&types.BusinessCustomField{}).
			Where("business_id = ? AND group_id = ? AND deleted_at IS NULL", businessID, groupID).
			Update("group_id", nil).Error; err != nil {
			return err
		}
		return tx.Where("id = ? AND business_id = ? AND deleted_at IS NULL", groupID, businessID).
			Delete(&types.BusinessCustomFieldGroup{}).Error
	})
}

func (s *service) CreateField(ctx context.Context, businessID uint64, payload *types.BusinessCustomFieldPayload, operator string) (*types.BusinessCustomField, error) {
	if err := validateFieldPayload(payload); err != nil {
		return nil, err
	}
	field, err := buildFieldModel(businessID, payload, operator, true)
	if err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Create(field).Error; err != nil {
		return nil, err
	}
	return field, nil
}

func (s *service) UpdateField(ctx context.Context, businessID uint64, fieldID uint64, payload *types.BusinessCustomFieldPayload, operator string) (*types.BusinessCustomField, error) {
	if err := validateFieldPayload(payload); err != nil {
		return nil, err
	}
	var field types.BusinessCustomField
	if err := s.db.WithContext(ctx).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", fieldID, businessID).
		First(&field).Error; err != nil {
		return nil, err
	}

	validators, _ := json.Marshal(payload.Validators)
	options, _ := json.Marshal(payload.Options)
	updates := map[string]interface{}{
		"object_type":   payload.ObjectType,
		"group_id":      payload.GroupID,
		"field_uid":     strings.TrimSpace(payload.FieldUID),
		"field_name":    strings.TrimSpace(payload.FieldName),
		"field_type":    payload.FieldType,
		"is_required":   payload.IsRequired,
		"is_editable":   payload.IsEditable,
		"is_unique":     payload.IsUnique,
		"default_value": payload.DefaultValue,
		"placeholder":   strings.TrimSpace(payload.Placeholder),
		"validators":    json.RawMessage(validators),
		"options":       json.RawMessage(options),
		"sort_order":    payload.SortOrder,
		"updated_by":    operator,
	}
	if err := s.db.WithContext(ctx).Model(&field).Updates(updates).Error; err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).First(&field, fieldID).Error; err != nil {
		return nil, err
	}
	return &field, nil
}

func (s *service) DeleteField(ctx context.Context, businessID uint64, fieldID uint64) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", fieldID, businessID).
		Delete(&types.BusinessCustomField{}).Error
}

func (s *service) GetFormSchema(ctx context.Context, businessID uint64, objectType string) (map[string]interface{}, error) {
	if err := validateObjectType(objectType); err != nil {
		return nil, err
	}

	groups, err := s.ListGroups(ctx, businessID, objectType)
	if err != nil {
		return nil, err
	}

	builtinFields := builtinSchema(objectType)
	customGroups := make([]types.BusinessFormSchemaGroup, 0, len(groups))
	merged := make([]types.BusinessFormSchemaGroup, 0, len(groups)+1)

	baseGroup := types.BusinessFormSchemaGroup{
		GroupName:          "基础信息",
		CollapsedByDefault: false,
		Fields:             builtinFields,
	}
	merged = append(merged, baseGroup)

	for _, group := range groups {
		fields := make([]types.BusinessFormSchemaField, 0, len(group.Fields))
		for _, field := range group.Fields {
			fields = append(fields, customFieldToSchema(field))
		}
		customGroup := types.BusinessFormSchemaGroup{
			GroupName:          group.Name,
			CollapsedByDefault: group.CollapsedByDefault,
			Fields:             fields,
		}
		customGroups = append(customGroups, customGroup)
		merged = append(merged, customGroup)
	}

	return map[string]interface{}{
		"object_type":            objectType,
		"builtin_fields":         builtinFields,
		"business_custom_groups": customGroups,
		"merged_schema":          merged,
	}, nil
}

func validateObjectType(objectType string) error {
	switch objectType {
	case types.BusinessObjectTypeSet, types.BusinessObjectTypeModule, types.BusinessObjectTypeHost:
		return nil
	default:
		return fmt.Errorf("unsupported object_type: %s", objectType)
	}
}

func validateFieldPayload(payload *types.BusinessCustomFieldPayload) error {
	if err := validateObjectType(payload.ObjectType); err != nil {
		return err
	}
	if strings.TrimSpace(payload.FieldUID) == "" {
		return fmt.Errorf("field_uid is required")
	}
	if strings.TrimSpace(payload.FieldName) == "" {
		return fmt.Errorf("field_name is required")
	}
	if payload.FieldType == "" {
		return fmt.Errorf("field_type is required")
	}
	return nil
}

func buildFieldModel(businessID uint64, payload *types.BusinessCustomFieldPayload, operator string, create bool) (*types.BusinessCustomField, error) {
	validators, err := json.Marshal(payload.Validators)
	if err != nil {
		return nil, fmt.Errorf("marshal validators: %w", err)
	}
	options, err := json.Marshal(payload.Options)
	if err != nil {
		return nil, fmt.Errorf("marshal options: %w", err)
	}
	field := &types.BusinessCustomField{
		BusinessID:   businessID,
		ObjectType:   payload.ObjectType,
		GroupID:      payload.GroupID,
		FieldUID:     strings.TrimSpace(payload.FieldUID),
		FieldName:    strings.TrimSpace(payload.FieldName),
		FieldType:    payload.FieldType,
		IsRequired:   payload.IsRequired,
		IsEditable:   payload.IsEditable,
		IsUnique:     payload.IsUnique,
		DefaultValue: payload.DefaultValue,
		Placeholder:  strings.TrimSpace(payload.Placeholder),
		Validators:   json.RawMessage(validators),
		Options:      json.RawMessage(options),
		SortOrder:    payload.SortOrder,
		UpdatedBy:    operator,
	}
	if create {
		field.CreatedBy = operator
	}
	return field, nil
}

func customFieldToSchema(field types.BusinessCustomField) types.BusinessFormSchemaField {
	schemaField := types.BusinessFormSchemaField{
		Name:        field.FieldUID,
		DisplayName: field.FieldName,
		FieldType:   field.FieldType,
		IsRequired:  field.IsRequired,
		IsUnique:    field.IsUnique,
		IsEditable:  field.IsEditable,
		IsSystem:    false,
		SortOrder:   field.SortOrder,
		Placeholder: field.Placeholder,
	}
	if field.DefaultValue != nil {
		schemaField.DefaultValue = *field.DefaultValue
	}
	if len(field.Options) > 0 {
		_ = json.Unmarshal(field.Options, &schemaField.Options)
	}
	if len(field.Validators) > 0 {
		_ = json.Unmarshal(field.Validators, &schemaField.Validators)
	}
	return schemaField
}

func builtinSchema(objectType string) []types.BusinessFormSchemaField {
	switch objectType {
	case types.BusinessObjectTypeSet:
		return []types.BusinessFormSchemaField{
			{Name: "name", DisplayName: "集群名称", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 10},
			{Name: "description", DisplayName: "集群描述", FieldType: "text", IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "env_type", DisplayName: "环境类型", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 30, Options: map[string]interface{}{"enum_values": []string{"prod", "staging", "dev", "test"}}},
			{Name: "sort_order", DisplayName: "排序", FieldType: "int", IsEditable: true, IsSystem: true, SortOrder: 40},
		}
	case types.BusinessObjectTypeModule:
		return []types.BusinessFormSchemaField{
			{Name: "name", DisplayName: "模块名称", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 10},
			{Name: "description", DisplayName: "模块描述", FieldType: "text", IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "service_type", DisplayName: "服务类型", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 30, Options: map[string]interface{}{"enum_values": []string{"web", "api", "db", "cache", "mq", "other"}}},
			{Name: "sort_order", DisplayName: "排序", FieldType: "int", IsEditable: true, IsSystem: true, SortOrder: 40},
		}
	case types.BusinessObjectTypeHost:
		return []types.BusinessFormSchemaField{
			{Name: "host_name", DisplayName: "主机名", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 10},
			{Name: "primary_ip", DisplayName: "主 IP", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "cloud_vendor", DisplayName: "云厂商", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 30, Options: map[string]interface{}{"enum_values": []string{"aws", "tencent_cloud", "aliyun", "custom"}}},
			{Name: "os_type", DisplayName: "操作系统", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 40, Options: map[string]interface{}{"enum_values": []string{"linux", "windows"}}},
		}
	default:
		return nil
	}
}
