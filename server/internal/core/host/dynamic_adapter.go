package host

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/google/uuid"
	"github.com/lib/pq"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/types"
)

// DynamicModelAdapter 动态模型适配器
// 将现有的 Host API 适配到动态模型系统
type DynamicModelAdapter struct {
	dynamicService *dynamic_model.Service
}

// NewDynamicModelAdapter 创建适配器
func NewDynamicModelAdapter(dynamicService *dynamic_model.Service) *DynamicModelAdapter {
	return &DynamicModelAdapter{
		dynamicService: dynamicService,
	}
}

// CreateHost 创建主机（适配到动态模型）
func (a *DynamicModelAdapter) CreateHost(ctx context.Context, tenantID uuid.UUID, req *types.CreateHostRequest, createdBy *uuid.UUID) (*types.Host, error) {
	// 1. 转换请求为动态模型格式
	data := a.convertCreateRequestToData(req)

	// 2. 审计上下文
	auditCtx := &dynamic_model.AuditContext{
		UserID:    "unknown",
		ClientIP:  "127.0.0.1",
		UserAgent: "Host API Adapter",
	}
	if createdBy != nil {
		auditCtx.UserID = createdBy.String()
	}

	// 3. 调用动态模型创建
	resourceID, err := a.dynamicService.UpsertInstance(ctx, "host", nil, data, auditCtx)
	if err != nil {
		return nil, err
	}

	// 4. 查询创建的资源
	resource, err := a.dynamicService.GetInstance(ctx, resourceID)
	if err != nil {
		return nil, err
	}

	// 5. 转换回 Host 类型
	return a.convertResourceToHost(resource)
}

// GetHost 获取主机
func (a *DynamicModelAdapter) GetHost(ctx context.Context, id uuid.UUID) (*types.Host, error) {
	// 通过 UUID 查询（需要转换为 uint64）
	// 方案：使用 JSONB 查询，通过 configs 中存储的原始 UUID
	var resource types.Resource
	err := a.dynamicService.DB().Where("model_uid = 'host' AND configs->>'id' = ?", id.String()).First(&resource).Error
	if err != nil {
		return nil, fmt.Errorf("host not found")
	}

	return a.convertResourceToHost(&resource)
}

