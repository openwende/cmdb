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
			business_id TEXT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)`,
		`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id BIGINT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)`,
		`CREATE TABLE modules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id INTEGER NOT NULL,
			business_id TEXT NOT NULL,
			service_template_id BIGINT,
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
	businessID := uuid.New()

	require.NoError(t, db.Exec(`
		INSERT INTO resources (id, model_uid, name, configs, created_at, updated_at)
		VALUES (1, 'host', 'host-1', '{"name":"host-1","primary_ip":"10.0.0.1"}', ?, ?)
	`, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resources (id, model_uid, name, configs, created_at, updated_at)
		VALUES (2, 'service', 'svc-1', '{"name":"svc-1"}', ?, ?)
	`, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_states (resource_id, last_check_time, health_status, metrics, updated_at)
		VALUES (1, ?, 0, '{"cpu": 10}', ?)
	`, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO association_types (uid, name, source_to_dest_desc, dest_to_source_desc, is_builtin, created_at, updated_at)
		VALUES ('runs_on', '运行于', '运行于', '运行', TRUE, ?, ?)
	`, time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO relations (source_id, target_id, association_uid, source_model_uid, target_model_uid, properties, created_at)
		VALUES (2, 1, 'runs_on', 'service', 'host', '{}', ?)
	`, time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resource_histories (resource_id, model_uid, change_type, before_data, after_data, changed_by, changed_at, client_ip, user_agent)
		VALUES (1, 'host', 'create', '{}', '{"name":"host-1"}', 'tester', ?, '127.0.0.1', 'go-test')
	`, time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO modules (id, set_id, business_id, name, service_type, created_at, updated_at)
		VALUES (1, 1, ?, 'module-a', 'web', ?, ?)
	`, businessID.String(), time.Now().UTC(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_business_relations (host_id, business_id, created_at)
		VALUES (?, ?, ?)
	`, hostID.String(), businessID.String(), time.Now().UTC()).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO host_module_relations (host_id, module_id, created_at)
		VALUES (?, 1, ?)
	`, hostID.String(), time.Now().UTC()).Error)

	view, err := svc.GetAggregateInstance(ctx, "host:1")
	require.NoError(t, err)
	require.Equal(t, "host:1", view.InstanceKey)
	require.NotNil(t, view.BindingContext)
	require.Contains(t, view.AllowedActions, "bind_topology")
}
