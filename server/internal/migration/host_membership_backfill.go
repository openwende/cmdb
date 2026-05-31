package migration

import (
	"context"
	"fmt"

	"gorm.io/gorm"
)

// MembershipBackfill 将既有 host_module_relations / resource_pool_hosts 回填进
// host_node_memberships（P1 真相收敛阶段 0，见 docs/P1-host-membership-convergence.md）。
//
// 幂等：依赖 host_node_memberships 的 UNIQUE(host_id,node_kind,node_id,relation_type) +
// ON CONFLICT DO NOTHING，可重复执行。不改动旧表（阶段 1 才双写/退役）。
type MembershipBackfill struct {
	db *gorm.DB
}

func NewMembershipBackfill(db *gorm.DB) *MembershipBackfill {
	return &MembershipBackfill{db: db}
}

// 业务模块归属：host_module_relations + modules(取 business_id/set_id 冗余) → biz_module 行
const backfillModuleSQL = `
INSERT INTO host_node_memberships
	(host_id, node_kind, node_id, business_id, set_id, relation_type, source, created_at, created_by)
SELECT hmr.host_id, 'biz_module', hmr.module_id, m.business_id, m.set_id, 'member_of', 'backfill', hmr.created_at, 'system'
FROM host_module_relations hmr
JOIN modules m ON m.id = hmr.module_id AND m.deleted_at IS NULL
WHERE hmr.host_id IS NOT NULL
ON CONFLICT (host_id, node_kind, node_id, relation_type) DO NOTHING`

// 资源池归属：resource_pool_hosts → pool_directory 行（无 business/set）
const backfillPoolSQL = `
INSERT INTO host_node_memberships
	(host_id, node_kind, node_id, business_id, set_id, relation_type, source, created_at, created_by)
SELECT rph.host_id, 'pool_directory', rph.directory_id, NULL, NULL, 'member_of', 'backfill', rph.imported_at, COALESCE(rph.imported_by, 'system')
FROM resource_pool_hosts rph
WHERE rph.host_id IS NOT NULL
ON CONFLICT (host_id, node_kind, node_id, relation_type) DO NOTHING`

// Run 执行回填，返回各自新增行数。
func (m *MembershipBackfill) Run(ctx context.Context) (moduleRows, poolRows int64, err error) {
	r1 := m.db.WithContext(ctx).Exec(backfillModuleSQL)
	if r1.Error != nil {
		return 0, 0, fmt.Errorf("回填业务模块归属: %w", r1.Error)
	}
	r2 := m.db.WithContext(ctx).Exec(backfillPoolSQL)
	if r2.Error != nil {
		return r1.RowsAffected, 0, fmt.Errorf("回填资源池归属: %w", r2.Error)
	}
	fmt.Printf("✅ 回填完成: 业务模块归属 +%d 行, 资源池归属 +%d 行\n", r1.RowsAffected, r2.RowsAffected)
	return r1.RowsAffected, r2.RowsAffected, nil
}

// Verify 对账：新表归属计数应不少于旧表（幂等回填后应相等）。
func (m *MembershipBackfill) Verify(ctx context.Context) error {
	var moduleOld, poolOld, hnmModule, hnmPool int64
	m.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM host_module_relations hmr JOIN modules mo ON mo.id=hmr.module_id AND mo.deleted_at IS NULL`).Scan(&moduleOld)
	m.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM resource_pool_hosts`).Scan(&poolOld)
	m.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM host_node_memberships WHERE node_kind='biz_module'`).Scan(&hnmModule)
	m.db.WithContext(ctx).Raw(`SELECT COUNT(*) FROM host_node_memberships WHERE node_kind='pool_directory'`).Scan(&hnmPool)
	if hnmModule < moduleOld || hnmPool < poolOld {
		return fmt.Errorf("回填对账不一致: 业务模块 旧=%d 新=%d, 资源池 旧=%d 新=%d", moduleOld, hnmModule, poolOld, hnmPool)
	}
	fmt.Printf("✅ 对账通过: 业务模块 旧=%d 新=%d, 资源池 旧=%d 新=%d\n", moduleOld, hnmModule, poolOld, hnmPool)
	return nil
}
