package mainline

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/openwende/cmdb/server/internal/storage"
	"github.com/openwende/cmdb/server/internal/types"
)

type Service interface {
	// WithDB returns a new Service bound to the given transaction. Used for cross-service transactions.
	WithDB(db *gorm.DB) Service

	// Sync operations (called by topology service inside transactions)
	EnsureBuiltinModels(ctx context.Context) error
	EnsureBusinessRoot(ctx context.Context, business *types.Business) (*types.MainlineInstance, error)
	SyncSet(ctx context.Context, set *types.Set) (*types.MainlineInstance, error)
	SyncModule(ctx context.Context, module *types.Module) (*types.MainlineInstance, error)
	SyncBusinessLegacy(ctx context.Context, businessID uint64) error
	SyncModelInstance(ctx context.Context, model *types.Model, instance *types.Instance, parentRefID *string) (*types.MainlineInstance, error)

	// Node queries
	GetNodeByRef(ctx context.Context, nodeType types.TopologyNodeType, refID string) (*types.MainlineInstance, error)
	ListChildren(ctx context.Context, node *types.MainlineInstance) ([]types.MainlineInstance, error)
	ListBusinessRoots(ctx context.Context, businessID *uint64) ([]types.MainlineInstance, error)
	DeleteNodeByRef(ctx context.Context, modelName, refID string) error
	GetModelByName(ctx context.Context, name string) (*types.Model, error)
	GetModelByID(ctx context.Context, id uuid.UUID) (*types.Model, error)

	// API methods (used by mainline handler)
	EnsureTopologySettings(ctx context.Context) error
	GetTopologySettings(ctx context.Context) (*types.TopologySettingsResponse, error)
	ListMainlineModels(ctx context.Context) ([]types.Model, error)
	CreateMainlineModel(ctx context.Context, req *types.CreateMainlineModelRequest) (*types.Model, error)
	UpdateMainlineModel(ctx context.Context, uid string, req *types.UpdateMainlineModelRequest) (*types.Model, error)
	CreateCustomNode(ctx context.Context, req *types.CreateMainlineNodeRequest) (*types.MainlineInstance, error)
	UpdateCustomNode(ctx context.Context, modelUID, refID string, req *types.UpdateMainlineNodeRequest) (*types.MainlineInstance, error)
	DeleteCustomNode(ctx context.Context, modelUID, refID string) error
	MoveCustomNode(ctx context.Context, modelUID, refID string, req *types.MoveMainlineNodeRequest) (*types.MainlineInstance, error)
}

type service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

func (s *service) WithDB(db *gorm.DB) Service {
	return &service{db: db}
}

