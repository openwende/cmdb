package resource_directory

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/wend/cmdb-backend/internal/core/host_membership"
	"github.com/wend/cmdb-backend/internal/types"
)

// Service 资源目录管理服务
type Service interface {
	CreateDirectory(ctx context.Context, req *types.CreateResourceDirectoryRequest, createdBy string) (*types.ResourceDirectory, error)
	GetDirectory(ctx context.Context, id uint64) (*types.ResourceDirectory, error)
	ListDirectories(ctx context.Context, parentID *uint64) ([]types.ResourceDirectory, error)
	GetDirectoryTree(ctx context.Context) ([]types.ResourceDirectoryTree, error)
	UpdateDirectory(ctx context.Context, id uint64, req *types.UpdateResourceDirectoryRequest, updatedBy string) (*types.ResourceDirectory, error)
	DeleteDirectory(ctx context.Context, id uint64) error
	MoveDirectory(ctx context.Context, id uint64, req *types.MoveResourceDirectoryRequest) error
	ImportHostsToPool(ctx context.Context, req *types.ImportHostsToPoolRequest, importedBy string) (*types.BatchOperationResult, error)
	MoveHostsInPool(ctx context.Context, req *types.MoveHostsInPoolRequest) (*types.BatchOperationResult, error)
	AllocateHosts(ctx context.Context, req *types.AllocateHostsRequest) (*types.ResourcePoolLifecycleResult, error)
	ReclaimHosts(ctx context.Context, req *types.ReclaimHostsRequest, reclaimedBy string) (*types.ResourcePoolLifecycleResult, error)
	GetHostLifecycle(ctx context.Context, hostID uuid.UUID) (*types.ResourcePoolHostLifecycle, error)
	ListPoolHosts(ctx context.Context, directoryID *uint64, page, pageSize int) ([]types.Host, int64, error)
	GetStatistics(ctx context.Context) (*types.ResourcePoolStatistics, error)
}

type service struct {
	db  *gorm.DB
	hms host_membership.Service // 阶段 1：注入后 allocate/reclaim 走统一归属通道（nil 时回退旧逻辑）
}

const projectionContainsRelType = "contains"

// Option 服务可选项。
type Option func(*service)

// WithHostMembership 注入主机归属统一服务（阶段 1 接入，allocate/reclaim 经单一通道并停写 v2 投影）。
func WithHostMembership(hms host_membership.Service) Option {
	return func(s *service) { s.hms = hms }
}

// NewService 创建服务实例。opts 向后兼容：现有 NewService(db) 调用不受影响。
func NewService(db *gorm.DB, opts ...Option) Service {
	s := &service{db: db}
	for _, o := range opts {
		o(s)
	}
	return s
}

// allocateViaMembership 经统一归属通道把主机分配进业务空闲机模块（阶段 1，修 R1；不再写 v2 投影）。
func (s *service) allocateViaMembership(ctx context.Context, req *types.AllocateHostsRequest) (*types.ResourcePoolLifecycleResult, error) {
	res, err := s.hms.Move(ctx, req.HostIDs,
		host_membership.NodeRef{Kind: types.NodeKindBizModule, ID: req.TargetModuleID},
		host_membership.MoveOptions{Source: types.HostMembershipSourceAllocate, By: "system"})
	if err != nil {
		return nil, err
	}
	return lifecycleResultFrom(res, types.ResourceStatusAllocated), nil
}

// reclaimViaMembership 经统一归属通道把主机回收到资源池目录（阶段 1；不再写 v2 投影）。
func (s *service) reclaimViaMembership(ctx context.Context, req *types.ReclaimHostsRequest, reclaimedBy string) (*types.ResourcePoolLifecycleResult, error) {
	res, err := s.hms.Move(ctx, req.HostIDs,
		host_membership.NodeRef{Kind: types.NodeKindPoolDirectory, ID: req.DirectoryID},
		host_membership.MoveOptions{Source: types.HostMembershipSourceReclaim, By: reclaimedBy})
	if err != nil {
		return nil, err
	}
	return lifecycleResultFrom(res, types.ResourceStatusPooled), nil
}

