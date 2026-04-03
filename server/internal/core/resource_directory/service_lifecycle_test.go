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

	"github.com/wend/cmdb-backend/internal/types"
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
		`CREATE TABLE resource_pool_hosts (
			host_id TEXT PRIMARY KEY,
			directory_id INTEGER NOT NULL,
			imported_at DATETIME,
			imported_by TEXT,
			remark TEXT
		)`,
		`CREATE TABLE modules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id INTEGER NOT NULL,
			business_id TEXT NOT NULL,
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
		`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id INTEGER NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)`,
		`CREATE TABLE host_business_relations (
			host_id TEXT NOT NULL,
			business_id TEXT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)`,
	}

	for _, sql := range sqls {
		require.NoError(t, db.Exec(sql).Error)
	}

	return db
}

func TestAllocateHosts_ReturnsStructuredFailures(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := NewService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	hostInPool := uuid.New()
	hostMissing := uuid.New()
	businessID := uuid.New()

	require.NoError(t, db.Exec(`
		INSERT INTO modules (id, set_id, business_id, name, created_at, updated_at)
		VALUES (1, 1, ?, 'module-a', ?, ?)
	`, businessID.String(), now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (1, 'default', '/default', 1, 0, TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_pool_hosts (host_id, directory_id, imported_at, imported_by, remark)
		VALUES (?, 1, ?, 'tester', '')
	`, hostInPool.String(), now).Error)

	result, err := svc.AllocateHosts(ctx, &types.AllocateHostsRequest{
		HostIDs:        []uuid.UUID{hostInPool, hostMissing},
		TargetModuleID: 1,
	})
	require.NoError(t, err)
	require.NotNil(t, result.FailedItems)
	require.Len(t, result.SucceededItems, 1)
	require.Len(t, result.FailedItems, 1)
}

func TestReclaimHosts_ReturnsStructuredSuccesses(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := NewService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	hostID := uuid.New()
	businessID := uuid.New()

	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (1, 'default', '/default', 1, 0, TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_module_relations (host_id, module_id, created_at)
		VALUES (?, 1, ?)
	`, hostID.String(), now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_business_relations (host_id, business_id, created_at)
		VALUES (?, ?, ?)
	`, hostID.String(), businessID.String(), now).Error)

	result, err := svc.ReclaimHosts(ctx, &types.ReclaimHostsRequest{
		HostIDs:     []uuid.UUID{hostID},
		DirectoryID: 1,
		Remark:      "reclaim",
	}, "tester")
	require.NoError(t, err)
	require.Len(t, result.SucceededItems, 1)
	require.Equal(t, "pooled", result.SucceededItems[0].ResourceStatus)
}

func TestLifecycle_GetHostLifecycle_ReturnsResourceStatus(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := NewService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	pooledHost := uuid.New()
	allocatedHost := uuid.New()
	businessID := uuid.New()

	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (1, 'default', '/default', 1, 0, TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_pool_hosts (host_id, directory_id, imported_at, imported_by, remark)
		VALUES (?, 1, ?, 'tester', '')
	`, pooledHost.String(), now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_business_relations (host_id, business_id, created_at)
		VALUES (?, ?, ?)
	`, allocatedHost.String(), businessID.String(), now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_module_relations (host_id, module_id, created_at)
		VALUES (?, 1, ?)
	`, allocatedHost.String(), now).Error)

	pooled, err := svc.GetHostLifecycle(ctx, pooledHost)
	require.NoError(t, err)
	require.Equal(t, "pooled", pooled.ResourceStatus)

	allocated, err := svc.GetHostLifecycle(ctx, allocatedHost)
	require.NoError(t, err)
	require.Equal(t, "allocated", allocated.ResourceStatus)
}