// ListHosts 列出主机
func (a *DynamicModelAdapter) ListHosts(ctx context.Context, tenantID uuid.UUID, params *types.HostQueryParams) ([]types.Host, int64, error) {
	// 构建过滤条件
	filters := make(map[string]interface{})

	if params.CloudAreaID != nil {
		filters["cloud_area_id"] = params.CloudAreaID.String()
	}
	if params.BusinessID != nil {
		filters["business_id"] = fmt.Sprintf("%d", *params.BusinessID)
	}
	if params.CloudVendor != nil {
		filters["cloud_vendor"] = *params.CloudVendor
	}
	if params.Status != nil {
		filters["status"] = *params.Status
	}
	if params.OSType != nil {
		filters["os_type"] = *params.OSType
	}

	// 分页参数
	page := 1
	pageSize := 20
	if params.Page > 0 {
		page = params.Page
	}
	if params.PageSize > 0 {
		pageSize = params.PageSize
	}

	// 查询
	resources, total, err := a.dynamicService.ListInstances(ctx, "host", filters, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	// 转换结果
	hosts := make([]types.Host, 0, len(resources))
	for _, resource := range resources {
		host, err := a.convertResourceToHost(&resource)
		if err != nil {
			continue // 跳过转换失败的记录
		}
		hosts = append(hosts, *host)
	}

	return hosts, total, nil
}

// UpdateHost 更新主机
func (a *DynamicModelAdapter) UpdateHost(ctx context.Context, id uuid.UUID, req *types.UpdateHostRequest, updatedBy *uuid.UUID) (*types.Host, error) {
	// 1. 先查询现有数据
	host, err := a.GetHost(ctx, id)
	if err != nil {
		return nil, err
	}

	// 2. 合并更新数据
	data := a.convertHostToData(host)
	a.applyUpdateRequest(data, req)

	// 3. 审计上下文
	auditCtx := &dynamic_model.AuditContext{
		UserID:    "unknown",
		ClientIP:  "127.0.0.1",
		UserAgent: "Host API Adapter",
	}
	if updatedBy != nil {
		auditCtx.UserID = updatedBy.String()
	}

	// 4. 查询动态模型资源 ID
	var resource types.Resource
	err = a.dynamicService.DB().Where("model_uid = 'host' AND configs->>'id' = ?", id.String()).First(&resource).Error
	if err != nil {
		return nil, fmt.Errorf("host not found")
	}

	// 5. 执行更新
	resourceID, err := a.dynamicService.UpsertInstance(ctx, "host", &resource.ID, data, auditCtx)
	if err != nil {
		return nil, err
	}

	// 6. 返回更新后的数据
	updatedResource, err := a.dynamicService.GetInstance(ctx, resourceID)
	if err != nil {
		return nil, err
	}

	return a.convertResourceToHost(updatedResource)
}

// DeleteHost 删除主机
func (a *DynamicModelAdapter) DeleteHost(ctx context.Context, id uuid.UUID) error {
	// 查询资源ID
	var resource types.Resource
	err := a.dynamicService.DB().Where("model_uid = 'host' AND configs->>'id' = ?", id.String()).First(&resource).Error
	if err != nil {
		return fmt.Errorf("host not found")
	}

	auditCtx := &dynamic_model.AuditContext{
		UserID:    "system",
		ClientIP:  "127.0.0.1",
		UserAgent: "Host API Adapter",
	}

	return a.dynamicService.DeleteInstance(ctx, resource.ID, auditCtx)
}

// ========== 数据转换方法 ==========

// convertCreateRequestToData 将创建请求转换为动态模型数据格式
func (a *DynamicModelAdapter) convertCreateRequestToData(req *types.CreateHostRequest) map[string]interface{} {
	data := map[string]interface{}{
		"id":         uuid.New().String(), // 生成新的UUID
		"host_name":  req.HostName,
		"primary_ip": req.PrimaryIP,
		"status":     types.HostStatusRunning,
	}

	// 云区域ID
	if req.CloudAreaID != nil {
		data["cloud_area_id"] = req.CloudAreaID.String()
	} else {
		data["cloud_area_id"] = "00000000-0000-0000-0000-000000000000"
	}

	// 业务ID
	if req.BusinessID != nil {
		data["business_id"] = fmt.Sprintf("%d", *req.BusinessID)
	}

	// IP地址列表 - 使用 PostgreSQL 数组类型
	if len(req.IPAddresses) > 0 {
		data["ip_addresses"] = pq.StringArray(req.IPAddresses)
	}

	// 云平台信息
	if req.CloudVendor != nil {
		data["cloud_vendor"] = *req.CloudVendor
	}
	if req.CloudInstanceID != nil {
		data["cloud_instance_id"] = *req.CloudInstanceID
	}
	if req.CloudRegion != nil {
		data["cloud_region"] = *req.CloudRegion
	}
	if req.VPCID != nil {
		data["vpc_id"] = *req.VPCID
	}
	if req.SubnetID != nil {
		data["subnet_id"] = *req.SubnetID
	}

	// 硬件配置
	if req.CPU != nil {
		data["cpu"] = *req.CPU
	}
	if req.Memory != nil {
		data["memory"] = *req.Memory
	}
	if req.DiskSize != nil {
		data["disk_size"] = *req.DiskSize
	}
	if req.OSType != nil {
		data["os_type"] = *req.OSType
	}
	if req.OSVersion != nil {
		data["os_version"] = *req.OSVersion
	}

	// 状态
	if req.Status != nil {
		data["status"] = *req.Status
	}
	data["is_destroyed"] = false

	// 自定义字段
	if len(req.CustomFields) > 0 {
		for k, v := range req.CustomFields {
			data[k] = v
		}
	}

	return data
}

// applyUpdateRequest 应用更新请求到数据
func (a *DynamicModelAdapter) applyUpdateRequest(data map[string]interface{}, req *types.UpdateHostRequest) {
	if req.HostName != nil {
		data["host_name"] = *req.HostName
	}
	if req.CloudAreaID != nil {
		data["cloud_area_id"] = req.CloudAreaID.String()
	}
	if req.BusinessID != nil {
		data["business_id"] = fmt.Sprintf("%d", *req.BusinessID)
	}
	if req.PrimaryIP != nil {
		data["primary_ip"] = *req.PrimaryIP
	}
	if req.IPAddresses != nil {
		data["ip_addresses"] = pq.StringArray(*req.IPAddresses)
	}
	if req.CPU != nil {
		data["cpu"] = *req.CPU
	}
	if req.Memory != nil {
		data["memory"] = *req.Memory
	}
	if req.DiskSize != nil {
		data["disk_size"] = *req.DiskSize
	}
	if req.OSType != nil {
		data["os_type"] = *req.OSType
	}
	if req.OSVersion != nil {
		data["os_version"] = *req.OSVersion
	}
	if req.Status != nil {
		data["status"] = *req.Status
	}
	if len(req.CustomFields) > 0 {
		for k, v := range req.CustomFields {
			data[k] = v
		}
	}
}

// convertResourceToHost 将动态模型资源转换为 Host 类型
func (a *DynamicModelAdapter) convertResourceToHost(resource *types.Resource) (*types.Host, error) {
	// 解析 configs JSONB
	var configs map[string]interface{}
	if err := json.Unmarshal(resource.Configs, &configs); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}

	host := &types.Host{
		CreatedAt: resource.CreatedAt,
		UpdatedAt: resource.UpdatedAt,
	}

	// ID
	if idStr, ok := configs["id"].(string); ok {
		id, _ := uuid.Parse(idStr)
		host.ID = id
	}

	// 基本字段
	if hostName, ok := configs["host_name"].(string); ok {
		host.HostName = hostName
	}
	if primaryIP, ok := configs["primary_ip"].(string); ok {
		host.PrimaryIP = primaryIP
	}

	// 云区域ID
	if cloudAreaIDStr, ok := configs["cloud_area_id"].(string); ok && cloudAreaIDStr != "00000000-0000-0000-0000-000000000000" {
		id, _ := uuid.Parse(cloudAreaIDStr)
		host.CloudAreaID = &id
	}

	// 业务ID
	if businessIDStr, ok := configs["business_id"].(string); ok {
		if id, err := strconv.ParseInt(businessIDStr, 10, 64); err == nil {
			host.BusinessID = &id
		}
	}

	// IP地址列表 - 支持 PostgreSQL 数组或 JSON 数组
	host.IPAddresses = getStringSliceFromConfig(configs, "ip_addresses")

	// 云平台信息
	if vendor, ok := configs["cloud_vendor"].(string); ok {
		host.CloudVendor = &vendor
	}
	if instanceID, ok := configs["cloud_instance_id"].(string); ok {
		host.CloudInstanceID = &instanceID
	}
	if region, ok := configs["cloud_region"].(string); ok {
		host.CloudRegion = &region
	}
	if vpcID, ok := configs["vpc_id"].(string); ok {
		host.VPCID = &vpcID
	}
	if subnetID, ok := configs["subnet_id"].(string); ok {
		host.SubnetID = &subnetID
	}

	// 硬件配置
	if cpu := getIntFromConfig(configs, "cpu"); cpu != nil {
		host.CPU = cpu
	}
	if memory := getIntFromConfig(configs, "memory"); memory != nil {
		host.Memory = memory
	}
	if diskSize := getIntFromConfig(configs, "disk_size"); diskSize != nil {
		host.DiskSize = diskSize
	}
	if osType, ok := configs["os_type"].(string); ok {
		host.OSType = &osType
	}
	if osVersion, ok := configs["os_version"].(string); ok {
		host.OSVersion = &osVersion
	}

	// 状态（从 state 表获取）
	if resource.State != nil {
		var metrics map[string]interface{}
		json.Unmarshal(resource.State.Metrics, &metrics)

		if status, ok := metrics["status"].(string); ok {
			host.Status = status
		}
		if isDestroyed, ok := metrics["is_destroyed"].(bool); ok {
			host.IsDestroyed = isDestroyed
		}
	} else {
		// 如果没有状态数据，使用默认值
		host.Status = types.HostStatusRunning
		host.IsDestroyed = false
	}

	return host, nil
}