func lifecycleResultFrom(res *host_membership.Result, status string) *types.ResourcePoolLifecycleResult {
	out := &types.ResourcePoolLifecycleResult{
		Total:          res.Total,
		Successful:     res.Successful,
		Failed:         res.Failed,
		SucceededItems: make([]types.ResourcePoolLifecycleItem, 0),
		FailedItems:    make([]types.ResourcePoolLifecycleItem, 0),
	}
	for _, e := range res.Errors {
		out.FailedItems = append(out.FailedItems, types.ResourcePoolLifecycleItem{ResourceStatus: status, Message: e})
	}
	return out
}

// batchResultFrom 把统一归属通道结果转为批量操作结果（import/move-in-pool 用）。
func batchResultFrom(res *host_membership.Result) *types.BatchOperationResult {
	return &types.BatchOperationResult{
		Total:      res.Total,
		Successful: res.Successful,
		Failed:     res.Failed,
		Errors:     res.Errors,
	}
}

// ========== 资源目录管理 ==========

// CreateDirectory 创建资源目录
func (s *service) CreateDirectory(ctx context.Context, req *types.CreateResourceDirectoryRequest, createdBy string) (*types.ResourceDirectory, error) {
	var parentPath string
	var parentLevel int

	if req.ParentID != nil {
		// 验证父目录存在
		var parent types.ResourceDirectory
		if err := s.db.First(&parent, *req.ParentID).Error; err != nil {
			return nil, fmt.Errorf("父目录不存在: %w", err)
		}
		parentPath = parent.Path
		parentLevel = parent.Level
	}

	dir := &types.ResourceDirectory{
		ParentID:    req.ParentID,
		Name:        req.Name,
		Description: req.Description,
		Path:        parentPath + "/" + req.Name,
		Level:       parentLevel + 1,
		SortOrder:   req.SortOrder,
		CreatedBy:   createdBy,
		UpdatedBy:   createdBy,
	}

	if err := s.db.Create(dir).Error; err != nil {
		return nil, err
	}

	return dir, nil
}

// GetDirectory 获取资源目录
func (s *service) GetDirectory(ctx context.Context, id uint64) (*types.ResourceDirectory, error) {
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, id).Error; err != nil {
		return nil, err
	}

	// 统计子目录数量
	var childCount int64
	s.db.Model(&types.ResourceDirectory{}).Where("parent_id = ?", id).Count(&childCount)
	dir.ChildCount = int(childCount)

	// 统计主机数量（读切换：host_node_memberships pool_directory，node_id 即目录ID）
	var hostCount int64
	s.db.Model(&types.HostNodeMembership{}).
		Where("node_kind = ? AND node_id = ?", types.NodeKindPoolDirectory, id).
		Count(&hostCount)
	dir.HostCount = int(hostCount)

	return &dir, nil
}

// ListDirectories 获取资源目录列表
func (s *service) ListDirectories(ctx context.Context, parentID *uint64) ([]types.ResourceDirectory, error) {
	var dirs []types.ResourceDirectory
	query := s.db.Model(&types.ResourceDirectory{})

	if parentID != nil {
		query = query.Where("parent_id = ?", *parentID)
	} else {
		query = query.Where("parent_id IS NULL")
	}

	if err := query.Order("sort_order ASC, id ASC").Find(&dirs).Error; err != nil {
		return nil, err
	}

	// 填充统计信息
	for i := range dirs {
		var childCount int64
		s.db.Model(&types.ResourceDirectory{}).Where("parent_id = ?", dirs[i].ID).Count(&childCount)
		dirs[i].ChildCount = int(childCount)

		var hostCount int64
		s.db.Model(&types.HostNodeMembership{}).
			Where("node_kind = ? AND node_id = ?", types.NodeKindPoolDirectory, dirs[i].ID).
			Count(&hostCount)
		dirs[i].HostCount = int(hostCount)
	}

	return dirs, nil
}

