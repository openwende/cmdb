package storage

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigrateRuntimeProcessSupportTablesCreatesCoreTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := MigrateRuntimeProcessSupportTables(db); err != nil {
		t.Fatalf("migrate runtime process support tables: %v", err)
	}

	for _, table := range []string{"service_templates", "process_templates", "processes", "process_statuses"} {
		if !db.Migrator().HasTable(table) {
			t.Fatalf("expected table %s to exist", table)
		}
	}
}