// convertHostToData 将 Host 转换为动态模型数据格式
func (a *DynamicModelAdapter) convertHostToData(host *types.Host) map[string]interface{} {
	data := map[string]interface{}{
		"id":           host.ID.String(),
		"host_name":    host.HostName,
		"primary_ip":   host.PrimaryIP,
		"status":       host.Status,
		"is_destroyed": host.IsDestroyed,
	}

	if host.CloudAreaID != nil {
		data["cloud_area_id"] = host.CloudAreaID.String()
	}
	if host.BusinessID != nil {
		data["business_id"] = fmt.Sprintf("%d", *host.BusinessID)
	}
	if len(host.IPAddresses) > 0 {
		data["ip_addresses"] = pq.StringArray(host.IPAddresses)
	}

	return data
}

// getStringSliceFromConfig 从配置中安全获取字符串数组
func getStringSliceFromConfig(configs map[string]interface{}, key string) []string {
	if val, ok := configs[key]; ok {
		switch v := val.(type) {
		case []interface{}:
			result := make([]string, len(v))
			for i, item := range v {
				if s, ok := item.(string); ok {
					result[i] = s
				}
			}
			return result
		case []string:
			return v
		case string:
			// 尝试解析 JSON 数组
			var ips []string
			if err := json.Unmarshal([]byte(v), &ips); err == nil {
				return ips
			}
		}
	}
	return nil
}

// getIntFromConfig 从配置中安全获取整数
func getIntFromConfig(configs map[string]interface{}, key string) *int {
	if val, ok := configs[key]; ok {
		switch v := val.(type) {
		case float64:
			i := int(v)
			return &i
		case int:
			return &v
		case string:
			if i, err := strconv.Atoi(v); err == nil {
				return &i
			}
		}
	}
	return nil
}