func (s *service) EnsureBuiltinModels(ctx context.Context) error {
	type builtinModel struct {
		name              string
		displayName       string
		classification    string
		icon              string
		isMainline        bool
		mainlineLevel     *int
		mainlineScope     string
		isTopologyBuiltin bool
		parentName        *string
	}

	level0, level1, level2 := 0, 1, 2
	businessName := string(types.NodeTypeBusiness)
	setName := string(types.NodeTypeSet)
	models := []builtinModel{
		{
			name:              businessName,
			displayName:       "业务",
			classification:    "business",
			icon:              "business",
			isMainline:        true,
			mainlineLevel:     &level0,
			mainlineScope:     types.MainlineScopeGlobal,
			isTopologyBuiltin: true,
		},
		{
			name:              setName,
			displayName:       "集群",
			classification:    "business",
			icon:              "cluster",
			isMainline:        true,
			mainlineLevel:     &level1,
			mainlineScope:     types.MainlineScopeBusiness,
			isTopologyBuiltin: true,
			parentName:        &businessName,
		},
		{
			name:              string(types.NodeTypeModule),
			displayName:       "模块",
			classification:    "business",
			icon:              "module",
			isMainline:        true,
			mainlineLevel:     &level2,
			mainlineScope:     types.MainlineScopeBusiness,
			isTopologyBuiltin: true,
			parentName:        &setName,
		},
		{
			name:              string(types.NodeTypeHost),
			displayName:       "主机",
			classification:    "resource",
			icon:              "host",
			isMainline:        false,
			mainlineScope:     types.MainlineScopeNone,
			isTopologyBuiltin: true,
		},
	}

	for _, builtin := range models {
		var model types.Model
		err := s.db.WithContext(ctx).Where("name = ?", builtin.name).First(&model).Error
		switch {
		case err == nil:
			updates := map[string]interface{}{
				"display_name":        builtin.displayName,
				"classification":      builtin.classification,
				"icon":                builtin.icon,
				"is_builtin":          true,
				"is_mainline":         builtin.isMainline,
				"mainline_scope":      builtin.mainlineScope,
				"is_topology_builtin": builtin.isTopologyBuiltin,
			}
			if builtin.mainlineLevel != nil {
				updates["mainline_level"] = *builtin.mainlineLevel
			} else {
				updates["mainline_level"] = nil
			}

			if builtin.parentName != nil {
				var parent types.Model
				if err := s.db.WithContext(ctx).Where("name = ?", *builtin.parentName).First(&parent).Error; err == nil {
					updates["mainline_parent_model_id"] = parent.ID
				}
			} else {
				updates["mainline_parent_model_id"] = nil
			}

			if err := s.db.WithContext(ctx).Model(&types.Model{}).Where("id = ?", model.ID).Updates(updates).Error; err != nil {
				return err
			}
			if err := storage.EnsureModelInstancePartition(s.db.WithContext(ctx), &model); err != nil {
				return err
			}
		case err == gorm.ErrRecordNotFound:
			model = types.Model{
				ID:                uuid.New(),
				Name:              builtin.name,
				DisplayName:       builtin.displayName,
				Classification:    builtin.classification,
				Icon:              builtin.icon,
				IsBuiltin:         true,
				IsMainline:        builtin.isMainline,
				MainlineScope:     builtin.mainlineScope,
				MainlineLevel:     builtin.mainlineLevel,
				IsTopologyBuiltin: builtin.isTopologyBuiltin,
			}
			if builtin.parentName != nil {
				var parent types.Model
				if err := s.db.WithContext(ctx).Where("name = ?", *builtin.parentName).First(&parent).Error; err == nil {
					model.MainlineParentModelID = &parent.ID
				}
			}
			if err := s.db.WithContext(ctx).Create(&model).Error; err != nil {
				return err
			}
			if err := storage.EnsureModelInstancePartition(s.db.WithContext(ctx), &model); err != nil {
				return err
			}
		default:
			return err
		}
	}

	return nil
}

func (s *service) EnsureBusinessRoot(ctx context.Context, business *types.Business) (*types.MainlineInstance, error) {
	root, err := s.GetNodeByRef(ctx, types.NodeTypeBusiness, strconv.FormatUint(business.ID, 10))
	switch {
	case err == nil:
		path := pathSegment(string(types.NodeTypeBusiness), strconv.FormatUint(business.ID, 10))
		updates := map[string]interface{}{
			"name":        business.Name,
			"business_id": business.ID,
			"path":        path,
			"level":       0,
			"sort_order":  0,
			"extra":       mustJSON(map[string]interface{}{"description": valueOrEmpty(business.Description), "lifecycle": business.Lifecycle}),
		}
		if err := s.db.WithContext(ctx).Model(&types.MainlineInstance{}).Where("id = ?", root.ID).Updates(updates).Error; err != nil {
			return nil, err
		}
		root.Name = business.Name
		root.BusinessID = business.ID
		root.Path = path
		root.Level = 0
		root.Extra = mustJSON(map[string]interface{}{"description": valueOrEmpty(business.Description), "lifecycle": business.Lifecycle})
		return root, nil
	case err != gorm.ErrRecordNotFound:
		return nil, err
	}

	idStr := strconv.FormatUint(business.ID, 10)
	root = &types.MainlineInstance{
		ModelName:  string(types.NodeTypeBusiness),
		BusinessID: business.ID,
		RefID:      idStr,
		Name:       business.Name,
		Path:       pathSegment(string(types.NodeTypeBusiness), idStr),
		Level:      0,
		SortOrder:  0,
		Extra:      mustJSON(map[string]interface{}{"description": valueOrEmpty(business.Description), "lifecycle": business.Lifecycle}),
	}
	if err := s.db.WithContext(ctx).Create(root).Error; err != nil {
		return nil, err
	}
	return root, nil
}

