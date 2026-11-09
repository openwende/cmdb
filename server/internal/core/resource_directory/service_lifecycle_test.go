package resource_directory

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/openwende/cmdb-server/internal/core/host_membership"
	"github.com/openwende/cmdb-server/internal/types"
)

func setupResourceLifecycleTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	sqls := []string{
		`CREATE TABLE resource_directories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			parent_id INTEGER,
			name TEXT NOT NULL,
			description TEXT,
			path TEXT,
			level INTEGER,
			sort_order INTEGER,
			is_default BOOLEAN,
			created_by TEXT,
			updated_by TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE modules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id INTEGER NOT NULL,
			business_id BIGINT NOT NULL,
			service_template_id INTEGER,
			service_category_id INTEGER,
			name TEXT NOT NULL,
			description TEXT,
			service_type TEXT,
			sort_order INTEGER,
			is_default BOOLEAN,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE hosts (
			id TEXT PRIMARY KEY,
			display_id INTEGER,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			tenant_id TEXT,
			cloud_area_id TEXT,
			host_name TEXT NOT NULL,
			primary_ip TEXT,
			status TEXT,
			is_destroyed BOOLEAN NOT NULL DEFAULT FALSE
		)`,
		// 阶段2：写只经 hms 落新表 host_node_memberships（旧三表已退役）
		`CREATE TABLE host_node_memberships (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			host_id TEXT NOT NULL,
			node_kind TEXT NOT NULL,
			node_id BIGINT NOT NULL,
			business_id BIGINT,
			set_id BIGINT,
			relation_type TEXT NOT NULL DEFAULT 'member_of',
			source TEXT,
			created_at DATETIME,
			created_by TEXT,
			UNIQUE (host_id, node_kind, node_id, relation_type)
		)`,
	}

	for _, sql := range sqls {
		require.NoError(t, db.Exec(sql).Error)
	}

	return db
}

// newLifecycleService 构建注入统一归属通道(hms)的资源目录服务（阶段2：归属写只经 hms 落新表）。
func newLifecycleService(db *gorm.DB) Service {
	return NewService(db, WithHostMembership(host_membership.NewService(db, nil)))
}

func membershipCount(t *testing.T, db *gorm.DB, host uuid.UUID, kind string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, db.Model(&types.HostNodeMembership{}).
		Where("host_id = ? AND node_kind = ?", host, kind).Count(&n).Error)
	return n
}

// 分配：资源池主机 → 业务模块（经 hms：进模块 + 移出资源池，I2 互斥）。
func TestAllocateHosts_MovesPoolHostToModule(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := newLifecycleService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	host := uuid.New()
	var businessID uint64 = 1000

	require.NoError(t, db.Exec(`INSERT INTO modules (id, set_id, business_id, name, is_default, created_at, updated_at) VALUES (5, 5, ?, '空闲机', TRUE, ?, ?)`, businessID, now, now).Error)
	// 主机当前在资源池目录 1
	require.NoError(t, db.Create(&types.HostNodeMembership{
		HostID: host, NodeKind: types.NodeKindPoolDirectory, NodeID: 1, RelationType: types.HostMembershipRelMemberOf,
	}).Error)

	result, err := svc.AllocateHosts(ctx, &types.AllocateHostsRequest{HostIDs: []uuid.UUID{host}, TargetModuleID: 5})
	require.NoError(t, err)
	require.EqualValues(t, 1, result.Successful)
	require.EqualValues(t, 0, result.Failed)

	// 分配后：进业务模块 5、移出资源池
	require.EqualValues(t, 1, membershipCount(t, db, host, types.NodeKindBizModule))
	require.Zero(t, membershipCount(t, db, host, types.NodeKindPoolDirectory))
	var row types.HostNodeMembership
	require.NoError(t, db.Where("host_id = ? AND node_kind = ?", host, types.NodeKindBizModule).First(&row).Error)
	require.EqualValues(t, 5, row.NodeID)
	require.NotNil(t, row.BusinessID)
	require.EqualValues(t, businessID, *row.BusinessID, "business_id 由 module 推导")
}

// 分配目标模块不存在 → resolveDims 失败 → 整体报错。
func TestAllocateHosts_FailsWhenModuleMissing(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := newLifecycleService(db)
	ctx := context.Background()

	_, err := svc.AllocateHosts(ctx, &types.AllocateHostsRequest{HostIDs: []uuid.UUID{uuid.New()}, TargetModuleID: 999})
	require.Error(t, err)
}

// 回收：业务模块主机 → 资源池目录（经 hms：进池 + 移出业务模块，I2 互斥）。
func TestReclaimHosts_MovesModuleHostToPool(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := newLifecycleService(db)
	ctx := context.Background()
	host := uuid.New()
	var businessID uint64 = 1002
	bid := businessID

	// 主机当前在业务模块 1
	require.NoError(t, db.Create(&types.HostNodeMembership{
		HostID: host, NodeKind: types.NodeKindBizModule, NodeID: 1, BusinessID: &bid, RelationType: types.HostMembershipRelMemberOf,
	}).Error)

	result, err := svc.ReclaimHosts(ctx, &types.ReclaimHostsRequest{HostIDs: []uuid.UUID{host}, DirectoryID: 2, Remark: "reclaim"}, "tester")
	require.NoError(t, err)
	require.EqualValues(t, 1, result.Successful)
	require.EqualValues(t, 0, result.Failed)

	// 回收后：进资源池目录 2、移出业务模块
	require.EqualValues(t, 1, membershipCount(t, db, host, types.NodeKindPoolDirectory))
	require.Zero(t, membershipCount(t, db, host, types.NodeKindBizModule))
	var row types.HostNodeMembership
	require.NoError(t, db.Where("host_id = ? AND node_kind = ?", host, types.NodeKindPoolDirectory).First(&row).Error)
	require.EqualValues(t, 2, row.NodeID)
}

// 生命周期状态：在池→pooled；在业务模块→allocated。
func TestLifecycle_GetHostLifecycle_ReturnsResourceStatus(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := newLifecycleService(db)
	ctx := context.Background()
	pooledHost := uuid.New()
	allocatedHost := uuid.New()
	var businessID uint64 = 1003
	bid := businessID

	require.NoError(t, db.Create(&types.HostNodeMembership{
		HostID: pooledHost, NodeKind: types.NodeKindPoolDirectory, NodeID: 1, RelationType: types.HostMembershipRelMemberOf,
	}).Error)
	require.NoError(t, db.Create(&types.HostNodeMembership{
		HostID: allocatedHost, NodeKind: types.NodeKindBizModule, NodeID: 1, BusinessID: &bid, RelationType: types.HostMembershipRelMemberOf,
	}).Error)

	pooled, err := svc.GetHostLifecycle(ctx, pooledHost)
	require.NoError(t, err)
	require.Equal(t, "pooled", pooled.ResourceStatus)

	allocated, err := svc.GetHostLifecycle(ctx, allocatedHost)
	require.NoError(t, err)
	require.Equal(t, "allocated", allocated.ResourceStatus)
}
