package types

import (
	"time"

	"github.com/google/uuid"
)

const (
	HostStatusRunning    = "running"
	HostStatusStopped    = "stopped"
	HostStatusTerminated = "terminated"

	CloudVendorAWS          = "aws"
	CloudVendorTencentCloud = "tencent_cloud"
	CloudVendorAliyun       = "aliyun"
	CloudVendorCustom       = "custom" // 自建机房

	OSTypeLinux   = "linux"
	OSTypeWindows = "windows"
)

// Host 云主机
type Host struct {
	ID        uuid.UUID  `json:"id" db:"id" gorm:"primaryKey;type:uuid"`
	DisplayID int64      `json:"display_id" db:"display_id" gorm:"autoIncrement;uniqueIndex"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"-" db:"deleted_at"`
	TenantID  uuid.UUID  `json:"tenant_id" db:"tenant_id"`
	CreatedBy *uuid.UUID `json:"created_by,omitempty" db:"created_by"`
	UpdatedBy *uuid.UUID `json:"updated_by,omitempty" db:"updated_by"`

	// 核心维度1：云区域（用于IP隔离，类似蓝鲸的bk_cloud_id）
	CloudAreaID *uuid.UUID `json:"cloud_area_id,omitempty" db:"cloud_area_id"`

	// 核心维度2：业务归属（NULL = 资源池）
	BusinessID *int64 `json:"business_id,omitempty" db:"business_id"`

	// 核心字段
	HostName    string   `json:"host_name" db:"host_name"`
	PrimaryIP   string   `json:"primary_ip" db:"primary_ip"` // INET type in DB
	IPAddresses []string `json:"ip_addresses,omitempty" db:"ip_addresses" gorm:"type:inet[]"`

	// 云平台相关（可选，手动导入时可为空）
	CloudVendor     *string `json:"cloud_vendor,omitempty" db:"cloud_vendor"`
	CloudInstanceID *string `json:"cloud_instance_id,omitempty" db:"cloud_instance_id"`
	CloudRegion     *string `json:"cloud_region,omitempty" db:"cloud_region"`
	VPCID           *string `json:"vpc_id,omitempty" db:"vpc_id"`       // VPC ID（冗余存储）
	SubnetID        *string `json:"subnet_id,omitempty" db:"subnet_id"` // 子网ID

	// 硬件配置
	CPU       *int    `json:"cpu,omitempty" db:"cpu"`
	Memory    *int    `json:"memory,omitempty" db:"memory"`       // MB
	DiskSize  *int    `json:"disk_size,omitempty" db:"disk_size"` // GB
	OSType    *string `json:"os_type,omitempty" db:"os_type"`
	OSVersion *string `json:"os_version,omitempty" db:"os_version"`

	// 状态
	Status      string `json:"status" db:"status"`
	IsDestroyed bool   `json:"is_destroyed" db:"is_destroyed"`

	// JSONB 扩展
	CloudMetadata map[string]interface{} `json:"cloud_metadata,omitempty" db:"cloud_metadata" gorm:"type:jsonb;serializer:json"`
	CustomFields  map[string]interface{} `json:"custom_fields,omitempty" db:"custom_fields" gorm:"type:jsonb;serializer:json"`

	// 关联数据（transient，不存储到数据库）
	CloudArea *CloudArea `json:"cloud_area,omitempty" gorm:"-"`
	Business  *Business  `json:"business,omitempty" gorm:"-"`
	// 多对多关联（transient，仅用于返回）
	BusinessIDs []uint64 `json:"business_ids,omitempty" gorm:"-"`
	ModuleIDs   []uint64 `json:"module_ids,omitempty" gorm:"-"`
}

// TableName specifies the table name for GORM
func (Host) TableName() string {
	return "hosts"
}

// CreateHostRequest 创建主机请求
type CreateHostRequest struct {
	HostName    string     `json:"host_name" validate:"required"`
	CloudAreaID *uuid.UUID `json:"cloud_area_id"` // 可选，不指定则使用默认云区域
	BusinessID  *uint64    `json:"business_id"`   // 可选，NULL表示在资源池
	PrimaryIP   string     `json:"primary_ip" validate:"required,ip"`
	IPAddresses []string   `json:"ip_addresses" validate:"omitempty,dive,ip"`

	CloudVendor     *string `json:"cloud_vendor" validate:"omitempty,oneof=aws tencent_cloud aliyun custom"`
	CloudInstanceID *string `json:"cloud_instance_id"`
	CloudRegion     *string `json:"cloud_region"`
	VPCID           *string `json:"vpc_id"`
	SubnetID        *string `json:"subnet_id"`

	CPU       *int    `json:"cpu" validate:"omitempty,min=1"`
	Memory    *int    `json:"memory" validate:"omitempty,min=1"`
	DiskSize  *int    `json:"disk_size" validate:"omitempty,min=1"`
	OSType    *string `json:"os_type" validate:"omitempty,oneof=linux windows"`
	OSVersion *string `json:"os_version"`

	Status       *string                `json:"status" validate:"omitempty,oneof=running stopped terminated"`
	CustomFields map[string]interface{} `json:"custom_fields"`
}

