package storage

import (
	"encoding/json"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupDynamicModelMigrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	schema := []string{
		`CREATE TABLE models (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			display_name TEXT NOT NULL,
			description TEXT,
			icon TEXT,
			is_builtin BOOLEAN NOT NULL DEFAULT 0,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE dynamic_models (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			uid TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			is_paused BOOLEAN NOT NULL DEFAULT 0,
			description TEXT,
			icon TEXT,
			unique_fields TEXT,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
	}

	for _, stmt := range schema {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("create schema: %v", err)
		}
	}

	return db
}

func TestSeedBuiltinDynamicModelsFromStaticModels(t *testing.T) {
	db := setupDynamicModelMigrationTestDB(t)
	now := time.Now().UTC()

	if err := db.Exec(
		`INSERT INTO models (id, name, display_name, description, icon, is_builtin, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
		"1", "set", "集群", "系统内置集群主线模型", "cluster", true, now, now,
		"2", "custom_app", "自定义应用", "custom", "app", false, now, now,
	).Error; err != nil {
		t.Fatalf("insert models: %v", err)
	}

	if err := seedBuiltinDynamicModelsFromStaticModels(db); err != nil {
		t.Fatalf("seed builtin dynamic models: %v", err)
	}

	type seededModel struct {
		UID         string
		Name        string
		Description string
		Icon        string
		IsPaused    bool
	}

	var items []seededModel
	if err := db.Table("dynamic_models").Order("uid ASC").Find(&items).Error; err != nil {
		t.Fatalf("query seeded models: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("expected 1 seeded model, got %d", len(items))
	}

	if items[0].UID != "set" {
		t.Fatalf("expected uid set, got %s", items[0].UID)
	}
	if items[0].Name != "集群" {
		t.Fatalf("expected name 集群, got %s", items[0].Name)
	}
	if items[0].Description != "系统内置集群主线模型" {
		t.Fatalf("unexpected description: %s", items[0].Description)
	}
	if items[0].Icon != "cluster" {
		t.Fatalf("expected icon cluster, got %s", items[0].Icon)
	}
	if items[0].IsPaused {
		t.Fatalf("expected seeded builtin model to be active")
	}
}

func TestMigrateRuntimeSupportTablesCreatesRequiredTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := MigrateRuntimeSupportTables(db); err != nil {
		t.Fatalf("migrate runtime support tables: %v", err)
	}

	for _, table := range []string{"dynamic_models", "dynamic_attributes", "association_types", "model_associations", "relations"} {
		if !db.Migrator().HasTable(table) {
			t.Fatalf("expected table %s to exist", table)
		}
	}

	var count int64
	if err := db.Table("association_types").Count(&count).Error; err != nil {
		t.Fatalf("count association types: %v", err)
	}
	if count != int64(len(BuiltinAssociationTypes)) {
		t.Fatalf("expected %d association types, got %d", len(BuiltinAssociationTypes), count)
	}
}

func TestMigrateRuntimeSupportTablesCreatesResourceInstanceTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := MigrateRuntimeSupportTables(db); err != nil {
		t.Fatalf("migrate runtime support tables: %v", err)
	}

	for _, table := range []string{"resources", "resource_states", "resource_histories"} {
		if !db.Migrator().HasTable(table) {
			t.Fatalf("expected table %s to exist", table)
		}
	}
}

func TestMigrateRuntimeSupportTablesSeedsBuiltinStaticModelAttributesWhenMissing(t *testing.T) {
	db := setupDynamicModelMigrationTestDB(t)
	now := time.Now().UTC()

	if err := db.Exec(`
		CREATE TABLE model_attributes (
			id TEXT PRIMARY KEY,
			model_id TEXT NOT NULL,
			name TEXT NOT NULL,
			display_name TEXT NOT NULL,
			field_type TEXT NOT NULL,
			is_required BOOLEAN NOT NULL DEFAULT 0,
			is_unique BOOLEAN NOT NULL DEFAULT 0,
			is_editable BOOLEAN NOT NULL DEFAULT 1,
			is_system BOOLEAN NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			options TEXT,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			UNIQUE(model_id, name)
		)
	`).Error; err != nil {
		t.Fatalf("create model_attributes: %v", err)
	}

	if err := db.Exec(
		`INSERT INTO models (id, name, display_name, description, icon, is_builtin, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)`,
		"11111111-1111-1111-1111-111111111111", "business", "业务", "builtin biz", "business", true, now, now,
		"22222222-2222-2222-2222-222222222222", "set", "集群", "builtin set", "cluster", true, now, now,
		"33333333-3333-3333-3333-333333333333", "module", "模块", "builtin module", "module", true, now, now,
		"44444444-4444-4444-4444-444444444444", "host", "主机", "builtin host", "host", true, now, now,
	).Error; err != nil {
		t.Fatalf("insert builtin models: %v", err)
	}

	if err := MigrateRuntimeSupportTables(db); err != nil {
		t.Fatalf("migrate runtime support tables: %v", err)
	}

	type staticAttribute struct {
		Name string
	}

	checks := []struct {
		ModelID string
		Name    string
	}{
		{"11111111-1111-1111-1111-111111111111", "bk_biz_name"},
		{"22222222-2222-2222-2222-222222222222", "bk_set_name"},
		{"33333333-3333-3333-3333-333333333333", "bk_module_name"},
		{"44444444-4444-4444-4444-444444444444", "bk_host_innerip"},
	}

	for _, check := range checks {
		var row staticAttribute
		if err := db.Table("model_attributes").Where("model_id = ? AND name = ?", check.ModelID, check.Name).First(&row).Error; err != nil {
			t.Fatalf("expected builtin static attribute %s for model %s: %v", check.Name, check.ModelID, err)
		}
	}

	type dynamicAttribute struct {
		ModelUID string
		FieldUID string
	}

	if err := db.Table("dynamic_attributes").Where("model_uid = ? AND field_uid = ?", "module", "bk_module_name").First(&dynamicAttribute{}).Error; err != nil {
		t.Fatalf("expected module dynamic attribute to be synced: %v", err)
	}
}

