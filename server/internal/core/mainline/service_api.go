package mainline

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/internal/types"
)

const (
	settingTopologyMaxLevel = "topology.max_level"
	settingTopologyIdleSet  = "topology.idle_set_name"
	settingTopologyIdleMod  = "topology.idle_module_name"
	defaultTopologyMaxLevel = 10
	defaultTopologyIdleSet  = "空闲机"
	defaultTopologyIdleMod  = "空闲模块"
)

func (s *service) EnsureTopologySettings(ctx context.Context) error {
	defaults := []types.PlatformSetting{
		{
			Key:         settingTopologyMaxLevel,
			Value:       mustSettingJSON(map[string]interface{}{"value": defaultTopologyMaxLevel}),
			Description: "业务拓扑最大层级",
		},
		{
			Key:         settingTopologyIdleSet,
			Value:       mustSettingJSON(map[string]interface{}{"value": defaultTopologyIdleSet}),
			Description: "业务空闲机集群名",
		},
		{
			Key:         settingTopologyIdleMod,
			Value:       mustSettingJSON(map[string]interface{}{"value": defaultTopologyIdleMod}),
			Description: "业务空闲模块名",
		},
	}

	for _, item := range defaults {
		if err := s.db.WithContext(ctx).Where("key = ?", item.Key).FirstOrCreate(&item).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *service) GetTopologySettings(ctx context.Context) (*types.TopologySettingsResponse, error) {
	if err := s.EnsureTopologySettings(ctx); err != nil {
		return nil, err
	}

	var settings []types.PlatformSetting
	if err := s.db.WithContext(ctx).Where("key IN ?", []string{
		settingTopologyMaxLevel,
		settingTopologyIdleSet,
		settingTopologyIdleMod,
	}).Find(&settings).Error; err != nil {
		return nil, err
	}

	resp := &types.TopologySettingsResponse{
		MaxTopologyLevel: defaultTopologyMaxLevel,
		IdleSetName:      defaultTopologyIdleSet,
		IdleModuleName:   defaultTopologyIdleMod,
	}

	for _, item := range settings {
		switch item.Key {
		case settingTopologyMaxLevel:
			if value, ok := parseSettingInt(item.Value); ok {
				resp.MaxTopologyLevel = value
			}
		case settingTopologyIdleSet:
			if value, ok := parseSettingString(item.Value); ok {
				resp.IdleSetName = value
			}
		case settingTopologyIdleMod:
			if value, ok := parseSettingString(item.Value); ok {
				resp.IdleModuleName = value
			}
		}
	}

	return resp, nil
}

func (s *service) ListMainlineModels(ctx context.Context) ([]types.Model, error) {
	if err := s.EnsureBuiltinModels(ctx); err != nil {
		return nil, err
	}

	var models []types.Model
	if err := s.db.WithContext(ctx).
		Where("is_mainline = ?", true).
		Order("mainline_level ASC NULLS LAST, display_name ASC, name ASC").
		Find(&models).Error; err != nil {
		return nil, err
	}
	return models, nil
}

func (s *service) CreateMainlineModel(ctx context.Context, req *types.CreateMainlineModelRequest) (*types.Model, error) {
	uid := strings.TrimSpace(req.UID)
	displayName := strings.TrimSpace(req.DisplayName)
	if uid == "" || displayName == "" {
		return nil, fmt.Errorf("uid and display_name are required")
	}

	if err := s.EnsureBuiltinModels(ctx); err != nil {
		return nil, err
	}

	var exists int64
	if err := s.db.WithContext(ctx).Model(&types.Model{}).Where("name = ?", uid).Count(&exists).Error; err != nil {
		return nil, err
	}
	if exists > 0 {
		return nil, fmt.Errorf("mainline model %q already exists", uid)
	}

	scope := strings.TrimSpace(req.Scope)
	if scope == "" {
		scope = types.MainlineScopeBusiness
	}

	var parentModel *types.Model
	if req.ParentModelUID != nil && strings.TrimSpace(*req.ParentModelUID) != "" {
		model, err := s.GetModelByName(ctx, strings.TrimSpace(*req.ParentModelUID))
		if err != nil {
			return nil, fmt.Errorf("parent model not found: %w", err)
		}
		if !model.IsMainline {
			return nil, fmt.Errorf("parent model %q is not mainline", model.Name)
		}
		parentModel = model
		if scope == types.MainlineScopeNone {
			scope = model.MainlineScope
		}
	}

	level := 0
	if req.Level != nil {
		level = *req.Level
	} else if parentModel != nil && parentModel.MainlineLevel != nil {
		level = *parentModel.MainlineLevel + 1
	}

	model := &types.Model{
		ID:             uuid.New(),
		Name:           uid,
		DisplayName:    displayName,
		Classification: valueOrDefault(req.Classification, "business"),
		Icon:           strings.TrimSpace(req.Icon),
		Description:    strings.TrimSpace(req.Description),
		IsBuiltin:      false,
		IsMainline:     true,
		MainlineScope:  scope,
		MainlineLevel:  &level,
	}
	if parentModel != nil {
		model.MainlineParentModelID = &parentModel.ID
	}

	if err := s.db.WithContext(ctx).Create(model).Error; err != nil {
		return nil, err
	}
	if err := storage.EnsureModelInstancePartition(s.db.WithContext(ctx), model); err != nil {
		return nil, err
	}
	return model, nil
}

func (s *service) UpdateMainlineModel(ctx context.Context, uid string, req *types.UpdateMainlineModelRequest) (*types.Model, error) {
	model, err := s.GetModelByName(ctx, strings.TrimSpace(uid))
	if err != nil {
		return nil, err
	}
	if !model.IsMainline {
		return nil, fmt.Errorf("model %q is not a mainline model", model.Name)
	}

	updates := map[string]interface{}{}
	if req.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*req.DisplayName)
	}
	if req.Classification != nil {
		updates["classification"] = strings.TrimSpace(*req.Classification)
	}
	if req.Icon != nil {
		updates["icon"] = strings.TrimSpace(*req.Icon)
	}
	if req.Description != nil {
		updates["description"] = strings.TrimSpace(*req.Description)
	}
	if req.Scope != nil {
		updates["mainline_scope"] = strings.TrimSpace(*req.Scope)
	}

	var parentModel *types.Model
	if req.ParentModelUID != nil {
		trimmed := strings.TrimSpace(*req.ParentModelUID)
		if trimmed == "" {
			updates["mainline_parent_model_id"] = nil
		} else {
			parentModel, err = s.GetModelByName(ctx, trimmed)
			if err != nil {
				return nil, fmt.Errorf("parent model not found: %w", err)
			}
			if !parentModel.IsMainline {
				return nil, fmt.Errorf("parent model %q is not mainline", parentModel.Name)
			}
			updates["mainline_parent_model_id"] = parentModel.ID
		}
	}

	if req.Level != nil {
		updates["mainline_level"] = *req.Level
	} else if parentModel != nil && parentModel.MainlineLevel != nil {
		updates["mainline_level"] = *parentModel.MainlineLevel + 1
	}

	if len(updates) == 0 {
		return model, nil
	}

	if err := s.db.WithContext(ctx).Model(&types.Model{}).Where("id = ?", model.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.GetModelByName(ctx, model.Name)
}

