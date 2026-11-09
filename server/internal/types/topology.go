package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ========== 业务拓扑数据模型 ==========
// 层级结构：Business（业务） → Set（集群） → Module（模块） → Host（主机）

// Set 集群（业务拓扑第二层）
// 用于组织业务下的资源分组，如：登录集群、游戏集群、运维集群
type Set struct {
	ID          uint64         `gorm:"primaryKey" json:"id"`
	BusinessID  uint64         `gorm:"index;not null;comment:所属业务ID" json:"business_id"`
	Name        string         `gorm:"size:200;not null;comment:集群名称" json:"name"`
	Description string         `gorm:"size:500;comment:集群描述" json:"description"`
	EnvType     string         `gorm:"size:50;comment:环境类型：prod/staging/dev/test" json:"env_type"`
	SortOrder   int            `gorm:"default:0;comment:排序顺序" json:"sort_order"`
	IsDefault   bool           `gorm:"default:false;comment:是否为默认集群（空闲机池）" json:"is_default"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 关联
	Business *Business `gorm:"foreignKey:BusinessID" json:"business,omitempty"`
	Modules  []Module  `gorm:"foreignKey:SetID" json:"modules,omitempty"`
}

func (Set) TableName() string {
	return "sets"
}

// Module 模块（业务拓扑第三层）
// 用于组织集群下的服务模块，如：Nginx模块、API模块、数据库模块
type Module struct {
	ID                uint64         `gorm:"primaryKey" json:"id"`
	SetID             uint64         `gorm:"index;not null;comment:所属集群ID" json:"set_id"`
	BusinessID        uint64         `gorm:"index;not null;comment:所属业务ID（冗余，便于查询）" json:"business_id"`
	ServiceTemplateID *uint64        `gorm:"index;comment:关联服务模板ID" json:"service_template_id,omitempty"`
	ServiceCategoryID *uint64        `gorm:"index;comment:服务分类ID" json:"service_category_id,omitempty"`
	Name              string         `gorm:"size:200;not null;comment:模块名称" json:"name"`
	Description       string         `gorm:"size:500;comment:模块描述" json:"description"`
	ServiceType       string         `gorm:"size:50;comment:服务类型：web/api/db/cache/mq/other" json:"service_type"`
	SortOrder         int            `gorm:"default:0;comment:排序顺序" json:"sort_order"`
	IsDefault         bool           `gorm:"default:false;comment:是否为默认模块（空闲机）" json:"is_default"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 关联
	Set *Set `gorm:"foreignKey:SetID" json:"set,omitempty"`

	// 统计（非持久化）
	HostCount int `gorm:"-" json:"host_count,omitempty"`
}

func (Module) TableName() string {
	return "modules"
}

// ========== 拓扑节点（用于返回树形结构）==========

// TopologyNodeType 节点类型
type TopologyNodeType string

const (
	NodeTypeBusiness TopologyNodeType = "business"
	NodeTypeSet      TopologyNodeType = "set"
	NodeTypeModule   TopologyNodeType = "module"
	NodeTypeHost     TopologyNodeType = "host"
)

// TopologyTreeNode 拓扑树节点（用于前端渲染）
type TopologyTreeNode struct {
	ID         string                 `json:"id"`          // 唯一标识，格式：{type}_{id}
	NodeID     interface{}            `json:"node_id"`     // 原始ID（uint64 或 uuid）
	Name       string                 `json:"name"`        // 显示名称
	NodeType   TopologyNodeType       `json:"node_type"`   // 节点类型
	ParentID   string                 `json:"parent_id"`   // 父节点ID
	Icon       string                 `json:"icon"`        // 图标标识
	IsLeaf     bool                   `json:"is_leaf"`     // 是否叶子节点
	IsDefault  bool                   `json:"is_default"`  // 是否默认节点
	Expandable bool                   `json:"expandable"`  // 是否可展开
	ChildCount int                    `json:"child_count"` // 子节点数量
	Children   []TopologyTreeNode     `json:"children,omitempty"`
	Extra      map[string]interface{} `json:"extra,omitempty"` // 额外信息
}

// ========== 请求/响应结构 ==========

// CreateSetRequest 创建集群请求
type CreateSetRequest struct {
	BusinessID  uint64 `json:"business_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	EnvType     string `json:"env_type" binding:"omitempty,oneof=prod staging dev test"`
	SortOrder   int    `json:"sort_order"`
}

// UpdateSetRequest 更新集群请求
type UpdateSetRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	EnvType     *string `json:"env_type" binding:"omitempty,oneof=prod staging dev test"`
	SortOrder   *int    `json:"sort_order"`
}

// CreateModuleRequest 创建模块请求
type CreateModuleRequest struct {
	SetID       uint64 `json:"set_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	ServiceType string `json:"service_type" binding:"omitempty,oneof=web api db cache mq other"`
	SortOrder   int    `json:"sort_order"`
}

// UpdateModuleRequest 更新模块请求
type UpdateModuleRequest struct {
	Name              *string `json:"name"`
	Description       *string `json:"description"`
	ServiceType       *string `json:"service_type" binding:"omitempty,oneof=web api db cache mq other"`
	ServiceCategoryID *uint64 `json:"service_category_id"`
	SortOrder         *int    `json:"sort_order"`
}

// TransferHostsRequest 转移主机请求
type TransferHostsRequest struct {
	HostIDs        []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	TargetModuleID uint64      `json:"target_module_id" binding:"required"`
	SourceModuleID *uint64     `json:"source_module_id,omitempty"`
}

// MoveNodeRequest 移动节点请求
type MoveNodeRequest struct {
	NodeType TopologyNodeType `json:"node_type" binding:"required"`
	NodeID   uint64           `json:"node_id" binding:"required"`
	TargetID uint64           `json:"target_id" binding:"required"` // 目标父节点ID
	Position int              `json:"position"`                     // 排序位置（可选）
}

// GetTopologyTreeRequest 获取拓扑树请求
type GetTopologyTreeRequest struct {
	BusinessID   *uint64 `form:"business_id"`
	IncludeHosts bool    `form:"include_hosts"`  // 是否包含主机节点
	MaxDepth     int     `form:"max_depth"`      // 最大深度（1=业务，2=集群，3=模块，4=主机）
	ExpandNodeID string  `form:"expand_node_id"` // 展开指定节点
}

// TopologyStatistics 拓扑统计信息
type TopologyStatistics struct {
	BusinessCount int64          `json:"business_count"`
	SetCount      int64          `json:"set_count"`
	ModuleCount   int64          `json:"module_count"`
	HostCount     int64          `json:"host_count"`
	ByEnvType     map[string]int `json:"by_env_type"`     // 按环境类型统计
	ByServiceType map[string]int `json:"by_service_type"` // 按服务类型统计
}

// BatchOperationResult 批量操作结果
type BatchOperationResult struct {
	Total      int      `json:"total"`
	Successful int      `json:"successful"`
	Failed     int      `json:"failed"`
	Errors     []string `json:"errors,omitempty"`
}
