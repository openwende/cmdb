package migration

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupBackfillDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	stmts := []string{
		`CREATE TABLE host_node_memberships (
			id INTEGER PRIMARY KEY AUTOINCREMENT, host_id TEXT NOT NULL, node_kind TEXT NOT NULL,
			node_id INTEGER NOT NULL, business_id INTEGER, set_id INTEGER,
			relation_type TEXT NOT NULL DEFAULT 'member_of', source TEXT, created_at DATETIME, created_by TEXT,
			UNIQUE (host_id, node_kind, node_id, relation_type))`,
		`CREATE TABLE host_module_relations (host_id TEXT NOT NULL, module_id INTEGER NOT NULL, created_at DATETIME, PRIMARY KEY (host_id, module_id))`,
		`CREATE TABLE resource_pool_hosts (host_id TEXT PRIMARY KEY, directory_id INTEGER NOT NULL, imported_at DATETIME, imported_by TEXT, remark TEXT)`,
		`CREATE TABLE modules (id INTEGER PRIMARY KEY AUTOINCREMENT, set_id INTEGER NOT NULL, business_id BIGINT NOT NULL, name TEXT, is_default BOOLEAN, deleted_at DATETIME)`,
	}
	for _, s := range stmts {
		require.NoError(t, db.Exec(s).Error)
	}
	return db
}

func TestMembershipBackfill_RunAndIdempotent(t *testing.T) {
	db := setupBackfillDB(t)
	ctx := context.Background()
	h1, h2, h3 := uuid.New().String(), uuid.New().String(), uuid.New().String()

	// 种子：module 10(biz=1000,set=5)、软删模块 99；h1 在 module10，h2 在 module10+软删99，h3 在资源池 dir1
	require.NoError(t, db.Exec(`INSERT INTO modules (id,set_id,business_id,name,is_default) VALUES (10,5,1000,'m',0)`).Error)
	require.NoError(t, db.Exec(`INSERT INTO modules (id,set_id,business_id,name,is_default,deleted_at) VALUES (99,5,1000,'gone',0,'2026-01-01')`).Error)
	require.NoError(t, db.Exec(`INSERT INTO host_module_relations (host_id,module_id) VALUES (?,10)`, h1).Error)
	require.NoError(t, db.Exec(`INSERT INTO host_module_relations (host_id,module_id) VALUES (?,10)`, h2).Error)
	require.NoError(t, db.Exec(`INSERT INTO host_module_relations (host_id,module_id) VALUES (?,99)`, h2).Error) // 软删模块，不应回填
	require.NoError(t, db.Exec(`INSERT INTO resource_pool_hosts (host_id,directory_id,imported_by) VALUES (?,1,'admin')`, h3).Error)

	bf := NewMembershipBackfill(db)
	mr, pr, err := bf.Run(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(2), mr, "h1+h2 的有效模块归属（软删模块 99 被排除）")
	require.Equal(t, int64(1), pr, "h3 资源池归属")

	// 校验冗余维度填充
	var biz, set *int64
	require.NoError(t, db.Raw(`SELECT business_id FROM host_node_memberships WHERE host_id=? AND node_kind='biz_module'`, h1).Scan(&biz).Error)
	require.NoError(t, db.Raw(`SELECT set_id FROM host_node_memberships WHERE host_id=? AND node_kind='biz_module'`, h1).Scan(&set).Error)
	require.NotNil(t, biz)
	require.Equal(t, int64(1000), *biz)
	require.NotNil(t, set)
	require.Equal(t, int64(5), *set)

	// 软删模块归属未回填
	var cnt99 int64
	db.Raw(`SELECT COUNT(*) FROM host_node_memberships WHERE node_id=99`).Scan(&cnt99)
	require.Equal(t, int64(0), cnt99)

	// 幂等：再跑一次新增 0
	mr2, pr2, err := bf.Run(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(0), mr2)
	require.Equal(t, int64(0), pr2)

	// 对账通过
	require.NoError(t, bf.Verify(ctx))
}
