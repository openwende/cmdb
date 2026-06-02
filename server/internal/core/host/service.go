package host

import (
	"context"
	"fmt"
	"net"

	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"
)

// Service 主机服务
type Service struct {
	hostRepo      storage.HostRepository
	cloudAreaRepo storage.CloudAreaRepository
}

// NewService 创建主机服务实例
func NewService(hostRepo storage.HostRepository, cloudAreaRepo storage.CloudAreaRepository) *Service {
	return &Service{
		hostRepo:      hostRepo,
		cloudAreaRepo: cloudAreaRepo,
	}
}

// CreateHost 创建主机
func (s *Service) CreateHost(ctx context.Context, tenantID uuid.UUID, req *types.CreateHostRequest, createdBy *uuid.UUID) (*types.Host, error) {
	// 1. 如果未指定云区域，使用默认云区域
	if req.CloudAreaID == nil {
		defaultArea, err := s.cloudAreaRepo.GetDefaultCloudArea(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get default cloud area: %w", err)
		}
		req.CloudAreaID = &defaultArea.ID
	}

	// 2. 校验数据
	if err := s.validateHostRequest(ctx, req, nil); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrInvalidInput, "INVALID_INPUT", err.Error())
	}

	// 3. 检查云区域是否存在
	if _, err := s.cloudAreaRepo.GetCloudArea(ctx, *req.CloudAreaID); err != nil {
		return nil, fmt.Errorf("cloud area not found: %w", err)
	}

	// 4. 检查IP冲突（按云区域隔离）
	if conflict, err := s.hostRepo.CheckIPConflict(ctx, req.CloudAreaID, req.PrimaryIP, nil); err != nil {
		return nil, fmt.Errorf("failed to check IP conflict: %w", err)
	} else if conflict {
		return nil, fmt.Errorf("IP address %s already exists in this cloud area", req.PrimaryIP)
	}

	// 5. 检查云实例ID冲突（如果提供了云平台信息）
	if req.CloudVendor != nil && req.CloudInstanceID != nil {
		if existing, _ := s.hostRepo.GetHostByCloudInstance(ctx, *req.CloudVendor, *req.CloudInstanceID); existing != nil {
			return nil, fmt.Errorf("cloud instance %s (%s) already exists", *req.CloudInstanceID, *req.CloudVendor)
		}
	}

	// 6. 创建主机
	return s.hostRepo.CreateHost(ctx, tenantID, req, createdBy)
}

