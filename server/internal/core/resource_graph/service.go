package resource_graph

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/types"
)

type Service interface {
	CreateType(ctx context.Context, input CreateTypeInput) (*types.ResourceTypeV2, error)
	ListTypes(ctx context.Context) ([]types.ResourceTypeV2, error)
	GetType(ctx context.Context, name string) (*types.ResourceTypeV2, error)
	CreateResource(ctx context.Context, input CreateResourceInput) (*types.ResourceV2, error)
	BatchUpsertResources(ctx context.Context, input BatchUpsertInput) (*BatchUpsertResult, error)
	SearchResources(ctx context.Context, input SearchResourcesInput) ([]types.ResourceV2, error)
	CreateEdge(ctx context.Context, input CreateEdgeInput) (*types.EdgeV2, error)
	ListResourceEdges(ctx context.Context, resourceID, relType string) ([]types.EdgeV2, error)
	ListEvents(ctx context.Context, input ListEventsInput) ([]types.EventV2, error)
}

type service struct {
	db *gorm.DB
}

type CreateTypeInput struct {
	Name          string
	DisplayName   string
	Category      string
	Icon          string
	Schema        map[string]any
	IdentityRules types.IdentityRules
	Builtin       bool
}

type CreateResourceInput struct {
	TypeName string
	Name     string
	Spec     map[string]any
	Status   map[string]any
	Labels   map[string]any
	Source   string
	SourceID *string
}

type BatchUpsertInput struct {
	TypeName string
	Source   string
	Items    []map[string]any
}

type SearchResourcesInput struct {
	TypeName string
	Source   string
	Filters  map[string]any
}

type CreateEdgeInput struct {
	FromID  string
	ToID    string
	RelType string
	Data    map[string]any
}

type ListEventsInput struct {
	ResourceID string
	EventType  string
	Limit      int
}

type BatchUpsertResult struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

func (s *service) CreateType(ctx context.Context, input CreateTypeInput) (*types.ResourceTypeV2, error) {
	if err := validateTypeInput(input); err != nil {
		return nil, err
	}

	item := &types.ResourceTypeV2{
		ID:            uuid.NewString(),
		Name:          strings.TrimSpace(input.Name),
		DisplayName:   strings.TrimSpace(input.DisplayName),
		Category:      strings.TrimSpace(input.Category),
		Icon:          strings.TrimSpace(input.Icon),
		Schema:        cloneMap(input.Schema),
		IdentityRules: input.IdentityRules,
		Builtin:       input.Builtin,
	}

	if err := s.db.WithContext(ctx).Create(item).Error; err != nil {
		return nil, err
	}

	return item, nil
}

func (s *service) ListTypes(ctx context.Context) ([]types.ResourceTypeV2, error) {
	var items []types.ResourceTypeV2
	if err := s.db.WithContext(ctx).Order("name ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *service) GetType(ctx context.Context, name string) (*types.ResourceTypeV2, error) {
	var item types.ResourceTypeV2
	if err := s.db.WithContext(ctx).Where("name = ?", strings.TrimSpace(name)).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) CreateResource(ctx context.Context, input CreateResourceInput) (*types.ResourceV2, error) {
	resourceType, err := s.GetType(ctx, input.TypeName)
	if err != nil {
		return nil, err
	}

	resource, err := buildResource(resourceType, input)
	if err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Create(resource).Error; err != nil {
		return nil, err
	}
	if err := s.recordEvent(ctx, s.db.WithContext(ctx), "resource.created", &resource.ID, map[string]any{
		"type_name": resource.TypeName,
	}); err != nil {
		return nil, err
	}

	return resource, nil
}

func (s *service) BatchUpsertResources(ctx context.Context, input BatchUpsertInput) (*BatchUpsertResult, error) {
	resourceType, err := s.GetType(ctx, input.TypeName)
	if err != nil {
		return nil, err
	}

	result := &BatchUpsertResult{}

	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, item := range input.Items {
			resource, buildErr := buildResource(resourceType, CreateResourceInput{
				TypeName: input.TypeName,
				Spec:     item,
				Source:   input.Source,
			})
			if buildErr != nil {
				return buildErr
			}

			var existing types.ResourceV2
			found, findErr := findExistingResource(tx, resource)
			if findErr != nil {
				return findErr
			}
			if found != nil {
				existing = *found
				existing.Name = resource.Name
				existing.Spec = resource.Spec
				existing.Status = resource.Status
				existing.Labels = resource.Labels
				existing.Source = resource.Source
				existing.SourceID = resource.SourceID
				existing.IdentityKey = resource.IdentityKey
				if err := tx.Save(&existing).Error; err != nil {
					return err
				}
				if err := s.recordEvent(ctx, tx, "resource.updated", &existing.ID, map[string]any{
					"type_name": existing.TypeName,
				}); err != nil {
					return err
				}
				result.Updated++
				continue
			}

			if err := tx.Create(resource).Error; err != nil {
				return err
			}
			if err := s.recordEvent(ctx, tx, "resource.created", &resource.ID, map[string]any{
				"type_name": resource.TypeName,
			}); err != nil {
				return err
			}
			result.Created++
		}

		return nil
	})
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *service) SearchResources(ctx context.Context, input SearchResourcesInput) ([]types.ResourceV2, error) {
	query := s.db.WithContext(ctx).Model(&types.ResourceV2{})
	if strings.TrimSpace(input.TypeName) != "" {
		query = query.Where("type_name = ?", strings.TrimSpace(input.TypeName))
	}
	if strings.TrimSpace(input.Source) != "" {
		query = query.Where("source = ?", strings.TrimSpace(input.Source))
	}

	var items []types.ResourceV2
	if err := query.Order("created_at DESC").Find(&items).Error; err != nil {
		return nil, err
	}

	if len(input.Filters) == 0 {
		return items, nil
	}

	filtered := make([]types.ResourceV2, 0, len(items))
	for _, item := range items {
		if matchesFilters(item.Spec, input.Filters) {
			filtered = append(filtered, item)
		}
	}

	return filtered, nil
}

