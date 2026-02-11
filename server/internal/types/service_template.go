package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ========== 服务模板 ==========

// ServiceTemplate 服务模板
// 定义模块的标准配置，包含进程模板列表
type ServiceTemplate struct {
	ID          uint64         `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:200;not null;comment:模板名称" json:"name"`
	BusinessID  uuid.UUID      `gorm:"type:uuid;index;not null;comment:所属业务ID" json:"business_id"`
	ServiceType string         `gorm:"size:50;comment:服务类型：web/api/db/cache/mq/other" json:"service_type"`
	Description string         `gorm:"size:500;comment:描述" json:"description"`
	CreatedBy   string         `gorm:"size:100;comment:创建人" json:"created_by"`
	UpdatedBy   string         `gorm:"size:100;comment:更新人" json:"updated_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 关联
	Business         *Business          `gorm:"foreignKey:BusinessID" json:"business,omitempty"`
	ProcessTemplates []ProcessTemplate  `gorm:"foreignKey:ServiceTemplateID" json:"process_templates,omitempty"`
	Modules          []Module           `gorm:"foreignKey:ServiceTemplateID" json:"modules,omitempty"`
}

func (ServiceTemplate) TableName() string {
	return "service_templates"
}

// ServiceTemplateWithStats 带统计信息的服务模板
type ServiceTemplateWithStats struct {
	ServiceTemplate
	ProcessCount int `json:"process_count"` // 进程模板数量
	ModuleCount  int `json:"module_count"`  // 使用此模板的模块数量
	HostCount    int `json:"host_count"`    // 关联主机数量
}

// ========== 集群模板 ==========

// SetTemplate 集群模板
// 定义集群的标准结构，包含多个服务模板
type SetTemplate struct {
	ID          uint64         `gorm:"primaryKey" json:"id"`
	Name        string         `gorm:"size:200;not null;comment:模板名称" json:"name"`
	BusinessID  uuid.UUID      `gorm:"type:uuid;index;not null;comment:所属业务ID" json:"business_id"`
	EnvType     string         `gorm:"size:50;comment:环境类型：prod/staging/dev/test" json:"env_type"`
	Description string         `gorm:"size:500;comment:描述" json:"description"`
	CreatedBy   string         `gorm:"size:100;comment:创建人" json:"created_by"`
	UpdatedBy   string         `gorm:"size:100;comment:更新人" json:"updated_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 关联
	Business          *Business                   `gorm:"foreignKey:BusinessID" json:"business,omitempty"`
	ServiceBindings   []SetTemplateServiceBinding `gorm:"foreignKey:SetTemplateID" json:"service_bindings,omitempty"`
}

func (SetTemplate) TableName() string {
	return "set_templates"
}

// SetTemplateServiceBinding 集群模板与服务模板的绑定关系
type SetTemplateServiceBinding struct {
	ID                uint64 `gorm:"primaryKey" json:"id"`
	SetTemplateID     uint64 `gorm:"index;not null;comment:集群模板ID" json:"set_template_id"`
	ServiceTemplateID uint64 `gorm:"index;not null;comment:服务模板ID" json:"service_template_id"`
	SortOrder         int    `gorm:"default:0;comment:排序顺序" json:"sort_order"`

	// 关联
	SetTemplate     *SetTemplate     `gorm:"foreignKey:SetTemplateID" json:"set_template,omitempty"`
	ServiceTemplate *ServiceTemplate `gorm:"foreignKey:ServiceTemplateID" json:"service_template,omitempty"`
}

func (SetTemplateServiceBinding) TableName() string {
	return "set_template_service_bindings"
}

// ========== 请求/响应结构 ==========

// CreateServiceTemplateRequest 创建服务模板请求
type CreateServiceTemplateRequest struct {
	Name        string    `json:"name" binding:"required"`
	BusinessID  uuid.UUID `json:"business_id" binding:"required"`
	ServiceType string    `json:"service_type" binding:"omitempty,oneof=web api db cache mq other"`
	Description string    `json:"description"`
}

// UpdateServiceTemplateRequest 更新服务模板请求
type UpdateServiceTemplateRequest struct {
	Name        *string `json:"name"`
	ServiceType *string `json:"service_type" binding:"omitempty,oneof=web api db cache mq other"`
	Description *string `json:"description"`
}

// AddProcessToServiceTemplateRequest 添加进程模板到服务模板
type AddProcessToServiceTemplateRequest struct {
	ProcessTemplateID uint64 `json:"process_template_id" binding:"required"`
}

// CreateModuleFromTemplateRequest 从服务模板创建模块
type CreateModuleFromTemplateRequest struct {
	SetID       uint64 `json:"set_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// SyncModulesRequest 同步模块请求（将模板变更同步到关联的模块）
type SyncModulesRequest struct {
	ModuleIDs []uint64 `json:"module_ids"` // 为空则同步所有关联模块
}

// CreateSetTemplateRequest 创建集群模板请求
type CreateSetTemplateRequest struct {
	Name               string    `json:"name" binding:"required"`
	BusinessID         uuid.UUID `json:"business_id" binding:"required"`
	EnvType            string    `json:"env_type" binding:"omitempty,oneof=prod staging dev test"`
	Description        string    `json:"description"`
	ServiceTemplateIDs []uint64  `json:"service_template_ids"` // 关联的服务模板
}

// UpdateSetTemplateRequest 更新集群模板请求
type UpdateSetTemplateRequest struct {
	Name               *string  `json:"name"`
	EnvType            *string  `json:"env_type" binding:"omitempty,oneof=prod staging dev test"`
	Description        *string  `json:"description"`
	ServiceTemplateIDs []uint64 `json:"service_template_ids"` // 更新关联的服务模板
}

// CreateSetFromTemplateRequest 从集群模板创建集群
type CreateSetFromTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}
