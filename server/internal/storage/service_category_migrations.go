package storage

import (
	"time"

	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/types"
)

func MigrateRuntimeServiceCategorySupportTables(db *gorm.DB) error {
	for _, stmt := range runtimeServiceCategoryDDL(db.Dialector.Name()) {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}

	if db.Migrator().HasTable(&types.Module{}) && !db.Migrator().HasColumn(&types.Module{}, "service_category_id") {
		if err := db.Migrator().AddColumn(&types.Module{}, "ServiceCategoryID"); err != nil {
			return err
		}
	}

	// seed 已收敛到 storage.SeedBuiltins(canonical 建表后由 main.go 无条件调用)
	return nil
}

func runtimeServiceCategoryDDL(dialect string) []string {
	if dialect == "sqlite" {
		return []string{
			`CREATE TABLE IF NOT EXISTS service_categories (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				business_id TEXT,
				name TEXT NOT NULL,
				parent_id INTEGER,
				root_id INTEGER NOT NULL,
				is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
				sort_order INTEGER NOT NULL DEFAULT 0,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_service_categories_business_id ON service_categories (business_id)`,
			`CREATE INDEX IF NOT EXISTS idx_service_categories_parent_id ON service_categories (parent_id)`,
			`CREATE INDEX IF NOT EXISTS idx_service_categories_root_id ON service_categories (root_id)`,
		}
	}

	return []string{
		`CREATE TABLE IF NOT EXISTS service_categories (
			id BIGSERIAL PRIMARY KEY,
			business_id UUID,
			name VARCHAR(200) NOT NULL,
			parent_id BIGINT,
			root_id BIGINT NOT NULL,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			sort_order INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_service_categories_business_id ON service_categories (business_id)`,
		`CREATE INDEX IF NOT EXISTS idx_service_categories_parent_id ON service_categories (parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_service_categories_root_id ON service_categories (root_id)`,
	}
}

func seedBuiltinServiceCategories(db *gorm.DB) error {
	var count int64
	if err := db.Model(&types.ServiceCategory{}).Where("is_builtin = ?", true).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now()
	root := types.ServiceCategory{
		ID:        1,
		Name:      "Default",
		RootID:    1,
		IsBuiltin: true,
		SortOrder: 0,
		CreatedAt: now,
		UpdatedAt: now,
	}
	childParentID := uint64(1)
	child := types.ServiceCategory{
		ID:        2,
		Name:      "Default",
		ParentID:  &childParentID,
		RootID:    1,
		IsBuiltin: true,
		SortOrder: 0,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := db.Where("id = ?", root.ID).FirstOrCreate(&root).Error; err != nil {
		return err
	}
	if err := db.Where("id = ?", child.ID).FirstOrCreate(&child).Error; err != nil {
		return err
	}
	return nil
}
