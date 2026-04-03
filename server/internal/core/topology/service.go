package topology

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/types"
)

// Service 业务拓扑服务
type Service struct {
	db       *gorm.DB
	mainline *mainline.Service
}

// NewService 创建服务实例
func NewService(db *gorm.DB, mainlineSvc *mainline.Service) *Service {
	if mainlineSvc == nil {
		mainlineSvc = mainline.NewService(db)
	}
	return &Service{db: db, mainline: mainlineSvc}
}

// DB 返回数据库连接
func (s *Service) DB() *gorm.DB {
	return s.db
}

// ========== 集群（Set）操作 ==========

// CreateSet 创建集群
func (s *Service) CreateSet(ctx context.Context, req *types.CreateSetRequest) (*types.Set, error) {
	// 验证业务是否存在
	var business types.Business
	if err := s.db.Where("id = ?", req.BusinessID).First(&business).Error; err != nil {
		return nil, fmt.Errorf("业务不存在: %w", err)
	}

	set := &types.Set{
		BusinessID:  req.BusinessID,
		Name:        req.Name,
		Description: req.Description,
		EnvType:     req.EnvType,
		SortOrder:   req.SortOrder,
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(set).Error; err != nil {
			return err
		}
		if err := s.mainline.WithDB(tx).EnsureBuiltinModels(ctx); err != nil {
			return err
		}
		_, err := s.mainline.WithDB(tx).SyncSet(ctx, set)
		return err
	}); err != nil {
		return nil, err
	}
	return set, nil
}

// GetSet 获取集群详情
func (s *Service) GetSet(ctx context.Context, id uint64) (*types.Set, error) {
	var set types.Set
	if err := s.db.Preload("Modules").First(&set, id).Error; err != nil {
		return nil, err
	}
	return &set, nil
}

// ListSets 获取业务下的集群列表
func (s *Service) ListSets(ctx context.Context, businessID uuid.UUID) ([]types.Set, error) {
	var sets []types.Set
	if err := s.db.Where("business_id = ?", businessID).
		Order("sort_order ASC, id ASC").
		Find(&sets).Error; err != nil {
		return nil, err
	}
	return sets, nil
}

// UpdateSet 更新集群
func (s *Service) UpdateSet(ctx context.Context, id uint64, req *types.UpdateSetRequest) (*types.Set, error) {
	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.EnvType != nil {
		updates["env_type"] = *req.EnvType
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	var updated types.Set
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&types.Set{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.First(&updated, id).Error; err != nil {
			return err
		}
		_, err := s.mainline.WithDB(tx).SyncSet(ctx, &updated)
		return err
	}); err != nil {
		return nil, err
	}

	return s.GetSet(ctx, id)
}

// DeleteSet 删除集群
func (s *Service) DeleteSet(ctx context.Context, id uint64) error {
	// 检查是否有模块
	var moduleCount int64
	s.db.Model(&types.Module{}).Where("set_id = ?", id).Count(&moduleCount)
	if moduleCount > 0 {
		return fmt.Errorf("集群下还有 %d 个模块，无法删除", moduleCount)
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.mainline.WithDB(tx).DeleteNodeByRef(ctx, string(types.NodeTypeSet), fmt.Sprintf("%d", id)); err != nil {
			return err
		}
		return tx.Delete(&types.Set{}, id).Error
	})
}

// ========== 模块（Module）操作 ==========

// CreateModule 创建模块
func (s *Service) CreateModule(ctx context.Context, req *types.CreateModuleRequest) (*types.Module, error) {
	// 验证集群是否存在
	var set types.Set
	if err := s.db.First(&set, req.SetID).Error; err != nil {
		return nil, fmt.Errorf("集群不存在: %w", err)
	}

	module := &types.Module{
		SetID:       req.SetID,
		BusinessID:  set.BusinessID, // 冗余存储
		Name:        req.Name,
		Description: req.Description,
		ServiceType: req.ServiceType,
		SortOrder:   req.SortOrder,
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(module).Error; err != nil {
			return err
		}
		_, err := s.mainline.WithDB(tx).SyncModule(ctx, module)
		return err
	}); err != nil {
		return nil, err
	}
	return module, nil
}

