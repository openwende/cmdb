package dynamic_model

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupRelationAggregateTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	sqls := []string{
		`CREATE TABLE dynamic_models (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			uid TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			is_paused BOOLEAN NOT NULL DEFAULT FALSE,
			description TEXT,
			icon TEXT,
			unique_fields TEXT,
			created_at DATETIME,
			updated_at DATETIME
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
		`CREATE TABLE model_associations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			source_model_uid TEXT NOT NULL,
			target_model_uid TEXT NOT NULL,
			association_uid TEXT NOT NULL,
			mapping TEXT NOT NULL,
			on_delete TEXT,
			description TEXT,
			created_at DATETIME,
			updated_at DATETIME
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
	}

	for _, sql := range sqls {
		require.NoError(t, db.Exec(sql).Error)
	}

	return db
}

func TestRelationAggregate_InstanceCapabilities_ReturnsCandidateTargets(t *testing.T) {
	db := setupRelationAggregateTestDB(t)
	baseService := NewService(db)
	svc := NewRelationAggregateService(db, baseService)
	ctx := context.Background()
	now := time.Now().UTC()

	require.NoError(t, db.Exec(`
		INSERT INTO dynamic_models (uid, name, created_at, updated_at)
		VALUES ('host', 'Host', ?, ?), ('service', 'Service', ?, ?)
	`, now, now, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO association_types (uid, name, source_to_dest_desc, dest_to_source_desc, is_builtin, created_at, updated_at)
		VALUES ('depends_on', '依赖于', '依赖于', '被依赖', TRUE, ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO model_associations (source_model_uid, target_model_uid, association_uid, mapping, on_delete, created_at, updated_at)
		VALUES ('host', 'service', 'depends_on', 'N:N', 'restrict', ?, ?)
	`, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO resources (id, model_uid, name, configs, created_at, updated_at)
		VALUES
			(1, 'host', 'host-1', '{"name":"host-1"}', ?, ?),
			(2, 'service', 'svc-1', '{"name":"svc-1"}', ?, ?),
			(3, 'service', 'svc-2', '{"name":"svc-2"}', ?, ?)
	`, now, now, now, now, now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO relations (source_id, target_id, association_uid, source_model_uid, target_model_uid, properties, created_at)
		VALUES (1, 2, 'depends_on', 'host', 'service', '{}', ?)
	`, now).Error)

	caps, err := svc.GetInstanceRelationCapabilities(ctx, "host", 1)
	require.NoError(t, err)
	require.NotNil(t, caps.CandidateTargets)
	require.Len(t, caps.CandidateTargets, 2)
}
