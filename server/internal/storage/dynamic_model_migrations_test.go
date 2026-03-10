package storage

import (
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

	for _, table := range []string{"dynamic_models", "association_types", "model_associations", "relations"} {
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