// GetModule 获取模块详情
func (s *Service) GetModule(ctx context.Context, id uint64) (*types.Module, error) {
	var module types.Module
	if err := s.db.Preload("Set").First(&module, id).Error; err != nil {
		return nil, err
	}

	// 统计主机数量
	var hostCount int64
	s.db.Table("host_module_relations").Where("module_id = ?", id).Distinct("host_id").Count(&hostCount)
	module.HostCount = int(hostCount)

	return &module, nil
}

// ListModules 获取集群下的模块列表
func (s *Service) ListModules(ctx context.Context, setID uint64) ([]types.Module, error) {
	var modules []types.Module
	if err := s.db.Where("set_id = ?", setID).
		Order("sort_order ASC, id ASC").
		Find(&modules).Error; err != nil {
		return nil, err
	}

	// 统计每个模块的主机数量
	for i := range modules {
		var count int64
		s.db.Table("host_module_relations").Where("module_id = ?", modules[i].ID).Distinct("host_id").Count(&count)
		modules[i].HostCount = int(count)
	}

	return modules, nil
}

// ListModulesByBusiness 获取业务下的所有模块
func (s *Service) ListModulesByBusiness(ctx context.Context, businessID uuid.UUID) ([]types.Module, error) {
	var modules []types.Module
	if err := s.db.Where("business_id = ?", businessID).
		Preload("Set").
		Order("set_id ASC, sort_order ASC, id ASC").
		Find(&modules).Error; err != nil {
		return nil, err
	}
	return modules, nil
}

// UpdateModule 更新模块
func (s *Service) UpdateModule(ctx context.Context, id uint64, req *types.UpdateModuleRequest) (*types.Module, error) {
	updates := make(map[string]interface{})

	var current types.Module
	if err := s.db.WithContext(ctx).First(&current, id).Error; err != nil {
		return nil, err
	}

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.ServiceType != nil {
		updates["service_type"] = *req.ServiceType
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.ServiceCategoryID != nil {
		if err := s.validateServiceCategory(ctx, current.BusinessID, *req.ServiceCategoryID); err != nil {
			return nil, err
		}
		updates["service_category_id"] = *req.ServiceCategoryID
	}

	var updated types.Module
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&types.Module{}).Where("id = ?", id).Updates(updates).Error; err != nil {
			return err
		}
		if err := tx.First(&updated, id).Error; err != nil {
			return err
		}
		_, err := s.mainline.WithDB(tx).SyncModule(ctx, &updated)
		return err
	}); err != nil {
		return nil, err
	}

	return s.GetModule(ctx, id)
}

func (s *Service) validateServiceCategory(ctx context.Context, businessID uuid.UUID, categoryID uint64) error {
	var category types.ServiceCategory
	if err := s.db.WithContext(ctx).First(&category, categoryID).Error; err != nil {
		return fmt.Errorf("服务分类不存在: %w", err)
	}
	if category.BusinessID != nil && *category.BusinessID != businessID {
		return fmt.Errorf("服务分类不属于当前业务")
	}
	return nil
}

// DeleteModule 删除模块
func (s *Service) DeleteModule(ctx context.Context, id uint64) error {
	// 检查是否有主机
	var hostCount int64
	s.db.Table("host_module_relations").Where("module_id = ?", id).Distinct("host_id").Count(&hostCount)
	if hostCount > 0 {
		return fmt.Errorf("模块下还有 %d 台主机，无法删除", hostCount)
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := s.mainline.WithDB(tx).DeleteNodeByRef(ctx, string(types.NodeTypeModule), fmt.Sprintf("%d", id)); err != nil {
			return err
		}
		return tx.Delete(&types.Module{}, id).Error
	})
}

// ========== 主机转移 ==========

