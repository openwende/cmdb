package storage

import (
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// MigrateTopology 执行拓扑相关的数据库迁移
func MigrateTopology(db *gorm.DB) error {
	// 1. 创建表
	if err := db.AutoMigrate(
		&types.Set{},
		&types.Module{},
	); err != nil {
		return err
	}

	// 2. 为 hosts 表添加 module_id 字段（如果不存在）
	if !db.Migrator().HasColumn(&types.Host{}, "module_id") {
		if err := db.Exec(`
			ALTER TABLE hosts
			ADD COLUMN module_id bigint REFERENCES modules(id) ON DELETE SET NULL
		`).Error; err != nil {
			// 忽略列已存在的错误
			if !isColumnExistsError(err) {
				return err
			}
		}
	}

	// 3. 创建索引
	indexes := []string{
		`CREATE INDEX IF NOT EXISTS idx_sets_business_id ON sets (business_id)`,
		`CREATE INDEX IF NOT EXISTS idx_sets_is_default ON sets (business_id, is_default) WHERE is_default = true`,
		`CREATE INDEX IF NOT EXISTS idx_modules_set_id ON modules (set_id)`,
		`CREATE INDEX IF NOT EXISTS idx_modules_business_id ON modules (business_id)`,
		`CREATE INDEX IF NOT EXISTS idx_modules_is_default ON modules (set_id, is_default) WHERE is_default = true`,
		`CREATE INDEX IF NOT EXISTS idx_hosts_module_id ON hosts (module_id)`,
	}

	for _, sql := range indexes {
		db.Exec(sql)
	}

	return nil
}