func (s *service) CreateEdge(ctx context.Context, input CreateEdgeInput) (*types.EdgeV2, error) {
	if strings.TrimSpace(input.FromID) == "" || strings.TrimSpace(input.ToID) == "" {
		return nil, fmt.Errorf("from_id and to_id are required")
	}
	if strings.TrimSpace(input.RelType) == "" {
		return nil, fmt.Errorf("rel_type is required")
	}

	if _, err := s.getResourceByID(ctx, input.FromID); err != nil {
		return nil, err
	}
	if _, err := s.getResourceByID(ctx, input.ToID); err != nil {
		return nil, err
	}

	edge := &types.EdgeV2{
		FromID:  strings.TrimSpace(input.FromID),
		ToID:    strings.TrimSpace(input.ToID),
		RelType: strings.TrimSpace(input.RelType),
		Data:    cloneMap(input.Data),
	}

	if err := s.db.WithContext(ctx).Create(edge).Error; err != nil {
		return nil, err
	}
	if err := s.recordEvent(ctx, s.db.WithContext(ctx), "edge.created", nil, map[string]any{
		"edge_id":  edge.ID,
		"from_id":  edge.FromID,
		"to_id":    edge.ToID,
		"rel_type": edge.RelType,
	}); err != nil {
		return nil, err
	}

	return edge, nil
}

func (s *service) ListResourceEdges(ctx context.Context, resourceID, relType string) ([]types.EdgeV2, error) {
	query := s.db.WithContext(ctx).Model(&types.EdgeV2{}).Where("from_id = ? OR to_id = ?", strings.TrimSpace(resourceID), strings.TrimSpace(resourceID))
	if strings.TrimSpace(relType) != "" {
		query = query.Where("rel_type = ?", strings.TrimSpace(relType))
	}

	var items []types.EdgeV2
	if err := query.Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}

	return items, nil
}

func (s *service) ListEvents(ctx context.Context, input ListEventsInput) ([]types.EventV2, error) {
	query := s.db.WithContext(ctx).Model(&types.EventV2{})
	if strings.TrimSpace(input.ResourceID) != "" {
		query = query.Where("resource_id = ?", strings.TrimSpace(input.ResourceID))
	}
	if strings.TrimSpace(input.EventType) != "" {
		query = query.Where("event_type = ?", strings.TrimSpace(input.EventType))
	}

	limit := input.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	var items []types.EventV2
	if err := query.Order("occurred_at DESC, id DESC").Limit(limit).Find(&items).Error; err != nil {
		return nil, err
	}

	return items, nil
}

func findExistingResource(tx *gorm.DB, resource *types.ResourceV2) (*types.ResourceV2, error) {
	var existing types.ResourceV2

	if resource.IdentityKey != nil {
		result := tx.Where("type_name = ? AND identity_key = ?", resource.TypeName, *resource.IdentityKey).Limit(1).Find(&existing)
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected > 0 {
			return &existing, nil
		}
	}

	if resource.SourceID != nil {
		result := tx.Where("type_name = ? AND source = ? AND source_id = ?", resource.TypeName, resource.Source, *resource.SourceID).Limit(1).Find(&existing)
		if result.Error != nil {
			return nil, result.Error
		}
		if result.RowsAffected > 0 {
			return &existing, nil
		}
	}

	return nil, nil
}

