package types

import (
	"time"

	"gorm.io/gorm"
)

// ServiceCategory 服务分类
// 参考 bk-cmdb：支持业务分类和全局内置分类并存。
type ServiceCategory struct {
	ID         uint64         `gorm:"primaryKey" json:"id"`
	BusinessID *uint64        `gorm:"index;comment:所属业务ID，NULL表示全局内置" json:"business_id,omitempty"`
	Name       string         `gorm:"size:200;not null;comment:分类名称" json:"name"`
	ParentID   *uint64        `gorm:"index;comment:父分类ID，NULL表示一级分类" json:"parent_id,omitempty"`
	RootID     uint64         `gorm:"index;not null;comment:根分类ID" json:"root_id"`
	IsBuiltin  bool           `gorm:"default:false;comment:是否为内置分类" json:"is_builtin"`
	SortOrder  int            `gorm:"default:0;comment:排序顺序" json:"sort_order"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ServiceCategory) TableName() string {
	return "service_categories"
}
