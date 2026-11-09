package storage

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/types"
)

var (
	detailHostMulti     = uuid.MustParse("00000000-0000-0000-0000-0000000000a1") // 同一业务两个模块
	detailHostPool      = uuid.MustParse("00000000-0000-0000-0000-0000000000a2") // 资源池目录
	detailHostDestroyed = uuid.MustParse("00000000-0000-0000-0000-0000000000a3") // 已销毁，无归属
	detailHostDeleted   = uuid.MustParse("00000000-0000-0000-0000-0000000000a4") // 已软删
)

func setupHostDetailDB(t *testing.T) *gorm.DB {
	t.Helper()
	db := setupHostTestDB(t)
	exec := func(sql string, args ...any) { require.NoError(t, db.Exec(sql, args...).Error, sql) }
	// setupHostTestDB 已建 hosts / cloud_areas / businesses / host_node_memberships
	exec(`CREATE TABLE sets (id INTEGER PRIMARY KEY, business_id INTEGER, name TEXT)`)
	exec(`CREATE TABLE modules (id INTEGER PRIMARY KEY, set_id INTEGER, business_id INTEGER, name TEXT)`)
	exec(`CREATE TABLE resource_directories (id INTEGER PRIMARY KEY, name TEXT)`)

	area := uuid.MustParse("00000000-0000-0000-0000-0000000000c1")
	exec(`INSERT INTO cloud_areas (id, name, identifier) VALUES (?, '广州 VPC', 'gz')`, area)
	exec(`INSERT INTO businesses (id, name, identifier) VALUES (1001, '支付清结算', 'pay')`)
	exec(`INSERT INTO sets VALUES (11, 1001, '生产集群')`)
	exec(`INSERT INTO modules VALUES (111, 11, 1001, '支付网关'), (112, 11, 1001, '风控服务')`)
	exec(`INSERT INTO resource_directories VALUES (2, '高配计算')`)

	now := time.Date(2026, 9, 20, 2, 0, 0, 0, time.UTC)
	host := func(id uuid.UUID, display int, name, ip string, destroyed bool, deletedAt any) {
		exec(`INSERT INTO hosts (id, display_id, created_at, updated_at, deleted_at, tenant_id, cloud_area_id, host_name, primary_ip,
			ip_addresses, cpu, memory, disk_size, os_type, status, is_destroyed, cloud_metadata, custom_fields)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', 8, 32768, 200, 'linux', 'running', ?, '{"zone":"gz-3"}', '{"固资编号":"WD-1"}')`,
			id, display, now, now, deletedAt, uuid.Nil, area, name, ip, destroyed)
	}
	host(detailHostMulti, 1, "pay-gw-01", "10.20.1.11", false, nil)
	host(detailHostPool, 2, "pool-hc-01", "10.90.3.11", false, nil)
	host(detailHostDestroyed, 3, "old-01", "10.90.3.12", true, nil)
	host(detailHostDeleted, 4, "gone-01", "10.90.3.13", false, now)
	exec(`INSERT INTO host_node_memberships (host_id, node_kind, node_id, business_id)
		VALUES (?, 'biz_module', 112, 1001), (?, 'biz_module', 111, 1001), (?, 'pool_directory', 2, NULL)`,
		detailHostMulti, detailHostMulti, detailHostPool)
	return db
}

func TestHostDetailRepository_GetHostDetailByDisplayID(t *testing.T) {
	repo := NewHostDetailRepository(setupHostDetailDB(t))
	ctx := context.Background()

	d, err := repo.GetHostDetailByDisplayID(ctx, 1)
	require.NoError(t, err)
	require.NotNil(t, d)
	require.Equal(t, detailHostMulti, d.ID)
	require.EqualValues(t, 1, d.DisplayID)
	require.Equal(t, "pay-gw-01", d.HostName)
	require.Equal(t, "10.20.1.11", d.PrimaryIP)
	require.Equal(t, "广州 VPC", d.CloudAreaName)
	require.Equal(t, "WD-1", d.CustomFields["固资编号"])
	require.Equal(t, "gz-3", d.CloudMetadata["zone"])
	// 多处归属，按 node_id 排序
	require.Equal(t, []types.HostPlacement{
		{Kind: types.HostPlacementBusiness, BusinessID: 1001, BusinessName: "支付清结算", SetID: 11, SetName: "生产集群", ModuleID: 111, ModuleName: "支付网关"},
		{Kind: types.HostPlacementBusiness, BusinessID: 1001, BusinessName: "支付清结算", SetID: 11, SetName: "生产集群", ModuleID: 112, ModuleName: "风控服务"},
	}, d.Placements)

	d, err = repo.GetHostDetailByDisplayID(ctx, 2)
	require.NoError(t, err)
	require.Equal(t, []types.HostPlacement{{Kind: types.HostPlacementPool, DirectoryID: 2, DirectoryName: "高配计算"}}, d.Placements)

	// 已销毁的主机照常返回，没有归属时 placements 是空数组
	d, err = repo.GetHostDetailByDisplayID(ctx, 3)
	require.NoError(t, err)
	require.NotNil(t, d)
	require.True(t, d.IsDestroyed)
	require.NotNil(t, d.Placements)
	require.Empty(t, d.Placements)

	// 软删和不存在都返回 nil
	for _, id := range []int64{4, 999} {
		d, err = repo.GetHostDetailByDisplayID(ctx, id)
		require.NoError(t, err)
		require.Nil(t, d, id)
	}
}

func TestListHostPlacements_EmptyInput(t *testing.T) {
	out, err := ListHostPlacements(context.Background(), setupHostDetailDB(t), nil)
	require.NoError(t, err)
	require.Empty(t, out)
}
