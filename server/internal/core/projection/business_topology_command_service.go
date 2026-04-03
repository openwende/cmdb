package projection

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/resource_graph"
	"github.com/wend/cmdb-backend/internal/types"
)

const (
	defaultIdleSetName    = "空闲机"
	defaultIdleModuleName = "空闲模块"
)

type BusinessTopologyCommandService struct {
	db    *gorm.DB
	graph *resource_graph.Service
}

func NewBusinessTopologyCommandService(db *gorm.DB) *BusinessTopologyCommandService {
	return &BusinessTopologyCommandService{
		db:    db,
		graph: resource_graph.NewService(db),
	}
}

func (s *BusinessTopologyCommandService) InitializeBusinessTopology(ctx context.Context, businessID uuid.UUID) error {
	if err := s.ensureBuiltinTypes(ctx); err != nil {
		return err
	}

	business, err := s.ensureBusinessResource(ctx, businessID)
	if err != nil {
		return err
	}

	_, err = s.ensureSetResource(ctx, business, setSpecInput{
		name:        defaultIdleSetName,
		description: "",
		envType:     "",
		sortOrder:   0,
		isDefault:   true,
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *BusinessTopologyCommandService) CreateSet(ctx context.Context, req *types.CreateSetRequest) (*types.Set, error) {
	if err := s.ensureBuiltinTypes(ctx); err != nil {
		return nil, err
	}
	business, err := s.ensureBusinessResource(ctx, req.BusinessID)
	if err != nil {
		return nil, err
	}

	resource, err := s.createSetResource(ctx, business, setSpecInput{
		name:        req.Name,
		description: req.Description,
		envType:     req.EnvType,
		sortOrder:   req.SortOrder,
		isDefault:   false,
	})
	if err != nil {
		return nil, err
	}

	return mapSetResource(resource), nil
}

func (s *BusinessTopologyCommandService) GetSet(ctx context.Context, id uint64) (*types.Set, error) {
	resource, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(id, 10))
	if err != nil {
		return nil, err
	}
	return mapSetResource(resource), nil
}

func (s *BusinessTopologyCommandService) ListSets(ctx context.Context, businessID uuid.UUID) ([]types.Set, error) {
	business, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeBusiness), businessID.String())
	if err != nil {
		return nil, err
	}

	children, err := s.listChildrenByType(ctx, business.ID, string(types.NodeTypeSet))
	if err != nil {
		return nil, err
	}

	items := make([]types.Set, 0, len(children))
	for _, child := range children {
		items = append(items, *mapSetResource(&child))
	}
	return items, nil
}

func (s *BusinessTopologyCommandService) UpdateSet(ctx context.Context, id uint64, req *types.UpdateSetRequest) (*types.Set, error) {
	resource, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(id, 10))
	if err != nil {
		return nil, err
	}

	spec := cloneMap(resource.Spec)
	if req.Name != nil {
		resource.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		spec["description"] = strings.TrimSpace(*req.Description)
	}
	if req.EnvType != nil {
		spec["env_type"] = strings.TrimSpace(*req.EnvType)
	}
	if req.SortOrder != nil {
		spec["sort_order"] = *req.SortOrder
	}

	resource.Spec = spec
	if err := s.db.WithContext(ctx).Save(resource).Error; err != nil {
		return nil, err
	}

	return mapSetResource(resource), nil
}

func (s *BusinessTopologyCommandService) DeleteSet(ctx context.Context, id uint64) error {
	resource, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(id, 10))
	if err != nil {
		return err
	}

	children, err := s.listChildrenByType(ctx, resource.ID, "")
	if err != nil {
		return err
	}
	if len(children) > 0 {
		return fmt.Errorf("集群下还有 %d 个模块，无法删除", len(children))
	}

	return s.deleteResourceAndEdges(ctx, resource.ID)
}