// BatchImportHosts 批量导入主机
func (s *Service) BatchImportHosts(ctx context.Context, tenantID uuid.UUID, req *types.BatchImportHostsRequest, createdBy *uuid.UUID) (*types.BatchImportResult, error) {
	result := &types.BatchImportResult{
		Total:      len(req.Hosts),
		Successful: 0,
		Failed:     0,
		CreatedIDs: make([]uuid.UUID, 0),
		Errors:     make([]types.ImportError, 0),
	}

	if len(req.Hosts) == 0 {
		return result, nil
	}

	// 获取默认云区域
	var defaultCloudAreaID *uuid.UUID
	if req.UseDefaultCloudArea {
		defaultArea, err := s.cloudAreaRepo.GetDefaultCloudArea(ctx)
		if err != nil {
			return result, fmt.Errorf("failed to get default cloud area: %w", err)
		}
		defaultCloudAreaID = &defaultArea.ID
	}

	// 用于批量创建的主机列表
	hostsToCreate := make([]*types.Host, 0, len(req.Hosts))

	// 逐个校验和准备主机数据
	for i, hostReq := range req.Hosts {
		// 如果未指定云区域且要求使用默认，设置默认云区域
		if hostReq.CloudAreaID == nil && defaultCloudAreaID != nil {
			hostReq.CloudAreaID = defaultCloudAreaID
		}

		// 如果仍未指定云区域，尝试获取默认
		if hostReq.CloudAreaID == nil {
			defaultArea, err := s.cloudAreaRepo.GetDefaultCloudArea(ctx)
			if err != nil {
				result.Failed++
				result.Errors = append(result.Errors, types.ImportError{
					Index:    i,
					HostName: hostReq.HostName,
					Error:    "no cloud area specified and default not available",
				})
				if !req.SkipErrors {
					return result, fmt.Errorf("no cloud area for host at index %d", i)
				}
				continue
			}
			hostReq.CloudAreaID = &defaultArea.ID
		}

		// 1. 校验数据
		if err := s.validateHostRequest(ctx, &hostReq, nil); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, types.ImportError{
				Index:    i,
				HostName: hostReq.HostName,
				Error:    fmt.Sprintf("validation failed: %s", err.Error()),
			})
			if !req.SkipErrors {
				return result, fmt.Errorf("validation failed for host at index %d: %w", i, err)
			}
			continue
		}

		// 2. 检查云区域是否存在
		if _, err := s.cloudAreaRepo.GetCloudArea(ctx, *hostReq.CloudAreaID); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, types.ImportError{
				Index:    i,
				HostName: hostReq.HostName,
				Error:    "cloud area not found",
			})
			if !req.SkipErrors {
				return result, fmt.Errorf("cloud area not found for host at index %d", i)
			}
			continue
		}

		// 3. 检查IP冲突（按云区域）
		if conflict, err := s.hostRepo.CheckIPConflict(ctx, hostReq.CloudAreaID, hostReq.PrimaryIP, nil); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, types.ImportError{
				Index:    i,
				HostName: hostReq.HostName,
				Error:    fmt.Sprintf("failed to check IP conflict: %s", err.Error()),
			})
			if !req.SkipErrors {
				return result, fmt.Errorf("failed to check IP conflict for host at index %d: %w", i, err)
			}
			continue
		} else if conflict {
			result.Failed++
			result.Errors = append(result.Errors, types.ImportError{
				Index:    i,
				HostName: hostReq.HostName,
				Error:    fmt.Sprintf("IP address %s already exists in cloud area", hostReq.PrimaryIP),
			})
			if !req.SkipErrors {
				return result, fmt.Errorf("IP conflict for host at index %d", i)
			}
			continue
		}

		// 4. 检查云实例ID冲突（如果提供了云平台信息）
		if hostReq.CloudVendor != nil && hostReq.CloudInstanceID != nil {
			if existing, _ := s.hostRepo.GetHostByCloudInstance(ctx, *hostReq.CloudVendor, *hostReq.CloudInstanceID); existing != nil {
				result.Failed++
				result.Errors = append(result.Errors, types.ImportError{
					Index:    i,
					HostName: hostReq.HostName,
					Error:    fmt.Sprintf("cloud instance %s (%s) already exists", *hostReq.CloudInstanceID, *hostReq.CloudVendor),
				})
				if !req.SkipErrors {
					return result, fmt.Errorf("cloud instance conflict for host at index %d", i)
				}
				continue
			}
		}

		// 5. 准备主机数据
		status := types.HostStatusRunning
		if hostReq.Status != nil {
			status = *hostReq.Status
		}

		host := &types.Host{
			ID:              uuid.New(),
			TenantID:        tenantID,
			CreatedBy:       createdBy,
			CloudAreaID:     hostReq.CloudAreaID,
			BusinessID:      nil, // 主机建到资源池(无业务)；业务归属经 HostMembershipService(host_node_memberships)
			HostName:        hostReq.HostName,
			PrimaryIP:       hostReq.PrimaryIP,
			IPAddresses:     hostReq.IPAddresses,
			CloudVendor:     hostReq.CloudVendor,
			CloudInstanceID: hostReq.CloudInstanceID,
			CloudRegion:     hostReq.CloudRegion,
			VPCID:           hostReq.VPCID,
			SubnetID:        hostReq.SubnetID,
			CPU:             hostReq.CPU,
			Memory:          hostReq.Memory,
			DiskSize:        hostReq.DiskSize,
			OSType:          hostReq.OSType,
			OSVersion:       hostReq.OSVersion,
			Status:          status,
			IsDestroyed:     false,
			CustomFields:    hostReq.CustomFields,
		}

		hostsToCreate = append(hostsToCreate, host)
		result.CreatedIDs = append(result.CreatedIDs, host.ID)
	}

	// 6. 批量创建主机
	if len(hostsToCreate) > 0 {
		if err := s.hostRepo.BatchCreateHosts(ctx, tenantID, hostsToCreate); err != nil {
			return result, fmt.Errorf("failed to batch create hosts: %w", err)
		}
		result.Successful = len(hostsToCreate)
	}

	return result, nil
}