// TransferHosts 转移主机到目标模块
func (s *Service) TransferHosts(ctx context.Context, req *types.TransferHostsRequest) (*types.BatchOperationResult, error) {
	result := &types.BatchOperationResult{
		Total:  len(req.HostIDs),
		Errors: make([]string, 0),
	}

	// 验证目标模块
	var targetModule types.Module
	if err := s.db.First(&targetModule, req.TargetModuleID).Error; err != nil {
		return nil, fmt.Errorf("目标模块不存在")
	}

	// 批量更新
	for _, hostID := range req.HostIDs {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			var hostCount int64
			if err := tx.Model(&types.Host{}).
				Where("id = ? AND deleted_at IS NULL", hostID).
				Count(&hostCount).Error; err != nil {
				return err
			}
			if hostCount == 0 {
				return fmt.Errorf("主机不存在")
			}

			moduleRel := &types.HostModuleRelation{
				HostID:   hostID,
				ModuleID: req.TargetModuleID,
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(moduleRel).Error; err != nil {
				return err
			}

			bizRel := &types.HostBusinessRelation{
				HostID:     hostID,
				BusinessID: targetModule.BusinessID,
			}
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(bizRel).Error
		})

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// TransferHostsToPool 将主机转移到资源池（空闲机池）
func (s *Service) TransferHostsToPool(ctx context.Context, hostIDs []uuid.UUID) (*types.BatchOperationResult, error) {
	result := &types.BatchOperationResult{
		Total:  len(hostIDs),
		Errors: make([]string, 0),
	}

	for _, hostID := range hostIDs {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			var hostCount int64
			if err := tx.Model(&types.Host{}).
				Where("id = ? AND deleted_at IS NULL", hostID).
				Count(&hostCount).Error; err != nil {
				return err
			}
			if hostCount == 0 {
				return fmt.Errorf("主机不存在")
			}

			if err := tx.Where("host_id = ?", hostID).Delete(&types.HostModuleRelation{}).Error; err != nil {
				return err
			}
			return tx.Where("host_id = ?", hostID).Delete(&types.HostBusinessRelation{}).Error
		})

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// ========== 节点移动 ==========

// MoveModule 移动模块到另一个集群
func (s *Service) MoveModule(ctx context.Context, moduleID, targetSetID uint64) error {
	// 验证目标集群
	var targetSet types.Set
	if err := s.db.First(&targetSet, targetSetID).Error; err != nil {
		return fmt.Errorf("目标集群不存在")
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&types.Module{}).
			Where("id = ?", moduleID).
			Updates(map[string]interface{}{
				"set_id":      targetSetID,
				"business_id": targetSet.BusinessID,
			}).Error; err != nil {
			return err
		}

		var module types.Module
		if err := tx.First(&module, moduleID).Error; err != nil {
			return err
		}
		_, err := s.mainline.WithDB(tx).SyncModule(ctx, &module)
		return err
	})
}

// MoveSet 移动集群到另一个业务
func (s *Service) MoveSet(ctx context.Context, setID uint64, targetBusinessID uuid.UUID) error {
	// 验证目标业务
	var targetBusiness types.Business
	if err := s.db.Where("id = ?", targetBusinessID).First(&targetBusiness).Error; err != nil {
		return fmt.Errorf("目标业务不存在")
	}

	// 开启事务
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 更新集群
		if err := tx.Model(&types.Set{}).
			Where("id = ?", setID).
			Update("business_id", targetBusinessID).Error; err != nil {
			return err
		}

		// 更新集群下所有模块的 business_id
		if err := tx.Model(&types.Module{}).
			Where("set_id = ?", setID).
			Update("business_id", targetBusinessID).Error; err != nil {
			return err
		}

		// 为模块下所有主机补充目标业务关联（多对多，不覆盖原有关联）
		var moduleIDs []uint64
		if err := tx.Model(&types.Module{}).Where("set_id = ?", setID).Pluck("id", &moduleIDs).Error; err != nil {
			return err
		}

		if len(moduleIDs) > 0 {
			if err := tx.Exec(`
				INSERT INTO host_business_relations (host_id, business_id, created_at)
				SELECT DISTINCT host_id, ?, NOW()
				FROM host_module_relations
				WHERE module_id IN ?
				ON CONFLICT (host_id, business_id) DO NOTHING
			`, targetBusinessID, moduleIDs).Error; err != nil {
				return err
			}
		}

		var set types.Set
		if err := tx.First(&set, setID).Error; err != nil {
			return err
		}
		if _, err := s.mainline.WithDB(tx).SyncSet(ctx, &set); err != nil {
			return err
		}

		var modules []types.Module
		if err := tx.Where("set_id = ?", setID).Find(&modules).Error; err != nil {
			return err
		}
		for i := range modules {
			if _, err := s.mainline.WithDB(tx).SyncModule(ctx, &modules[i]); err != nil {
				return err
			}
		}

		return nil
	})
}

