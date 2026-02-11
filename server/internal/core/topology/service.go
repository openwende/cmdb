package topology

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// Service 业务拓扑服务
type Service struct {
	db *gorm.DB
}

// NewService 创建服务实例
func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
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

	if err := s.db.Create(set).Error; err != nil {
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

	if err := s.db.Model(&types.Set{}).Where("id = ?", id).Updates(updates).Error; err != nil {
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

	return s.db.Delete(&types.Set{}, id).Error
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

	if err := s.db.Create(module).Error; err != nil {
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
	s.db.Model(&types.Host{}).Where("module_id = ?", id).Count(&hostCount)
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
		s.db.Model(&types.Host{}).Where("module_id = ?", modules[i].ID).Count(&count)
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

	if err := s.db.Model(&types.Module{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetModule(ctx, id)
}

// DeleteModule 删除模块
func (s *Service) DeleteModule(ctx context.Context, id uint64) error {
	// 检查是否有主机
	var hostCount int64
	s.db.Model(&types.Host{}).Where("module_id = ?", id).Count(&hostCount)
	if hostCount > 0 {
		return fmt.Errorf("模块下还有 %d 台主机，无法删除", hostCount)
	}

	return s.db.Delete(&types.Module{}, id).Error
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
		err := s.db.Model(&types.Host{}).
			Where("id = ?", hostID).
			Updates(map[string]interface{}{
				"module_id":   req.TargetModuleID,
				"business_id": targetModule.BusinessID,
			}).Error

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
		err := s.db.Model(&types.Host{}).
			Where("id = ?", hostID).
			Updates(map[string]interface{}{
				"module_id":   nil,
				"business_id": nil,
			}).Error

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

	// 更新模块
	return s.db.Model(&types.Module{}).
		Where("id = ?", moduleID).
		Updates(map[string]interface{}{
			"set_id":      targetSetID,
			"business_id": targetSet.BusinessID,
		}).Error
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

		// 更新模块下所有主机的 business_id
		var moduleIDs []uint64
		tx.Model(&types.Module{}).Where("set_id = ?", setID).Pluck("id", &moduleIDs)

		if len(moduleIDs) > 0 {
			if err := tx.Model(&types.Host{}).
				Where("module_id IN ?", moduleIDs).
				Update("business_id", targetBusinessID).Error; err != nil {
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

	nodes := make([]types.TopologyTreeNode, 0, len(businesses))

	for _, biz := range businesses {
		node := s.buildBusinessNode(ctx, &biz, req)
		nodes = append(nodes, node)
	}

	return nodes, nil
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
	s.db.Model(&types.Host{}).Where("module_id = ?", module.ID).Count(&hostCount)

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
		s.db.Where("module_id = ?", module.ID).Limit(100).Find(&hosts)

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
	switch nodeType {
	case types.NodeTypeBusiness:
		businessID, ok := nodeID.(uuid.UUID)
		if !ok {
			return nil, fmt.Errorf("无效的业务ID")
		}
		sets, err := s.ListSets(ctx, businessID)
		if err != nil {
			return nil, err
		}
		nodes := make([]types.TopologyTreeNode, 0, len(sets))
		for _, set := range sets {
			nodes = append(nodes, s.buildSetNode(ctx, &set, &types.GetTopologyTreeRequest{}))
		}
		return nodes, nil

	case types.NodeTypeSet:
		setID, ok := nodeID.(uint64)
		if !ok {
			return nil, fmt.Errorf("无效的集群ID")
		}
		modules, err := s.ListModules(ctx, setID)
		if err != nil {
			return nil, err
		}
		nodes := make([]types.TopologyTreeNode, 0, len(modules))
		for _, module := range modules {
			nodes = append(nodes, s.buildModuleNode(ctx, &module, &types.GetTopologyTreeRequest{}))
		}
		return nodes, nil

	case types.NodeTypeModule:
		moduleID, ok := nodeID.(uint64)
		if !ok {
			return nil, fmt.Errorf("无效的模块ID")
		}
		var hosts []types.Host
		if err := s.db.Where("module_id = ?", moduleID).Find(&hosts).Error; err != nil {
			return nil, err
		}
		nodes := make([]types.TopologyTreeNode, 0, len(hosts))
		for _, host := range hosts {
			nodes = append(nodes, types.TopologyTreeNode{
				ID:         fmt.Sprintf("host_%s", host.ID),
				NodeID:     host.ID,
				Name:       host.HostName,
				NodeType:   types.NodeTypeHost,
				ParentID:   fmt.Sprintf("module_%d", moduleID),
				Icon:       "host",
				IsLeaf:     true,
				Expandable: false,
				Extra: map[string]interface{}{
					"primary_ip": host.PrimaryIP,
					"status":     host.Status,
				},
			})
		}
		return nodes, nil

	default:
		return nil, fmt.Errorf("不支持的节点类型: %s", nodeType)
	}
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
	hostQuery := s.db.Model(&types.Host{}).Where("deleted_at IS NULL")
	if businessID != nil {
		hostQuery = hostQuery.Where("business_id = ?", *businessID)
	}
	hostQuery.Count(&stats.HostCount)

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

		return nil
	})
}