// GetDirectoryTree 获取目录树
func (s *service) GetDirectoryTree(ctx context.Context) ([]types.ResourceDirectoryTree, error) {
	var allDirs []types.ResourceDirectory
	if err := s.db.Order("level ASC, sort_order ASC, id ASC").Find(&allDirs).Error; err != nil {
		return nil, err
	}

	// 构建目录 ID -> 主机数量映射
	hostCounts := make(map[uint64]int)
	var counts []struct {
		DirectoryID uint64
		Count       int64
	}
	s.db.Model(&types.HostNodeMembership{}).
		Select("node_id as directory_id, count(*) as count").
		Where("node_kind = ?", types.NodeKindPoolDirectory).
		Group("node_id").
		Scan(&counts)
	for _, c := range counts {
		hostCounts[c.DirectoryID] = int(c.Count)
	}

	// 构建树
	dirMap := make(map[uint64]*types.ResourceDirectoryTree)
	var roots []types.ResourceDirectoryTree

	for _, dir := range allDirs {
		node := types.ResourceDirectoryTree{
			ID:          dir.ID,
			Name:        dir.Name,
			Description: dir.Description,
			Path:        dir.Path,
			Level:       dir.Level,
			IsDefault:   dir.IsDefault,
			HostCount:   hostCounts[dir.ID],
			Children:    make([]types.ResourceDirectoryTree, 0),
		}
		dirMap[dir.ID] = &node

		if dir.ParentID == nil {
			roots = append(roots, node)
		}
	}

	// 建立父子关系
	for _, dir := range allDirs {
		if dir.ParentID != nil {
			if parent, ok := dirMap[*dir.ParentID]; ok {
				if child, ok := dirMap[dir.ID]; ok {
					parent.Children = append(parent.Children, *child)
					parent.ChildCount = len(parent.Children)
				}
			}
		}
	}

	// 更新根节点
	for i := range roots {
		if node, ok := dirMap[roots[i].ID]; ok {
			roots[i] = *node
		}
	}

	return roots, nil
}

// UpdateDirectory 更新资源目录
func (s *service) UpdateDirectory(ctx context.Context, id uint64, req *types.UpdateResourceDirectoryRequest, updatedBy string) (*types.ResourceDirectory, error) {
	// 检查是否为默认目录
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, id).Error; err != nil {
		return nil, err
	}
	if dir.IsDefault {
		return nil, fmt.Errorf("默认目录不可修改")
	}

	updates := map[string]interface{}{
		"updated_by": updatedBy,
	}

	if req.Name != nil {
		updates["name"] = *req.Name
		// 更新路径
		pathParts := strings.Split(dir.Path, "/")
		pathParts[len(pathParts)-1] = *req.Name
		updates["path"] = strings.Join(pathParts, "/")
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	if err := s.db.Model(&types.ResourceDirectory{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetDirectory(ctx, id)
}

// DeleteDirectory 删除资源目录
func (s *service) DeleteDirectory(ctx context.Context, id uint64) error {
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, id).Error; err != nil {
		return err
	}

	if dir.IsDefault {
		return fmt.Errorf("默认目录不可删除")
	}

	// 检查是否有子目录
	var childCount int64
	s.db.Model(&types.ResourceDirectory{}).Where("parent_id = ?", id).Count(&childCount)
	if childCount > 0 {
		return fmt.Errorf("目录下还有 %d 个子目录，无法删除", childCount)
	}

	// 检查是否有主机（读切换：host_node_memberships pool_directory）
	var hostCount int64
	s.db.Model(&types.HostNodeMembership{}).
		Where("node_kind = ? AND node_id = ?", types.NodeKindPoolDirectory, id).
		Count(&hostCount)
	if hostCount > 0 {
		return fmt.Errorf("目录下还有 %d 台主机，无法删除", hostCount)
	}

	return s.db.Delete(&types.ResourceDirectory{}, id).Error
}

// MoveDirectory 移动目录
func (s *service) MoveDirectory(ctx context.Context, id uint64, req *types.MoveResourceDirectoryRequest) error {
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, id).Error; err != nil {
		return err
	}

	if dir.IsDefault {
		return fmt.Errorf("默认目录不可移动")
	}

	var newPath string
	var newLevel int

	if req.NewParentID != nil {
		// 验证新父目录
		var newParent types.ResourceDirectory
		if err := s.db.First(&newParent, *req.NewParentID).Error; err != nil {
			return fmt.Errorf("目标目录不存在")
		}

		// 防止循环引用
		if newParent.ID == id {
			return fmt.Errorf("不能将目录移动到自身")
		}
		if strings.HasPrefix(newParent.Path, dir.Path+"/") {
			return fmt.Errorf("不能将目录移动到其子目录下")
		}

		newPath = newParent.Path + "/" + dir.Name
		newLevel = newParent.Level + 1
	} else {
		newPath = "/" + dir.Name
		newLevel = 1
	}

	return s.db.Model(&types.ResourceDirectory{}).Where("id = ?", id).Updates(map[string]interface{}{
		"parent_id": req.NewParentID,
		"path":      newPath,
		"level":     newLevel,
	}).Error
}