func (s *service) getResourceByID(ctx context.Context, id string) (*types.ResourceV2, error) {
	var item types.ResourceV2
	if err := s.db.WithContext(ctx).Where("id = ?", strings.TrimSpace(id)).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) recordEvent(ctx context.Context, tx *gorm.DB, eventType string, resourceID *string, payload map[string]any) error {
	event := &types.EventV2{
		EventType:  strings.TrimSpace(eventType),
		ResourceID: resourceID,
		Payload:    cloneMap(payload),
		Producer:   "resource_graph",
		OccurredAt: tx.NowFunc(),
	}

	return tx.WithContext(ctx).Create(event).Error
}

func buildResource(resourceType *types.ResourceTypeV2, input CreateResourceInput) (*types.ResourceV2, error) {
	spec := cloneMap(input.Spec)
	if spec == nil {
		spec = map[string]any{}
	}

	if err := validateSpecAgainstSchema(resourceType.Schema, spec); err != nil {
		return nil, err
	}

	source := strings.TrimSpace(input.Source)
	if source == "" {
		source = "manual"
	}

	identityPayload := cloneMap(spec)
	identityPayload["source"] = source
	if input.SourceID != nil {
		identityPayload["source_id"] = *input.SourceID
	}

	var identityKey *string
	if key, ok := MatchIdentity(resourceType.IdentityRules, identityPayload); ok {
		identityKey = &key
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = deriveResourceName(spec)
	}

	return &types.ResourceV2{
		ID:          uuid.NewString(),
		TypeName:    resourceType.Name,
		Name:        name,
		Spec:        spec,
		Status:      cloneMap(input.Status),
		Labels:      cloneMap(input.Labels),
		Source:      source,
		SourceID:    input.SourceID,
		IdentityKey: identityKey,
	}, nil
}

func validateTypeInput(input CreateTypeInput) error {
	if strings.TrimSpace(input.Name) == "" {
		return fmt.Errorf("name is required")
	}
	if strings.TrimSpace(input.DisplayName) == "" {
		return fmt.Errorf("display_name is required")
	}
	if strings.TrimSpace(input.Category) == "" {
		return fmt.Errorf("category is required")
	}
	return validateSchemaDefinition(input.Schema)
}

func validateSchemaDefinition(schema map[string]any) error {
	if schema == nil {
		return fmt.Errorf("schema is required")
	}

	if schemaType, _ := schema["type"].(string); strings.TrimSpace(schemaType) != "object" {
		return fmt.Errorf("schema type must be object")
	}

	if properties, ok := schema["properties"]; ok {
		if _, ok := properties.(map[string]any); !ok {
			return fmt.Errorf("schema properties must be an object")
		}
	}

	return nil
}

func validateSpecAgainstSchema(schema map[string]any, spec map[string]any) error {
	if err := validateSchemaDefinition(schema); err != nil {
		return err
	}

	requiredFields := toStringSlice(schema["required"])
	for _, field := range requiredFields {
		value, ok := spec[field]
		if !ok || value == nil || strings.TrimSpace(fmt.Sprint(value)) == "" {
			return fmt.Errorf("missing required field %s", field)
		}
	}

	properties, _ := schema["properties"].(map[string]any)
	for field, value := range spec {
		property, ok := properties[field]
		if !ok {
			continue
		}

		propertyDef, ok := property.(map[string]any)
		if !ok {
			continue
		}

		expectedType, _ := propertyDef["type"].(string)
		if expectedType == "" {
			continue
		}

		if !matchesJSONType(expectedType, value) {
			return fmt.Errorf("field %s expects %s", field, expectedType)
		}
	}

	return nil
}

func matchesJSONType(expected string, value any) bool {
	switch expected {
	case "string":
		_, ok := value.(string)
		return ok
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "integer":
		switch value.(type) {
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
			return true
		default:
			return false
		}
	case "number":
		switch value.(type) {
		case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, float32, float64:
			return true
		default:
			return false
		}
	case "object":
		return reflect.ValueOf(value).Kind() == reflect.Map
	case "array":
		return reflect.ValueOf(value).Kind() == reflect.Slice || reflect.ValueOf(value).Kind() == reflect.Array
	default:
		return true
	}
}

func toStringSlice(value any) []string {
	switch items := value.(type) {
	case []string:
		return items
	case []any:
		result := make([]string, 0, len(items))
		for _, item := range items {
			text := strings.TrimSpace(fmt.Sprint(item))
			if text != "" {
				result = append(result, text)
			}
		}
		return result
	default:
		return nil
	}
}

func deriveResourceName(spec map[string]any) string {
	for _, key := range []string{"name", "hostname", "inner_ip"} {
		if value, ok := spec[key]; ok {
			text := strings.TrimSpace(fmt.Sprint(value))
			if text != "" {
				return text
			}
		}
	}

	return ""
}

func cloneMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}

	cloned := make(map[string]any, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

func matchesFilters(spec map[string]any, filters map[string]any) bool {
	for key, expected := range filters {
		actual, ok := spec[key]
		if !ok {
			return false
		}
		if fmt.Sprint(actual) != fmt.Sprint(expected) {
			return false
		}
	}

	return true
}
