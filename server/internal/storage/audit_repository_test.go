package storage

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/openwende/cmdb/server/internal/types"
)

// ListAuditLogs 的查询列用了 PG 专有的 ::text，sqlite 跑不了；这里只验证过滤条件 applyFilters。
func TestAuditRepository_ApplyFilters_ResourceID(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`CREATE TABLE resource_histories (id INTEGER PRIMARY KEY, resource_id INTEGER, model_uid TEXT,
		change_type TEXT, changed_by TEXT, changed_at DATETIME, resource_name TEXT)`).Error)
	now := time.Now().UTC()
	// 主机 7、17、70 的审计 + 一条 resource_id 也是 7 的非主机记录
	require.NoError(t, db.Exec(`INSERT INTO resource_histories VALUES
		(1, 7, 'host', 'update', 'a', ?, 'h7'), (2, 7, 'host', 'create', 'a', ?, 'h7'),
		(3, 17, 'host', 'update', 'a', ?, 'h17'), (4, 70, 'host', 'update', 'a', ?, 'h70'),
		(5, 7, 'module', 'update', 'a', ?, 'm7')`, now, now, now, now, now).Error)

	repo := &auditRepository{db: db}
	ids := func(p *types.AuditQueryParams) []uint64 {
		var out []uint64
		require.NoError(t, repo.applyFilters(db.Table("resource_histories rh"), p).Order("rh.id").Pluck("rh.id", &out).Error)
		return out
	}

	require.Equal(t, []uint64{1, 2}, ids(&types.AuditQueryParams{ResourceID: 7, ModelUIDs: []string{"host"}}), "精确匹配，不命中 17 / 70")
	require.Equal(t, []uint64{1, 2, 5}, ids(&types.AuditQueryParams{ResourceID: 7}))
	require.Equal(t, []uint64{1, 2, 3, 4}, ids(&types.AuditQueryParams{ModelUIDs: []string{"host"}}), "0 表示不过滤")
}