// ========== 资源池主机管理 ==========

// ImportHostsToPool 导入主机到资源池
func (s *service) ImportHostsToPool(ctx context.Context, req *types.ImportHostsToPoolRequest, importedBy string) (*types.BatchOperationResult, error) {
	// 验证目录存在
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, req.DirectoryID).Error; err != nil {
		return nil, fmt.Errorf("目录不存在")
	}

	result := &types.BatchOperationResult{
		Total:  len(req.HostIDs),
		Errors: make([]string, 0),
	}

	for _, hostID := range req.HostIDs {
		// 验证主机存在
		var host types.Host
		if err := s.db.Where("id = ?", hostID).First(&host).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: 不存在", hostID))
			continue
		}

		// 已分配到业务则拒绝（须先回收）
		var bizRelCount int64
		if err := s.db.Model(&types.HostNodeMembership{}).Where("host_id = ? AND node_kind = ?", hostID, types.NodeKindBizModule).Count(&bizRelCount).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
			continue
		}
		if bizRelCount > 0 {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: 已分配到业务，请先回收", hostID))
			continue
		}

		// 写收敛（阶段2）：经统一归属通道导入到目标资源池目录（Move 兼容新导入与改目录；mirror 仍写旧表作安全网）。
		res, err := s.hms.Move(ctx, []uuid.UUID{hostID},
			host_membership.NodeRef{Kind: types.NodeKindPoolDirectory, ID: req.DirectoryID},
			host_membership.MoveOptions{Source: types.HostMembershipSourceImport, By: importedBy})
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
			continue
		}
		if res.Failed > 0 {
			result.Failed++
			msg := "导入失败"
			if len(res.Errors) > 0 {
				msg = res.Errors[0]
			}
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, msg))
			continue
		}
		result.Successful++
	}

	return result, nil
}

// MoveHostsInPool 在资源池内移动主机
func (s *service) MoveHostsInPool(ctx context.Context, req *types.MoveHostsInPoolRequest) (*types.BatchOperationResult, error) {
	// 验证目标目录存在
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, req.TargetDirectoryID).Error; err != nil {
		return nil, fmt.Errorf("目标目录不存在")
	}

	// 写收敛（阶段2）：经统一归属通道把主机移到目标资源池目录（Move 删旧 pool 行+增新；mirror 仍写旧表作安全网）。
	res, err := s.hms.Move(ctx, req.HostIDs,
		host_membership.NodeRef{Kind: types.NodeKindPoolDirectory, ID: req.TargetDirectoryID},
		host_membership.MoveOptions{Source: types.HostMembershipSourceTransfer, By: "system"})
	if err != nil {
		return nil, err
	}
	return batchResultFrom(res), nil
}

