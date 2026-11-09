// Package host_membership 提供主机归属的单一写入通道。
//
// 设计见 docs/P1-host-membership-convergence.md。主机的一切归属（资源池目录 / 业务模块 /
// 空闲机 / 待回收）统一表达为 host_node_memberships 表中指向某个 node 的一行；主机流转 =
// 改这一行的 node。所有写操作经此服务，在单事务内保证以下不变量：
//
//	I1 无游离：归属迁移删旧必同事务增新，主机永远至少属于一个 node。
//	I2 池/业务互斥：同一主机不同时存在资源池目录归属与业务模块归属。
//	I4 业务多属：一主机可属多个业务模块（由 UNIQUE 约束承载）。
//	I5 单一审计点：任何归属变更经唯一写入点统一落审计。
//
// 阶段 2 起：本服务只写新表 host_node_memberships（旧三表已退役，读写均不再涉及）。
package host_membership

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/openwende/cmdb/server/internal/auth"
	"github.com/openwende/cmdb/server/internal/types"
)

// NodeRef 节点引用：资源池目录 或 业务模块。
type NodeRef struct {
	Kind string // types.NodeKindPoolDirectory | types.NodeKindBizModule
	ID   uint64
}

// AuditRecorder 归属变更审计落点（不变量 I5）。
// 阶段 0 可注入 nil（暂不落审计）；阶段 1 接 resource_histories。
type AuditRecorder interface {
	RecordHostMembershipChange(tx *gorm.DB, hostID uuid.UUID, before, after []NodeRef, source, by string) error
}

// MoveOptions 归属变更选项。
type MoveOptions struct {
	Source string // types.HostMembershipSourceXxx
	By     string // 操作人；为空时取请求 context 中的操作人（auth.OperatorFromContext）
	// Additive=true：追加归属（保留其它业务模块归属，仅清资源池归属），用于"追加到业务模块"。
	// Additive=false（默认）：替换归属（主机最终只在 to），用于分配/转移/回收/待回收。
	Additive bool
}

// withOperator 未显式指定操作人时，取请求 context 中的操作人，保证审计 changed_by 为真实用户。
func (o MoveOptions) withOperator(ctx context.Context) MoveOptions {
	if o.By == "" {
		o.By = auth.OperatorFromContext(ctx)
	}
	return o
}

// Result 批量操作结果。
type Result struct {
	Total      int
	Successful int
	Failed     int
	Errors     []string
}

// Service 主机归属统一服务：单一写入点，保证不变量 I1-I5。
type Service interface {
	// WithTx 返回绑定到给定事务的服务，用于跨服务事务编排。
	WithTx(tx *gorm.DB) Service
	// Attach 首次归属（导入）：主机进入某节点，不触碰其它归属。幂等。
	Attach(ctx context.Context, hostIDs []uuid.UUID, node NodeRef, opts MoveOptions) (*Result, error)
	// Move 归属迁移（分配/转移/回收/待回收）：单事务内删旧 + 增新 + 审计，保证 I1/I2。
	Move(ctx context.Context, hostIDs []uuid.UUID, to NodeRef, opts MoveOptions) (*Result, error)
	// MoveBetweenModules 业务模块间转移：删源模块归属（removeModuleID；nil=该主机的空闲/默认模块）、
	// 清资源池归属、追加目标模块归属，并保留其它业务模块归属（I4 多属）。用于 topology TransferHosts。
	MoveBetweenModules(ctx context.Context, hostIDs []uuid.UUID, targetModuleID uint64, removeModuleID *uint64, opts MoveOptions) (*Result, error)
	// NodesOfHost 查询主机当前归属节点。
	NodesOfHost(ctx context.Context, hostID uuid.UUID) ([]NodeRef, error)
}

type service struct {
	db    *gorm.DB
	audit AuditRecorder
}

// Option 服务可选项。
type Option func(*service)

// NewService 创建主机归属服务。audit 可为 nil（暂不落审计）。
func NewService(db *gorm.DB, audit AuditRecorder, opts ...Option) Service {
	s := &service{db: db, audit: audit}
	for _, o := range opts {
		o(s)
	}
	return s
}

