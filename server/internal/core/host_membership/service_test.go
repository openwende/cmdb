package host_membership

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/internal/types"
)

// 业务模块 id 约定（测试数据）
const (
	idleModuleID    = uint64(1)  // 空闲机模块（is_default）
	moduleAID       = uint64(10) // 业务模块 A
	moduleBID       = uint64(11) // 业务模块 B
	recycleModuleID = uint64(2)  // 待回收模块
	poolDirID       = uint64(1)  // 资源池默认目录
	testBiz         = uint64(1000)
	testSet         = uint64(5)
)

func setupHMTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	stmts := []string{
		`CREATE TABLE host_node_memberships (
			id            INTEGER PRIMARY KEY AUTOINCREMENT,
			host_id       TEXT NOT NULL,
			node_kind     TEXT NOT NULL,
			node_id       INTEGER NOT NULL,
			business_id   INTEGER,
			set_id        INTEGER,
			relation_type TEXT NOT NULL DEFAULT 'member_of',
			source        TEXT,
			created_at    DATETIME,
			created_by    TEXT,
			UNIQUE (host_id, node_kind, node_id, relation_type)
		)`,
		`CREATE TABLE modules (
			id          INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id      INTEGER NOT NULL,
			business_id BIGINT NOT NULL,
			name        TEXT,
			is_default  BOOLEAN,
			created_at  DATETIME,
			updated_at  DATETIME,
			deleted_at  DATETIME
		)`,
		// 旧三表（阶段 1 镜像目标）
		`CREATE TABLE host_module_relations (host_id TEXT NOT NULL, module_id INTEGER NOT NULL, created_at DATETIME, PRIMARY KEY (host_id, module_id))`,
		`CREATE TABLE host_business_relations (host_id TEXT NOT NULL, business_id BIGINT NOT NULL, created_at DATETIME, PRIMARY KEY (host_id, business_id))`,
		`CREATE TABLE resource_pool_hosts (host_id TEXT PRIMARY KEY, directory_id INTEGER NOT NULL, imported_at DATETIME, imported_by TEXT, remark TEXT)`,
		// 审计落点依赖的表（R3）
		`CREATE TABLE hosts (id TEXT PRIMARY KEY, display_id INTEGER, primary_ip TEXT, host_name TEXT, deleted_at DATETIME)`,
		`CREATE TABLE businesses (id INTEGER PRIMARY KEY, name TEXT)`,
		`CREATE TABLE resource_histories (id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER, model_uid TEXT, change_type TEXT, before_data TEXT, after_data TEXT, changed_by TEXT, changed_at DATETIME, client_ip TEXT, user_agent TEXT, resource_name TEXT, biz_name TEXT)`,
	}
	for _, s := range stmts {
		require.NoError(t, db.Exec(s).Error)
	}
	// 业务模块种子：空闲机/待回收/A/B 同属 biz=1000,set=5
	require.NoError(t, db.Exec(
		`INSERT INTO modules (id, set_id, business_id, name, is_default) VALUES (?,?,?,?,?)`,
		idleModuleID, testSet, testBiz, "空闲机", true).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO modules (id, set_id, business_id, name, is_default) VALUES (?,?,?,?,?)`,
		recycleModuleID, testSet, testBiz, "待回收", false).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO modules (id, set_id, business_id, name, is_default) VALUES (?,?,?,?,?)`,
		moduleAID, testSet, testBiz, "module-A", false).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO modules (id, set_id, business_id, name, is_default) VALUES (?,?,?,?,?)`,
		moduleBID, testSet, testBiz, "module-B", false).Error)
	return db
}

func poolNode() NodeRef   { return NodeRef{Kind: types.NodeKindPoolDirectory, ID: poolDirID} }
func mod(id uint64) NodeRef { return NodeRef{Kind: types.NodeKindBizModule, ID: id} }

func membershipsOf(t *testing.T, db *gorm.DB, hostID uuid.UUID) []types.HostNodeMembership {
	t.Helper()
	var rows []types.HostNodeMembership
	require.NoError(t, db.Where("host_id = ?", hostID).Find(&rows).Error)
	return rows
}

// fakeAudit 记录审计调用，用于验证 I5。
type fakeAudit struct{ calls []auditCall }
type auditCall struct {
	hostID        uuid.UUID
	before, after []NodeRef
	source, by    string
}

func (f *fakeAudit) RecordHostMembershipChange(_ *gorm.DB, hostID uuid.UUID, before, after []NodeRef, source, by string) error {
	f.calls = append(f.calls, auditCall{hostID, before, after, source, by})
	return nil
}

// 导入：主机进资源池目录，仅一行 pool_directory 归属。
func TestAttach_PlacesHostInPool(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	host := uuid.New()

	res, err := svc.Attach(context.Background(), []uuid.UUID{host}, poolNode(),
		MoveOptions{Source: types.HostMembershipSourceImport, By: "admin"})
	require.NoError(t, err)
	require.Equal(t, 1, res.Successful)

	rows := membershipsOf(t, db, host)
	require.Len(t, rows, 1)
	require.Equal(t, types.NodeKindPoolDirectory, rows[0].NodeKind)
	require.Equal(t, poolDirID, rows[0].NodeID)
	require.Nil(t, rows[0].BusinessID) // 资源池目录无 business
}

// 分配：池 → 业务空闲机。验证 I2 互斥（pool 行被清）+ 冗余维度填充。
func TestMove_AllocatePoolToModule_MutexAndDims(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	host := uuid.New()
	_, err := svc.Attach(context.Background(), []uuid.UUID{host}, poolNode(), MoveOptions{Source: types.HostMembershipSourceImport})
	require.NoError(t, err)

	res, err := svc.Move(context.Background(), []uuid.UUID{host}, mod(idleModuleID),
		MoveOptions{Source: types.HostMembershipSourceAllocate, By: "admin"})
	require.NoError(t, err)
	require.Equal(t, 1, res.Successful)

	rows := membershipsOf(t, db, host)
	require.Len(t, rows, 1, "池归属应被清除（I2 互斥）")
	require.Equal(t, types.NodeKindBizModule, rows[0].NodeKind)
	require.Equal(t, idleModuleID, rows[0].NodeID)
	require.NotNil(t, rows[0].BusinessID)
	require.Equal(t, testBiz, *rows[0].BusinessID, "business_id 应由 module 冗余填充")
	require.Equal(t, testSet, *rows[0].SetID)
}

// 转移：模块A → 模块B（非 additive）。最终只在 B。
func TestMove_TransferReplacesModule(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	host := uuid.New()
	ctx := context.Background()
	_, _ = svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{})
	_, _ = svc.Move(ctx, []uuid.UUID{host}, mod(moduleAID), MoveOptions{Source: types.HostMembershipSourceAllocate})

	_, err := svc.Move(ctx, []uuid.UUID{host}, mod(moduleBID), MoveOptions{Source: types.HostMembershipSourceTransfer})
	require.NoError(t, err)

	rows := membershipsOf(t, db, host)
	require.Len(t, rows, 1)
	require.Equal(t, moduleBID, rows[0].NodeID)
}

// 待回收 + 回收：模块 → 待回收 → 资源池。验证全程不游离（I1）且互斥（I2）。
func TestMove_RecycleThenReclaim_NoOrphan(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	host := uuid.New()
	ctx := context.Background()
	_, _ = svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{})
	_, _ = svc.Move(ctx, []uuid.UUID{host}, mod(moduleAID), MoveOptions{Source: types.HostMembershipSourceAllocate})

	// → 待回收
	_, err := svc.Move(ctx, []uuid.UUID{host}, mod(recycleModuleID), MoveOptions{Source: types.HostMembershipSourceRecycle})
	require.NoError(t, err)
	nodes, _ := svc.NodesOfHost(ctx, host)
	require.Len(t, nodes, 1)
	require.Equal(t, recycleModuleID, nodes[0].ID)

	// → 回资源池（业务归属应被清，I2）
	_, err = svc.Move(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{Source: types.HostMembershipSourceReclaim})
	require.NoError(t, err)
	rows := membershipsOf(t, db, host)
	require.Len(t, rows, 1, "业务归属应被清（I2）")
	require.Equal(t, types.NodeKindPoolDirectory, rows[0].NodeKind)
}

// 追加（Additive）：保留其它业务模块归属，实现一主机多模块（I4），但资源池归属被清。
func TestMove_AdditiveKeepsModulesClearsPool(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	host := uuid.New()
	ctx := context.Background()
	_, _ = svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{})
	_, _ = svc.Move(ctx, []uuid.UUID{host}, mod(moduleAID), MoveOptions{Source: types.HostMembershipSourceAllocate})

	_, err := svc.Move(ctx, []uuid.UUID{host}, mod(moduleBID), MoveOptions{Source: types.HostMembershipSourceTransfer, Additive: true})
	require.NoError(t, err)

	rows := membershipsOf(t, db, host)
	require.Len(t, rows, 2, "应同时归属 A 和 B（I4 多属）")
	kinds := map[uint64]bool{}
	for _, r := range rows {
		require.Equal(t, types.NodeKindBizModule, r.NodeKind)
		kinds[r.NodeID] = true
	}
	require.True(t, kinds[moduleAID] && kinds[moduleBID])
}

// I5：归属变更经唯一写入点统一落审计，before/after 正确。
func TestMove_InvokesAudit(t *testing.T) {
	db := setupHMTestDB(t)
	audit := &fakeAudit{}
	svc := NewService(db, audit)
	host := uuid.New()
	ctx := context.Background()
	_, _ = svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{})

	_, err := svc.Move(ctx, []uuid.UUID{host}, mod(idleModuleID), MoveOptions{Source: types.HostMembershipSourceAllocate, By: "admin"})
	require.NoError(t, err)

	require.Len(t, audit.calls, 1)
	c := audit.calls[0]
	require.Equal(t, host, c.hostID)
	require.Equal(t, types.HostMembershipSourceAllocate, c.source)
	require.Len(t, c.before, 1)
	require.Equal(t, types.NodeKindPoolDirectory, c.before[0].Kind)
	require.Len(t, c.after, 1)
	require.Equal(t, idleModuleID, c.after[0].ID)
}

// 幂等：重复 Attach 同一节点不报错、不产生重复行。
func TestAttach_Idempotent(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	host := uuid.New()
	ctx := context.Background()
	_, err := svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{})
	require.NoError(t, err)
	res, err := svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{})
	require.NoError(t, err)
	require.Equal(t, 1, res.Successful)
	require.Len(t, membershipsOf(t, db, host), 1)
}

func TestValidateNode(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil)
	_, err := svc.Move(context.Background(), []uuid.UUID{uuid.New()}, NodeRef{Kind: "bogus", ID: 1}, MoveOptions{})
	require.Error(t, err)
	_, err = svc.Move(context.Background(), []uuid.UUID{uuid.New()}, NodeRef{Kind: types.NodeKindBizModule, ID: 0}, MoveOptions{})
	require.Error(t, err)
}

// R3 审计：归属变更写 resource_histories(model_uid=host)，使"审计→主机"tab 能查到主机流转。
func TestMove_WritesHostAudit(t *testing.T) {
	db := setupHMTestDB(t)
	host := uuid.New()
	require.NoError(t, db.Exec(`INSERT INTO hosts (id, display_id, primary_ip, host_name) VALUES (?, 7, '10.0.0.7', 'h7')`, host.String()).Error)
	require.NoError(t, db.Exec(`INSERT INTO businesses (id, name) VALUES (?, 'biz-x')`, testBiz).Error)

	svc := NewService(db, NewResourceHistoryAuditRecorder())
	_, err := svc.Move(context.Background(), []uuid.UUID{host}, mod(moduleAID),
		MoveOptions{Source: types.HostMembershipSourceAllocate, By: "admin"})
	require.NoError(t, err)

	var cnt int64
	require.NoError(t, db.Table("resource_histories").
		Where("model_uid = ? AND resource_id = ?", "host", 7).Count(&cnt).Error)
	require.Equal(t, int64(1), cnt, "应写入一条 host 审计")

	var row struct {
		ChangeType string
		AfterData  string
		BizName    string
		ChangedBy  string
	}
	require.NoError(t, db.Table("resource_histories").
		Select("change_type, after_data, biz_name, changed_by").
		Where("resource_id = ?", 7).Scan(&row).Error)
	require.Equal(t, "update", row.ChangeType)
	require.Equal(t, "admin", row.ChangedBy)
	require.Equal(t, "biz-x", row.BizName)
	require.Contains(t, row.AfterData, `"business_id":"1000"`)
	require.Contains(t, row.AfterData, "10.0.0.7")
}

func requireLegacyCount(t *testing.T, db *gorm.DB, table string, host uuid.UUID, want int64) {
	t.Helper()
	var n int64
	require.NoError(t, db.Table(table).Where("host_id = ?", host.String()).Count(&n).Error)
	require.Equalf(t, want, n, "%s 中 host 的行数", table)
}

// 阶段 1 双写：回资源池应镜像写 resource_pool_hosts —— 直接验证 R2 主机不再蒸发。
func TestMove_LegacyMirror_ReclaimWritesResourcePoolHost(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil, WithLegacyMirror())
	host := uuid.New()
	ctx := context.Background()

	// 先在业务模块（镜像写 host_module_relations + host_business_relations）
	_, err := svc.Move(ctx, []uuid.UUID{host}, mod(moduleAID), MoveOptions{Source: types.HostMembershipSourceAllocate, By: "admin"})
	require.NoError(t, err)
	requireLegacyCount(t, db, "host_module_relations", host, 1)
	requireLegacyCount(t, db, "host_business_relations", host, 1)
	requireLegacyCount(t, db, "resource_pool_hosts", host, 0)

	// 回资源池：镜像应删 module/business + 增 resource_pool_hosts（★ R2 修复）
	_, err = svc.Move(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{Source: types.HostMembershipSourceReclaim, By: "admin"})
	require.NoError(t, err)
	requireLegacyCount(t, db, "host_module_relations", host, 0)
	requireLegacyCount(t, db, "host_business_relations", host, 0)
	requireLegacyCount(t, db, "resource_pool_hosts", host, 1) // 旧读路径(资源池)能看到主机，不再蒸发
}

// 阶段 1 双写：进业务模块应清资源池镜像 —— 直接验证 R1 不再双重归属。
func TestMove_LegacyMirror_AllocateClearsResourcePoolHost(t *testing.T) {
	db := setupHMTestDB(t)
	svc := NewService(db, nil, WithLegacyMirror())
	host := uuid.New()
	ctx := context.Background()

	_, err := svc.Attach(ctx, []uuid.UUID{host}, poolNode(), MoveOptions{Source: types.HostMembershipSourceImport, By: "admin"})
	require.NoError(t, err)
	requireLegacyCount(t, db, "resource_pool_hosts", host, 1)

	_, err = svc.Move(ctx, []uuid.UUID{host}, mod(idleModuleID), MoveOptions{Source: types.HostMembershipSourceAllocate, By: "admin"})
	require.NoError(t, err)
	requireLegacyCount(t, db, "resource_pool_hosts", host, 0) // ★ R1 修复：进业务必出资源池
	requireLegacyCount(t, db, "host_module_relations", host, 1)
	requireLegacyCount(t, db, "host_business_relations", host, 1)
}
