package types

import (
	"time"

	"github.com/google/uuid"
)

const (
	CloudAreaTypeDirect = "direct" // 直连区域
	CloudAreaTypeVPC    = "vpc"    // VPC
	CloudAreaTypeCustom = "custom" // 自定义
)

// CloudArea 云区域（类似蓝鲸CMDB的云区域，用于IP隔离）
type CloudArea struct {
	ID        uuid.UUID  `json:"id" db:"id" gorm:"primaryKey;type:uuid"`
	CreatedAt time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt time.Time  `json:"updated_at" db:"updated_at"`
	DeletedAt *time.Time `json:"-" db:"deleted_at"`
	TenantID  uuid.UUID  `json:"tenant_id" db:"tenant_id"`

	Name        string  `json:"name" db:"name"`
	Identifier  string  `json:"identifier" db:"identifier"`
	Type        string  `json:"type" db:"type"` // direct, vpc, custom
	Description *string `json:"description,omitempty" db:"description"`

	// 云平台信息（可选）
	CloudVendor *string `json:"cloud_vendor,omitempty" db:"cloud_vendor"`
	VPCID       *string `json:"vpc_id,omitempty" db:"vpc_id"`
	CIDRBlock   *string `json:"cidr_block,omitempty" db:"cidr_block"`
	Region      *string `json:"region,omitempty" db:"region"`

	CloudMetadata map[string]interface{} `json:"cloud_metadata,omitempty" db:"cloud_metadata" gorm:"type:jsonb;serializer:json"`
	CustomFields  map[string]interface{} `json:"custom_fields,omitempty" db:"custom_fields" gorm:"type:jsonb;serializer:json"`
}

// TableName specifies the table name for GORM
func (CloudArea) TableName() string {
	return "cloud_areas"
}

// CreateCloudAreaRequest 创建云区域请求
type CreateCloudAreaRequest struct {
	Name         string                 `json:"name" validate:"required"`
	Identifier   string                 `json:"identifier" validate:"required"`
	Type         *string                `json:"type" validate:"omitempty,oneof=direct vpc custom"`
	Description  *string                `json:"description"`
	CloudVendor  *string                `json:"cloud_vendor" validate:"omitempty,oneof=aws tencent_cloud aliyun custom"`
	VPCID        *string                `json:"vpc_id"`
	CIDRBlock    *string                `json:"cidr_block"`
	Region       *string                `json:"region"`
	CustomFields map[string]interface{} `json:"custom_fields"`
}

// UpdateCloudAreaRequest 更新云区域请求
type UpdateCloudAreaRequest struct {
	Name         *string                `json:"name"`
	Type         *string                `json:"type" validate:"omitempty,oneof=direct vpc custom"`
	Description  *string                `json:"description"`
	CIDRBlock    *string                `json:"cidr_block"`
	Region       *string                `json:"region"`
	CustomFields map[string]interface{} `json:"custom_fields"`
}

// CloudAreaQueryParams 云区域查询参数
type CloudAreaQueryParams struct {
	CloudVendor *string `form:"cloud_vendor" validate:"omitempty,oneof=aws tencent_cloud aliyun custom"`
	Type        *string `form:"type" validate:"omitempty,oneof=direct vpc custom"`
	Region      *string `form:"region"`

	// 分页
	Page     int `form:"page" validate:"min=1"`
	PageSize int `form:"page_size" validate:"min=1,max=100"`
}
