package storage

import (
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigrateResourceGraphTablesCreatesCoreTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := MigrateResourceGraphTables(db); err != nil {
		t.Fatalf("migrate resource graph tables: %v", err)
	}

	for _, table := range []string{"resource_types_v2", "resources_v2", "edges_v2", "events_v2"} {
		if !db.Migrator().HasTable(table) {
			t.Fatalf("expected table %s to exist", table)
		}
	}
}
