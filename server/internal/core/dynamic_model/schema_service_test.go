package dynamic_model

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupSchemaServiceTestDB(t *testing.T) *gorm.DB {
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
		`CREATE TABLE dynamic_attributes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			model_uid TEXT NOT NULL,
			field_uid TEXT NOT NULL,
			field_name TEXT NOT NULL,
			field_type TEXT NOT NULL,
			category TEXT NOT NULL,
			is_required BOOLEAN NOT NULL DEFAULT FALSE,
			is_unique BOOLEAN NOT NULL DEFAULT FALSE,
			unique_group TEXT,
			is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
			default_value TEXT,
			placeholder TEXT,
			unit TEXT,
			validators TEXT,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE business_custom_field_groups (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id TEXT NOT NULL,
			object_type TEXT NOT NULL,
			name TEXT NOT NULL,
			collapsed_by_default BOOLEAN NOT NULL DEFAULT FALSE,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_by TEXT,
			updated_by TEXT,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE business_custom_fields (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id TEXT NOT NULL,
			object_type TEXT NOT NULL,
			group_id INTEGER,
			field_uid TEXT NOT NULL,
			field_name TEXT NOT NULL,
			field_type TEXT NOT NULL,
			is_required BOOLEAN NOT NULL DEFAULT FALSE,
			is_editable BOOLEAN NOT NULL DEFAULT TRUE,
			is_unique BOOLEAN NOT NULL DEFAULT FALSE,
			default_value TEXT,
			placeholder TEXT,
			validators TEXT,
			options TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_by TEXT,
			updated_by TEXT,
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

func TestSchemaService_GetFormSchema_MergesBusinessOverrides(t *testing.T) {
	db := setupSchemaServiceTestDB(t)
	svc := NewSchemaService(db, NewService(db))
	ctx := context.Background()
	bizID := uuid.New()
	now := time.Now().UTC()

	require.NoError(t, db.Exec(`
		INSERT INTO business_custom_field_groups
			(business_id, object_type, name, collapsed_by_default, sort_order, created_by, updated_by, created_at, updated_at)
		VALUES
			(?, 'module', '扩展信息', FALSE, 10, 'tester', 'tester', ?, ?)
	`, bizID.String(), now, now).Error)
	require.NoError(t, db.Exec(`
		INSERT INTO business_custom_fields
			(business_id, object_type, group_id, field_uid, field_name, field_type, is_required, is_editable, is_unique, placeholder, sort_order, created_by, updated_by, created_at, updated_at)
		VALUES
			(?, 'module', 1, 'owner', '负责人', 'string', TRUE, TRUE, FALSE, '请输入负责人', 10, 'tester', 'tester', ?, ?)
	`, bizID.String(), now, now).Error)

	schema, err := svc.GetFormSchema(ctx, "module", "topology_create", bizID)
	require.NoError(t, err)
	require.NotEmpty(t, schema.Fields)
	require.Equal(t, "module", schema.ModelUID)
	require.Equal(t, "topology_create", schema.Scene)

	fieldNames := make([]string, 0, len(schema.Fields))
	for _, field := range schema.Fields {
		fieldNames = append(fieldNames, field.Name)
	}

	require.Contains(t, fieldNames, "name")
	require.Contains(t, fieldNames, "owner")
}
