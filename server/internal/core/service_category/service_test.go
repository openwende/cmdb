package service_category

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

func setupServiceCategoryTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`
		CREATE TABLE service_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id TEXT,
			name TEXT NOT NULL,
			parent_id BIGINT,
			root_id BIGINT NOT NULL,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)
	`).Error)

	return db
}

func seedServiceCategoryRow(t *testing.T, db *gorm.DB, id uint64, businessID *uuid.UUID, name string, parentID *uint64, rootID uint64, isBuiltin bool, sortOrder int) {
	t.Helper()

	require.NoError(t, db.Exec(`
		INSERT INTO service_categories (id, business_id, name, parent_id, root_id, is_builtin, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, businessID, name, parentID, rootID, isBuiltin, sortOrder, time.Now(), time.Now()).Error)
}

func TestListCategories_ReturnsBuiltinAndBusinessRows(t *testing.T) {
	db := setupServiceCategoryTestDB(t)
	svc := NewService(db)

	bizID := uuid.MustParse("2f567fe1-1e9d-4f5e-8f07-e7804a11f001")
	rootID := uint64(10)

	seedServiceCategoryRow(t, db, 1, nil, "Default", nil, 1, true, 0)
	parentID := uint64(1)
	seedServiceCategoryRow(t, db, 2, nil, "Default", &parentID, 1, true, 0)
	seedServiceCategoryRow(t, db, rootID, &bizID, "Database", nil, rootID, false, 10)
	seedServiceCategoryRow(t, db, 11, &bizID, "MySQL", &rootID, rootID, false, 20)

	rows, err := svc.ListCategories(context.Background(), bizID)
	require.NoError(t, err)
	require.Len(t, rows, 4)
	require.Equal(t, uint64(1), rows[0].ID)
	require.Equal(t, uint64(2), rows[1].ID)
	require.Equal(t, uint64(10), rows[2].ID)
	require.Equal(t, uint64(11), rows[3].ID)
}
