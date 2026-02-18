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
	AssignToBusiness(ctx context.Context, id uuid.UUID, businessID int64) error
	ReclaimToPool(ctx context.Context, id uuid.UUID) error
	MarkAsDestroyed(ctx context.Context, id uuid.UUID) error
	DeleteHost(ctx context.Context, id uuid.UUID) error
	CheckIPConflict(ctx context.Context, cloudAreaID *uuid.UUID, primaryIP string, excludeHostID *uuid.UUID) (bool, error)
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
		BusinessID:      req.BusinessID,
		HostName:        req.HostName,
		PrimaryIP:       req.PrimaryIP,
		IPAddresses:     req.IPAddresses,
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

	if err := r.db.WithContext(ctx).Create(host).Error; err != nil {
		return nil, err
	}

	return host, nil
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
	return r.db.WithContext(ctx).CreateInBatches(hosts, batchSize).Error
}

// GetHost 根据ID获取主机
func (r *hostRepository) GetHost(ctx context.Context, id uuid.UUID) (*types.Host, error) {
	var host types.Host
	err := r.db.WithContext(ctx).
		Preload("CloudArea").
		Preload("Business").
		Where("id = ? AND deleted_at IS NULL", id).
		First(&host).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("host not found")
		}
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
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)

	// 应用过滤条件
	if params.CloudAreaID != nil {
		query = query.Where("cloud_area_id = ?", *params.CloudAreaID)
	}
	if params.BusinessID != nil {
		query = query.Where("business_id = ?", *params.BusinessID)
	}
	// 资源池查询（business_id IS NULL）
	if params.InPool != nil && *params.InPool {
		query = query.Where("business_id IS NULL")
	}
	if params.CloudVendor != nil {
		query = query.Where("cloud_vendor = ?", *params.CloudVendor)
	}
	if params.CloudInstanceID != nil {
		query = query.Where("cloud_instance_id = ?", *params.CloudInstanceID)
	}
	if params.Status != nil {
		query = query.Where("status = ?", *params.Status)
	}
	if params.OSType != nil {
		query = query.Where("os_type = ?", *params.OSType)
	}
	if !params.IncludeDestroyed {
		query = query.Where("is_destroyed = false")
	}

	// 获取总数
	var total int64
	if err := query.Model(&types.Host{}).Count(&total).Error; err != nil {
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
		Preload("CloudArea").
		Preload("Business").
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&hosts).Error

	if err != nil {
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
	if req.BusinessID != nil {
		updates["business_id"] = *req.BusinessID
	}
	if req.PrimaryIP != nil {
		updates["primary_ip"] = *req.PrimaryIP
	}
	if req.IPAddresses != nil {
		updates["ip_addresses"] = *req.IPAddresses
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

// AssignToBusiness 分配主机到业务
func (r *hostRepository) AssignToBusiness(ctx context.Context, id uuid.UUID, businessID int64) error {
	result := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]interface{}{
			"business_id": businessID,
			"updated_at":  time.Now(),
		})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("host not found")
	}

	return nil
}

// ReclaimToPool 回收主机到资源池
func (r *hostRepository) ReclaimToPool(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Updates(map[string]interface{}{
			"business_id": nil,
			"updated_at":  time.Now(),
		})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("host not found")
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
