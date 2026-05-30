package instance

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
)

func setupAggregateInstanceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	sqls := []string{
		`CREATE TABLE mainline_instances (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			model_name TEXT NOT NULL,
			business_id BIGINT NOT NULL,
			parent_id INTEGER,
			ref_id TEXT NOT NULL,
			name TEXT NOT NULL,
			path TEXT NOT NULL,
			level INTEGER NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			extra TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE resources (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			model_uid TEXT NOT NULL,
			name TEXT NOT NULL,
			configs TEXT NOT NULL,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE resource_states (
			resource_id INTEGER PRIMARY KEY,
			last_check_time DATETIME,
			health_status INTEGER,
			metrics TEXT,
			updated_at DATETIME
		)`,
		`CREATE TABLE relations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source_id INTEGER NOT NULL,
			target_id INTEGER NOT NULL,
			association_uid TEXT NOT NULL,
			source_model_uid TEXT,
			target_model_uid TEXT,
			properties TEXT,
			created_at DATETIME
		)`,
		`CREATE TABLE association_types (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			uid TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			source_to_dest_desc TEXT,
			dest_to_source_desc TEXT,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			description TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE resource_histories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			resource_id INTEGER NOT NULL,
			model_uid TEXT NOT NULL,
			change_type TEXT NOT NULL,
			before_data TEXT,
			after_data TEXT,
			changed_by TEXT,
			changed_at DATETIME,
			client_ip TEXT,
			user_agent TEXT
		)`,
		`CREATE TABLE host_business_relations (
			host_id TEXT NOT NULL,
			business_id BIGINT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)`,
		`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id BIGINT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)`,
		`CREATE TABLE hosts (
			id TEXT PRIMARY KEY,
			display_id INTEGER,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			tenant_id TEXT NOT NULL,
			created_by TEXT,
			updated_by TEXT,
			cloud_area_id TEXT,
			business_id INTEGER,
			host_name TEXT NOT NULL,
			primary_ip TEXT NOT NULL,
			ip_addresses TEXT,
			cloud_vendor TEXT,
			cloud_instance_id TEXT,
			cloud_region TEXT,
			vpc_id TEXT,
			subnet_id TEXT,
			cpu INTEGER,
			memory INTEGER,
			disk_size INTEGER,
			os_type TEXT,
			os_version TEXT,
			status TEXT NOT NULL,
			is_destroyed BOOLEAN NOT NULL DEFAULT FALSE,
			cloud_metadata TEXT,
			custom_fields TEXT
		)`,
		`CREATE TABLE modules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id INTEGER NOT NULL,
			business_id BIGINT NOT NULL,
			service_template_id BIGINT,
			service_category_id BIGINT,
			name TEXT NOT NULL,
			description TEXT,
			service_type TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
	}

	for _, sql := range sqls {
		require.NoError(t, db.Exec(sql).Error)
	}

	return db
}

func TestAggregateInstance_GetInstance_ReturnsBindingContext(t *testing.T) {
	db := setupAggregateInstanceTestDB(t)
	dynamicService := dynamic_model.NewService(db)
	svc := NewAggregateService(db, dynamicService)
	ctx := context.Background()

	hostID := uuid.New()
	tenantID := uuid.New()
	var businessID uint64 = 1001

	require.NoError(t, db.Exec(`
		INSERT INTO resources (id, model_uid, name, configs, created_at, updated_at)
		VALUES (2, 'service', 'svc-1', '{"name":"svc-1"}', ?, ?)
	`, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO association_types (uid, name, source_to_dest_desc, dest_to_source_desc, is_builtin, created_at, updated_at)
		VALUES ('runs_on', '运行于', '运行于', '运行', TRUE, ?, ?)
	`, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO modules (id, set_id, business_id, name, service_type, created_at, updated_at)
		VALUES (1, 1, ?, 'module-a', 'web', ?, ?)
	`, businessID, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO hosts (id, tenant_id, business_id, host_name, primary_ip, status, is_destroyed, created_at, updated_at)
		VALUES (?, ?, 1000, 'host-1', '10.0.0.1', 'running', FALSE, ?, ?)
	`, hostID.String(), tenantID.String(), time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_business_relations (host_id, business_id, created_at)
		VALUES (?, ?, ?)
	`, hostID.String(), businessID, time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_module_relations (host_id, module_id, created_at)
		VALUES (?, 1, ?)
	`, hostID.String(), time.Now().UTC()).Error)

	view, err := svc.GetAggregateInstance(ctx, "host:"+hostID.String())
	require.NoError(t, err)
	require.Equal(t, "host:"+hostID.String(), view.InstanceKey)
	require.NotNil(t, view.BindingContext)
	require.Contains(t, view.AllowedActions, "bind_topology")
}