func (s *service) CreateCustomNode(ctx context.Context, req *types.CreateMainlineNodeRequest) (*types.MainlineInstance, error) {
	model, parent, err := s.resolveNodeCreateContext(ctx, req.ModelUID, req.ParentModelUID, req.ParentRefID)
	if err != nil {
		return nil, err
	}
	if req.BusinessID == 0 {
		return nil, fmt.Errorf("business_id is required")
	}
	if parent != nil && parent.BusinessID != req.BusinessID {
		return nil, fmt.Errorf("business_id does not match parent business scope")
	}

	node := &types.MainlineInstance{
		ModelName:  model.Name,
		BusinessID: req.BusinessID,
		RefID:      uuid.NewString(),
		Name:       strings.TrimSpace(req.Name),
		Level:      derefInt(model.MainlineLevel),
		SortOrder:  req.SortOrder,
		Extra:      mustSettingJSON(req.Properties),
	}
	return s.upsertNode(ctx, parent, node)
}

func (s *service) UpdateCustomNode(ctx context.Context, modelUID, refID string, req *types.UpdateMainlineNodeRequest) (*types.MainlineInstance, error) {
	node, model, err := s.getMutableNode(ctx, modelUID, refID)
	if err != nil {
		return nil, err
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = strings.TrimSpace(*req.Name)
		node.Name = strings.TrimSpace(*req.Name)
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
		node.SortOrder = *req.SortOrder
	}
	if req.Properties != nil {
		updates["extra"] = mustSettingJSON(req.Properties)
		node.Extra = mustSettingJSON(req.Properties)
	}
	if len(updates) == 0 {
		_ = model
		return node, nil
	}
	if err := s.db.WithContext(ctx).Model(&types.MainlineInstance{}).Where("id = ?", node.ID).Updates(updates).Error; err != nil {
		return nil, err
	}
	return node, nil
}

func (s *service) DeleteCustomNode(ctx context.Context, modelUID, refID string) error {
	node, _, err := s.getMutableNode(ctx, modelUID, refID)
	if err != nil {
		return err
	}
	var children int64
	if err := s.db.WithContext(ctx).Model(&types.MainlineInstance{}).Where("parent_id = ?", node.ID).Count(&children).Error; err != nil {
		return err
	}
	if children > 0 {
		return fmt.Errorf("node has %d child nodes", children)
	}
	return s.db.WithContext(ctx).Delete(&types.MainlineInstance{}, node.ID).Error
}