// AllocateHosts 分配主机到业务模块
func (s *service) AllocateHosts(ctx context.Context, req *types.AllocateHostsRequest) (*types.ResourcePoolLifecycleResult, error) {
	// 阶段 1：注入统一归属通道后，分配到业务空闲机经 HostMembershipService
	// （主机进该业务空闲机模块 + 移出资源池，原子；不再依赖/阻断于 v2 投影，修 R1）。
	if s.hms != nil {
		return s.allocateViaMembership(ctx, req)
	}

	// 验证目标模块存在
	var module types.Module
	if err := s.db.First(&module, req.TargetModuleID).Error; err != nil {
		return nil, fmt.Errorf("目标模块不存在")
	}

	result := &types.ResourcePoolLifecycleResult{
		Total:          len(req.HostIDs),
		SucceededItems: make([]types.ResourcePoolLifecycleItem, 0),
		FailedItems:    make([]types.ResourcePoolLifecycleItem, 0),
	}

	for _, hostID := range req.HostIDs {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// 验证主机在资源池中
			var poolHost types.ResourcePoolHost
			if err := tx.Where("host_id = ?", hostID).First(&poolHost).Error; err != nil {
				return fmt.Errorf("主机不在资源池中")
			}

			// 建立主机与模块的关联（多对多）
			moduleRel := &types.HostModuleRelation{
				HostID:   hostID,
				ModuleID: req.TargetModuleID,
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(moduleRel).Error; err != nil {
				return err
			}

			// 建立主机与业务的关联（多对多）
			bizRel := &types.HostBusinessRelation{
				HostID:     hostID,
				BusinessID: module.BusinessID,
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(bizRel).Error; err != nil {
				return err
			}

			if err := s.attachProjectionHostToModule(tx, hostID, module); err != nil {
				return err
			}

			// 从资源池移除
			return tx.Delete(&poolHost).Error
		})

		if err != nil {
			result.Failed++
			item, lookupErr := s.GetHostLifecycle(ctx, hostID)
			if lookupErr != nil {
				result.FailedItems = append(result.FailedItems, types.ResourcePoolLifecycleItem{
					HostID:         hostID.String(),
					ResourceStatus: types.ResourceStatusUnknown,
					Message:        err.Error(),
				})
			} else {
				result.FailedItems = append(result.FailedItems, types.ResourcePoolLifecycleItem{
					HostID:         item.HostID,
					ResourceStatus: item.ResourceStatus,
					DirectoryID:    item.DirectoryID,
					Message:        err.Error(),
				})
			}
		} else {
			result.Successful++
			result.SucceededItems = append(result.SucceededItems, types.ResourcePoolLifecycleItem{
				HostID:         hostID.String(),
				ResourceStatus: types.ResourceStatusAllocated,
				BusinessID:     fmt.Sprintf("%d", module.BusinessID),
				ModuleID:       req.TargetModuleID,
			})
		}
	}

	return result, nil
}

// ReclaimHosts 回收主机到资源池
func (s *service) ReclaimHosts(ctx context.Context, req *types.ReclaimHostsRequest, reclaimedBy string) (*types.ResourcePoolLifecycleResult, error) {
	// 阶段 1：注入统一归属通道后，回收经 HostMembershipService（不再写 v2 投影）。
	if s.hms != nil {
		return s.reclaimViaMembership(ctx, req, reclaimedBy)
	}

	// 验证目录存在
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, req.DirectoryID).Error; err != nil {
		return nil, fmt.Errorf("目录不存在")
	}

	result := &types.ResourcePoolLifecycleResult{
		Total:          len(req.HostIDs),
		SucceededItems: make([]types.ResourcePoolLifecycleItem, 0),
		FailedItems:    make([]types.ResourcePoolLifecycleItem, 0),
	}

	for _, hostID := range req.HostIDs {
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// 清除主机的业务和模块关联（多对多）
			if err := tx.Where("host_id = ?", hostID).Delete(&types.HostModuleRelation{}).Error; err != nil {
				return err
			}
			if err := tx.Where("host_id = ?", hostID).Delete(&types.HostBusinessRelation{}).Error; err != nil {
				return err
			}
			if err := s.detachProjectionHostFromTopology(tx, hostID, req.DirectoryID); err != nil {
				return err
			}

			// 添加到资源池
			poolHost := &types.ResourcePoolHost{
				HostID:      hostID,
				DirectoryID: req.DirectoryID,
				ImportedAt:  time.Now(),
				ImportedBy:  reclaimedBy,
				Remark:      req.Remark,
			}

			return tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{{Name: "host_id"}},
				DoUpdates: clause.AssignmentColumns([]string{
					"directory_id",
					"imported_at",
					"imported_by",
					"remark",
				}),
			}).Create(poolHost).Error
		})

		if err != nil {
			result.Failed++
			item, lookupErr := s.GetHostLifecycle(ctx, hostID)
			if lookupErr != nil {
				result.FailedItems = append(result.FailedItems, types.ResourcePoolLifecycleItem{
					HostID:         hostID.String(),
					ResourceStatus: types.ResourceStatusUnknown,
					Message:        err.Error(),
				})
			} else {
				result.FailedItems = append(result.FailedItems, types.ResourcePoolLifecycleItem{
					HostID:         item.HostID,
					ResourceStatus: item.ResourceStatus,
					DirectoryID:    item.DirectoryID,
					Message:        err.Error(),
				})
			}
		} else {
			result.Successful++
			result.SucceededItems = append(result.SucceededItems, types.ResourcePoolLifecycleItem{
				HostID:         hostID.String(),
				ResourceStatus: types.ResourceStatusPooled,
				DirectoryID:    req.DirectoryID,
			})
		}
	}

	return result, nil
}

