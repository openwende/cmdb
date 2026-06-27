package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// HostRepository 主机数据仓库接口
type HostRepository interface {
	CreateHost(ctx context.Context, tenantID uuid.UUID, req *types.CreateHostRequest, createdBy *uuid.UUID) (*types.Host, error)
	BatchCreateHosts(ctx context.Context, tenantID uuid.UUID, hosts []*types.Host) error
	GetHost(ctx context.Context, id uuid.UUID) (*types.Host, error)
	GetHostByCloudInstance(ctx context.Context, cloudVendor, cloudInstanceID string) (*types.Host, error)
	GetHostByCloudAreaIP(ctx context.Context, cloudAreaID uuid.UUID, primaryIP string) (*types.Host, error)
	ListHosts(ctx context.Context, tenantID uuid.UUID, params *types.HostQueryParams) ([]types.Host, int64, error)
	UpdateHost(ctx context.Context, id uuid.UUID, req *types.UpdateHostRequest, updatedBy *uuid.UUID) (*types.Host, error)
	UpdateCustomFields(ctx context.Context, id uuid.UUID, customFields map[string]interface{}, updatedBy *uuid.UUID) (*types.Host, error)
	MarkAsDestroyed(ctx context.Context, id uuid.UUID) error
	DeleteHost(ctx context.Context, id uuid.UUID) error
	CheckIPConflict(ctx context.Context, cloudAreaID *uuid.UUID, primaryIP string, excludeHostID *uuid.UUID) (bool, error)
	HostStatistics(ctx context.Context) (*types.HostStatistics, error)
}

type hostRepository struct {
	db *gorm.DB
}

// NewHostRepository 创建主机仓库实例
func NewHostRepository(db *gorm.DB) HostRepository {
	return &hostRepository{db: db}
}

// CreateHost 创建主机
func (r *hostRepository) CreateHost(ctx context.Context, tenantID uuid.UUID, req *types.CreateHostRequest, createdBy *uuid.UUID) (*types.Host, error) {
	// 设置默认状态
	status := types.HostStatusRunning
	if req.Status != nil {
		status = *req.Status
	}

	host := &types.Host{
		ID:              uuid.New(),
		TenantID:        tenantID,
		CreatedBy:       createdBy,
		CloudAreaID:     req.CloudAreaID,
		HostName:        req.HostName,
		PrimaryIP:       req.PrimaryIP,
		IPAddresses:     types.StringArray(req.IPAddresses),
		CloudVendor:     req.CloudVendor,
		CloudInstanceID: req.CloudInstanceID,
		CloudRegion:     req.CloudRegion,
		VPCID:           req.VPCID,
		SubnetID:        req.SubnetID,
		CPU:             req.CPU,
		Memory:          req.Memory,
		DiskSize:        req.DiskSize,
		OSType:          req.OSType,
		OSVersion:       req.OSVersion,
		Status:          status,
		IsDestroyed:     false,
		CustomFields:    req.CustomFields,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	// 主机创建即入资源池目录由上层(导入流程)经 HostMembershipService 处理；此处只落 host 本体。
	if err := r.db.WithContext(ctx).Create(host).Error; err != nil {
		return nil, err
	}

	return r.GetHost(ctx, host.ID)
}

// BatchCreateHosts 批量创建主机
func (r *hostRepository) BatchCreateHosts(ctx context.Context, tenantID uuid.UUID, hosts []*types.Host) error {
	if len(hosts) == 0 {
		return nil
	}

	// 设置租户ID和时间戳
	now := time.Now()
	for _, host := range hosts {
		if host.ID == uuid.Nil {
			host.ID = uuid.New()
		}
		host.TenantID = tenantID
		host.CreatedAt = now
		host.UpdatedAt = now
	}

	// 批量插入（每次500条）
	batchSize := 500
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return tx.CreateInBatches(hosts, batchSize).Error
	})
}

// GetHost 根据ID获取主机
func (r *hostRepository) GetHost(ctx context.Context, id uuid.UUID) (*types.Host, error) {
	var host types.Host
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		First(&host).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("host not found")
		}
		return nil, err
	}

	if err := r.fillHostRelations(ctx, []*types.Host{&host}); err != nil {
		return nil, err
	}
	return &host, nil
}