// ========== 拓扑树查询 ==========

// GetTopologyTree 获取完整拓扑树
func (s *Service) GetTopologyTree(ctx context.Context, req *types.GetTopologyTreeRequest) ([]types.TopologyTreeNode, error) {
	var businesses []types.Business

	query := s.db.Where("deleted_at IS NULL")
	if req.BusinessID != nil {
		query = query.Where("id = ?", *req.BusinessID)
	}

	if err := query.Order("name ASC").Find(&businesses).Error; err != nil {
		return nil, err
	}

	if err := s.mainline.EnsureBuiltinModels(ctx); err != nil {
		return nil, err
	}

	nodes := make([]types.TopologyTreeNode, 0, len(businesses))

	for _, biz := range businesses {
		if err := s.mainline.SyncBusinessLegacy(ctx, biz.ID); err != nil {
			return nil, err
		}
		root, err := s.mainline.GetNodeByRef(ctx, types.NodeTypeBusiness, biz.ID.String())
		if err != nil {
			return nil, err
		}
		node, err := s.buildMainlineNode(ctx, root, req, "")
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, node)
	}

	return nodes, nil
}

func (s *Service) buildMainlineNode(ctx context.Context, node *types.MainlineInstance, req *types.GetTopologyTreeRequest, parentAPIID string) (types.TopologyTreeNode, error) {
	extra := decodeExtra(node.Extra)
	nodeID := apiNodeID(node)
	childNodes, err := s.mainline.ListChildren(ctx, node)
	if err != nil {
		return types.TopologyTreeNode{}, err
	}

	treeNode := types.TopologyTreeNode{
		ID:        nodeID,
		NodeID:    apiNodeRef(node),
		Name:      node.Name,
		NodeType:  types.TopologyNodeType(node.ModelName),
		ParentID:  parentAPIID,
		Icon:      s.apiNodeIcon(ctx, node),
		IsDefault: node.IsDefault,
		Extra:     extra,
	}

	if node.ModelName == string(types.NodeTypeModule) {
		hostCount, err := s.countModuleHosts(ctx, node.RefID)
		if err != nil {
			return types.TopologyTreeNode{}, err
		}
		treeNode.Extra["host_count"] = hostCount
		if len(childNodes) > 0 {
			treeNode.IsLeaf = false
			treeNode.Expandable = true
			treeNode.ChildCount = len(childNodes)
		} else {
			treeNode.IsLeaf = !req.IncludeHosts || hostCount == 0
			treeNode.Expandable = req.IncludeHosts && hostCount > 0
			treeNode.ChildCount = hostCount
		}
	} else {
		treeNode.IsLeaf = len(childNodes) == 0
		treeNode.Expandable = len(childNodes) > 0
		treeNode.ChildCount = len(childNodes)
	}

	shouldLoadChildren := req.MaxDepth >= node.Level+2 || req.ExpandNodeID == nodeID

	if !shouldLoadChildren {
		return treeNode, nil
	}

	if node.ModelName == string(types.NodeTypeModule) && len(childNodes) == 0 {
		if !req.IncludeHosts {
			return treeNode, nil
		}
		children, err := s.buildModuleHostNodes(ctx, node)
		if err != nil {
			return types.TopologyTreeNode{}, err
		}
		treeNode.Children = children
		return treeNode, nil
	}

	children := make([]types.TopologyTreeNode, 0, len(childNodes))
	for i := range childNodes {
		childNode, err := s.buildMainlineNode(ctx, &childNodes[i], req, nodeID)
		if err != nil {
			return types.TopologyTreeNode{}, err
		}
		children = append(children, childNode)
	}
	treeNode.Children = children
	return treeNode, nil
}