func (s *service) WithTx(tx *gorm.DB) Service {
	return &service{db: tx, audit: s.audit}
}

func validateNode(n NodeRef) error {
	if n.Kind != types.NodeKindPoolDirectory && n.Kind != types.NodeKindBizModule {
		return fmt.Errorf("非法节点类型: %q", n.Kind)
	}
	if n.ID == 0 {
		return fmt.Errorf("非法节点ID: 0")
	}
	return nil
}

// resolveDims 解析节点的冗余维度（business_id/set_id）。业务模块从 modules 表取；资源池目录留空。
func (s *service) resolveDims(ctx context.Context, node NodeRef) (bizID, setID *uint64, err error) {
	if node.Kind != types.NodeKindBizModule {
		return nil, nil, nil
	}
	var m types.Module
	if err := s.db.WithContext(ctx).Select("id", "business_id", "set_id").First(&m, node.ID).Error; err != nil {
		return nil, nil, fmt.Errorf("目标业务模块不存在(id=%d): %w", node.ID, err)
	}
	b, st := m.BusinessID, m.SetID
	return &b, &st, nil
}

func (s *service) Attach(ctx context.Context, hostIDs []uuid.UUID, node NodeRef, opts MoveOptions) (*Result, error) {
	opts = opts.withOperator(ctx)
	if err := validateNode(node); err != nil {
		return nil, err
	}
	bizID, setID, err := s.resolveDims(ctx, node)
	if err != nil {
		return nil, err
	}
	result := &Result{Total: len(hostIDs), Errors: make([]string, 0)}
	now := time.Now().UTC()
	for _, hostID := range hostIDs {
		txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			row := newMembershipRow(hostID, node, bizID, setID, opts, now)
			return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(row).Error
		})
		if txErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, txErr.Error()))
			continue
		}
		result.Successful++
	}
	return result, nil
}

func (s *service) Move(ctx context.Context, hostIDs []uuid.UUID, to NodeRef, opts MoveOptions) (*Result, error) {
	opts = opts.withOperator(ctx)
	if err := validateNode(to); err != nil {
		return nil, err
	}
	bizID, setID, err := s.resolveDims(ctx, to)
	if err != nil {
		return nil, err
	}
	result := &Result{Total: len(hostIDs), Errors: make([]string, 0)}
	now := time.Now().UTC()

	for _, hostID := range hostIDs {
		txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			// 读取并（PG 上）锁定该主机现有归属，防并发归属竞态
			readQ := tx.Where("host_id = ?", hostID)
			if tx.Dialector.Name() == "postgres" {
				readQ = readQ.Clauses(clause.Locking{Strength: "UPDATE"})
			}
			var before []types.HostNodeMembership
			if err := readQ.Find(&before).Error; err != nil {
				return err
			}

			// I2 池/业务互斥 + additive 语义：决定删除哪些旧行
			delQ := tx.Where("host_id = ?", hostID)
			if opts.Additive && to.Kind == types.NodeKindBizModule {
				// 追加到业务模块：保留其它业务模块归属，仅清资源池归属
				delQ = delQ.Where("node_kind = ?", types.NodeKindPoolDirectory)
			}
			// 非 additive：删除全部，主机最终只属于 to
			if err := delQ.Delete(&types.HostNodeMembership{}).Error; err != nil {
				return err
			}

			// I1 增 to 行（幂等）——删旧后立即增新，保证不游离
			row := newMembershipRow(hostID, to, bizID, setID, opts, now)
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(row).Error; err != nil {
				return err
			}

			// I5 审计（audit 可为 nil）
			if s.audit != nil {
				if err := s.audit.RecordHostMembershipChange(tx, hostID, toNodeRefs(before), []NodeRef{to}, opts.Source, opts.By); err != nil {
					return err
				}
			}
			return nil
		})
		if txErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, txErr.Error()))
			continue
		}
		result.Successful++
	}
	return result, nil
}