// GetHost 获取主机
func (s *Service) GetHost(ctx context.Context, id uuid.UUID) (*types.Host, error) {
	return s.hostRepo.GetHost(ctx, id)
}

// ListHosts 获取主机列表
func (s *Service) ListHosts(ctx context.Context, tenantID uuid.UUID, params *types.HostQueryParams) ([]types.Host, int64, error) {
	return s.hostRepo.ListHosts(ctx, tenantID, params)
}

// UpdateHost 更新主机
func (s *Service) UpdateHost(ctx context.Context, id uuid.UUID, req *types.UpdateHostRequest, updatedBy *uuid.UUID) (*types.Host, error) {
	// 1. 校验数据
	if err := s.validateUpdateHostRequest(ctx, id, req); err != nil {
		return nil, apperrors.Wrap(apperrors.ErrInvalidInput, "INVALID_INPUT", err.Error())
	}

	// 2. 检查主机是否存在
	if _, err := s.hostRepo.GetHost(ctx, id); err != nil {
		return nil, err
	}

	// 3. 如果更新了云区域，检查云区域是否存在
	if req.CloudAreaID != nil {
		if _, err := s.cloudAreaRepo.GetCloudArea(ctx, *req.CloudAreaID); err != nil {
			return nil, fmt.Errorf("cloud area not found: %w", err)
		}
	}

	// 4. 如果更新了IP，检查IP冲突
	if req.PrimaryIP != nil {
		// 获取当前主机的云区域ID
		currentHost, _ := s.hostRepo.GetHost(ctx, id)
		cloudAreaID := currentHost.CloudAreaID
		if req.CloudAreaID != nil {
			cloudAreaID = req.CloudAreaID
		}

		if conflict, err := s.hostRepo.CheckIPConflict(ctx, cloudAreaID, *req.PrimaryIP, &id); err != nil {
			return nil, fmt.Errorf("failed to check IP conflict: %w", err)
		} else if conflict {
			return nil, fmt.Errorf("IP address %s already exists in this cloud area", *req.PrimaryIP)
		}
	}

	// 5. 执行更新
	return s.hostRepo.UpdateHost(ctx, id, req, updatedBy)
}

// UpdateCustomFields 更新主机自定义字段
func (s *Service) UpdateCustomFields(ctx context.Context, id uuid.UUID, customFields map[string]interface{}, updatedBy *uuid.UUID) (*types.Host, error) {
	// 1. 检查主机是否存在
	if _, err := s.hostRepo.GetHost(ctx, id); err != nil {
		return nil, err
	}

	// 2. 执行更新
	return s.hostRepo.UpdateCustomFields(ctx, id, customFields, updatedBy)
}

// DeleteHost 删除主机（标记删除）
func (s *Service) DeleteHost(ctx context.Context, id uuid.UUID, markAsDestroyed bool) error {
	// 1. 检查主机是否存在
	if _, err := s.hostRepo.GetHost(ctx, id); err != nil {
		return err
	}

	// 2. 选择删除方式
	if markAsDestroyed {
		// 标记为已销毁（保留记录）
		return s.hostRepo.MarkAsDestroyed(ctx, id)
	} else {
		// 软删除
		return s.hostRepo.DeleteHost(ctx, id)
	}
}