func (s *BusinessTopologyCommandService) MoveSet(ctx context.Context, id uint64, targetBusinessID uuid.UUID) error {
	setNode, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(id, 10))
	if err != nil {
		return err
	}
	targetBusiness, err := s.ensureBusinessResource(ctx, targetBusinessID)
	if err != nil {
		return err
	}
	modules, err := s.listChildrenByType(ctx, setNode.ID, string(types.NodeTypeModule))
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("to_id = ? AND rel_type = ?", setNode.ID, containsRelType).Delete(&types.EdgeV2{}).Error; err != nil {
			return err
		}
		if err := tx.Create(&types.EdgeV2{
			FromID:  targetBusiness.ID,
			ToID:    setNode.ID,
			RelType: containsRelType,
			Data:    map[string]any{},
		}).Error; err != nil {
			return err
		}

		updatedSet := *setNode
		updatedSet.Spec = cloneMap(setNode.Spec)
		updatedSet.Spec["business_id"] = graphRefID(*targetBusiness)
		if err := tx.Save(&updatedSet).Error; err != nil {
			return err
		}

		for _, module := range modules {
			updatedModule := module
			updatedModule.Spec = cloneMap(module.Spec)
			updatedModule.Spec["business_id"] = graphRefID(*targetBusiness)
			if err := tx.Save(&updatedModule).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (s *BusinessTopologyCommandService) CreateModule(ctx context.Context, req *types.CreateModuleRequest) (*types.Module, error) {
	if err := s.ensureBuiltinTypes(ctx); err != nil {
		return nil, err
	}

	parentSet, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(req.SetID, 10))
	if err != nil {
		return nil, err
	}

	resource, err := s.createModuleResource(ctx, parentSet, moduleSpecInput{
		name:        req.Name,
		description: req.Description,
		serviceType: req.ServiceType,
		sortOrder:   req.SortOrder,
		isDefault:   false,
	})
	if err != nil {
		return nil, err
	}

	return mapModuleResource(resource), nil
}

func (s *BusinessTopologyCommandService) GetModule(ctx context.Context, id uint64) (*types.Module, error) {
	resource, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeModule), strconv.FormatUint(id, 10))
	if err != nil {
		return nil, err
	}
	return mapModuleResource(resource), nil
}

func (s *BusinessTopologyCommandService) ListModules(ctx context.Context, setID uint64) ([]types.Module, error) {
	parentSet, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(setID, 10))
	if err != nil {
		return nil, err
	}

	children, err := s.listChildrenByType(ctx, parentSet.ID, string(types.NodeTypeModule))
	if err != nil {
		return nil, err
	}

	items := make([]types.Module, 0, len(children))
	for _, child := range children {
		items = append(items, *mapModuleResource(&child))
	}
	return items, nil
}

func (s *BusinessTopologyCommandService) ListModulesByBusiness(ctx context.Context, businessID uuid.UUID) ([]types.Module, error) {
	business, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeBusiness), businessID.String())
	if err != nil {
		return nil, err
	}

	sets, err := s.listChildrenByType(ctx, business.ID, string(types.NodeTypeSet))
	if err != nil {
		return nil, err
	}

	items := make([]types.Module, 0)
	for _, setNode := range sets {
		modules, err := s.listChildrenByType(ctx, setNode.ID, string(types.NodeTypeModule))
		if err != nil {
			return nil, err
		}
		for _, module := range modules {
			items = append(items, *mapModuleResource(&module))
		}
	}
	return items, nil
}

func (s *BusinessTopologyCommandService) UpdateModule(ctx context.Context, id uint64, req *types.UpdateModuleRequest) (*types.Module, error) {
	resource, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeModule), strconv.FormatUint(id, 10))
	if err != nil {
		return nil, err
	}

	spec := cloneMap(resource.Spec)
	if req.Name != nil {
		resource.Name = strings.TrimSpace(*req.Name)
	}
	if req.Description != nil {
		spec["description"] = strings.TrimSpace(*req.Description)
	}
	if req.ServiceType != nil {
		spec["service_type"] = strings.TrimSpace(*req.ServiceType)
	}
	if req.SortOrder != nil {
		spec["sort_order"] = *req.SortOrder
	}

	resource.Spec = spec
	if err := s.db.WithContext(ctx).Save(resource).Error; err != nil {
		return nil, err
	}

	return mapModuleResource(resource), nil
}