func (s *service) attachProjectionHostToModule(tx *gorm.DB, hostID uuid.UUID, module types.Module) error {
	moduleResource, err := s.findProjectionModuleByRef(tx, fmt.Sprintf("%d", module.ID))
	if err != nil {
		if isMissingProjectionTableError(err) {
			return nil
		}
		return fmt.Errorf("目标模块投影不存在")
	}

	hostResource, err := s.ensureProjectionHostResource(tx, hostID)
	if err != nil {
		if isMissingProjectionTableError(err) {
			return nil
		}
		return err
	}

	if err := tx.Where("to_id = ? AND rel_type = ?", hostResource.ID, projectionContainsRelType).
		Delete(&types.EdgeV2{}).Error; err != nil {
		if isMissingProjectionTableError(err) {
			return nil
		}
		return err
	}

	if err := tx.Create(&types.EdgeV2{
		FromID:  moduleResource.ID,
		ToID:    hostResource.ID,
		RelType: projectionContainsRelType,
		Data:    map[string]any{},
	}).Error; err != nil {
		return err
	}

	spec := cloneProjectionSpec(hostResource.Spec)
	spec["business_id"] = fmt.Sprintf("%d", module.BusinessID)
	spec["module_id"] = fmt.Sprintf("%d", module.ID)
	spec["set_id"] = fmt.Sprintf("%d", module.SetID)
	spec["in_idle_pool"] = module.IsDefault
	delete(spec, "in_resource_pool")
	delete(spec, "directory_id")

	encodedSpec, err := marshalProjectionSpec(spec)
	if err != nil {
		return err
	}
	return tx.Model(&types.ResourceV2{}).
		Where("id = ?", hostResource.ID).
		Update("spec", encodedSpec).Error
}

