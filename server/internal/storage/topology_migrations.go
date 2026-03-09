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
		&types.MainlineInstance{},
		&types.HostBusinessRelation{},
		&types.HostModuleRelation{},
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
		`CREATE INDEX IF NOT EXISTS idx_host_business_relations_business_id ON host_business_relations (business_id)`,
		`CREATE INDEX IF NOT EXISTS idx_host_module_relations_module_id ON host_module_relations (module_id)`,
	}

	for _, sql := range indexes {
		db.Exec(sql)
	}

	// 4. 从旧单归属字段回填到多对多关系表（幂等）
	db.Exec(`
		INSERT INTO host_business_relations (host_id, business_id, created_at)
		SELECT h.id, b.id, NOW()
		FROM hosts h
		JOIN businesses b ON b.business_id = h.business_id
		WHERE h.business_id IS NOT NULL
		ON CONFLICT (host_id, business_id) DO NOTHING
	`)
	db.Exec(`
		INSERT INTO host_module_relations (host_id, module_id, created_at)
		SELECT h.id, h.module_id, NOW()
		FROM hosts h
		WHERE h.module_id IS NOT NULL
		ON CONFLICT (host_id, module_id) DO NOTHING
	`)

	return nil
}