func (s *BusinessTopologyCommandService) DeleteModule(ctx context.Context, id uint64) error {
	resource, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeModule), strconv.FormatUint(id, 10))
	if err != nil {
		return err
	}

	children, err := s.listChildrenByType(ctx, resource.ID, "")
	if err != nil {
		return err
	}
	if len(children) > 0 {
		return fmt.Errorf("模块下还有 %d 个子节点，无法删除", len(children))
	}

	return s.deleteResourceAndEdges(ctx, resource.ID)
}

func (s *BusinessTopologyCommandService) MoveModule(ctx context.Context, moduleID, targetSetID uint64) error {
	module, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeModule), strconv.FormatUint(moduleID, 10))
	if err != nil {
		return err
	}
	targetSet, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeSet), strconv.FormatUint(targetSetID, 10))
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("to_id = ? AND rel_type = ?", module.ID, containsRelType).Delete(&types.EdgeV2{}).Error; err != nil {
			return err
		}
		if err := tx.Create(&types.EdgeV2{
			FromID:  targetSet.ID,
			ToID:    module.ID,
			RelType: containsRelType,
			Data:    map[string]any{},
		}).Error; err != nil {
			return err
		}

		updatedModule := *module
		updatedModule.Spec = cloneMap(module.Spec)
		updatedModule.Spec["set_id"] = graphRefID(*targetSet)
		updatedModule.Spec["business_id"] = stringValue(targetSet.Spec["business_id"])
		return tx.Save(&updatedModule).Error
	})
}

type setSpecInput struct {
	name        string
	description string
	envType     string
	sortOrder   int
	isDefault   bool
}

type moduleSpecInput struct {
	name        string
	description string
	serviceType string
	sortOrder   int
	isDefault   bool
}

func (s *BusinessTopologyCommandService) ensureBuiltinTypes(ctx context.Context) error {
	for _, item := range []resource_graph.CreateTypeInput{
		{
			Name:        string(types.NodeTypeBusiness),
			DisplayName: "业务",
			Category:    "org",
			Builtin:     true,
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"ref_id":      map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
					"lifecycle":   map[string]any{"type": "string"},
				},
			},
			IdentityRules: types.IdentityRules{UniqueKeys: [][]string{{"ref_id"}}},
		},
		{
			Name:        string(types.NodeTypeSet),
			DisplayName: "集群",
			Category:    "org",
			Builtin:     true,
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"ref_id":      map[string]any{"type": "string"},
					"business_id": map[string]any{"type": "string"},
					"description": map[string]any{"type": "string"},
					"env_type":    map[string]any{"type": "string"},
					"sort_order":  map[string]any{"type": "integer"},
					"is_default":  map[string]any{"type": "boolean"},
				},
			},
			IdentityRules: types.IdentityRules{UniqueKeys: [][]string{{"ref_id"}}},
		},
		{
			Name:        string(types.NodeTypeModule),
			DisplayName: "模块",
			Category:    "app",
			Builtin:     true,
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"ref_id":       map[string]any{"type": "string"},
					"set_id":       map[string]any{"type": "string"},
					"business_id":  map[string]any{"type": "string"},
					"description":  map[string]any{"type": "string"},
					"service_type": map[string]any{"type": "string"},
					"sort_order":   map[string]any{"type": "integer"},
					"is_default":   map[string]any{"type": "boolean"},
				},
			},
			IdentityRules: types.IdentityRules{UniqueKeys: [][]string{{"ref_id"}}},
		},
		{
			Name:        string(types.NodeTypeHost),
			DisplayName: "主机",
			Category:    "infra",
			Builtin:     true,
			Schema: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"ref_id":          map[string]any{"type": "string"},
					"primary_ip":      map[string]any{"type": "string"},
					"status":          map[string]any{"type": "string"},
					"hostname":        map[string]any{"type": "string"},
					"cloud_area_id":   map[string]any{"type": "string"},
					"cloud_area_name": map[string]any{"type": "string"},
					"business_id":     map[string]any{"type": "string"},
					"module_id":       map[string]any{"type": "string"},
					"set_id":          map[string]any{"type": "string"},
					"in_idle_pool":    map[string]any{"type": "boolean"},
				},
			},
			IdentityRules: types.IdentityRules{UniqueKeys: [][]string{{"ref_id"}}},
		},
	} {
		_, err := s.graph.GetType(ctx, item.Name)
		if err == nil {
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		if _, err := s.graph.CreateType(ctx, item); err != nil {
			return err
		}
	}

	return nil
}

