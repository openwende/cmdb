package dynamic_model

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"github.com/openwende/cmdb-server/internal/types"
	"gorm.io/gorm"
)

type relationViewRow struct {
	ID               uint64
	AssociationUID   string
	AssociationName  string
	SourceToDestDesc string
	DestToSourceDesc string
	SourceID         uint64
	SourceModelUID   string
	SourceName       string
	TargetID         uint64
	TargetModelUID   string
	TargetName       string
	Properties       []byte
	CreatedAt        time.Time
}

type topologyEdgeRow struct {
	ID              uint64
	SourceID        uint64
	TargetID        uint64
	SourceModelUID  string
	TargetModelUID  string
	AssociationUID  string
	AssociationName string
	Properties      []byte
}

// ========== 模型管理方法 ==========

// CreateModel 创建模型
func (s *service) CreateModel(ctx context.Context, model *types.DynamicModel) error {
	if err := s.db.WithContext(ctx).Create(model).Error; err != nil {
		return err
	}

	if err := s.syncModelUniqueIndex(*model); err != nil {
		return fmt.Errorf("同步唯一索引失败: %w", err)
	}

	return nil
}

// ListModels 列出所有模型
func (s *service) ListModels(ctx context.Context) ([]types.DynamicModel, error) {
	var models []types.DynamicModel
	if err := s.db.WithContext(ctx).Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}
	return models, nil
}

// GetModel 获取模型
func (s *service) GetModel(ctx context.Context, uid string) (*types.DynamicModel, error) {
	return s.modelCache.Get(uid)
}

// UpdateModel 更新模型
func (s *service) UpdateModel(ctx context.Context, uid string, updates map[string]interface{}) error {
	if err := s.db.WithContext(ctx).Model(&types.DynamicModel{}).Where("uid = ?", uid).Updates(updates).Error; err != nil {
		return err
	}

	s.modelCache.Invalidate(uid)

	if _, ok := updates["unique_fields"]; ok {
		model, err := s.modelCache.Get(uid)
		if err != nil {
			return err
		}
		if err := s.syncModelUniqueIndex(*model); err != nil {
			return fmt.Errorf("同步唯一索引失败: %w", err)
		}
	}

	return nil
}

// DeleteModel 删除模型
func (s *service) DeleteModel(ctx context.Context, uid string) error {
	var count int64
	s.db.WithContext(ctx).Model(&types.Resource{}).Where("model_uid = ?", uid).Count(&count)
	if count > 0 {
		return fmt.Errorf("模型 %s 下还有 %d 个实例，无法删除", uid, count)
	}

	var assocCount int64
	s.db.WithContext(ctx).Model(&types.DynamicModelAssociation{}).
		Where("source_model_uid = ? OR target_model_uid = ?", uid, uid).
		Count(&assocCount)
	if assocCount > 0 {
		return fmt.Errorf("模型 %s 仍被 %d 个模型关联引用，请先删除相关关联定义", uid, assocCount)
	}

	s.db.WithContext(ctx).Where("model_uid = ?", uid).Delete(&types.DynamicAttribute{})

	if err := s.db.WithContext(ctx).Where("uid = ?", uid).Delete(&types.DynamicModel{}).Error; err != nil {
		return err
	}

	s.modelCache.Invalidate(uid)
	s.attrCache.Invalidate(uid)

	return nil
}

// ========== 属性管理方法 ==========

// CreateAttribute 创建属性
func (s *service) CreateAttribute(ctx context.Context, attr *types.DynamicAttribute) error {
	if err := s.db.WithContext(ctx).Create(attr).Error; err != nil {
		return err
	}

	s.attrCache.Invalidate(attr.ModelUID)

	if attr.IsUnique || attr.UniqueGroup != "" {
		model, err := s.modelCache.Get(attr.ModelUID)
		if err != nil {
			return err
		}
		if err := s.syncModelUniqueIndex(*model); err != nil {
			return fmt.Errorf("同步唯一索引失败: %w", err)
		}
	}

	return nil
}