func (s *Service) buildModuleHostNodes(ctx context.Context, node *types.MainlineInstance) ([]types.TopologyTreeNode, error) {
	moduleID, err := mainline.ParseRefUint(node.RefID)
	if err != nil {
		return nil, err
	}
	var hosts []types.Host
	if err := s.db.WithContext(ctx).Model(&types.Host{}).
		Joins("JOIN host_module_relations hmr ON hmr.host_id = hosts.id").
		Where("hmr.module_id = ? AND hosts.deleted_at IS NULL", moduleID).
		Limit(100).
		Find(&hosts).Error; err != nil {
		return nil, err
	}

	children := make([]types.TopologyTreeNode, 0, len(hosts))
	for _, host := range hosts {
		children = append(children, types.TopologyTreeNode{
			ID:         fmt.Sprintf("host_%s", host.ID),
			NodeID:     host.ID,
			Name:       host.HostName,
			NodeType:   types.NodeTypeHost,
			ParentID:   apiNodeID(node),
			Icon:       s.apiNodeIcon(ctx, &types.MainlineInstance{ModelName: string(types.NodeTypeHost)}),
			IsLeaf:     true,
			Expandable: false,
			Extra: map[string]interface{}{
				"primary_ip": host.PrimaryIP,
				"status":     host.Status,
			},
		})
	}
	return children, nil
}

func (s *Service) countModuleHosts(ctx context.Context, refID string) (int, error) {
	moduleID, err := mainline.ParseRefUint(refID)
	if err != nil {
		return 0, err
	}
	var hostCount int64
	if err := s.db.WithContext(ctx).Table("host_module_relations").Where("module_id = ?", moduleID).Distinct("host_id").Count(&hostCount).Error; err != nil {
		return 0, err
	}
	return int(hostCount), nil
}

// buildBusinessNode 构建业务节点
func (s *Service) buildBusinessNode(ctx context.Context, business *types.Business, req *types.GetTopologyTreeRequest) types.TopologyTreeNode {
	// 统计子节点数量
	var setCount int64
	s.db.Model(&types.Set{}).Where("business_id = ?", business.ID).Count(&setCount)

	node := types.TopologyTreeNode{
		ID:         fmt.Sprintf("business_%s", business.ID),
		NodeID:     business.ID,
		Name:       business.Name,
		NodeType:   types.NodeTypeBusiness,
		ParentID:   "",
		Icon:       "business",
		IsLeaf:     false,
		Expandable: true,
		ChildCount: int(setCount),
		Extra: map[string]interface{}{
			"description": business.Description,
			"lifecycle":   business.Lifecycle,
		},
	}

	// 如果需要展开或深度足够，获取子节点
	if req.MaxDepth >= 2 || req.ExpandNodeID == node.ID {
		sets, _ := s.ListSets(ctx, business.ID)
		children := make([]types.TopologyTreeNode, 0, len(sets))
		for _, set := range sets {
			childNode := s.buildSetNode(ctx, &set, req)
			children = append(children, childNode)
		}
		node.Children = children
	}

	return node
}

// buildSetNode 构建集群节点
func (s *Service) buildSetNode(ctx context.Context, set *types.Set, req *types.GetTopologyTreeRequest) types.TopologyTreeNode {
	var moduleCount int64
	s.db.Model(&types.Module{}).Where("set_id = ?", set.ID).Count(&moduleCount)

	node := types.TopologyTreeNode{
		ID:         fmt.Sprintf("set_%d", set.ID),
		NodeID:     set.ID,
		Name:       set.Name,
		NodeType:   types.NodeTypeSet,
		ParentID:   fmt.Sprintf("business_%s", set.BusinessID),
		Icon:       "cluster",
		IsLeaf:     false,
		IsDefault:  set.IsDefault,
		Expandable: true,
		ChildCount: int(moduleCount),
		Extra: map[string]interface{}{
			"env_type":    set.EnvType,
			"description": set.Description,
		},
	}

	// 获取子节点
	if req.MaxDepth >= 3 || req.ExpandNodeID == node.ID {
		modules, _ := s.ListModules(ctx, set.ID)
		children := make([]types.TopologyTreeNode, 0, len(modules))
		for _, module := range modules {
			childNode := s.buildModuleNode(ctx, &module, req)
			children = append(children, childNode)
		}
		node.Children = children
	}

	return node
}

