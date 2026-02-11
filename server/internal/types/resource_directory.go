package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ========== 资源目录 ==========

// ResourceDirectory 资源目录
// 用于组织和管理未分配到业务的资源（资源池）
type ResourceDirectory struct {
	ID          uint64         `gorm:"primaryKey" json:"id"`
	ParentID    *uint64        `gorm:"index;comment:父目录ID，NULL表示根目录" json:"parent_id,omitempty"`
	Name        string         `gorm:"size:200;not null;comment:目录名称" json:"name"`
	Description string         `gorm:"size:500;comment:目录描述" json:"description"`
	Path        string         `gorm:"size:500;index;comment:目录路径，如 /默认目录/华南区" json:"path"`
	Level       int            `gorm:"default:1;comment:目录层级" json:"level"`
	SortOrder   int            `gorm:"default:0;comment:排序顺序" json:"sort_order"`
	IsDefault   bool           `gorm:"default:false;comment:是否为默认目录" json:"is_default"`
	CreatedBy   string         `gorm:"size:100;comment:创建人" json:"created_by"`
	UpdatedBy   string         `gorm:"size:100;comment:更新人" json:"updated_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 关联
	Parent   *ResourceDirectory  `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
	Children []ResourceDirectory `gorm:"foreignKey:ParentID" json:"children,omitempty"`

	// 统计（非持久化）
	HostCount  int `gorm:"-" json:"host_count,omitempty"`
	ChildCount int `gorm:"-" json:"child_count,omitempty"`
}

func (ResourceDirectory) TableName() string {
	return "resource_directories"
}

// ResourcePoolHost 资源池主机
// 未分配到业务的主机，存放在资源目录中
type ResourcePoolHost struct {
	HostID      uuid.UUID `gorm:"type:uuid;primaryKey;comment:主机ID" json:"host_id"`
	DirectoryID uint64    `gorm:"index;not null;comment:所在资源目录ID" json:"directory_id"`
	ImportedAt  time.Time `gorm:"comment:导入时间" json:"imported_at"`
	ImportedBy  string    `gorm:"size:100;comment:导入人" json:"imported_by"`
	Remark      string    `gorm:"size:500;comment:备注" json:"remark"`

	// 关联
	Host      *Host              `gorm:"foreignKey:HostID" json:"host,omitempty"`
	Directory *ResourceDirectory `gorm:"foreignKey:DirectoryID" json:"directory,omitempty"`
}

func (ResourcePoolHost) TableName() string {
	return "resource_pool_hosts"
}

// ========== 请求/响应结构 ==========

// CreateResourceDirectoryRequest 创建资源目录请求
type CreateResourceDirectoryRequest struct {
	ParentID    *uint64 `json:"parent_id"`
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	SortOrder   int     `json:"sort_order"`
}

// UpdateResourceDirectoryRequest 更新资源目录请求
type UpdateResourceDirectoryRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sort_order"`
}

// MoveResourceDirectoryRequest 移动资源目录请求
type MoveResourceDirectoryRequest struct {
	NewParentID *uint64 `json:"new_parent_id"` // NULL 表示移动到根目录
}

// ImportHostsToPoolRequest 导入主机到资源池请求
type ImportHostsToPoolRequest struct {
	DirectoryID uint64      `json:"directory_id" binding:"required"`
	HostIDs     []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	Remark      string      `json:"remark"`
}

// MoveHostsInPoolRequest 在资源池内移动主机请求
type MoveHostsInPoolRequest struct {
	HostIDs           []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	TargetDirectoryID uint64      `json:"target_directory_id" binding:"required"`
}

// AllocateHostsRequest 分配主机到业务请求
type AllocateHostsRequest struct {
	HostIDs        []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	TargetModuleID uint64      `json:"target_module_id" binding:"required"`
}

// ReclaimHostsRequest 回收主机到资源池请求
type ReclaimHostsRequest struct {
	HostIDs     []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	DirectoryID uint64      `json:"directory_id" binding:"required"`
	Remark      string      `json:"remark"`
}

// ResourceDirectoryTree 资源目录树节点
type ResourceDirectoryTree struct {
	ID          uint64                  `json:"id"`
	Name        string                  `json:"name"`
	Description string                  `json:"description"`
	Path        string                  `json:"path"`
	Level       int                     `json:"level"`
	IsDefault   bool                    `json:"is_default"`
	HostCount   int                     `json:"host_count"`
	ChildCount  int                     `json:"child_count"`
	Children    []ResourceDirectoryTree `json:"children,omitempty"`
}

// ResourcePoolStatistics 资源池统计
type ResourcePoolStatistics struct {
	TotalDirectories int            `json:"total_directories"`
	TotalHosts       int            `json:"total_hosts"`
	ByDirectory      map[string]int `json:"by_directory"` // 目录名 -> 主机数
}
