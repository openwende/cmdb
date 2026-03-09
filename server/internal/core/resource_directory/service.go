package resource_directory

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/wend/cmdb-backend/internal/types"
)

// Service 资源目录管理服务
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

// ========== 资源目录管理 ==========

// CreateDirectory 创建资源目录
func (s *Service) CreateDirectory(ctx context.Context, req *types.CreateResourceDirectoryRequest, createdBy string) (*types.ResourceDirectory, error) {
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
func (s *Service) GetDirectory(ctx context.Context, id uint64) (*types.ResourceDirectory, error) {
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, id).Error; err != nil {
		return nil, err
	}

	// 统计子目录数量
	var childCount int64
	s.db.Model(&types.ResourceDirectory{}).Where("parent_id = ?", id).Count(&childCount)
	dir.ChildCount = int(childCount)

	// 统计主机数量
	var hostCount int64
	s.db.Model(&types.ResourcePoolHost{}).Where("directory_id = ?", id).Count(&hostCount)
	dir.HostCount = int(hostCount)

	return &dir, nil
}

// ListDirectories 获取资源目录列表
func (s *Service) ListDirectories(ctx context.Context, parentID *uint64) ([]types.ResourceDirectory, error) {
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
		s.db.Model(&types.ResourcePoolHost{}).Where("directory_id = ?", dirs[i].ID).Count(&hostCount)
		dirs[i].HostCount = int(hostCount)
	}

	return dirs, nil
}