// buildModuleNode 构建模块节点
func (s *Service) buildModuleNode(ctx context.Context, module *types.Module, req *types.GetTopologyTreeRequest) types.TopologyTreeNode {
	var hostCount int64
	s.db.Table("host_module_relations").Where("module_id = ?", module.ID).Distinct("host_id").Count(&hostCount)

	node := types.TopologyTreeNode{
		ID:         fmt.Sprintf("module_%d", module.ID),
		NodeID:     module.ID,
		Name:       module.Name,
		NodeType:   types.NodeTypeModule,
		ParentID:   fmt.Sprintf("set_%d", module.SetID),
		Icon:       "module",
		IsLeaf:     !req.IncludeHosts,
		IsDefault:  module.IsDefault,
		Expandable: req.IncludeHosts && hostCount > 0,
		ChildCount: int(hostCount),
		Extra: map[string]interface{}{
			"service_type": module.ServiceType,
			"description":  module.Description,
			"host_count":   hostCount,
		},
	}

	// 获取主机子节点
	if req.IncludeHosts && (req.MaxDepth >= 4 || req.ExpandNodeID == node.ID) {
		var hosts []types.Host
		s.db.Model(&types.Host{}).
			Joins("JOIN host_module_relations hmr ON hmr.host_id = hosts.id").
			Where("hmr.module_id = ? AND hosts.deleted_at IS NULL", module.ID).
			Limit(100).
			Find(&hosts)

		children := make([]types.TopologyTreeNode, 0, len(hosts))
		for _, host := range hosts {
			childNode := types.TopologyTreeNode{
				ID:         fmt.Sprintf("host_%s", host.ID),
				NodeID:     host.ID,
				Name:       host.HostName,
				NodeType:   types.NodeTypeHost,
				ParentID:   node.ID,
				Icon:       "host",
				IsLeaf:     true,
				Expandable: false,
				Extra: map[string]interface{}{
					"primary_ip": host.PrimaryIP,
					"status":     host.Status,
				},
			}
			children = append(children, childNode)
		}
		node.Children = children
	}

	return node
}

// GetNodeChildren 获取节点的子节点（懒加载）
func (s *Service) GetNodeChildren(ctx context.Context, nodeType types.TopologyNodeType, nodeID interface{}) ([]types.TopologyTreeNode, error) {
	refID, err := mainline.RefString(nodeID)
	if err != nil {
		return nil, err
	}

	if nodeType == types.NodeTypeBusiness {
		businessID, err := mainline.ParseRefUUID(refID)
		if err != nil {
			return nil, err
		}
		if err := s.mainline.SyncBusinessLegacy(ctx, businessID); err != nil {
			return nil, err
		}
	}

	parent, err := s.mainline.GetNodeByRef(ctx, nodeType, refID)
	if err != nil {
		return nil, err
	}
	children, err := s.mainline.ListChildren(ctx, parent)
	if err != nil {
		return nil, err
	}
	if len(children) > 0 {
		nodes := make([]types.TopologyTreeNode, 0, len(children))
		for i := range children {
			childNode, err := s.buildMainlineNode(ctx, &children[i], &types.GetTopologyTreeRequest{}, apiNodeID(parent))
			if err != nil {
				return nil, err
			}
			nodes = append(nodes, childNode)
		}
		return nodes, nil
	}
	if nodeType == types.NodeTypeModule {
		return s.buildModuleHostNodes(ctx, parent)
	}
	return []types.TopologyTreeNode{}, nil
}

// ========== 统计信息 ==========