// GetHostByCloudInstance 根据云实例ID获取主机
func (r *hostRepository) GetHostByCloudInstance(ctx context.Context, cloudVendor, cloudInstanceID string) (*types.Host, error) {
	var host types.Host
	err := r.db.WithContext(ctx).
		Where("cloud_vendor = ? AND cloud_instance_id = ? AND deleted_at IS NULL", cloudVendor, cloudInstanceID).
		First(&host).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("host not found")
		}
		return nil, err
	}

	return &host, nil
}

// GetHostByCloudAreaIP 根据云区域和IP获取主机（类似蓝鲸的 bk_cloud_id + bk_host_innerip）
func (r *hostRepository) GetHostByCloudAreaIP(ctx context.Context, cloudAreaID uuid.UUID, primaryIP string) (*types.Host, error) {
	var host types.Host
	err := r.db.WithContext(ctx).
		Where("cloud_area_id = ? AND primary_ip = ? AND deleted_at IS NULL AND is_destroyed = false", cloudAreaID, primaryIP).
		First(&host).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("host not found")
		}
		return nil, err
	}

	return &host, nil
}

// ListHosts 获取主机列表
func (r *hostRepository) ListHosts(ctx context.Context, tenantID uuid.UUID, params *types.HostQueryParams) ([]types.Host, int64, error) {
	query := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("hosts.tenant_id = ? AND hosts.deleted_at IS NULL", tenantID)

	// 应用过滤条件
	if params.CloudAreaID != nil {
		query = query.Where("cloud_area_id = ?", *params.CloudAreaID)
	}
	if params.BusinessID != nil {
		// 读切换：业务过滤读 host_node_memberships biz_module 的冗余列 business_id；
		// 一主机多模块同业务会多行，count/find 已 Distinct(hosts.id) 去重。
		query = query.
			Joins("JOIN host_node_memberships hnm ON hnm.host_id = hosts.id AND hnm.node_kind = ?", types.NodeKindBizModule).
			Where("hnm.business_id = ?", *params.BusinessID)
	}
	// 资源池查询（无业务模块归属者）：读切换为 LEFT JOIN host_node_memberships(biz_module) IS NULL。
	// node_kind 过滤必须放 ON 子句，否则 LEFT JOIN 退化为内连接。
	if params.InPool != nil && *params.InPool {
		query = query.
			Joins("LEFT JOIN host_node_memberships hnm_pool ON hnm_pool.host_id = hosts.id AND hnm_pool.node_kind = ?", types.NodeKindBizModule).
			Where("hnm_pool.host_id IS NULL")
	}
	if params.CloudVendor != nil {
		query = query.Where("hosts.cloud_vendor = ?", *params.CloudVendor)
	}
	if params.CloudInstanceID != nil {
		query = query.Where("hosts.cloud_instance_id = ?", *params.CloudInstanceID)
	}
	if params.Status != nil {
		query = query.Where("hosts.status = ?", *params.Status)
	}
	if params.OSType != nil {
		query = query.Where("hosts.os_type = ?", *params.OSType)
	}
	if !params.IncludeDestroyed {
		query = query.Where("hosts.is_destroyed = false")
	}

	// 获取总数
	var total int64
	if err := query.Distinct("hosts.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 应用分页
	page := 1
	pageSize := 20
	if params.Page > 0 {
		page = params.Page
	}
	if params.PageSize > 0 {
		pageSize = params.PageSize
	}

	var hosts []types.Host
	err := query.
		Select("hosts.*").
		Distinct().
		Order("hosts.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&hosts).Error

	if err != nil {
		return nil, 0, err
	}

	hostPtrs := make([]*types.Host, 0, len(hosts))
	for i := range hosts {
		hostPtrs = append(hostPtrs, &hosts[i])
	}
	if err := r.fillHostRelations(ctx, hostPtrs); err != nil {
		return nil, 0, err
	}

	return hosts, total, nil
}

// UpdateHost 更新主机
func (r *hostRepository) UpdateHost(ctx context.Context, id uuid.UUID, req *types.UpdateHostRequest, updatedBy *uuid.UUID) (*types.Host, error) {
	// 先获取现有记录（验证存在性）
	_, err := r.GetHost(ctx, id)
	if err != nil {
		return nil, err
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	updates["updated_at"] = time.Now()
	if updatedBy != nil {
		updates["updated_by"] = *updatedBy
	}

	if req.HostName != nil {
		updates["host_name"] = *req.HostName
	}
	if req.CloudAreaID != nil {
		updates["cloud_area_id"] = *req.CloudAreaID
	}
	if req.PrimaryIP != nil {
		updates["primary_ip"] = *req.PrimaryIP
	}
	if req.IPAddresses != nil {
		updates["ip_addresses"] = types.StringArray(*req.IPAddresses)
	}
	if req.CPU != nil {
		updates["cpu"] = *req.CPU
	}
	if req.Memory != nil {
		updates["memory"] = *req.Memory
	}
	if req.DiskSize != nil {
		updates["disk_size"] = *req.DiskSize
	}
	if req.OSType != nil {
		updates["os_type"] = *req.OSType
	}
	if req.OSVersion != nil {
		updates["os_version"] = *req.OSVersion
	}
	if req.Status != nil {
		updates["status"] = *req.Status
	}
	if req.CustomFields != nil {
		updates["custom_fields"] = req.CustomFields
	}

	// 执行更新（业务归属变更经 HostMembershipService，不在此落）
	if err := r.db.WithContext(ctx).Model(&types.Host{}).
		Where("id = ?", id).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	// 重新获取更新后的数据
	return r.GetHost(ctx, id)
}

// UpdateCustomFields 更新主机自定义字段
func (r *hostRepository) UpdateCustomFields(ctx context.Context, id uuid.UUID, customFields map[string]interface{}, updatedBy *uuid.UUID) (*types.Host, error) {
	// 先获取现有记录
	host, err := r.GetHost(ctx, id)
	if err != nil {
		return nil, err
	}

	// 合并自定义字段（保留原有字段，更新新字段）
	if host.CustomFields == nil {
		host.CustomFields = make(map[string]interface{})
	}
	for k, v := range customFields {
		host.CustomFields[k] = v
	}

	// 构建更新数据
	updates := map[string]interface{}{
		"custom_fields": host.CustomFields,
		"updated_at":    time.Now(),
	}
	if updatedBy != nil {
		updates["updated_by"] = *updatedBy
	}

	// 执行更新
	if err := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("id = ?", id).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	// 重新获取更新后的数据
	return r.GetHost(ctx, id)
}

// MarkAsDestroyed 标记主机为已销毁
func (r *hostRepository) MarkAsDestroyed(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("id = ? AND deleted_at IS NULL AND is_destroyed = false", id).
		Updates(map[string]interface{}{
			"is_destroyed": true,
			"updated_at":   time.Now(),
		})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("host not found or already destroyed")
	}

	return nil
}

// DeleteHost 软删除主机
func (r *hostRepository) DeleteHost(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", time.Now())

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("host not found or already deleted")
	}

	return nil
}

// CheckIPConflict 检查IP冲突（按云区域隔离，类似蓝鲸的 bk_cloud_id + bk_host_innerip）
func (r *hostRepository) CheckIPConflict(ctx context.Context, cloudAreaID *uuid.UUID, primaryIP string, excludeHostID *uuid.UUID) (bool, error) {
	query := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("primary_ip = ? AND deleted_at IS NULL AND is_destroyed = false", primaryIP)

	if cloudAreaID != nil {
		query = query.Where("cloud_area_id = ?", *cloudAreaID)
	}

	if excludeHostID != nil {
		query = query.Where("id != ?", *excludeHostID)
	}

	var count int64
	if err := query.Count(&count).Error; err != nil {
		return false, fmt.Errorf("failed to check IP conflict: %w", err)
	}

	return count > 0, nil
}

func (r *hostRepository) fillHostRelations(ctx context.Context, hosts []*types.Host) error {
	if len(hosts) == 0 {
		return nil
	}

	hostIDs := make([]uuid.UUID, 0, len(hosts))
	for i := range hosts {
		hostIDs = append(hostIDs, hosts[i].ID)
	}

	// 读切换：业务归属读 host_node_memberships biz_module 的冗余列 business_id；
	// 一主机多模块同业务会多行，按业务维度 DISTINCT(host_id,business_id) 去重。
	var bizRows []struct {
		HostID     uuid.UUID `gorm:"column:host_id"`
		BusinessID uint64    `gorm:"column:business_id"`
	}
	if err := r.db.WithContext(ctx).
		Table("host_node_memberships").
		Select("DISTINCT host_id, business_id").
		Where("host_id IN ? AND node_kind = ?", hostIDs, types.NodeKindBizModule).
		Find(&bizRows).Error; err != nil {
		return err
	}
	bizMap := make(map[uuid.UUID][]uint64, len(hosts))
	for _, row := range bizRows {
		bizMap[row.HostID] = append(bizMap[row.HostID], row.BusinessID)
	}

	// 读切换：模块归属读 host_node_memberships biz_module 的 node_id（即 module_id）。
	var modRows []struct {
		HostID   uuid.UUID `gorm:"column:host_id"`
		ModuleID uint64    `gorm:"column:module_id"`
	}
	if err := r.db.WithContext(ctx).
		Table("host_node_memberships").
		Select("host_id, node_id AS module_id").
		Where("host_id IN ? AND node_kind = ?", hostIDs, types.NodeKindBizModule).
		Find(&modRows).Error; err != nil {
		return err
	}
	modMap := make(map[uuid.UUID][]uint64, len(hosts))
	for _, row := range modRows {
		modMap[row.HostID] = append(modMap[row.HostID], row.ModuleID)
	}

	for i := range hosts {
		hosts[i].BusinessIDs = bizMap[hosts[i].ID]
		hosts[i].ModuleIDs = modMap[hosts[i].ID]
	}

	return nil
}

// HostStatistics 按维度聚合主机数量（os_type / 业务 / 管控区域），供运营概览分布图（R4）。
func (r *hostRepository) HostStatistics(ctx context.Context) (*types.HostStatistics, error) {
	db := r.db.WithContext(ctx)
	stats := &types.HostStatistics{
		ByOSType:    []types.HostStatBucket{},
		ByBusiness:  []types.HostStatBucket{},
		ByCloudArea: []types.HostStatBucket{},
	}

	// 按操作系统类型
	if err := db.Table("hosts").
		Select("COALESCE(NULLIF(os_type, ''), '未知') AS name, COUNT(*) AS count").
		Where("deleted_at IS NULL AND is_destroyed = false").
		Group("os_type").
		Order("count DESC").
		Scan(&stats.ByOSType).Error; err != nil {
		return nil, err
	}

	// 按管控区域
	if err := db.Table("hosts AS h").
		Select("COALESCE(NULLIF(ca.name, ''), '未分配') AS name, COUNT(*) AS count").
		Joins("LEFT JOIN cloud_areas ca ON ca.id = h.cloud_area_id").
		Where("h.deleted_at IS NULL AND h.is_destroyed = false").
		Group("ca.name").
		Order("count DESC").
		Scan(&stats.ByCloudArea).Error; err != nil {
		return nil, err
	}

	// 按业务（无归属计入"未分配"；跨多业务的主机在各业务各计一次）
	// 读切换：业务归属读 host_node_memberships biz_module 的冗余列 business_id；
	// node_kind 过滤放 LEFT JOIN ON 子句，无业务模块归属者落 b.name NULL→"未分配"。
	if err := db.Table("hosts AS h").
		Select("COALESCE(b.name, '未分配') AS name, COUNT(DISTINCT h.id) AS count").
		Joins("LEFT JOIN host_node_memberships hnm ON hnm.host_id = h.id AND hnm.node_kind = ?", types.NodeKindBizModule).
		Joins("LEFT JOIN businesses b ON b.id = hnm.business_id AND b.deleted_at IS NULL").
		Where("h.deleted_at IS NULL AND h.is_destroyed = false").
		Group("b.name").
		Order("count DESC").
		Scan(&stats.ByBusiness).Error; err != nil {
		return nil, err
	}

	return stats, nil
}