func (s *BusinessTopologyCommandService) ensureBusinessResource(ctx context.Context, businessID uuid.UUID) (*types.ResourceV2, error) {
	var business types.Business
	if err := s.db.WithContext(ctx).Where("id = ?", businessID).First(&business).Error; err != nil {
		return nil, fmt.Errorf("业务不存在: %w", err)
	}

	spec, err := s.buildBusinessSpec(ctx, business)
	if err != nil {
		return nil, err
	}

	if existing, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeBusiness), businessID.String()); err == nil {
		mergedSpec := cloneMap(existing.Spec)
		for key, value := range spec {
			mergedSpec[key] = value
		}
		existing.Name = business.Name
		existing.Spec = mergedSpec
		if err := s.db.WithContext(ctx).Save(existing).Error; err != nil {
			return nil, err
		}
		return existing, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	return s.graph.CreateResource(ctx, resource_graph.CreateResourceInput{
		TypeName: string(types.NodeTypeBusiness),
		Name:     business.Name,
		Spec:     spec,
	})
}

func (s *BusinessTopologyCommandService) buildBusinessSpec(
	ctx context.Context,
	business types.Business,
) (map[string]any, error) {
	spec := map[string]any{
		"ref_id":      business.ID.String(),
		"description": strings.TrimSpace(valueOrEmpty(business.Description)),
		"lifecycle":   business.Lifecycle,
		"timezone":    business.Timezone,
		"language":    business.Language,
		"bk_biz_id":   business.ID.String(),
	}

	var personnel []types.BusinessPersonnel
	if err := s.db.WithContext(ctx).
		Table("business_personnel").
		Where("business_id = ?", business.ID).
		Order("created_at ASC").
		Find(&personnel).Error; err != nil {
		if isMissingOptionalTableError(err) {
			return spec, nil
		}
		return nil, fmt.Errorf("查询业务角色失败: %w", err)
	}

	if roles := collectBusinessRoleIdentities(personnel, "sre"); len(roles) > 0 {
		spec["sres"] = roles
	}
	if roles := collectBusinessRoleIdentities(personnel, "developer"); len(roles) > 0 {
		spec["developers"] = roles
	}
	if roles := collectBusinessRoleIdentities(personnel, "tester"); len(roles) > 0 {
		spec["testers"] = roles
	}
	if roles := collectBusinessRoleIdentities(personnel, "bizops"); len(roles) > 0 {
		spec["bizops"] = roles
	}

	return spec, nil
}

func collectBusinessRoleIdentities(personnel []types.BusinessPersonnel, role string) []string {
	identities := make([]string, 0)
	for _, person := range personnel {
		if strings.TrimSpace(person.Role) != role {
			continue
		}
		identity := strings.TrimSpace(person.Identity)
		if identity == "" {
			continue
		}
		identities = append(identities, identity)
	}
	return identities
}

func isMissingOptionalTableError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "no such table") || strings.Contains(message, "does not exist")
}