func (s *service) SyncSet(ctx context.Context, set *types.Set) (*types.MainlineInstance, error) {
	business, err := s.getBusiness(ctx, set.BusinessID)
	if err != nil {
		return nil, err
	}
	root, err := s.EnsureBusinessRoot(ctx, business)
	if err != nil {
		return nil, err
	}
	return s.upsertNode(ctx, root, &types.MainlineInstance{
		ModelName:  string(types.NodeTypeSet),
		BusinessID: set.BusinessID,
		RefID:      strconv.FormatUint(set.ID, 10),
		Name:       set.Name,
		Level:      1,
		SortOrder:  set.SortOrder,
		IsDefault:  set.IsDefault,
		Extra:      mustJSON(map[string]interface{}{"env_type": set.EnvType, "description": set.Description}),
	})
}

func (s *service) SyncModule(ctx context.Context, module *types.Module) (*types.MainlineInstance, error) {
	set, err := s.getSet(ctx, module.SetID)
	if err != nil {
		return nil, err
	}
	parent, err := s.SyncSet(ctx, set)
	if err != nil {
		return nil, err
	}
	extra := map[string]interface{}{
		"service_type": module.ServiceType,
		"description":  module.Description,
	}
	if module.ServiceCategoryID != nil {
		extra["service_category_id"] = *module.ServiceCategoryID
	}
	return s.upsertNode(ctx, parent, &types.MainlineInstance{
		ModelName:  string(types.NodeTypeModule),
		BusinessID: module.BusinessID,
		RefID:      strconv.FormatUint(module.ID, 10),
		Name:       module.Name,
		Level:      2,
		SortOrder:  module.SortOrder,
		IsDefault:  module.IsDefault,
		Extra:      mustJSON(extra),
	})
}

func (s *service) SyncBusinessLegacy(ctx context.Context, businessID uint64) error {
	business, err := s.getBusiness(ctx, businessID)
	if err != nil {
		return err
	}
	if _, err := s.EnsureBusinessRoot(ctx, business); err != nil {
		return err
	}

	var sets []types.Set
	if err := s.db.WithContext(ctx).Where("business_id = ?", businessID).Order("sort_order ASC, id ASC").Find(&sets).Error; err != nil {
		return err
	}
	for i := range sets {
		if _, err := s.SyncSet(ctx, &sets[i]); err != nil {
			return err
		}
		var modules []types.Module
		if err := s.db.WithContext(ctx).Where("set_id = ?", sets[i].ID).Order("sort_order ASC, id ASC").Find(&modules).Error; err != nil {
			return err
		}
		for j := range modules {
			if _, err := s.SyncModule(ctx, &modules[j]); err != nil {
				return err
			}
		}
	}
	return nil
}

