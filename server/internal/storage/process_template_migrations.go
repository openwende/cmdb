package storage

import (
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// MigrateProcessAndTemplates 迁移进程和模板相关表
func MigrateProcessAndTemplates(db *gorm.DB) error {
	// 1. 服务模板表
	if err := db.AutoMigrate(&types.ServiceTemplate{}); err != nil {
		return err
	}

	// 2. 进程模板表
	if err := db.AutoMigrate(&types.ProcessTemplate{}); err != nil {
		return err
	}

	// 3. 进程实例表
	if err := db.AutoMigrate(&types.Process{}); err != nil {
		return err
	}

	// 4. 进程状态表
	if err := db.AutoMigrate(&types.ProcessStatus{}); err != nil {
		return err
	}

	// 5. 集群模板表
	if err := db.AutoMigrate(&types.SetTemplate{}); err != nil {
		return err
	}

	// 6. 集群模板-服务模板绑定表
	if err := db.AutoMigrate(&types.SetTemplateServiceBinding{}); err != nil {
		return err
	}

	// 7. 资源目录表
	if err := db.AutoMigrate(&types.ResourceDirectory{}); err != nil {
		return err
	}

	// 8. 资源池主机表
	if err := db.AutoMigrate(&types.ResourcePoolHost{}); err != nil {
		return err
	}

	// 9. 更新 modules 表添加 service_template_id 字段
	if err := db.AutoMigrate(&types.Module{}); err != nil {
		return err
	}

	// 10. 主机与业务/模块多对多关系表
	if err := db.AutoMigrate(&types.HostBusinessRelation{}, &types.HostModuleRelation{}); err != nil {
		return err
	}

	// 11. 创建默认资源目录
	if err := createDefaultResourceDirectory(db); err != nil {
		return err
	}

	return nil
}

// createDefaultResourceDirectory 创建默认资源目录
func createDefaultResourceDirectory(db *gorm.DB) error {
	var count int64
	db.Model(&types.ResourceDirectory{}).Where("is_default = ?", true).Count(&count)
	if count > 0 {
		return nil // 已存在默认目录
	}

	defaultDir := &types.ResourceDirectory{
		Name:        "默认目录",
		Description: "系统默认资源目录",
		Path:        "/默认目录",
		Level:       1,
		IsDefault:   true,
		SortOrder:   0,
	}

	return db.Create(defaultDir).Error
}