func (s *service) findProjectionModuleByRef(tx *gorm.DB, refID string) (*types.ResourceV2, error) {
	var item types.ResourceV2
	query := tx.Where("type_name = ?", string(types.NodeTypeModule)).
		Where("deleted_at IS NULL")
	if tx.Dialector.Name() == "sqlite" {
		query = query.Where("json_extract(spec, '$.ref_id') = ?", refID)
	} else {
		query = query.Where("spec ->> 'ref_id' = ?", refID)
	}
	if err := query.First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) ensureProjectionHostResource(tx *gorm.DB, hostID uuid.UUID) (*types.ResourceV2, error) {
	hostResource, err := s.findProjectionHostByRef(tx, hostID.String())
	if err == nil {
		return hostResource, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var host types.Host
	if err := tx.Where("id = ?", hostID).First(&host).Error; err != nil {
		return nil, fmt.Errorf("主机投影不存在且主机记录不存在")
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
		if err := tx.Where("id = ?", *host.CloudAreaID).First(&cloudArea).Error; err == nil {
			spec["cloud_area_name"] = cloudArea.Name
		}
	}

	item := &types.ResourceV2{
		ID:       uuid.NewString(),
		TypeName: string(types.NodeTypeHost),
		Name:     host.HostName,
		Spec:     spec,
		Status:   map[string]any{},
		Labels:   map[string]any{},
	}
	if err := tx.Create(item).Error; err != nil {
		return nil, err
	}
	return item, nil
}

func (s *service) detachProjectionHostFromTopology(tx *gorm.DB, hostID uuid.UUID, directoryID uint64) error {
	hostResource, err := s.findProjectionHostByRef(tx, hostID.String())
	if err != nil {
		if err == gorm.ErrRecordNotFound || isMissingProjectionTableError(err) {
			return nil
		}
		return err
	}

	if err := tx.Where("to_id = ? AND rel_type = ?", hostResource.ID, projectionContainsRelType).
		Delete(&types.EdgeV2{}).Error; err != nil {
		if isMissingProjectionTableError(err) {
			return nil
		}
		return err
	}

	spec := cloneProjectionSpec(hostResource.Spec)
	for _, key := range []string{
		"business_id",
		"module_id",
		"set_id",
		"bk_biz_id",
		"bk_module_id",
		"bk_set_id",
	} {
		delete(spec, key)
	}
	spec["in_idle_pool"] = false
	spec["in_resource_pool"] = true
	spec["directory_id"] = directoryID

	encodedSpec, err := marshalProjectionSpec(spec)
	if err != nil {
		return err
	}
	return tx.Model(&types.ResourceV2{}).
		Where("id = ?", hostResource.ID).
		Update("spec", encodedSpec).Error
}

func (s *service) findProjectionHostByRef(tx *gorm.DB, refID string) (*types.ResourceV2, error) {
	var item types.ResourceV2
	query := tx.Where("type_name = ?", string(types.NodeTypeHost)).
		Where("deleted_at IS NULL")
	if tx.Dialector.Name() == "sqlite" {
		query = query.Where("json_extract(spec, '$.ref_id') = ?", refID)
	} else {
		query = query.Where("spec ->> 'ref_id' = ?", refID)
	}
	if err := query.First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func cloneProjectionSpec(input map[string]any) map[string]any {
	output := make(map[string]any, len(input)+2)
	for key, value := range input {
		output[key] = value
	}
	return output
}

func marshalProjectionSpec(input map[string]any) (datatypes.JSON, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	return datatypes.JSON(data), nil
}

func isMissingProjectionTableError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "no such table") || strings.Contains(message, "does not exist")
}

func (s *service) GetHostLifecycle(ctx context.Context, hostID uuid.UUID) (*types.ResourcePoolHostLifecycle, error) {
	var poolHost types.ResourcePoolHost
	if err := s.db.WithContext(ctx).Where("host_id = ?", hostID).First(&poolHost).Error; err == nil {
		return &types.ResourcePoolHostLifecycle{
			HostID:         hostID.String(),
			ResourceStatus: types.ResourceStatusPooled,
			DirectoryID:    poolHost.DirectoryID,
			AllowedActions: []string{"allocate", "move"},
		}, nil
	} else if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var bizRelations []types.HostBusinessRelation
	if err := s.db.WithContext(ctx).Where("host_id = ?", hostID).Find(&bizRelations).Error; err != nil {
		return nil, err
	}

	var moduleRelations []types.HostModuleRelation
	if err := s.db.WithContext(ctx).Where("host_id = ?", hostID).Find(&moduleRelations).Error; err != nil {
		return nil, err
	}

	if len(bizRelations) > 0 || len(moduleRelations) > 0 {
		businessIDs := make([]string, 0, len(bizRelations))
		for _, item := range bizRelations {
			businessIDs = append(businessIDs, fmt.Sprintf("%d", item.BusinessID))
		}

		moduleIDs := make([]uint64, 0, len(moduleRelations))
		for _, item := range moduleRelations {
			moduleIDs = append(moduleIDs, item.ModuleID)
		}

		return &types.ResourcePoolHostLifecycle{
			HostID:         hostID.String(),
			ResourceStatus: types.ResourceStatusAllocated,
			BusinessIDs:    businessIDs,
			ModuleIDs:      moduleIDs,
			AllowedActions: []string{"reclaim"},
		}, nil
	}

	return &types.ResourcePoolHostLifecycle{
		HostID:         hostID.String(),
		ResourceStatus: types.ResourceStatusUnknown,
		AllowedActions: []string{},
	}, nil
}

