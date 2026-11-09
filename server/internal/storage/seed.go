package storage

import (
	"fmt"

	"gorm.io/gorm"
)

// SeedBuiltins 是内置数据的统一 seed 入口。
//
// 约定:表结构由 canonical 迁移(golang-migrate)负责创建,本函数只负责向已存在的表写入
// 内置/默认数据,且全部幂等(ON CONFLICT / 先查后插 / FirstOrCreate),可在每次启动无条件调用。
//
// 这里只包含 storage 包内、彼此无跨包依赖的 seed。依赖 mainline 内置模型(A 套 models)的
// B 套同步,见 SeedDynamicFromStatic —— 必须在 mainline.EnsureBuiltinModels 之后调用。
func SeedBuiltins(db *gorm.DB) error {
	if err := seedBuiltinServiceCategories(db); err != nil {
		return fmt.Errorf("seed builtin service categories: %w", err)
	}
	if err := createDefaultResourceDirectory(db); err != nil {
		return fmt.Errorf("seed default resource directory: %w", err)
	}
	if err := seedBuiltinData(db); err != nil {
		return fmt.Errorf("seed builtin association types: %w", err)
	}
	return nil
}

// SeedDynamicFromStatic 把 A 套(models / model_attributes)的内置模型与属性同步到 B 套
// (dynamic_models / dynamic_attributes)。
//
// 顺序硬约束:必须在 mainline.EnsureBuiltinModels(填充 A 套内置模型)之后调用,否则源表为空、
// 同步空跑(这正是收敛前 automigrate 早于 lazy EnsureBuiltinModels 导致的 bug)。
// 内部:先补 A 套静态属性 → 再同步 B 套模型 → 最后同步 B 套属性(依赖前一步的 model_attributes)。
func SeedDynamicFromStatic(db *gorm.DB) error {
	if err := seedBuiltinStaticModelAttributesFromBuiltinModels(db); err != nil {
		return fmt.Errorf("seed builtin static model attributes: %w", err)
	}
	if err := seedBuiltinDynamicModelsFromStaticModels(db); err != nil {
		return fmt.Errorf("seed builtin dynamic models: %w", err)
	}
	if err := seedRuntimeDynamicAttributesFromStaticModels(db); err != nil {
		return fmt.Errorf("seed runtime dynamic attributes: %w", err)
	}
	return nil
}

// SeedAuthUsers creates the demo accounts, whose passwords are in the source code.
// Production deployments use EnsureInitialAdmin instead.
func SeedAuthUsers(db *gorm.DB) error {
	return seedDefaultAuthUsers(db)
}