func (s *service) MoveBetweenModules(ctx context.Context, hostIDs []uuid.UUID, targetModuleID uint64, removeModuleID *uint64, opts MoveOptions) (*Result, error) {
	opts = opts.withOperator(ctx)
	to := NodeRef{Kind: types.NodeKindBizModule, ID: targetModuleID}
	if err := validateNode(to); err != nil {
		return nil, err
	}
	bizID, setID, err := s.resolveDims(ctx, to)
	if err != nil {
		return nil, err
	}
	result := &Result{Total: len(hostIDs), Errors: make([]string, 0)}
	now := time.Now().UTC()

	for _, hostID := range hostIDs {
		txErr := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			// 读取并（PG 上）锁定该主机现有归属，防并发竞态
			readQ := tx.Where("host_id = ?", hostID)
			if tx.Dialector.Name() == "postgres" {
				readQ = readQ.Clauses(clause.Locking{Strength: "UPDATE"})
			}
			var before []types.HostNodeMembership
			if err := readQ.Find(&before).Error; err != nil {
				return err
			}

			// 计算要删的源业务模块：指定 removeModuleID 则删它（≠目标时）；否则删该主机的空闲(默认)模块归属
			var removeIDs []uint64
			if removeModuleID != nil {
				if *removeModuleID != targetModuleID {
					removeIDs = []uint64{*removeModuleID}
				}
			} else {
				if err := tx.Table("host_node_memberships AS hnm").
					Joins("JOIN modules m ON m.id = hnm.node_id").
					Where("hnm.host_id = ? AND hnm.node_kind = ? AND hnm.node_id <> ? AND m.is_default = ?",
						hostID, types.NodeKindBizModule, targetModuleID, true).
					Pluck("hnm.node_id", &removeIDs).Error; err != nil {
					return err
				}
			}

			// 删源业务模块归属
			if len(removeIDs) > 0 {
				if err := tx.Where("host_id = ? AND node_kind = ? AND node_id IN ?", hostID, types.NodeKindBizModule, removeIDs).
					Delete(&types.HostNodeMembership{}).Error; err != nil {
					return err
				}
			}
			// 清资源池归属（进业务必出池，I2）
			if err := tx.Where("host_id = ? AND node_kind = ?", hostID, types.NodeKindPoolDirectory).
				Delete(&types.HostNodeMembership{}).Error; err != nil {
				return err
			}
			// 增目标业务模块归属（幂等），保留其它业务模块归属（I4）
			row := newMembershipRow(hostID, to, bizID, setID, opts, now)
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(row).Error; err != nil {
				return err
			}

			// I5 审计
			if s.audit != nil {
				if err := s.audit.RecordHostMembershipChange(tx, hostID, toNodeRefs(before), []NodeRef{to}, opts.Source, opts.By); err != nil {
					return err
				}
			}
			return nil
		})
		if txErr != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, txErr.Error()))
			continue
		}
		result.Successful++
	}
	return result, nil
}

func (s *service) NodesOfHost(ctx context.Context, hostID uuid.UUID) ([]NodeRef, error) {
	var rows []types.HostNodeMembership
	if err := s.db.WithContext(ctx).Where("host_id = ?", hostID).Find(&rows).Error; err != nil {
		return nil, err
	}
	return toNodeRefs(rows), nil
}

func newMembershipRow(hostID uuid.UUID, node NodeRef, bizID, setID *uint64, opts MoveOptions, now time.Time) *types.HostNodeMembership {
	return &types.HostNodeMembership{
		HostID:       hostID,
		NodeKind:     node.Kind,
		NodeID:       node.ID,
		BusinessID:   bizID,
		SetID:        setID,
		RelationType: types.HostMembershipRelMemberOf,
		Source:       opts.Source,
		CreatedBy:    opts.By,
		CreatedAt:    now,
	}
}

func toNodeRefs(rows []types.HostNodeMembership) []NodeRef {
	refs := make([]NodeRef, 0, len(rows))
	for _, r := range rows {
		refs = append(refs, NodeRef{Kind: r.NodeKind, ID: r.NodeID})
	}
	return refs
}