// ListPoolHosts 获取资源池主机列表
func (s *service) ListPoolHosts(ctx context.Context, directoryID *uint64, page, pageSize int) ([]types.Host, int64, error) {
	var total int64
	var poolMemberships []types.HostNodeMembership

	// 读切换：资源池主机列表读 host_node_memberships pool_directory（node_id 即目录ID）
	query := s.db.Model(&types.HostNodeMembership{}).Where("node_kind = ?", types.NodeKindPoolDirectory)
	if directoryID != nil {
		query = query.Where("node_id = ?", *directoryID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&poolMemberships).Error; err != nil {
		return nil, 0, err
	}

	// 获取主机详情
	hostIDs := make([]uuid.UUID, 0, len(poolMemberships))
	for _, ph := range poolMemberships {
		hostIDs = append(hostIDs, ph.HostID)
	}

	hosts := make([]types.Host, 0)
	if len(hostIDs) > 0 {
		if err := s.db.Where("id IN ?", hostIDs).Find(&hosts).Error; err != nil {
			return nil, 0, err
		}

		// 批量加载 CloudArea，填充 host.CloudArea（用于前端展示名称，避免只返回 UUID）
		cloudAreaIDs := make([]uuid.UUID, 0, len(hosts))
		for _, h := range hosts {
			if h.CloudAreaID != nil {
				cloudAreaIDs = append(cloudAreaIDs, *h.CloudAreaID)
			}
		}
		if len(cloudAreaIDs) > 0 {
			var cloudAreas []types.CloudArea
			if err := s.db.WithContext(ctx).Where("id IN ?", cloudAreaIDs).Find(&cloudAreas).Error; err == nil {
				caMap := make(map[uuid.UUID]*types.CloudArea, len(cloudAreas))
				for i := range cloudAreas {
					caMap[cloudAreas[i].ID] = &cloudAreas[i]
				}
				for i := range hosts {
					if hosts[i].CloudAreaID != nil {
						hosts[i].CloudArea = caMap[*hosts[i].CloudAreaID]
					}
				}
			}
		}
	}

	return hosts, total, nil
}

// GetStatistics 获取资源池统计
func (s *service) GetStatistics(ctx context.Context) (*types.ResourcePoolStatistics, error) {
	stats := &types.ResourcePoolStatistics{
		ByDirectory: make(map[string]int),
	}

	// 目录总数
	var dirCount int64
	s.db.Model(&types.ResourceDirectory{}).Count(&dirCount)
	stats.TotalDirectories = int(dirCount)

	// 主机总数（读切换：host_node_memberships pool_directory）
	var hostCount int64
	s.db.Model(&types.HostNodeMembership{}).
		Where("node_kind = ?", types.NodeKindPoolDirectory).
		Count(&hostCount)
	stats.TotalHosts = int(hostCount)

	// 按目录统计（读切换：host_node_memberships pool_directory，node_id 即目录ID）
	var results []struct {
		DirName string
		Count   int64
	}
	s.db.Model(&types.HostNodeMembership{}).
		Select("resource_directories.name as dir_name, count(*) as count").
		Joins("JOIN resource_directories ON resource_directories.id = host_node_memberships.node_id").
		Where("host_node_memberships.node_kind = ?", types.NodeKindPoolDirectory).
		Group("resource_directories.name").
		Scan(&results)

	for _, r := range results {
		stats.ByDirectory[r.DirName] = int(r.Count)
	}

	return stats, nil
}