// validateHostRequest 校验主机创建请求
func (s *Service) validateHostRequest(ctx context.Context, req *types.CreateHostRequest, excludeHostID *uuid.UUID) error {
	// 1. 校验主机名
	if req.HostName == "" {
		return fmt.Errorf("host_name is required")
	}

	// 2. 校验IP地址格式
	if req.PrimaryIP == "" {
		return fmt.Errorf("primary_ip is required")
	}
	if net.ParseIP(req.PrimaryIP) == nil {
		return fmt.Errorf("invalid primary_ip format: %s", req.PrimaryIP)
	}

	// 3. 校验IP地址列表
	for _, ip := range req.IPAddresses {
		if net.ParseIP(ip) == nil {
			return fmt.Errorf("invalid ip address in ip_addresses: %s", ip)
		}
	}

	// 4. 校验云厂商
	if req.CloudVendor != nil {
		validVendors := map[string]bool{
			types.CloudVendorAWS:          true,
			types.CloudVendorTencentCloud: true,
			types.CloudVendorAliyun:       true,
			types.CloudVendorCustom:       true,
		}
		if !validVendors[*req.CloudVendor] {
			return fmt.Errorf("invalid cloud_vendor: %s", *req.CloudVendor)
		}
	}

	// 5. 校验操作系统类型
	if req.OSType != nil {
		validOSTypes := map[string]bool{
			types.OSTypeLinux:   true,
			types.OSTypeWindows: true,
		}
		if !validOSTypes[*req.OSType] {
			return fmt.Errorf("invalid os_type: %s", *req.OSType)
		}
	}

	// 6. 校验状态
	if req.Status != nil {
		validStatuses := map[string]bool{
			types.HostStatusRunning:    true,
			types.HostStatusStopped:    true,
			types.HostStatusTerminated: true,
		}
		if !validStatuses[*req.Status] {
			return fmt.Errorf("invalid status: %s", *req.Status)
		}
	}

	// 7. 校验硬件配置
	if req.CPU != nil && *req.CPU <= 0 {
		return fmt.Errorf("cpu must be greater than 0")
	}
	if req.Memory != nil && *req.Memory <= 0 {
		return fmt.Errorf("memory must be greater than 0")
	}
	if req.DiskSize != nil && *req.DiskSize <= 0 {
		return fmt.Errorf("disk_size must be greater than 0")
	}

	return nil
}

// validateUpdateHostRequest 校验主机更新请求
func (s *Service) validateUpdateHostRequest(ctx context.Context, hostID uuid.UUID, req *types.UpdateHostRequest) error {
	// 1. 校验IP地址格式
	if req.PrimaryIP != nil {
		if net.ParseIP(*req.PrimaryIP) == nil {
			return fmt.Errorf("invalid primary_ip format: %s", *req.PrimaryIP)
		}
	}

	// 2. 校验IP地址列表
	if req.IPAddresses != nil {
		for _, ip := range *req.IPAddresses {
			if net.ParseIP(ip) == nil {
				return fmt.Errorf("invalid ip address in ip_addresses: %s", ip)
			}
		}
	}

	// 3. 校验操作系统类型
	if req.OSType != nil {
		validOSTypes := map[string]bool{
			types.OSTypeLinux:   true,
			types.OSTypeWindows: true,
		}
		if !validOSTypes[*req.OSType] {
			return fmt.Errorf("invalid os_type: %s", *req.OSType)
		}
	}

	// 4. 校验状态
	if req.Status != nil {
		validStatuses := map[string]bool{
			types.HostStatusRunning:    true,
			types.HostStatusStopped:    true,
			types.HostStatusTerminated: true,
		}
		if !validStatuses[*req.Status] {
			return fmt.Errorf("invalid status: %s", *req.Status)
		}
	}

	// 5. 校验硬件配置
	if req.CPU != nil && *req.CPU <= 0 {
		return fmt.Errorf("cpu must be greater than 0")
	}
	if req.Memory != nil && *req.Memory <= 0 {
		return fmt.Errorf("memory must be greater than 0")
	}
	if req.DiskSize != nil && *req.DiskSize <= 0 {
		return fmt.Errorf("disk_size must be greater than 0")
	}

	return nil
}

// HostStatistics 主机维度聚合统计（os_type / 业务 / 管控区域），供运营概览分布图（R4）。
func (s *Service) HostStatistics(ctx context.Context) (*types.HostStatistics, error) {
	return s.hostRepo.HostStatistics(ctx)
}
