package storage

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestMigrateRuntimeServiceCategorySupportTablesCreatesDefaults(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`
		CREATE TABLE modules (
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
		)
	`).Error)

	require.NoError(t, MigrateRuntimeServiceCategorySupportTables(db))

	type categoryRow struct {
		ID        uint64  `gorm:"column:id"`
		Name      string  `gorm:"column:name"`
		ParentID  *uint64 `gorm:"column:parent_id"`
		RootID    uint64  `gorm:"column:root_id"`
		IsBuiltin bool    `gorm:"column:is_builtin"`
	}

	var rows []categoryRow
	require.NoError(t, db.Table("service_categories").Order("id ASC").Find(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, uint64(1), rows[0].ID)
	require.Equal(t, "Default", rows[0].Name)
	require.Nil(t, rows[0].ParentID)
	require.True(t, rows[0].IsBuiltin)
	require.Equal(t, uint64(2), rows[1].ID)
	require.NotNil(t, rows[1].ParentID)
	require.Equal(t, uint64(1), *rows[1].ParentID)
	require.Equal(t, uint64(1), rows[1].RootID)
	require.True(t, db.Migrator().HasColumn("modules", "service_category_id"))
}
