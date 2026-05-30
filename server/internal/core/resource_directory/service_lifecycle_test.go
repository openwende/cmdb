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

	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

func setupResourceLifecycleTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, storage.MigrateResourceGraphTables(db))

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
		`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id INTEGER NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)`,
		`CREATE TABLE host_business_relations (
				host_id TEXT NOT NULL,
				business_id BIGINT NOT NULL,
				created_at DATETIME,
				PRIMARY KEY (host_id, business_id)
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
	var businessID uint64 = 1001

	require.NoError(t, db.Exec(`
		INSERT INTO modules (id, set_id, business_id, name, created_at, updated_at)
		VALUES (1, 1, ?, 'module-a', ?, ?)
	`, businessID, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (1, 'default', '/default', 1, 0, TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_pool_hosts (host_id, directory_id, imported_at, imported_by, remark)
		VALUES (?, 1, ?, 'tester', '')
	`, hostInPool.String(), now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO hosts (id, tenant_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, 'host-in-pool', '10.10.0.1', 'running', ?, ?)
	`, hostInPool.String(), uuid.NewString(), now, now).Error)
	require.NoError(t, db.Create(&types.ResourceV2{
		ID:       uuid.NewString(),
		TypeName: string(types.NodeTypeModule),
		Name:     "module-a",
		Status:   map[string]any{},
		Labels:   map[string]any{},
		Spec: map[string]any{
			"ref_id":      "1",
			"business_id": businessID,
			"set_id":      1,
		},
	}).Error)

	result, err := svc.AllocateHosts(ctx, &types.AllocateHostsRequest{
		HostIDs:        []uuid.UUID{hostInPool, hostMissing},
		TargetModuleID: 1,
	})
	require.NoError(t, err)
	require.NotNil(t, result.FailedItems)
	require.Len(t, result.SucceededItems, 1)
	require.Len(t, result.FailedItems, 1)
}

func TestAllocateHosts_AttachesProjectionHostToTargetModule(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := NewService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	hostID := uuid.New()
	var businessID uint64 = 1000

	require.NoError(t, db.Exec(`
		INSERT INTO modules (id, set_id, business_id, name, is_default, created_at, updated_at)
		VALUES (5, 5, ?, '空闲机', TRUE, ?, ?)
	`, businessID, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (1, 'default', '/default', 1, 0, TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_pool_hosts (host_id, directory_id, imported_at, imported_by, remark)
		VALUES (?, 1, ?, 'tester', '')
	`, hostID.String(), now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO hosts (id, tenant_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, 'host-from-pool', '10.252.2.140', 'running', ?, ?)
	`, hostID.String(), uuid.NewString(), now, now).Error)

	moduleResourceID := uuid.NewString()
	hostResourceID := uuid.NewString()
	require.NoError(t, db.Create(&types.ResourceV2{
		ID:       moduleResourceID,
		TypeName: string(types.NodeTypeModule),
		Name:     "空闲机",
		Status:   map[string]any{},
		Labels:   map[string]any{},
		Spec: map[string]any{
			"ref_id":      "5",
			"business_id": businessID,
			"set_id":      5,
			"is_default":  true,
		},
	}).Error)
	require.NoError(t, db.Create(&types.ResourceV2{
		ID:       hostResourceID,
		TypeName: string(types.NodeTypeHost),
		Name:     "host-from-pool",
		Status:   map[string]any{},
		Labels:   map[string]any{},
		Spec: map[string]any{
			"ref_id":           hostID.String(),
			"primary_ip":       "10.252.2.140",
			"in_resource_pool": true,
			"directory_id":     1,
		},
	}).Error)

	result, err := svc.AllocateHosts(ctx, &types.AllocateHostsRequest{
		HostIDs:        []uuid.UUID{hostID},
		TargetModuleID: 5,
	})
	require.NoError(t, err)
	require.Len(t, result.SucceededItems, 1)
	require.Empty(t, result.FailedItems)

	var edgeCount int64
	require.NoError(t, db.Model(&types.EdgeV2{}).
		Where("from_id = ? AND to_id = ? AND rel_type = ?", moduleResourceID, hostResourceID, projectionContainsRelType).
		Count(&edgeCount).Error)
	require.EqualValues(t, 1, edgeCount)

	var poolCount int64
	require.NoError(t, db.Model(&types.ResourcePoolHost{}).Where("host_id = ?", hostID).Count(&poolCount).Error)
	require.Zero(t, poolCount)

	var storedHost types.ResourceV2
	require.NoError(t, db.Where("id = ?", hostResourceID).First(&storedHost).Error)
	require.EqualValues(t, "1000", storedHost.Spec["business_id"])
	require.EqualValues(t, "5", storedHost.Spec["module_id"])
	require.EqualValues(t, "5", storedHost.Spec["set_id"])
	require.Equal(t, true, storedHost.Spec["in_idle_pool"])
	require.NotContains(t, storedHost.Spec, "in_resource_pool")
	require.NotContains(t, storedHost.Spec, "directory_id")
}

func TestReclaimHosts_ReturnsStructuredSuccesses(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := NewService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	hostID := uuid.New()
	var businessID uint64 = 1002

	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (1, 'default', '/default', 1, 0, TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_directories (id, name, path, level, sort_order, is_default, created_at, updated_at)
		VALUES (2, 'test', '/test', 1, 0, FALSE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_module_relations (host_id, module_id, created_at)
		VALUES (?, 1, ?)
	`, hostID.String(), now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_business_relations (host_id, business_id, created_at)
		VALUES (?, ?, ?)
	`, hostID.String(), businessID, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_pool_hosts (host_id, directory_id, imported_at, imported_by, remark)
		VALUES (?, 1, ?, 'idle-sync', '')
	`, hostID.String(), now).Error)

	parentResourceID := uuid.NewString()
	hostResourceID := uuid.NewString()
	require.NoError(t, db.Create(&types.ResourceV2{
		ID:       parentResourceID,
		TypeName: string(types.NodeTypeModule),
		Name:     "source-module",
		Status:   map[string]any{},
		Labels:   map[string]any{},
		Spec: map[string]any{
			"ref_id":      "1",
			"business_id": businessID,
		},
	}).Error)
	require.NoError(t, db.Create(&types.ResourceV2{
		ID:       hostResourceID,
		TypeName: string(types.NodeTypeHost),
		Name:     "host-a",
		Status:   map[string]any{},
		Labels:   map[string]any{},
		Spec: map[string]any{
			"ref_id":       hostID.String(),
			"business_id":  businessID,
			"module_id":    1,
			"set_id":       1,
			"in_idle_pool": true,
		},
	}).Error)
	require.NoError(t, db.Create(&types.EdgeV2{
		FromID:  parentResourceID,
		ToID:    hostResourceID,
		RelType: projectionContainsRelType,
		Data:    map[string]any{},
	}).Error)

	result, err := svc.ReclaimHosts(ctx, &types.ReclaimHostsRequest{
		HostIDs:     []uuid.UUID{hostID},
		DirectoryID: 2,
		Remark:      "reclaim",
	}, "tester")
	require.NoError(t, err)
	require.Empty(t, result.FailedItems)
	require.Len(t, result.SucceededItems, 1)
	require.Equal(t, "pooled", result.SucceededItems[0].ResourceStatus)
	require.EqualValues(t, 2, result.SucceededItems[0].DirectoryID)

	var poolHost types.ResourcePoolHost
	require.NoError(t, db.Where("host_id = ?", hostID).First(&poolHost).Error)
	require.EqualValues(t, 2, poolHost.DirectoryID)

	var relationCount int64
	require.NoError(t, db.Model(&types.HostModuleRelation{}).Where("host_id = ?", hostID).Count(&relationCount).Error)
	require.Zero(t, relationCount)
	require.NoError(t, db.Model(&types.HostBusinessRelation{}).Where("host_id = ?", hostID).Count(&relationCount).Error)
	require.Zero(t, relationCount)
	require.NoError(t, db.Model(&types.EdgeV2{}).
		Where("to_id = ? AND rel_type = ?", hostResourceID, projectionContainsRelType).
		Count(&relationCount).Error)
	require.Zero(t, relationCount)

	var storedHost types.ResourceV2
	require.NoError(t, db.Where("id = ?", hostResourceID).First(&storedHost).Error)
	require.NotContains(t, storedHost.Spec, "business_id")
	require.NotContains(t, storedHost.Spec, "module_id")
	require.NotContains(t, storedHost.Spec, "set_id")
	require.Equal(t, false, storedHost.Spec["in_idle_pool"])
	require.Equal(t, true, storedHost.Spec["in_resource_pool"])
	require.EqualValues(t, 2, storedHost.Spec["directory_id"])
}

func TestLifecycle_GetHostLifecycle_ReturnsResourceStatus(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	svc := NewService(db)
	ctx := context.Background()
	now := time.Now().UTC()
	pooledHost := uuid.New()
	allocatedHost := uuid.New()
	var businessID uint64 = 1003

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
	`, allocatedHost.String(), businessID, now).Error)
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