// UpdateHostRequest 更新主机请求
type UpdateHostRequest struct {
	HostName    *string    `json:"host_name"`
	CloudAreaID *uuid.UUID `json:"cloud_area_id"`
	BusinessID  *uint64    `json:"business_id"`
	PrimaryIP   *string    `json:"primary_ip" validate:"omitempty,ip"`
	IPAddresses *[]string  `json:"ip_addresses" validate:"omitempty,dive,ip"`

	CPU       *int    `json:"cpu" validate:"omitempty,min=1"`
	Memory    *int    `json:"memory" validate:"omitempty,min=1"`
	DiskSize  *int    `json:"disk_size" validate:"omitempty,min=1"`
	OSType    *string `json:"os_type" validate:"omitempty,oneof=linux windows"`
	OSVersion *string `json:"os_version"`

	Status       *string                `json:"status" validate:"omitempty,oneof=running stopped terminated"`
	CustomFields map[string]interface{} `json:"custom_fields"`
}

// UpdateHostCustomFieldsRequest 更新主机自定义字段请求
type UpdateHostCustomFieldsRequest struct {
	CustomFields map[string]interface{} `json:"custom_fields" validate:"required"`
}

// AssignHostToBusinessRequest 分配主机到业务请求
type AssignHostToBusinessRequest struct {
	BusinessID uint64 `json:"business_id" validate:"required"`
}

// BatchImportHostsRequest 批量导入主机请求
type BatchImportHostsRequest struct {
	Hosts               []CreateHostRequest `json:"hosts" validate:"required,min=1,dive"`
	SkipErrors          bool                `json:"skip_errors"`            // 是否跳过错误继续导入
	UseDefaultCloudArea bool                `json:"use_default_cloud_area"` // 如果未指定cloud_area_id，是否使用默认云区域
}

// BatchImportResult 批量导入结果
type BatchImportResult struct {
	Total      int           `json:"total"`            // 总数
	Successful int           `json:"successful"`       // 成功数
	Failed     int           `json:"failed"`           // 失败数
	Errors     []ImportError `json:"errors,omitempty"` // 错误详情
	CreatedIDs []uuid.UUID   `json:"created_ids"`      // 成功创建的主机ID列表
}

// ImportError 导入错误
type ImportError struct {
	Index    int    `json:"index"`     // 第几条数据（从0开始）
	HostName string `json:"host_name"` // 主机名
	Error    string `json:"error"`     // 错误信息
}

// HostQueryParams 主机查询参数
type HostQueryParams struct {
	CloudAreaID      *uuid.UUID `form:"cloud_area_id"`
	BusinessID       *int64     `form:"business_id"`
	InPool           *bool      `form:"in_pool"` // 是否在资源池（business_id IS NULL）
	CloudVendor      *string    `form:"cloud_vendor" validate:"omitempty,oneof=aws tencent_cloud aliyun custom"`
	CloudInstanceID  *string    `form:"cloud_instance_id"`
	Status           *string    `form:"status" validate:"omitempty,oneof=running stopped terminated"`
	IncludeDestroyed bool       `form:"include_destroyed"` // 是否包含已销毁主机
	OSType           *string    `form:"os_type" validate:"omitempty,oneof=linux windows"`

	// 分页
	Page     int `form:"page" validate:"min=1"`
	PageSize int `form:"page_size" validate:"min=1,max=100"`
}

// HostListResponse 主机列表响应
type HostListResponse struct {
	Total    int    `json:"total"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
	Hosts    []Host `json:"hosts"`
}

// HostBusinessRelation 主机-业务多对多关联
type HostBusinessRelation struct {
	HostID     uuid.UUID `gorm:"type:uuid;primaryKey;comment:主机ID" json:"host_id"`
	BusinessID uint64    `gorm:"primaryKey;comment:业务ID" json:"business_id"`
	CreatedAt  time.Time `json:"created_at"`
}

func (HostBusinessRelation) TableName() string {
	return "host_business_relations"
}

// HostModuleRelation 主机-模块多对多关联
type HostModuleRelation struct {
	HostID    uuid.UUID `gorm:"type:uuid;primaryKey;comment:主机ID" json:"host_id"`
	ModuleID  uint64    `gorm:"primaryKey;comment:模块ID" json:"module_id"`
	CreatedAt time.Time `json:"created_at"`
}

func (HostModuleRelation) TableName() string {
	return "host_module_relations"
}