// GetDirectoryTree 获取目录树
func (s *Service) GetDirectoryTree(ctx context.Context) ([]types.ResourceDirectoryTree, error) {
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
	s.db.Model(&types.ResourcePoolHost{}).
		Select("directory_id, count(*) as count").
		Group("directory_id").
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
func (s *Service) UpdateDirectory(ctx context.Context, id uint64, req *types.UpdateResourceDirectoryRequest, updatedBy string) (*types.ResourceDirectory, error) {
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
func (s *Service) DeleteDirectory(ctx context.Context, id uint64) error {
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

	// 检查是否有主机
	var hostCount int64
	s.db.Model(&types.ResourcePoolHost{}).Where("directory_id = ?", id).Count(&hostCount)
	if hostCount > 0 {
		return fmt.Errorf("目录下还有 %d 台主机，无法删除", hostCount)
	}

	return s.db.Delete(&types.ResourceDirectory{}, id).Error
}

// MoveDirectory 移动目录
func (s *Service) MoveDirectory(ctx context.Context, id uint64, req *types.MoveResourceDirectoryRequest) error {
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
func (s *Service) ImportHostsToPool(ctx context.Context, req *types.ImportHostsToPoolRequest, importedBy string) (*types.BatchOperationResult, error) {
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

		// 检查主机是否已分配到业务（多对多关系）
		var bizRelCount int64
		if err := s.db.Model(&types.HostBusinessRelation{}).Where("host_id = ?", hostID).Count(&bizRelCount).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
			continue
		}
		if bizRelCount > 0 {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: 已分配到业务，请先回收", hostID))
			continue
		}

		// 检查是否已在资源池
		var existing types.ResourcePoolHost
		if err := s.db.Where("host_id = ?", hostID).First(&existing).Error; err == nil {
			// 已存在，更新目录
			if err := s.db.Model(&existing).Updates(map[string]interface{}{
				"directory_id": req.DirectoryID,
				"imported_by":  importedBy,
				"remark":       req.Remark,
			}).Error; err != nil {
				result.Failed++
				result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
			} else {
				result.Successful++
			}
			continue
		}

		// 新增资源池记录
		poolHost := &types.ResourcePoolHost{
			HostID:      hostID,
			DirectoryID: req.DirectoryID,
			ImportedAt:  time.Now(),
			ImportedBy:  importedBy,
			Remark:      req.Remark,
		}

		if err := s.db.Create(poolHost).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// MoveHostsInPool 在资源池内移动主机
func (s *Service) MoveHostsInPool(ctx context.Context, req *types.MoveHostsInPoolRequest) (*types.BatchOperationResult, error) {
	// 验证目标目录存在
	var dir types.ResourceDirectory
	if err := s.db.First(&dir, req.TargetDirectoryID).Error; err != nil {
		return nil, fmt.Errorf("目标目录不存在")
	}

	result := &types.BatchOperationResult{
		Total:  len(req.HostIDs),
		Errors: make([]string, 0),
	}

	for _, hostID := range req.HostIDs {
		if err := s.db.Model(&types.ResourcePoolHost{}).
			Where("host_id = ?", hostID).
			Update("directory_id", req.TargetDirectoryID).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// AllocateHosts 分配主机到业务模块
func (s *Service) AllocateHosts(ctx context.Context, req *types.AllocateHostsRequest) (*types.BatchOperationResult, error) {
	// 验证目标模块存在
	var module types.Module
	if err := s.db.First(&module, req.TargetModuleID).Error; err != nil {
		return nil, fmt.Errorf("目标模块不存在")
	}

	result := &types.BatchOperationResult{
		Total:  len(req.HostIDs),
		Errors: make([]string, 0),
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

			// 从资源池移除
			return tx.Delete(&poolHost).Error
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

// ReclaimHosts 回收主机到资源池
func (s *Service) ReclaimHosts(ctx context.Context, req *types.ReclaimHostsRequest, reclaimedBy string) (*types.BatchOperationResult, error) {
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
		err := s.db.Transaction(func(tx *gorm.DB) error {
			// 清除主机的业务和模块关联（多对多）
			if err := tx.Where("host_id = ?", hostID).Delete(&types.HostModuleRelation{}).Error; err != nil {
				return err
			}
			if err := tx.Where("host_id = ?", hostID).Delete(&types.HostBusinessRelation{}).Error; err != nil {
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

			return tx.Create(poolHost).Error
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

// ListPoolHosts 获取资源池主机列表
func (s *Service) ListPoolHosts(ctx context.Context, directoryID *uint64, page, pageSize int) ([]types.Host, int64, error) {
	var total int64
	var poolHosts []types.ResourcePoolHost

	query := s.db.Model(&types.ResourcePoolHost{})
	if directoryID != nil {
		query = query.Where("directory_id = ?", *directoryID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Find(&poolHosts).Error; err != nil {
		return nil, 0, err
	}

	// 获取主机详情
	hostIDs := make([]uuid.UUID, 0, len(poolHosts))
	for _, ph := range poolHosts {
		hostIDs = append(hostIDs, ph.HostID)
	}

	var hosts []types.Host
	if len(hostIDs) > 0 {
		if err := s.db.Where("id IN ?", hostIDs).Find(&hosts).Error; err != nil {
			return nil, 0, err
		}
	}

	return hosts, total, nil
}

// GetStatistics 获取资源池统计
func (s *Service) GetStatistics(ctx context.Context) (*types.ResourcePoolStatistics, error) {
	stats := &types.ResourcePoolStatistics{
		ByDirectory: make(map[string]int),
	}

	// 目录总数
	var dirCount int64
	s.db.Model(&types.ResourceDirectory{}).Count(&dirCount)
	stats.TotalDirectories = int(dirCount)

	// 主机总数
	var hostCount int64
	s.db.Model(&types.ResourcePoolHost{}).Count(&hostCount)
	stats.TotalHosts = int(hostCount)

	// 按目录统计
	var results []struct {
		DirName string
		Count   int64
	}
	s.db.Model(&types.ResourcePoolHost{}).
		Select("resource_directories.name as dir_name, count(*) as count").
		Joins("JOIN resource_directories ON resource_directories.id = resource_pool_hosts.directory_id").
		Group("resource_directories.name").
		Scan(&results)

	for _, r := range results {
		stats.ByDirectory[r.DirName] = int(r.Count)
	}

	return stats, nil
}