func (s *BusinessTopologyCommandService) ensureHostResource(ctx context.Context, hostID uuid.UUID) (*types.ResourceV2, error) {
	if existing, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeHost), hostID.String()); err == nil {
		return existing, nil
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var host types.Host
	if err := s.db.WithContext(ctx).Where("id = ?", hostID).First(&host).Error; err != nil {
		return nil, fmt.Errorf("主机不存在")
	}

	spec := map[string]any{
		"ref_id":       host.ID.String(),
		"primary_ip":   host.PrimaryIP,
		"status":       host.Status,
		"hostname":     host.HostName,
		"in_idle_pool": false,
	}
	if host.CloudAreaID != nil {
		spec["cloud_area_id"] = host.CloudAreaID.String()
		var cloudArea types.CloudArea
		if err := s.db.WithContext(ctx).Where("id = ?", *host.CloudAreaID).First(&cloudArea).Error; err == nil {
			spec["cloud_area_name"] = cloudArea.Name
		}
	}

	return s.graph.CreateResource(ctx, resource_graph.CreateResourceInput{
		TypeName: string(types.NodeTypeHost),
		Name:     host.HostName,
		Spec:     spec,
	})
}

func (s *BusinessTopologyCommandService) TransferHosts(ctx context.Context, req *types.TransferHostsRequest) (*types.BatchOperationResult, error) {
	targetModule, err := s.findResourceByTypeAndRef(ctx, string(types.NodeTypeModule), strconv.FormatUint(req.TargetModuleID, 10))
	if err != nil {
		return nil, fmt.Errorf("目标模块不存在")
	}

	result := &types.BatchOperationResult{
		Total:  len(req.HostIDs),
		Errors: make([]string, 0),
	}

	for _, hostID := range req.HostIDs {
		if err := s.moveHostToModule(ctx, hostID, targetModule); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

func (s *BusinessTopologyCommandService) TransferHostsToPool(ctx context.Context, hostIDs []uuid.UUID) (*types.BatchOperationResult, error) {
	result := &types.BatchOperationResult{
		Total:  len(hostIDs),
		Errors: make([]string, 0),
	}

	for _, hostID := range hostIDs {
		if err := s.moveHostToIdlePool(ctx, hostID); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

func (s *BusinessTopologyCommandService) ensureSetResource(
	ctx context.Context,
	business *types.ResourceV2,
	input setSpecInput,
) (*types.ResourceV2, error) {
	existing, err := s.findDefaultSetByBusiness(ctx, business.ID)
	if err == nil {
		if _, err := s.findDefaultModuleBySet(ctx, existing.ID); err == gorm.ErrRecordNotFound {
			if _, err := s.createModuleResource(ctx, existing, moduleSpecInput{
				name:        defaultIdleModuleName,
				description: "",
				serviceType: "",
				sortOrder:   0,
				isDefault:   true,
			}); err != nil {
				return nil, err
			}
		} else if err != nil {
			return nil, err
		}
		return existing, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	return s.createSetResource(ctx, business, input)
}

func (s *BusinessTopologyCommandService) createSetResource(
	ctx context.Context,
	business *types.ResourceV2,
	input setSpecInput,
) (*types.ResourceV2, error) {
	refID, err := s.nextRefID(ctx, string(types.NodeTypeSet))
	if err != nil {
		return nil, err
	}

	resource, err := s.graph.CreateResource(ctx, resource_graph.CreateResourceInput{
		TypeName: string(types.NodeTypeSet),
		Name:     strings.TrimSpace(input.name),
		Spec: map[string]any{
			"ref_id":      refID,
			"business_id": graphRefID(*business),
			"description": strings.TrimSpace(input.description),
			"env_type":    strings.TrimSpace(input.envType),
			"sort_order":  input.sortOrder,
			"is_default":  input.isDefault,
		},
	})
	if err != nil {
		return nil, err
	}

	if _, err := s.graph.CreateEdge(ctx, resource_graph.CreateEdgeInput{
		FromID:  business.ID,
		ToID:    resource.ID,
		RelType: containsRelType,
	}); err != nil {
		return nil, err
	}

	if input.isDefault {
		if _, err := s.createModuleResource(ctx, resource, moduleSpecInput{
			name:        defaultIdleModuleName,
			description: "",
			serviceType: "",
			sortOrder:   0,
			isDefault:   true,
		}); err != nil {
			return nil, err
		}
	}

	return resource, nil
}

func (s *BusinessTopologyCommandService) createModuleResource(
	ctx context.Context,
	parentSet *types.ResourceV2,
	input moduleSpecInput,
) (*types.ResourceV2, error) {
	refID, err := s.nextRefID(ctx, string(types.NodeTypeModule))
	if err != nil {
		return nil, err
	}

	resource, err := s.graph.CreateResource(ctx, resource_graph.CreateResourceInput{
		TypeName: string(types.NodeTypeModule),
		Name:     strings.TrimSpace(input.name),
		Spec: map[string]any{
			"ref_id":       refID,
			"set_id":       graphRefID(*parentSet),
			"business_id":  stringValue(parentSet.Spec["business_id"]),
			"description":  strings.TrimSpace(input.description),
			"service_type": strings.TrimSpace(input.serviceType),
			"sort_order":   input.sortOrder,
			"is_default":   input.isDefault,
		},
	})
	if err != nil {
		return nil, err
	}

	if _, err := s.graph.CreateEdge(ctx, resource_graph.CreateEdgeInput{
		FromID:  parentSet.ID,
		ToID:    resource.ID,
		RelType: containsRelType,
	}); err != nil {
		return nil, err
	}

	return resource, nil
}

func (s *BusinessTopologyCommandService) listChildrenByType(ctx context.Context, parentID, typeName string) ([]types.ResourceV2, error) {
	var items []types.ResourceV2
	query := s.db.WithContext(ctx).
		Table("resources_v2 AS child").
		Select("child.*").
		Joins("JOIN edges_v2 AS edge ON edge.to_id = child.id").
		Where("edge.from_id = ? AND edge.rel_type = ? AND child.deleted_at IS NULL", parentID, containsRelType)
	if strings.TrimSpace(typeName) != "" {
		query = query.Where("child.type_name = ?", typeName)
	}
	err := query.Order("child.created_at ASC, child.id ASC").Scan(&items).Error
	return items, err
}

func (s *BusinessTopologyCommandService) findResourceByTypeAndRef(ctx context.Context, typeName, refID string) (*types.ResourceV2, error) {
	var item types.ResourceV2
	if s.db.Dialector.Name() == "sqlite" {
		if err := s.db.WithContext(ctx).
			Where("type_name = ?", typeName).
			Where("json_extract(spec, '$.ref_id') = ?", refID).
			First(&item).Error; err != nil {
			return nil, err
		}
		return &item, nil
	}

	if err := s.db.WithContext(ctx).
		Where("type_name = ?", typeName).
		Where("spec ->> 'ref_id' = ?", refID).
		First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *BusinessTopologyCommandService) findDefaultSetByBusiness(ctx context.Context, businessResourceID string) (*types.ResourceV2, error) {
	var item types.ResourceV2
	query := s.db.WithContext(ctx).
		Table("resources_v2 AS child").
		Select("child.*").
		Joins("JOIN edges_v2 AS edge ON edge.to_id = child.id").
		Where("edge.from_id = ? AND edge.rel_type = ? AND child.type_name = ? AND child.deleted_at IS NULL", businessResourceID, containsRelType, string(types.NodeTypeSet))

	if s.db.Dialector.Name() == "sqlite" {
		query = query.Where("json_extract(child.spec, '$.is_default') = 1")
	} else {
		query = query.Where("child.spec ->> 'is_default' = ?", "true")
	}

	if err := query.Order("child.created_at ASC, child.id ASC").First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *BusinessTopologyCommandService) findDefaultModuleBySet(ctx context.Context, setResourceID string) (*types.ResourceV2, error) {
	var item types.ResourceV2
	query := s.db.WithContext(ctx).
		Table("resources_v2 AS child").
		Select("child.*").
		Joins("JOIN edges_v2 AS edge ON edge.to_id = child.id").
		Where("edge.from_id = ? AND edge.rel_type = ? AND child.type_name = ? AND child.deleted_at IS NULL", setResourceID, containsRelType, string(types.NodeTypeModule))

	if s.db.Dialector.Name() == "sqlite" {
		query = query.Where("json_extract(child.spec, '$.is_default') = 1")
	} else {
		query = query.Where("child.spec ->> 'is_default' = ?", "true")
	}

	if err := query.Order("child.created_at ASC, child.id ASC").First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *BusinessTopologyCommandService) nextRefID(ctx context.Context, typeName string) (string, error) {
	var items []types.ResourceV2
	if err := s.db.WithContext(ctx).Where("type_name = ? AND deleted_at IS NULL", typeName).Find(&items).Error; err != nil {
		return "", err
	}

	maxID := uint64(0)
	for _, item := range items {
		refID, err := strconv.ParseUint(graphRefID(item), 10, 64)
		if err == nil && refID > maxID {
			maxID = refID
		}
	}

	return strconv.FormatUint(maxID+1, 10), nil
}

func (s *BusinessTopologyCommandService) deleteResourceAndEdges(ctx context.Context, resourceID string) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("from_id = ? OR to_id = ?", resourceID, resourceID).Delete(&types.EdgeV2{}).Error; err != nil {
			return err
		}
		return tx.Where("id = ?", resourceID).Delete(&types.ResourceV2{}).Error
	})
}

func (s *BusinessTopologyCommandService) moveHostToModule(ctx context.Context, hostID uuid.UUID, targetModule *types.ResourceV2) error {
	hostResource, err := s.ensureHostResource(ctx, hostID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("to_id = ? AND rel_type = ?", hostResource.ID, containsRelType).Delete(&types.EdgeV2{}).Error; err != nil {
			return err
		}
		if err := tx.Create(&types.EdgeV2{
			FromID:  targetModule.ID,
			ToID:    hostResource.ID,
			RelType: containsRelType,
			Data:    map[string]any{},
		}).Error; err != nil {
			return err
		}

		updatedHost := *hostResource
		updatedHost.Spec = cloneMap(hostResource.Spec)
		updatedHost.Spec["business_id"] = stringValue(targetModule.Spec["business_id"])
		updatedHost.Spec["module_id"] = graphRefID(*targetModule)
		updatedHost.Spec["set_id"] = stringValue(targetModule.Spec["set_id"])
		updatedHost.Spec["in_idle_pool"] = false
		return tx.Save(&updatedHost).Error
	})
}

func (s *BusinessTopologyCommandService) moveHostToIdlePool(ctx context.Context, hostID uuid.UUID) error {
	hostResource, err := s.ensureHostResource(ctx, hostID)
	if err != nil {
		return err
	}

	businessID := stringValue(hostResource.Spec["business_id"])
	if businessID == "" {
		currentParent, parentErr := s.findCurrentParent(ctx, hostResource.ID)
		if parentErr == nil {
			businessID = stringValue(currentParent.Spec["business_id"])
		}
	}
	if businessID == "" {
		return fmt.Errorf("无法确定主机所属业务")
	}

	bizUUID, err := uuid.Parse(businessID)
	if err != nil {
		return fmt.Errorf("无法确定主机所属业务")
	}

	idleModule, idleSet, err := s.ensureIdleModuleForBusiness(ctx, bizUUID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("to_id = ? AND rel_type = ?", hostResource.ID, containsRelType).Delete(&types.EdgeV2{}).Error; err != nil {
			return err
		}
		if err := tx.Create(&types.EdgeV2{
			FromID:  idleModule.ID,
			ToID:    hostResource.ID,
			RelType: containsRelType,
			Data:    map[string]any{},
		}).Error; err != nil {
			return err
		}

		updatedHost := *hostResource
		updatedHost.Spec = cloneMap(hostResource.Spec)
		updatedHost.Spec["business_id"] = businessID
		updatedHost.Spec["module_id"] = graphRefID(*idleModule)
		updatedHost.Spec["set_id"] = graphRefID(*idleSet)
		updatedHost.Spec["in_idle_pool"] = true
		return tx.Save(&updatedHost).Error
	})
}

