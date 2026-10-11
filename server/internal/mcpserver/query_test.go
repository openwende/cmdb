package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var (
	hostGW   = uuid.MustParse("00000000-0000-0000-0000-000000000001") // 支付网关 + 风控服务（多属）
	hostPool = uuid.MustParse("00000000-0000-0000-0000-000000000002") // 资源池·高配计算，由待回收回收而来
	hostWin  = uuid.MustParse("00000000-0000-0000-0000-000000000003") // 资源池·默认目录，已停机
)

func setupQueryDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	exec := func(sql string, args ...any) { require.NoError(t, db.Exec(sql, args...).Error, sql) }

	exec(`CREATE TABLE hosts (id TEXT PRIMARY KEY, display_id INTEGER, host_name TEXT, primary_ip TEXT, cpu INTEGER, memory INTEGER,
		disk_size INTEGER, os_type TEXT, os_version TEXT, status TEXT, cloud_vendor TEXT, cloud_region TEXT, cloud_area_id TEXT,
		custom_fields TEXT, created_at DATETIME, updated_at DATETIME, deleted_at DATETIME)`)
	exec(`CREATE TABLE cloud_areas (id TEXT PRIMARY KEY, name TEXT)`)
	exec(`CREATE TABLE businesses (id INTEGER PRIMARY KEY, name TEXT, identifier TEXT, lifecycle TEXT, deleted_at DATETIME)`)
	exec(`CREATE TABLE business_personnel (business_id INTEGER, role TEXT, identity TEXT)`)
	exec(`CREATE TABLE sets (id INTEGER PRIMARY KEY, business_id INTEGER, name TEXT, env_type TEXT, is_default BOOLEAN, sort_order INTEGER, deleted_at DATETIME)`)
	exec(`CREATE TABLE modules (id INTEGER PRIMARY KEY, set_id INTEGER, business_id INTEGER, name TEXT, service_type TEXT, sort_order INTEGER, deleted_at DATETIME)`)
	exec(`CREATE TABLE resource_directories (id INTEGER PRIMARY KEY, name TEXT, path TEXT, is_default BOOLEAN, sort_order INTEGER, deleted_at DATETIME)`)
	exec(`CREATE TABLE host_node_memberships (host_id TEXT, node_kind TEXT, node_id INTEGER, business_id INTEGER)`)
	exec(`CREATE TABLE resource_histories (id INTEGER PRIMARY KEY, resource_id INTEGER, model_uid TEXT, change_type TEXT,
		before_data TEXT, after_data TEXT, changed_by TEXT, changed_at DATETIME, resource_name TEXT)`)

	area := uuid.New()
	exec(`INSERT INTO cloud_areas VALUES (?, '腾讯云广州支付 VPC')`, area)
	exec(`INSERT INTO businesses VALUES (1001, '支付清结算', 'demo-payment-clearing', 'online', NULL)`)
	exec(`INSERT INTO business_personnel VALUES (1001, 'sre', 'sre-payment@wendeops.com')`)
	exec(`INSERT INTO sets VALUES (10, 1001, '空闲机池', '', 1, -1, NULL), (11, 1001, '生产集群', 'prod', 0, 1, NULL)`)
	exec(`INSERT INTO modules VALUES (101, 10, 1001, '空闲机', '', -3, NULL), (102, 10, 1001, '故障机', '', -2, NULL),
		(103, 10, 1001, '待回收', '', -1, NULL), (111, 11, 1001, '支付网关', 'api', 1, NULL), (112, 11, 1001, '风控服务', 'api', 2, NULL)`)
	exec(`INSERT INTO resource_directories VALUES (1, '默认目录', '/默认目录', 1, 0, NULL), (2, '高配计算', '/高配计算', 0, 1, NULL)`)

	now := time.Date(2026, 9, 20, 2, 0, 0, 0, time.UTC)
	host := func(id uuid.UUID, display int, name, ip string, cpu, mem int, os, status, custom string) {
		exec(`INSERT INTO hosts VALUES (?, ?, ?, ?, ?, ?, 200, ?, 'v', ?, 'tencent_cloud', 'ap-guangzhou', ?, ?, ?, ?, NULL)`,
			id, display, name, ip, cpu, mem, os, status, area, custom, now, now)
	}
	host(hostGW, 1, "pay-gw-01", "10.20.1.11", 8, 32768, "linux", "running", `{"固资编号":"WD-2024-00001","备份":false}`)
	host(hostPool, 2, "pool-hc-01", "10.90.3.11", 16, 65536, "linux", "running", `{"固资编号":"WD-2024-00002"}`)
	host(hostWin, 3, "pool-win-01", "10.90.2.11", 8, 16384, "windows", "stopped", `{}`)
	exec(`INSERT INTO host_node_memberships VALUES (?, 'biz_module', 111, 1001), (?, 'biz_module', 112, 1001),
		(?, 'pool_directory', 2, NULL), (?, 'pool_directory', 1, NULL)`, hostGW, hostGW, hostPool, hostWin)

	hist := func(id, resource int, changeType, before, after, by string, at time.Time) {
		var b, a any
		if before != "" {
			b = before
		}
		if after != "" {
			a = after
		}
		exec(`INSERT INTO resource_histories VALUES (?, ?, 'host', ?, ?, ?, ?, ?, '')`, id, resource, changeType, b, a, by, at)
	}
	day := func(d int) time.Time { return time.Date(2026, 9, d, 2, 0, 0, 0, time.UTC) }
	hist(1, 1, "create", "", `{"cpu":8,"memory":16384,"status":"running"}`, "chenjing", day(1))
	hist(2, 1, "update", `{"memory":16384,"custom_fields.备份":true,"business_id":"1001"}`,
		`{"memory":32768,"custom_fields.备份":false,"business_id":"1001"}`, "zhangwei", day(3))
	hist(3, 1, "update", `{"business_id":"1001","business_name":"支付清结算","module_ids":[111],"module_names":["支付网关"]}`,
		`{"business_id":"1001","business_name":"支付清结算","module_ids":[112],"module_names":["风控服务"],"source":"transfer"}`, "liuyang", day(16))
	hist(4, 2, "update", `{"business_id":"1001","business_name":"支付清结算","module_names":["待回收"]}`,
		`{"directory_id":2,"source":"reclaim"}`, "chenjing", day(14))
	hist(5, 1, "update", "", `{"business_id":"1001","module_id":111,"source":"allocate"}`, "system", day(2)) // 旧审计：无 before、无模块名快照
	return db
}