func (s *service) DeleteNodeByRef(ctx context.Context, modelName, refID string) error {
	node, err := s.GetNodeByRef(ctx, types.TopologyNodeType(modelName), refID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	// path 是 ltree 列，不能用 LIKE(~~)——会报 "operator does not exist: ltree ~~ unknown"。
	// 用 ltree 的 <@（"是…的子孙或自身"）匹配该节点及其全部子孙，删整棵子树。
	return s.db.WithContext(ctx).
		Where("id = ? OR path <@ ?::ltree", node.ID, node.Path).
		Delete(&types.MainlineInstance{}).Error
}

func (s *service) GetNodeByRef(ctx context.Context, nodeType types.TopologyNodeType, refID string) (*types.MainlineInstance, error) {
	var node types.MainlineInstance
	if err := s.db.WithContext(ctx).
		Where("model_name = ? AND ref_id = ?", string(nodeType), refID).
		First(&node).Error; err != nil {
		return nil, err
	}
	return &node, nil
}

func (s *service) ListChildren(ctx context.Context, node *types.MainlineInstance) ([]types.MainlineInstance, error) {
	var nodes []types.MainlineInstance
	if err := s.db.WithContext(ctx).
		Where("parent_id = ?", node.ID).
		Order("sort_order ASC, id ASC").
		Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

func (s *service) ListBusinessRoots(ctx context.Context, businessID *uint64) ([]types.MainlineInstance, error) {
	query := s.db.WithContext(ctx).
		Model(&types.MainlineInstance{}).
		Where("model_name = ?", string(types.NodeTypeBusiness)).
		Order("name ASC")
	if businessID != nil {
		query = query.Where("business_id = ?", *businessID)
	}
	var nodes []types.MainlineInstance
	if err := query.Find(&nodes).Error; err != nil {
		return nil, err
	}
	return nodes, nil
}

func (s *service) GetModelByName(ctx context.Context, name string) (*types.Model, error) {
	var model types.Model
	if err := s.db.WithContext(ctx).Where("name = ?", name).First(&model).Error; err != nil {
		return nil, err
	}
	return &model, nil
}

func (s *service) GetModelByID(ctx context.Context, id uuid.UUID) (*types.Model, error) {
	var model types.Model
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&model).Error; err != nil {
		return nil, err
	}
	return &model, nil
}

func (s *service) SyncModelInstance(ctx context.Context, model *types.Model, instance *types.Instance, parentRefID *string) (*types.MainlineInstance, error) {
	if model == nil {
		return nil, fmt.Errorf("model is required")
	}
	if !model.IsMainline {
		return nil, fmt.Errorf("model %q is not a mainline model", model.Name)
	}
	if model.MainlineLevel == nil {
		return nil, fmt.Errorf("model %q is missing mainline_level", model.Name)
	}

	var parent *types.MainlineInstance
	if model.MainlineParentModelID != nil {
		if parentRefID == nil || strings.TrimSpace(*parentRefID) == "" {
			return nil, fmt.Errorf("mainline model %q requires mainline_parent_ref_id", model.Name)
		}
		parentModel, err := s.GetModelByID(ctx, *model.MainlineParentModelID)
		if err != nil {
			return nil, err
		}
		parent, err = s.GetNodeByRef(ctx, types.TopologyNodeType(parentModel.Name), strings.TrimSpace(*parentRefID))
		if err != nil {
			return nil, err
		}
	}

	businessID, err := s.resolveBusinessID(instance, parent)
	if err != nil {
		return nil, err
	}

	props := decodeInstanceProperties(instance.Properties)
	node := &types.MainlineInstance{
		ModelName:  model.Name,
		BusinessID: businessID,
		RefID:      instance.ID.String(),
		Name:       mainlineInstanceName(model, instance, props),
		Level:      *model.MainlineLevel,
		SortOrder:  mainlineSortOrder(props),
		Extra:      datatypes.JSON(instance.Properties),
	}
	return s.upsertNode(ctx, parent, node)
}

func (s *service) upsertNode(ctx context.Context, parent *types.MainlineInstance, desired *types.MainlineInstance) (*types.MainlineInstance, error) {
	path := pathSegment(desired.ModelName, desired.RefID)
	if parent != nil {
		desired.ParentID = &parent.ID
		desired.BusinessID = parent.BusinessID
		path = parent.Path + "." + pathSegment(desired.ModelName, desired.RefID)
	}
	desired.Path = path

	var existing types.MainlineInstance
	err := s.db.WithContext(ctx).
		Where("model_name = ? AND ref_id = ?", desired.ModelName, desired.RefID).
		First(&existing).Error
	switch {
	case err == nil:
		shouldRefreshDescendants := existing.Path != desired.Path
		updates := map[string]interface{}{
			"business_id": desired.BusinessID,
			"parent_id":   desired.ParentID,
			"name":        desired.Name,
			"path":        desired.Path,
			"level":       desired.Level,
			"sort_order":  desired.SortOrder,
			"is_default":  desired.IsDefault,
			"extra":       desired.Extra,
		}
		if err := s.db.WithContext(ctx).Model(&types.MainlineInstance{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
			return nil, err
		}
		existing.BusinessID = desired.BusinessID
		existing.ParentID = desired.ParentID
		existing.Name = desired.Name
		existing.Path = desired.Path
		existing.Level = desired.Level
		existing.SortOrder = desired.SortOrder
		existing.IsDefault = desired.IsDefault
		existing.Extra = desired.Extra
		if shouldRefreshDescendants {
			if err := s.refreshDescendantPaths(ctx, &existing); err != nil {
				return nil, err
			}
		}
		return &existing, nil
	case err != gorm.ErrRecordNotFound:
		return nil, err
	}

	if err := s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(desired).Error; err != nil {
		return nil, err
	}
	if desired.ID == 0 {
		return s.GetNodeByRef(ctx, types.TopologyNodeType(desired.ModelName), desired.RefID)
	}
	return desired, nil
}

func (s *service) refreshDescendantPaths(ctx context.Context, node *types.MainlineInstance) error {
	children, err := s.ListChildren(ctx, node)
	if err != nil {
		return err
	}
	for i := range children {
		child := &children[i]
		child.Path = node.Path + "." + pathSegment(child.ModelName, child.RefID)
		if err := s.db.WithContext(ctx).Model(&types.MainlineInstance{}).Where("id = ?", child.ID).Update("path", child.Path).Error; err != nil {
			return err
		}
		if err := s.refreshDescendantPaths(ctx, child); err != nil {
			return err
		}
	}
	return nil
}

func (s *service) getBusiness(ctx context.Context, id uint64) (*types.Business, error) {
	var business types.Business
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&business).Error; err != nil {
		return nil, err
	}
	return &business, nil
}

func (s *service) getSet(ctx context.Context, id uint64) (*types.Set, error) {
	var set types.Set
	if err := s.db.WithContext(ctx).Where("id = ?", id).First(&set).Error; err != nil {
		return nil, err
	}
	return &set, nil
}

func mustJSON(data map[string]interface{}) []byte {
	raw, _ := json.Marshal(data)
	return raw
}

func decodeInstanceProperties(raw []byte) map[string]interface{} {
	if len(raw) == 0 {
		return map[string]interface{}{}
	}
	var props map[string]interface{}
	if err := json.Unmarshal(raw, &props); err != nil {
		return map[string]interface{}{}
	}
	return props
}

func mainlineInstanceName(model *types.Model, instance *types.Instance, props map[string]interface{}) string {
	for _, key := range []string{"name", "display_name", "label", "title", "bk_inst_name"} {
		if value, ok := props[key].(string); ok && strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	shortID := instance.ID.String()
	if len(shortID) > 8 {
		shortID = shortID[:8]
	}
	return fmt.Sprintf("%s-%s", model.DisplayName, shortID)
}

func mainlineSortOrder(props map[string]interface{}) int {
	switch v := props["sort_order"].(type) {
	case int:
		return v
	case int32:
		return int(v)
	case int64:
		return int(v)
	case float64:
		return int(v)
	default:
		return 0
	}
}

func (s *service) resolveBusinessID(instance *types.Instance, parent *types.MainlineInstance) (uint64, error) {
	if instance.BusinessID != nil {
		if parent != nil && *instance.BusinessID != parent.BusinessID {
			return 0, fmt.Errorf("instance business_id does not match parent business scope")
		}
		return *instance.BusinessID, nil
	}
	if parent != nil {
		return parent.BusinessID, nil
	}
	return 0, fmt.Errorf("mainline instance requires business_id or a parent node")
}

func valueOrEmpty(v *string) string {
	if v == nil {
		return ""
	}
	return *v
}

func ParseRefUint(ref string) (uint64, error) {
	return strconv.ParseUint(strings.TrimSpace(ref), 10, 64)
}

func ParseRefUUID(ref string) (uuid.UUID, error) {
	return uuid.Parse(strings.TrimSpace(ref))
}

func ChildTypeFor(modelName string) (types.TopologyNodeType, bool) {
	switch modelName {
	case string(types.NodeTypeBusiness):
		return types.NodeTypeSet, true
	case string(types.NodeTypeSet):
		return types.NodeTypeModule, true
	default:
		return "", false
	}
}

func ParentTypeFor(modelName string) (types.TopologyNodeType, bool) {
	switch modelName {
	case string(types.NodeTypeSet):
		return types.NodeTypeBusiness, true
	case string(types.NodeTypeModule):
		return types.NodeTypeSet, true
	default:
		return "", false
	}
}

func RefString(nodeID interface{}) (string, error) {
	switch v := nodeID.(type) {
	case uuid.UUID:
		return v.String(), nil
	case string:
		return v, nil
	case uint64:
		return strconv.FormatUint(v, 10), nil
	case int:
		return strconv.Itoa(v), nil
	default:
		return "", fmt.Errorf("unsupported ref id type %T", nodeID)
	}
}

func pathSegment(modelName, refID string) string {
	replacer := strings.NewReplacer("-", "_", ".", "_", ":", "_", "/", "_")
	return replacer.Replace(modelName + "_" + refID)
}