func TestMigrateRuntimeSupportTablesSeedsDynamicAttributesFromStaticModelAttributes(t *testing.T) {
	db := setupDynamicModelMigrationTestDB(t)
	now := time.Now().UTC()

	if err := db.Exec(`
		CREATE TABLE model_attributes (
			id TEXT PRIMARY KEY,
			model_id TEXT NOT NULL,
			name TEXT NOT NULL,
			display_name TEXT NOT NULL,
			field_type TEXT NOT NULL,
			is_required BOOLEAN NOT NULL DEFAULT 0,
			is_unique BOOLEAN NOT NULL DEFAULT 0,
			is_editable BOOLEAN NOT NULL DEFAULT 1,
			is_system BOOLEAN NOT NULL DEFAULT 0,
			sort_order INTEGER NOT NULL DEFAULT 0,
			options TEXT,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)
	`).Error; err != nil {
		t.Fatalf("create model_attributes: %v", err)
	}

	options, err := json.Marshal(map[string]any{
		"placeholder": "请输入模块名称",
		"unit":        "",
	})
	if err != nil {
		t.Fatalf("marshal options: %v", err)
	}

	if err := db.Exec(
		`INSERT INTO models (id, name, display_name, description, icon, is_builtin, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"model-1", "module", "模块", "系统内置模块模型", "module", true, now, now,
	).Error; err != nil {
		t.Fatalf("insert model: %v", err)
	}

	if err := db.Exec(
		`INSERT INTO model_attributes (id, model_id, name, display_name, field_type, is_required, is_unique, is_editable, is_system, sort_order, options, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		"attr-1", "model-1", "bk_module_name", "模块名称", "string", true, false, true, true, 0, string(options), now, now,
	).Error; err != nil {
		t.Fatalf("insert model_attribute: %v", err)
	}

	if err := MigrateRuntimeSupportTables(db); err != nil {
		t.Fatalf("migrate runtime support tables: %v", err)
	}

	type seededAttribute struct {
		ModelUID    string
		FieldUID    string
		FieldName   string
		FieldType   string
		IsRequired  bool
		IsReadOnly  bool
		Placeholder string
	}

	var item seededAttribute
	if err := db.Table("dynamic_attributes").Where("model_uid = ? AND field_uid = ?", "module", "bk_module_name").First(&item).Error; err != nil {
		t.Fatalf("query dynamic_attributes: %v", err)
	}

	if item.FieldName != "模块名称" {
		t.Fatalf("expected field name 模块名称, got %s", item.FieldName)
	}
	if item.FieldType != "string" {
		t.Fatalf("expected field type string, got %s", item.FieldType)
	}
	if !item.IsRequired {
		t.Fatalf("expected field to be required")
	}
	if item.IsReadOnly {
		t.Fatalf("expected editable static field to stay writable")
	}
	if item.Placeholder != "请输入模块名称" {
		t.Fatalf("expected placeholder to be seeded, got %s", item.Placeholder)
	}
}

func TestMigrateRuntimeResourceSupportTablesCreatesDefaultDirectory(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := MigrateRuntimeResourceSupportTables(db); err != nil {
		t.Fatalf("migrate runtime resource support tables: %v", err)
	}

	for _, table := range []string{"resource_directories", "resource_pool_hosts"} {
		if !db.Migrator().HasTable(table) {
			t.Fatalf("expected table %s to exist", table)
		}
	}

	type defaultDirectory struct {
		Name      string
		Path      string
		IsDefault bool
	}

	var directory defaultDirectory
	if err := db.Table("resource_directories").Where("is_default = ?", true).First(&directory).Error; err != nil {
		t.Fatalf("query default directory: %v", err)
	}

	if directory.Name != "默认目录" {
		t.Fatalf("expected default directory name 默认目录, got %s", directory.Name)
	}
	if directory.Path != "/默认目录" {
		t.Fatalf("expected default directory path /默认目录, got %s", directory.Path)
	}
	if !directory.IsDefault {
		t.Fatalf("expected queried directory to be default")
	}
}