func TestSearchHosts(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	ctx := context.Background()

	total, hosts, err := q.SearchHosts(ctx, HostFilter{Keyword: "WD-2024-00001", Limit: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	assert.Equal(t, "10.20.1.11", hosts[0].IP)
	assert.ElementsMatch(t, []string{"支付清结算 / 生产集群 / 支付网关", "支付清结算 / 生产集群 / 风控服务"}, hosts[0].Placements)

	total, hosts, err = q.SearchHosts(ctx, HostFilter{Location: "pool", MinCPU: 16, Limit: 20})
	require.NoError(t, err)
	require.EqualValues(t, 1, total)
	assert.Equal(t, "pool-hc-01", hosts[0].HostName)
	assert.Equal(t, []string{"资源池 / 高配计算"}, hosts[0].Placements)

	total, _, err = q.SearchHosts(ctx, HostFilter{Location: "pool", Status: "running", OSType: "linux", Limit: 20})
	require.NoError(t, err)
	assert.EqualValues(t, 1, total, "停机的 Windows 备机不应命中")

	total, _, err = q.SearchHosts(ctx, HostFilter{ModuleID: 112, Limit: 20})
	require.NoError(t, err)
	assert.EqualValues(t, 1, total)
}

func TestGetHost(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	ctx := context.Background()

	d, err := q.GetHost(ctx, 0, "10.20.1.11")
	require.NoError(t, err)
	assert.EqualValues(t, 1, d.HostID)
	assert.Equal(t, "腾讯云广州支付 VPC", d.CloudArea)
	assert.Equal(t, "WD-2024-00001", d.CustomFields["固资编号"])
	require.Len(t, d.Locations, 2)
	assert.Equal(t, "2026-09-20T10:00:00+08:00", d.CreatedAt, "时间以北京时间输出")

	_, err = q.GetHost(ctx, 0, "10.99.99.99")
	assert.True(t, errors.Is(err, ErrNotFound))
	_, err = q.GetHost(ctx, 0, "")
	assert.Error(t, err)
}

func TestQueryChanges_HostTimeline(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	matched, items, err := q.QueryChanges(context.Background(), ChangeFilter{HostID: 1, Limit: 20})
	require.NoError(t, err)
	require.Equal(t, 4, matched)
	require.Len(t, items, 4)

	// 倒序：转移(16日) → 配置(3日) → 旧分配(2日) → 录入(1日)
	assert.Equal(t, []uint64{3, 2, 5, 1}, []uint64{items[0].RecordID, items[1].RecordID, items[2].RecordID, items[3].RecordID})

	transfer := items[0]
	assert.Equal(t, "placement_change", transfer.Action)
	assert.Equal(t, "转移", transfer.Source)
	assert.Equal(t, "支付清结算 / 支付网关", transfer.From)
	assert.Equal(t, "支付清结算 / 风控服务", transfer.To)
	assert.Equal(t, "liuyang", transfer.Operator)
	assert.Equal(t, "10.20.1.11（pay-gw-01）", transfer.Host)

	cfg := items[1]
	assert.Equal(t, "config_change", cfg.Action)
	require.Len(t, cfg.Changes, 2, "business_id 等上下文字段不算配置变更")
	assert.Equal(t, "custom_fields.备份", cfg.Changes[0].Field)
	assert.Equal(t, true, cfg.Changes[0].From)
	assert.Equal(t, false, cfg.Changes[0].To)
	assert.Equal(t, "memory", cfg.Changes[1].Field)

	legacy := items[2]
	assert.Equal(t, "支付清结算 / 生产集群 / 支付网关（按当前名称）", legacy.To)
	assert.NotEmpty(t, legacy.Note, "旧审计缺少变更前归属时要说明")

	assert.Equal(t, "create", items[3].Action)
	assert.Contains(t, items[3].Note, "16384 MB")
}

func TestQueryChanges_Filters(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	ctx := context.Background()

	// 业务 + 关键字：变更前属于该业务的回收记录也要命中
	matched, items, err := q.QueryChanges(ctx, ChangeFilter{BusinessID: 1001, Keyword: "待回收", Limit: 20})
	require.NoError(t, err)
	require.Equal(t, 1, matched)
	assert.Equal(t, "回收到资源池", items[0].Source)
	assert.Equal(t, "资源池 / 高配计算", items[0].To)

	matched, _, err = q.QueryChanges(ctx, ChangeFilter{Keyword: "备份", Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, 1, matched)

	since, _ := parseTime("2026-09-10")
	matched, _, err = q.QueryChanges(ctx, ChangeFilter{Since: since, Action: "placement_change", Limit: 20})
	require.NoError(t, err)
	assert.Equal(t, 2, matched)

	matched, items, err = q.QueryChanges(ctx, ChangeFilter{Operator: "zhangwei", Limit: 1})
	require.NoError(t, err)
	assert.Equal(t, 1, matched)
	assert.Len(t, items, 1)
}

func TestQueryChanges_ModuleAndIP(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	ctx := context.Background()

	// 模块 111：转出（记录 3，新快照 module_ids）和旧审计的分配（记录 5，只有 module_id）
	matched, items, err := q.QueryChanges(ctx, ChangeFilter{ModuleID: 111, Limit: 20})
	require.NoError(t, err)
	require.Equal(t, 2, matched)
	assert.Equal(t, uint64(3), items[0].RecordID)
	assert.Equal(t, uint64(5), items[1].RecordID)

	// 模块 112：同一条转移记录是它的转入
	matched, items, err = q.QueryChanges(ctx, ChangeFilter{ModuleID: 112, Limit: 20})
	require.NoError(t, err)
	require.Equal(t, 1, matched)
	assert.Equal(t, "支付清结算 / 风控服务", items[0].To)

	id, err := q.HostIDByIP(ctx, " 10.20.1.11 ")
	require.NoError(t, err)
	assert.Equal(t, int64(1), id)
	_, err = q.HostIDByIP(ctx, "10.99.99.99")
	assert.ErrorIs(t, err, ErrNotFound)
}

func TestSearchBusinesses_MatchesModuleName(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	ctx := context.Background()

	out, err := q.SearchBusinesses(ctx, "风控", 20)
	require.NoError(t, err)
	require.Len(t, out, 1)
	assert.Equal(t, uint64(1001), out[0].BusinessID)
	assert.Equal(t, []ModuleRef{{ModuleID: 112, Path: "生产集群 / 风控服务"}}, out[0].MatchedModules)

	// 命中业务名时不附带模块
	out, err = q.SearchBusinesses(ctx, "清结算", 20)
	require.NoError(t, err)
	require.Len(t, out, 1)
	assert.Empty(t, out[0].MatchedModules)

	out, err = q.SearchBusinesses(ctx, "不存在的模块", 20)
	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestTopologyAndPool(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	ctx := context.Background()

	topo, err := q.GetBusinessTopology(ctx, 1001)
	require.NoError(t, err)
	require.Len(t, topo.Sets, 2)
	assert.True(t, topo.Sets[0].IsIdlePool)
	assert.Equal(t, "空闲机", topo.Sets[0].Modules[0].Name)
	assert.EqualValues(t, 1, topo.Sets[1].Modules[0].HostCount)

	_, err = q.GetBusinessTopology(ctx, 9999)
	assert.True(t, errors.Is(err, ErrNotFound))

	dirs, err := q.ListPoolDirectories(ctx)
	require.NoError(t, err)
	require.Len(t, dirs, 2)
	assert.EqualValues(t, 1, dirs[0].HostCount)
	assert.EqualValues(t, 0, dirs[0].RunningCount)
	assert.EqualValues(t, 1, dirs[1].RunningCount)

	bizs, err := q.SearchBusinesses(ctx, "支付", 20)
	require.NoError(t, err)
	require.Len(t, bizs, 1)
	assert.EqualValues(t, 1, bizs[0].HostCount)
	assert.Equal(t, []string{"sre: sre-payment@wendeops.com"}, bizs[0].Contacts)
}

func TestParseTime(t *testing.T) {
	ts, err := parseTime("2026-09-10")
	require.NoError(t, err)
	assert.Equal(t, "2026-09-10T00:00:00+08:00", ts.Format(time.RFC3339))
	_, err = parseTime("yesterday")
	assert.Error(t, err)

	// 只写日期的截止时间包含当天
	end, err := parseUntil("2026-09-22")
	require.NoError(t, err)
	assert.Equal(t, "2026-09-22T23:59:59.999999999+08:00", end.Format(time.RFC3339Nano))
	// 写了具体时间的照原样
	end, err = parseUntil("2026-09-22T06:00:00+08:00")
	require.NoError(t, err)
	assert.Equal(t, "2026-09-22T06:00:00+08:00", end.Format(time.RFC3339))
	end, err = parseUntil("")
	require.NoError(t, err)
	assert.Nil(t, end)
	_, err = parseUntil("yesterday")
	assert.Error(t, err)
}

func TestQueryChanges_UntilDateIncludesThatDay(t *testing.T) {
	q := NewQuery(setupQueryDB(t))
	// 记录 3 发生在 9 月 16 日 10:00（北京时间）
	since, _ := parseTime("2026-09-16")
	until, _ := parseUntil("2026-09-16")
	matched, items, err := q.QueryChanges(context.Background(), ChangeFilter{Since: since, Until: until, Limit: 20})
	require.NoError(t, err)
	require.Equal(t, 1, matched)
	assert.Equal(t, uint64(3), items[0].RecordID)
}

func mustJSON(t *testing.T, v any) map[string]any {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	var m map[string]any
	require.NoError(t, json.Unmarshal(b, &m))
	return m
}