func (s *BusinessTopologyCommandService) ensureIdleModuleForBusiness(ctx context.Context, businessID uuid.UUID) (*types.ResourceV2, *types.ResourceV2, error) {
	business, err := s.ensureBusinessResource(ctx, businessID)
	if err != nil {
		return nil, nil, err
	}

	idleSet, err := s.ensureSetResource(ctx, business, setSpecInput{
		name:        defaultIdleSetName,
		description: "",
		envType:     "",
		sortOrder:   0,
		isDefault:   true,
	})
	if err != nil {
		return nil, nil, err
	}

	idleModule, err := s.findDefaultModuleBySet(ctx, idleSet.ID)
	if err != nil {
		return nil, nil, err
	}

	return idleModule, idleSet, nil
}

func (s *BusinessTopologyCommandService) findCurrentParent(ctx context.Context, childID string) (*types.ResourceV2, error) {
	var parent types.ResourceV2
	err := s.db.WithContext(ctx).
		Table("resources_v2 AS parent").
		Select("parent.*").
		Joins("JOIN edges_v2 AS edge ON edge.from_id = parent.id").
		Where("edge.to_id = ? AND edge.rel_type = ? AND parent.deleted_at IS NULL", childID, containsRelType).
		Order("parent.created_at ASC, parent.id ASC").
		First(&parent).Error
	if err != nil {
		return nil, err
	}
	return &parent, nil
}