func TestAggregateInstance_ListAggregateInstances_ReturnsMainlineNodes(t *testing.T) {
	db := setupAggregateInstanceTestDB(t)
	dynamicService := dynamic_model.NewService(db)
	svc := NewAggregateService(db, dynamicService)
	ctx := context.Background()

	var businessID uint64 = 1001

	require.NoError(t, db.Exec(`
		INSERT INTO mainline_instances (id, model_name, business_id, ref_id, name, path, level, sort_order, is_default, extra, created_at, updated_at)
		VALUES (1, 'business', ?, '1001', 'SmokeBiz3', 'business_1000', 0, 0, FALSE, '{}', ?, ?)
	`, businessID, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO mainline_instances (id, model_name, business_id, parent_id, ref_id, name, path, level, sort_order, is_default, extra, created_at, updated_at)
		VALUES (2, 'set', ?, 1, '2', 'SmokeSet3', 'business_1000.set_2', 1, 0, FALSE, '{"description":"topology smoke set"}', ?, ?)
	`, businessID, time.Now().UTC(), time.Now().UTC()).Error)

	items, total, err := svc.ListAggregateInstances(ctx, "set", 1, 20)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, "set:2", items[0].InstanceKey)
	require.Equal(t, "set", items[0].Model.ModelUID)
	require.Equal(t, "SmokeSet3", items[0].Properties["name"])
	require.Equal(t, "mainline", items[0].BindingContext["source"])
}

func TestAggregateInstance_ListAggregateInstances_ReturnsHosts(t *testing.T) {
	db := setupAggregateInstanceTestDB(t)
	dynamicService := dynamic_model.NewService(db)
	svc := NewAggregateService(db, dynamicService)
	ctx := context.Background()

	hostID := uuid.New()
	tenantID := uuid.New()

	require.NoError(t, db.Exec(`
		INSERT INTO hosts (id, tenant_id, host_name, primary_ip, status, is_destroyed, created_at, updated_at)
		VALUES (?, ?, 'host-agg-1', '10.0.0.10', 'running', FALSE, ?, ?)
	`, hostID.String(), tenantID.String(), time.Now().UTC(), time.Now().UTC()).Error)

	items, total, err := svc.ListAggregateInstances(ctx, "host", 1, 20)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Len(t, items, 1)
	require.Equal(t, "host:"+hostID.String(), items[0].InstanceKey)
	require.Equal(t, "host", items[0].Model.ModelUID)
	require.Equal(t, "host-agg-1", items[0].Properties["name"])
	require.Equal(t, "host", items[0].BindingContext["source"])
}

func TestAggregateInstance_GetInstance_ReturnsMainlineBindingContext(t *testing.T) {
	db := setupAggregateInstanceTestDB(t)
	dynamicService := dynamic_model.NewService(db)
	svc := NewAggregateService(db, dynamicService)
	ctx := context.Background()

	var businessID uint64 = 1002

	require.NoError(t, db.Exec(`
		INSERT INTO mainline_instances (id, model_name, business_id, ref_id, name, path, level, sort_order, is_default, extra, created_at, updated_at)
		VALUES (1, 'business', ?, '1002', 'SmokeBiz3', 'business_1000', 0, 0, FALSE, '{}', ?, ?)
	`, businessID, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO mainline_instances (id, model_name, business_id, parent_id, ref_id, name, path, level, sort_order, is_default, extra, created_at, updated_at)
		VALUES (2, 'set', ?, 1, '2', 'SmokeSet3', 'business_1000.set_2', 1, 0, FALSE, '{"description":"topology smoke set"}', ?, ?)
	`, businessID, time.Now().UTC(), time.Now().UTC()).Error)

	view, err := svc.GetAggregateInstance(ctx, "set:2")
	require.NoError(t, err)
	require.Equal(t, "set:2", view.InstanceKey)
	require.Equal(t, "mainline", view.BindingContext["source"])
	require.Equal(t, true, view.BindingContext["topology_bound"])
	require.Equal(t, "SmokeSet3", view.Properties["name"])
}