// ListAttributes 列出模型的所有属性
func (s *service) ListAttributes(ctx context.Context, modelUID string) ([]types.DynamicAttribute, error) {
	return s.attrCache.Get(modelUID)
}

// UpdateAttribute 更新属性
func (s *service) UpdateAttribute(ctx context.Context, modelUID, fieldUID string, updates map[string]interface{}) error {
	if err := s.db.WithContext(ctx).Model(&types.DynamicAttribute{}).
		Where("model_uid = ? AND field_uid = ?", modelUID, fieldUID).
		Updates(updates).Error; err != nil {
		return err
	}

	s.attrCache.Invalidate(modelUID)

	return nil
}

// DeleteAttribute 删除属性
func (s *service) DeleteAttribute(ctx context.Context, modelUID, fieldUID string) error {
	if err := s.db.WithContext(ctx).Where("model_uid = ? AND field_uid = ?", modelUID, fieldUID).
		Delete(&types.DynamicAttribute{}).Error; err != nil {
		return err
	}

	s.attrCache.Invalidate(modelUID)

	return nil
}

// GetInstanceView 获取实例详情视图
func (s *service) GetInstanceView(ctx context.Context, modelUID string, resourceID uint64) (*types.DynamicModelInstanceView, error) {
	resource, err := s.getResourceByModel(ctx, modelUID, resourceID, true)
	if err != nil {
		return nil, err
	}

	view := &types.DynamicModelInstanceView{
		ID:        resource.ID,
		ModelUID:  resource.ModelUID,
		Name:      resource.Name,
		Configs:   decodeJSONObject(resource.Configs),
		CreatedAt: resource.CreatedAt,
		UpdatedAt: resource.UpdatedAt,
	}
	if resource.State != nil {
		view.State = &types.InstanceStateView{
			ResourceID:    resource.State.ResourceID,
			LastCheckTime: resource.State.LastCheckTime,
			HealthStatus:  resource.State.HealthStatus,
			Metrics:       decodeJSONObject(resource.State.Metrics),
			UpdatedAt:     resource.State.UpdatedAt,
		}
	}

	return view, nil
}

// ListInstanceRelations 查询实例关联关系视图
func (s *service) ListInstanceRelations(ctx context.Context, modelUID string, resourceID uint64, direction, associationUID string) ([]types.InstanceRelationView, error) {
	if _, err := s.getResourceByModel(ctx, modelUID, resourceID, false); err != nil {
		return nil, err
	}

	query := s.db.WithContext(ctx).
		Table("relations AS r").
		Select(`
			r.id,
			r.association_uid,
			COALESCE(at.name, r.association_uid) AS association_name,
			COALESCE(NULLIF(at.source_to_dest_desc, ''), COALESCE(at.name, r.association_uid)) AS source_to_dest_desc,
			COALESCE(NULLIF(at.dest_to_source_desc, ''), COALESCE(at.name, r.association_uid)) AS dest_to_source_desc,
			r.source_id,
			r.source_model_uid,
			src.name AS source_name,
			r.target_id,
			r.target_model_uid,
			tgt.name AS target_name,
			r.properties,
			r.created_at
		`).
		Joins("JOIN resources AS src ON src.id = r.source_id AND src.deleted_at IS NULL").
		Joins("JOIN resources AS tgt ON tgt.id = r.target_id AND tgt.deleted_at IS NULL").
		Joins("LEFT JOIN association_types AS at ON at.uid = r.association_uid")

	switch direction {
	case "source":
		query = query.Where("r.source_id = ?", resourceID)
	case "target":
		query = query.Where("r.target_id = ?", resourceID)
	default:
		query = query.Where("r.source_id = ? OR r.target_id = ?", resourceID, resourceID)
	}

	if associationUID != "" {
		query = query.Where("r.association_uid = ?", associationUID)
	}

	var rows []relationViewRow
	if err := query.Order("r.created_at DESC").Scan(&rows).Error; err != nil {
		return nil, err
	}

	items := make([]types.InstanceRelationView, 0, len(rows))
	for _, row := range rows {
		item := types.InstanceRelationView{
			ID:              row.ID,
			AssociationUID:  row.AssociationUID,
			AssociationName: row.AssociationName,
			Source: types.InstanceRelationEndpoint{
				ID:       row.SourceID,
				ModelUID: row.SourceModelUID,
				Name:     row.SourceName,
			},
			Target: types.InstanceRelationEndpoint{
				ID:       row.TargetID,
				ModelUID: row.TargetModelUID,
				Name:     row.TargetName,
			},
			Properties: decodeJSONObject(row.Properties),
			CreatedAt:  row.CreatedAt,
		}

		if row.SourceID == resourceID {
			item.Direction = "source"
			item.AssociationLabel = row.SourceToDestDesc
			item.Related = item.Target
		} else {
			item.Direction = "target"
			item.AssociationLabel = row.DestToSourceDesc
			item.Related = item.Source
		}

		items = append(items, item)
	}

	return items, nil
}