func (s *service) MoveCustomNode(ctx context.Context, modelUID, refID string, req *types.MoveMainlineNodeRequest) (*types.MainlineInstance, error) {
	node, model, err := s.getMutableNode(ctx, modelUID, refID)
	if err != nil {
		return nil, err
	}

	parentModelUID := strings.TrimSpace(req.TargetParentModelUID)
	parentRefID := strings.TrimSpace(req.TargetParentRefID)
	if parentModelUID == "" || parentRefID == "" {
		return nil, fmt.Errorf("target parent is required")
	}

	targetParent, err := s.GetNodeByRef(ctx, types.TopologyNodeType(parentModelUID), parentRefID)
	if err != nil {
		return nil, fmt.Errorf("target parent not found: %w", err)
	}

	if model.MainlineParentModelID != nil {
		parentModel, err := s.GetModelByID(ctx, *model.MainlineParentModelID)
		if err != nil {
			return nil, err
		}
		if targetParent.ModelName != parentModel.Name {
			return nil, fmt.Errorf("target parent model must be %q", parentModel.Name)
		}
	}

	desired := &types.MainlineInstance{
		ModelName:  node.ModelName,
		BusinessID: targetParent.BusinessID,
		RefID:      node.RefID,
		Name:       node.Name,
		Level:      node.Level,
		SortOrder:  node.SortOrder,
		IsDefault:  node.IsDefault,
		Extra:      node.Extra,
	}
	return s.upsertNode(ctx, targetParent, desired)
}

func (s *service) resolveNodeCreateContext(ctx context.Context, modelUID string, parentModelUID, parentRefID *string) (*types.Model, *types.MainlineInstance, error) {
	model, err := s.GetModelByName(ctx, strings.TrimSpace(modelUID))
	if err != nil {
		return nil, nil, err
	}
	if !model.IsMainline {
		return nil, nil, fmt.Errorf("model %q is not a mainline model", model.Name)
	}
	if model.IsTopologyBuiltin {
		return nil, nil, fmt.Errorf("builtin topology model %q should use dedicated APIs", model.Name)
	}

	if model.MainlineParentModelID == nil {
		return model, nil, nil
	}
	if parentModelUID == nil || parentRefID == nil || strings.TrimSpace(*parentModelUID) == "" || strings.TrimSpace(*parentRefID) == "" {
		return nil, nil, fmt.Errorf("parent_model_uid and parent_ref_id are required")
	}

	parentModel, err := s.GetModelByID(ctx, *model.MainlineParentModelID)
	if err != nil {
		return nil, nil, err
	}
	if strings.TrimSpace(*parentModelUID) != parentModel.Name {
		return nil, nil, fmt.Errorf("parent model must be %q", parentModel.Name)
	}

	parent, err := s.GetNodeByRef(ctx, types.TopologyNodeType(parentModel.Name), strings.TrimSpace(*parentRefID))
	if err != nil {
		return nil, nil, err
	}
	return model, parent, nil
}

func (s *service) getMutableNode(ctx context.Context, modelUID, refID string) (*types.MainlineInstance, *types.Model, error) {
	model, err := s.GetModelByName(ctx, strings.TrimSpace(modelUID))
	if err != nil {
		return nil, nil, err
	}
	if model.IsTopologyBuiltin {
		return nil, nil, fmt.Errorf("builtin topology node should use dedicated APIs")
	}
	node, err := s.GetNodeByRef(ctx, types.TopologyNodeType(strings.TrimSpace(modelUID)), strings.TrimSpace(refID))
	if err != nil {
		return nil, nil, err
	}
	return node, model, nil
}

func mustSettingJSON(data map[string]interface{}) []byte {
	if data == nil {
		data = map[string]interface{}{}
	}
	raw, _ := json.Marshal(data)
	return raw
}

func parseSettingInt(raw []byte) (int, bool) {
	if len(raw) == 0 {
		return 0, false
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return 0, false
	}
	value, ok := payload["value"]
	if !ok {
		return 0, false
	}
	switch v := value.(type) {
	case float64:
		return int(v), true
	case int:
		return v, true
	default:
		return 0, false
	}
}

func parseSettingString(raw []byte) (string, bool) {
	if len(raw) == 0 {
		return "", false
	}
	var payload map[string]interface{}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", false
	}
	value, ok := payload["value"].(string)
	if !ok {
		return "", false
	}
	return value, true
}

func valueOrDefault(value, fallback string) string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return fallback
	}
	return trimmed
}

func derefInt(value *int) int {
	if value == nil {
		return 0
	}
	return *value
}
