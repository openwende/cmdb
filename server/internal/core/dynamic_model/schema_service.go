package dynamic_model

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	businesscustomfield "github.com/openwende/cmdb-server/internal/core/business_custom_field"
	"github.com/openwende/cmdb-server/internal/types"
)

type SchemaService struct {
	db            *gorm.DB
	dynamic       Service
	businessField businesscustomfield.Service
}

func NewSchemaService(db *gorm.DB, dynamicService Service) *SchemaService {
	if dynamicService == nil && db != nil {
		dynamicService = NewService(db)
	}

	return &SchemaService{
		db:            db,
		dynamic:       dynamicService,
		businessField: businesscustomfield.NewService(db),
	}
}

func (s *SchemaService) GetSchema(ctx context.Context, modelUID string) (*types.AggregateSchemaContract, error) {
	modelUID = strings.TrimSpace(modelUID)
	if isBusinessSchemaModel(modelUID) {
		return s.GetFormSchema(ctx, modelUID, "schema", 0)
	}

	if _, err := s.dynamic.GetModel(ctx, modelUID); err != nil {
		return nil, err
	}

	attributes, err := s.dynamic.ListAttributes(ctx, modelUID)
	if err != nil {
		return nil, err
	}

	fields := make([]types.ModelFormField, 0, len(attributes))
	for _, attribute := range attributes {
		fields = append(fields, attributeToSchemaField(attribute))
	}

	return &types.AggregateSchemaContract{
		ModelUID:        modelUID,
		Scene:           "schema",
		Fields:          fields,
		FieldCategories: []string{"config"},
		Capabilities:    []string{"view_schema"},
	}, nil
}

func (s *SchemaService) GetFormSchema(ctx context.Context, modelUID, scene string, businessID uint64) (*types.AggregateSchemaContract, error) {
	modelUID = strings.TrimSpace(modelUID)
	scene = strings.TrimSpace(scene)
	if scene == "" {
		scene = "default"
	}

	if isBusinessSchemaModel(modelUID) {
		formSchema, err := s.businessField.GetFormSchema(ctx, businessID, modelUID)
		if err != nil {
			return nil, err
		}

		fields := make([]types.ModelFormField, 0)
		if merged, ok := formSchema["merged_schema"].([]types.BusinessFormSchemaGroup); ok {
			for _, group := range merged {
				for _, field := range group.Fields {
					fields = append(fields, businessFieldToSchemaField(group.GroupName, field))
				}
			}
		}

		return &types.AggregateSchemaContract{
			ModelUID:        modelUID,
			Scene:           scene,
			Fields:          fields,
			FieldCategories: []string{"builtin", "business_custom"},
			Capabilities:    []string{"view_form_schema"},
		}, nil
	}

	schema, err := s.GetSchema(ctx, modelUID)
	if err != nil {
		return nil, err
	}
	schema.Scene = scene
	schema.Capabilities = []string{"view_schema", "view_form_schema"}
	return schema, nil
}

func isBusinessSchemaModel(modelUID string) bool {
	switch modelUID {
	case types.BusinessObjectTypeSet, types.BusinessObjectTypeModule, types.BusinessObjectTypeHost:
		return true
	default:
		return false
	}
}

func attributeToSchemaField(attribute types.DynamicAttribute) types.ModelFormField {
	field := types.ModelFormField{
		Name:        attribute.FieldUID,
		DisplayName: attribute.FieldName,
		FieldType:   attribute.FieldType,
		IsRequired:  attribute.IsRequired,
		IsUnique:    attribute.IsUnique,
		IsEditable:  !attribute.IsReadOnly,
		IsSystem:    false,
		SortOrder:   0,
		Placeholder: attribute.Placeholder,
		Unit:        attribute.Unit,
		Options:     decodeJSONObject(attribute.Validators),
	}

	if options := decodeJSONObject(attribute.Validators); options != nil {
		field.Options = options
	}
	if attribute.DefaultValue != "" {
		field.Default = attribute.DefaultValue
	}

	return field
}

func businessFieldToSchemaField(groupName string, field types.BusinessFormSchemaField) types.ModelFormField {
	return types.ModelFormField{
		Name:        field.Name,
		DisplayName: field.DisplayName,
		FieldType:   field.FieldType,
		IsRequired:  field.IsRequired,
		IsUnique:    field.IsUnique,
		IsEditable:  field.IsEditable,
		IsSystem:    field.IsSystem,
		SortOrder:   field.SortOrder,
		Group:       groupName,
		Placeholder: field.Placeholder,
		Default:     field.DefaultValue,
		Options:     field.Options,
	}
}

func (s *SchemaService) MustGetFormSchema(ctx context.Context, modelUID, scene string, businessID uint64) (*types.AggregateSchemaContract, error) {
	schema, err := s.GetFormSchema(ctx, modelUID, scene, businessID)
	if err != nil {
		return nil, fmt.Errorf("get form schema: %w", err)
	}
	return schema, nil
}