// DeleteRelation 删除关联关系
func (s *service) DeleteRelation(ctx context.Context, relationID uint64) error {
	return s.db.WithContext(ctx).Delete(&types.Relation{}, relationID).Error
}

// GetTopologyGraph 获取实例拓扑图视图
func (s *service) GetTopologyGraph(ctx context.Context, modelUID string, startID uint64, maxDepth int, associationUIDs []string, reverse bool) (*types.InstanceTopologyGraph, error) {
	if _, err := s.getResourceByModel(ctx, modelUID, startID, false); err != nil {
		return nil, err
	}

	rawNodes, err := s.GetTopology(ctx, startID, maxDepth, associationUIDs, reverse)
	if err != nil {
		return nil, err
	}

	nodeMap := make(map[uint64]types.TopologyGraphNode, len(rawNodes))
	resourceIDs := make([]uint64, 0, len(rawNodes))
	for _, raw := range rawNodes {
		if _, exists := nodeMap[raw.ResourceID]; exists {
			continue
		}
		nodeMap[raw.ResourceID] = types.TopologyGraphNode{
			ResourceID: raw.ResourceID,
			ModelUID:   raw.ModelUID,
			Name:       raw.Name,
			Depth:      raw.Depth,
			Path:       raw.Path,
			IsRoot:     raw.ResourceID == startID,
		}
		resourceIDs = append(resourceIDs, raw.ResourceID)
	}

	if len(resourceIDs) == 0 {
		return &types.InstanceTopologyGraph{
			Nodes: []types.TopologyGraphNode{},
			Edges: []types.TopologyGraphEdge{},
		}, nil
	}

	var resources []types.Resource
	if err := s.db.WithContext(ctx).Where("id IN ?", resourceIDs).Find(&resources).Error; err != nil {
		return nil, err
	}
	for _, resource := range resources {
		node := nodeMap[resource.ID]
		node.Configs = decodeJSONObject(resource.Configs)
		nodeMap[resource.ID] = node
	}

	nodes := make([]types.TopologyGraphNode, 0, len(nodeMap))
	for _, id := range resourceIDs {
		nodes = append(nodes, nodeMap[id])
	}
	sort.SliceStable(nodes, func(i, j int) bool {
		if nodes[i].Depth == nodes[j].Depth {
			return nodes[i].ResourceID < nodes[j].ResourceID
		}
		return nodes[i].Depth < nodes[j].Depth
	})

	query := s.db.WithContext(ctx).
		Table("relations AS r").
		Select(`
			r.id,
			r.source_id,
			r.target_id,
			r.source_model_uid,
			r.target_model_uid,
			r.association_uid,
			COALESCE(at.name, r.association_uid) AS association_name,
			r.properties
		`).
		Joins("LEFT JOIN association_types AS at ON at.uid = r.association_uid").
		Where("r.source_id IN ? AND r.target_id IN ?", resourceIDs, resourceIDs)
	if len(associationUIDs) > 0 {
		query = query.Where("r.association_uid IN ?", associationUIDs)
	}

	var edgeRows []topologyEdgeRow
	if err := query.Order("r.id ASC").Scan(&edgeRows).Error; err != nil {
		return nil, err
	}

	edges := make([]types.TopologyGraphEdge, 0, len(edgeRows))
	for _, row := range edgeRows {
		edges = append(edges, types.TopologyGraphEdge{
			ID:              row.ID,
			SourceID:        row.SourceID,
			TargetID:        row.TargetID,
			SourceModelUID:  row.SourceModelUID,
			TargetModelUID:  row.TargetModelUID,
			AssociationUID:  row.AssociationUID,
			AssociationName: row.AssociationName,
			Properties:      decodeJSONObject(row.Properties),
		})
	}

	return &types.InstanceTopologyGraph{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

// GetResourceHistoryView 获取资源变更历史视图
func (s *service) GetResourceHistoryView(ctx context.Context, modelUID string, resourceID uint64, page, pageSize int) ([]types.ResourceHistoryView, int64, error) {
	if _, err := s.getResourceByModel(ctx, modelUID, resourceID, false); err != nil {
		return nil, 0, err
	}

	query := s.db.WithContext(ctx).Model(&types.ResourceHistory{}).Where("resource_id = ?", resourceID)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var histories []types.ResourceHistory
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("changed_at DESC").Find(&histories).Error; err != nil {
		return nil, 0, err
	}

	items := make([]types.ResourceHistoryView, 0, len(histories))
	for _, history := range histories {
		beforeData := decodeJSONObject(history.BeforeData)
		afterData := decodeJSONObject(history.AfterData)
		items = append(items, types.ResourceHistoryView{
			ID:            history.ID,
			ResourceID:    history.ResourceID,
			ModelUID:      history.ModelUID,
			ChangeType:    history.ChangeType,
			BeforeData:    beforeData,
			AfterData:     afterData,
			ChangedFields: calculateChangedFields(beforeData, afterData),
			ChangedBy:     history.ChangedBy,
			ChangedAt:     history.ChangedAt,
			ClientIP:      history.ClientIP,
			UserAgent:     history.UserAgent,
		})
	}

	return items, total, nil
}

func (s *service) getResourceByModel(ctx context.Context, modelUID string, resourceID uint64, preloadState bool) (*types.Resource, error) {
	query := s.db.WithContext(ctx)
	if preloadState {
		query = query.Preload("State")
	}

	var resource types.Resource
	if err := query.First(&resource, resourceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, NewResourceNotFoundError(resourceID)
		}
		return nil, err
	}
	if resource.ModelUID != modelUID {
		return nil, NewResourceNotFoundError(resourceID)
	}
	return &resource, nil
}

func decodeJSONObject(data []byte) map[string]interface{} {
	if len(data) == 0 || string(data) == "null" {
		return nil
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil
	}
	if len(result) == 0 {
		return nil
	}
	return result
}

func calculateChangedFields(beforeData, afterData map[string]interface{}) []string {
	keys := make(map[string]struct{}, len(beforeData)+len(afterData))
	for key := range beforeData {
		keys[key] = struct{}{}
	}
	for key := range afterData {
		keys[key] = struct{}{}
	}

	changed := make([]string, 0, len(keys))
	for key := range keys {
		beforeValue, beforeExists := beforeData[key]
		afterValue, afterExists := afterData[key]
		if !beforeExists || !afterExists {
			changed = append(changed, key)
			continue
		}

		beforeJSON, _ := json.Marshal(beforeValue)
		afterJSON, _ := json.Marshal(afterValue)
		if string(beforeJSON) != string(afterJSON) {
			changed = append(changed, key)
		}
	}

	sort.Strings(changed)
	return changed
}

// Invalidate 使模型缓存失效
func (c *ModelCache) Invalidate(modelUID string) {
	c.Lock()
	delete(c.cache, modelUID)
	c.Unlock()
}