func mapSetResource(resource *types.ResourceV2) *types.Set {
	item := &types.Set{
		Name:        resourceDisplayName(*resource),
		Description: stringValue(resource.Spec["description"]),
		EnvType:     stringValue(resource.Spec["env_type"]),
		SortOrder:   intValue(resource.Spec["sort_order"]),
		IsDefault:   resourceIsDefault(*resource),
	}
	item.ID = uintValue(resource.Spec["ref_id"])
	if businessID, err := uuid.Parse(stringValue(resource.Spec["business_id"])); err == nil {
		item.BusinessID = businessID
	}
	return item
}

func mapModuleResource(resource *types.ResourceV2) *types.Module {
	item := &types.Module{
		Name:        resourceDisplayName(*resource),
		Description: stringValue(resource.Spec["description"]),
		ServiceType: stringValue(resource.Spec["service_type"]),
		SortOrder:   intValue(resource.Spec["sort_order"]),
		IsDefault:   resourceIsDefault(*resource),
	}
	item.ID = uintValue(resource.Spec["ref_id"])
	item.SetID = uintValue(resource.Spec["set_id"])
	if businessID, err := uuid.Parse(stringValue(resource.Spec["business_id"])); err == nil {
		item.BusinessID = businessID
	}
	return item
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func stringValue(value any) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func uintValue(value any) uint64 {
	switch v := value.(type) {
	case uint64:
		return v
	case uint32:
		return uint64(v)
	case int:
		return uint64(v)
	case int64:
		return uint64(v)
	case float64:
		return uint64(v)
	case string:
		n, _ := strconv.ParseUint(strings.TrimSpace(v), 10, 64)
		return n
	default:
		n, _ := strconv.ParseUint(strings.TrimSpace(fmt.Sprint(v)), 10, 64)
		return n
	}
}

func intValue(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case uint64:
		return int(v)
	case float64:
		return int(v)
	case string:
		n, _ := strconv.Atoi(strings.TrimSpace(v))
		return n
	default:
		n, _ := strconv.Atoi(strings.TrimSpace(fmt.Sprint(v)))
		return n
	}
}
