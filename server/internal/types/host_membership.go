package types

import (
	"time"

	"github.com/google/uuid"
)

// 节点类型（host_node_memberships.node_kind）
const (
	// NodeKindPoolDirectory 资源池目录节点（node_id → resource_directories.id）
	NodeKindPoolDirectory = "pool_directory"
	// NodeKindBizModule 业务模块节点（node_id → modules.id）
	NodeKindBizModule = "biz_module"
)

// HostMembershipRelMemberOf 默认归属关系类型
const HostMembershipRelMemberOf = "member_of"

// 归属变更来源（host_node_memberships.source）
const (
	HostMembershipSourceImport   = "import"
	HostMembershipSourceAllocate = "allocate"
	HostMembershipSourceTransfer = "transfer"
	HostMembershipSourceReclaim  = "reclaim"
	HostMembershipSourceRecycle  = "recycle"
	HostMembershipSourceBackfill = "backfill"
)

// HostNodeMembership 主机归属统一关系表
//
// 收敛 host_module_relations / host_business_relations / resource_pool_hosts 三表。
// 主机的一切归属（资源池目录 / 业务模块 / 空闲机 / 待回收）都表达为指向某个 node 的一行；
// 主机流转 = 改这一行的 node。详见 docs/P1-host-membership-convergence.md。
type HostNodeMembership struct {
	ID           uint64    `gorm:"primaryKey" json:"id"`
	HostID       uuid.UUID `gorm:"type:uuid;not null;index" json:"host_id"`
	NodeKind     string    `gorm:"size:20;not null" json:"node_kind"`
	NodeID       uint64    `gorm:"not null" json:"node_id"`
	BusinessID   *uint64   `gorm:"index" json:"business_id,omitempty"`
	SetID        *uint64   `json:"set_id,omitempty"`
	RelationType string    `gorm:"size:50;not null;default:member_of" json:"relation_type"`
	Source       string    `gorm:"size:30" json:"source"`
	CreatedAt    time.Time `json:"created_at"`
	CreatedBy    string    `gorm:"size:100" json:"created_by"`
}

func (HostNodeMembership) TableName() string {
	return "host_node_memberships"
}