// GetStatistics 获取拓扑统计信息
func (s *Service) GetStatistics(ctx context.Context, businessID *uuid.UUID) (*types.TopologyStatistics, error) {
	stats := &types.TopologyStatistics{
		ByEnvType:     make(map[string]int),
		ByServiceType: make(map[string]int),
	}

	// 业务数量
	bizQuery := s.db.Model(&types.Business{})
	if businessID != nil {
		bizQuery = bizQuery.Where("id = ?", *businessID)
	}
	bizQuery.Count(&stats.BusinessCount)

	// 集群数量
	setQuery := s.db.Model(&types.Set{})
	if businessID != nil {
		setQuery = setQuery.Where("business_id = ?", *businessID)
	}
	setQuery.Count(&stats.SetCount)

	// 模块数量
	moduleQuery := s.db.Model(&types.Module{})
	if businessID != nil {
		moduleQuery = moduleQuery.Where("business_id = ?", *businessID)
	}
	moduleQuery.Count(&stats.ModuleCount)

	// 主机数量
	if businessID != nil {
		s.db.Table("host_business_relations hbr").
			Joins("JOIN hosts ON hosts.id = hbr.host_id").
			Where("hbr.business_id = ? AND hosts.deleted_at IS NULL", *businessID).
			Distinct("hbr.host_id").
			Count(&stats.HostCount)
	} else {
		s.db.Model(&types.Host{}).
			Where("deleted_at IS NULL").
			Count(&stats.HostCount)
	}

	// 按环境类型统计集群
	var envStats []struct {
		EnvType string
		Count   int
	}
	s.db.Model(&types.Set{}).
		Select("env_type, count(*) as count").
		Group("env_type").
		Scan(&envStats)
	for _, stat := range envStats {
		if stat.EnvType != "" {
			stats.ByEnvType[stat.EnvType] = stat.Count
		}
	}

	// 按服务类型统计模块
	var serviceStats []struct {
		ServiceType string
		Count       int
	}
	s.db.Model(&types.Module{}).
		Select("service_type, count(*) as count").
		Group("service_type").
		Scan(&serviceStats)
	for _, stat := range serviceStats {
		if stat.ServiceType != "" {
			stats.ByServiceType[stat.ServiceType] = stat.Count
		}
	}

	return stats, nil
}

// ========== 初始化默认拓扑 ==========

// InitializeBusinessTopology 为业务初始化默认拓扑结构
func (s *Service) InitializeBusinessTopology(ctx context.Context, businessID uuid.UUID) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		txMainline := s.mainline.WithDB(tx)
		if err := txMainline.EnsureBuiltinModels(ctx); err != nil {
			return err
		}
		var business types.Business
		if err := tx.Where("id = ?", businessID).First(&business).Error; err != nil {
			return err
		}
		if _, err := txMainline.EnsureBusinessRoot(ctx, &business); err != nil {
			return err
		}

		// 创建默认集群（空闲机池）
		defaultSet := &types.Set{
			BusinessID:  businessID,
			Name:        "空闲机池",
			Description: "未分配到具体模块的主机",
			IsDefault:   true,
			SortOrder:   -1, // 排在最前面
		}
		if err := tx.Create(defaultSet).Error; err != nil {
			return err
		}
		if _, err := txMainline.SyncSet(ctx, defaultSet); err != nil {
			return err
		}

		// 创建默认模块（空闲机）
		defaultModule := &types.Module{
			SetID:       defaultSet.ID,
			BusinessID:  businessID,
			Name:        "空闲机",
			Description: "未分配的空闲主机",
			IsDefault:   true,
			SortOrder:   -1,
		}
		if err := tx.Create(defaultModule).Error; err != nil {
			return err
		}
		if _, err := txMainline.SyncModule(ctx, defaultModule); err != nil {
			return err
		}

		return nil
	})
}

func apiNodeID(node *types.MainlineInstance) string {
	return fmt.Sprintf("%s_%s", node.ModelName, node.RefID)
}

func apiNodeRef(node *types.MainlineInstance) interface{} {
	switch node.ModelName {
	case string(types.NodeTypeBusiness), string(types.NodeTypeHost):
		id, err := uuid.Parse(node.RefID)
		if err == nil {
			return id
		}
		return node.RefID
	case string(types.NodeTypeSet), string(types.NodeTypeModule):
		if id, err := mainline.ParseRefUint(node.RefID); err == nil {
			return id
		}
	}
	return node.RefID
}

func (s *Service) apiNodeIcon(ctx context.Context, node *types.MainlineInstance) string {
	switch node.ModelName {
	case string(types.NodeTypeBusiness):
		return "business"
	case string(types.NodeTypeSet):
		return "cluster"
	case string(types.NodeTypeModule):
		return "module"
	case string(types.NodeTypeHost):
		return "host"
	default:
		model, err := s.mainline.GetModelByName(ctx, node.ModelName)
		if err == nil && model.Icon != "" {
			return model.Icon
		}
		return node.ModelName
	}
}

func decodeExtra(raw []byte) map[string]interface{} {
	if len(raw) == 0 {
		return map[string]interface{}{}
	}
	var extra map[string]interface{}
	if err := json.Unmarshal(raw, &extra); err != nil {
		return map[string]interface{}{}
	}
	return extra
}
