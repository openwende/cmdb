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

// MigrateRuntimeProcessSupportTables 仅初始化当前运行时依赖的进程相关表。
// 本地 Docker 联调启用兼容迁移时只需要进程读写依赖表，避免依赖完整业务模板初始化流程。
func MigrateRuntimeProcessSupportTables(db *gorm.DB) error {
	for _, stmt := range runtimeProcessSupportDDL(db.Dialector.Name()) {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}

	return nil
}

func runtimeProcessSupportDDL(dialect string) []string {
	if dialect == "sqlite" {
		return []string{
			`CREATE TABLE IF NOT EXISTS service_templates (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				business_id TEXT NOT NULL,
				service_type TEXT,
				description TEXT,
				created_by TEXT,
				updated_by TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_service_templates_business_id ON service_templates (business_id)`,
			`CREATE TABLE IF NOT EXISTS process_templates (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				name TEXT NOT NULL,
				business_id TEXT NOT NULL,
				service_template_id INTEGER,
				start_command TEXT,
				stop_command TEXT,
				restart_command TEXT,
				reload_command TEXT,
				face_stop_command TEXT,
				work_path TEXT,
				pid_file TEXT,
				user TEXT,
				proc_num INTEGER NOT NULL DEFAULT 1,
				start_param_regex TEXT,
				priority INTEGER NOT NULL DEFAULT 0,
				timeout INTEGER NOT NULL DEFAULT 60,
				auto_start BOOLEAN NOT NULL DEFAULT TRUE,
				auto_recover BOOLEAN NOT NULL DEFAULT TRUE,
				bind_info TEXT,
				description TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS idx_process_templates_business_id ON process_templates (business_id)`,
			`CREATE INDEX IF NOT EXISTS idx_process_templates_service_template_id ON process_templates (service_template_id)`,
			`CREATE TABLE IF NOT EXISTS processes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				process_template_id INTEGER NOT NULL,
				host_id TEXT NOT NULL,
				module_id INTEGER NOT NULL,
				business_id TEXT NOT NULL,
				process_name TEXT,
				bind_info TEXT,
				start_command TEXT,
				user TEXT,
				work_path TEXT,
				priority INTEGER,
				proc_num INTEGER,
				description TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_processes_template_id ON processes (process_template_id)`,
			`CREATE INDEX IF NOT EXISTS idx_processes_host_id ON processes (host_id)`,
			`CREATE INDEX IF NOT EXISTS idx_processes_module_id ON processes (module_id)`,
			`CREATE INDEX IF NOT EXISTS idx_processes_business_id ON processes (business_id)`,
			`CREATE TABLE IF NOT EXISTS process_statuses (
				process_id INTEGER PRIMARY KEY,
				host_id TEXT NOT NULL,
				pid INTEGER NOT NULL DEFAULT 0,
				status TEXT,
				cpu REAL NOT NULL DEFAULT 0,
				memory REAL NOT NULL DEFAULT 0,
				start_time DATETIME,
				last_check_at DATETIME,
				error_message TEXT
			)`,
			`CREATE INDEX IF NOT EXISTS idx_process_statuses_host_id ON process_statuses (host_id)`,
		}
	}

	return []string{
		`CREATE TABLE IF NOT EXISTS service_templates (
			id BIGSERIAL PRIMARY KEY,
			name VARCHAR(200) NOT NULL,
			business_id UUID NOT NULL,
			service_type VARCHAR(50),
			description VARCHAR(500),
			created_by VARCHAR(100),
			updated_by VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_service_templates_business_id ON service_templates (business_id)`,
		`CREATE TABLE IF NOT EXISTS process_templates (
			id BIGSERIAL PRIMARY KEY,
			name VARCHAR(200) NOT NULL,
			business_id UUID NOT NULL,
			service_template_id BIGINT,
			start_command VARCHAR(500),
			stop_command VARCHAR(500),
			restart_command VARCHAR(500),
			reload_command VARCHAR(500),
			face_stop_command VARCHAR(500),
			work_path VARCHAR(500),
			pid_file VARCHAR(500),
			"user" VARCHAR(100),
			proc_num INT NOT NULL DEFAULT 1,
			start_param_regex VARCHAR(500),
			priority INT NOT NULL DEFAULT 0,
			timeout INT NOT NULL DEFAULT 60,
			auto_start BOOLEAN NOT NULL DEFAULT TRUE,
			auto_recover BOOLEAN NOT NULL DEFAULT TRUE,
			bind_info JSONB,
			description VARCHAR(500),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_process_templates_business_id ON process_templates (business_id)`,
		`CREATE INDEX IF NOT EXISTS idx_process_templates_service_template_id ON process_templates (service_template_id)`,
		`CREATE TABLE IF NOT EXISTS processes (
			id BIGSERIAL PRIMARY KEY,
			process_template_id BIGINT NOT NULL,
			host_id UUID NOT NULL,
			module_id BIGINT NOT NULL,
			business_id UUID NOT NULL,
			process_name VARCHAR(200),
			bind_info JSONB,
			start_command VARCHAR(500),
			"user" VARCHAR(100),
			work_path VARCHAR(500),
			priority INT,
			proc_num INT,
			description VARCHAR(500),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_processes_template_id ON processes (process_template_id)`,
		`CREATE INDEX IF NOT EXISTS idx_processes_host_id ON processes (host_id)`,
		`CREATE INDEX IF NOT EXISTS idx_processes_module_id ON processes (module_id)`,
		`CREATE INDEX IF NOT EXISTS idx_processes_business_id ON processes (business_id)`,
		`CREATE TABLE IF NOT EXISTS process_statuses (
			process_id BIGINT PRIMARY KEY,
			host_id UUID NOT NULL,
			pid INT NOT NULL DEFAULT 0,
			status VARCHAR(50),
			cpu DOUBLE PRECISION NOT NULL DEFAULT 0,
			memory DOUBLE PRECISION NOT NULL DEFAULT 0,
			start_time TIMESTAMPTZ,
			last_check_at TIMESTAMPTZ,
			error_message VARCHAR(500)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_process_statuses_host_id ON process_statuses (host_id)`,
	}
}

// MigrateRuntimeResourceSupportTables 仅初始化资源池页面和生命周期接口依赖的表。
// 这里显式建表，避免启动时触发历史模型上的 GORM AutoMigrate 兼容问题。
func MigrateRuntimeResourceSupportTables(db *gorm.DB) error {
	for _, stmt := range runtimeResourceSupportDDL(db.Dialector.Name()) {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}

	// seed 已收敛到 storage.SeedBuiltins(canonical 建表后由 main.go 无条件调用)
	return nil
}

func runtimeResourceSupportDDL(dialect string) []string {
	if dialect == "sqlite" {
		return []string{
			`CREATE TABLE IF NOT EXISTS resource_directories (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				parent_id INTEGER,
				name TEXT NOT NULL,
				description TEXT,
				path TEXT,
				level INTEGER NOT NULL DEFAULT 1,
				sort_order INTEGER NOT NULL DEFAULT 0,
				is_default BOOLEAN NOT NULL DEFAULT FALSE,
				created_by TEXT,
				updated_by TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_resource_directories_parent_id ON resource_directories (parent_id)`,
			`CREATE INDEX IF NOT EXISTS idx_resource_directories_path ON resource_directories (path)`,
			`CREATE INDEX IF NOT EXISTS idx_resource_directories_default ON resource_directories (is_default)`,
			`CREATE TABLE IF NOT EXISTS resource_pool_hosts (
				host_id TEXT PRIMARY KEY,
				directory_id INTEGER NOT NULL,
				imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				imported_by TEXT,
				remark TEXT
			)`,
			`CREATE INDEX IF NOT EXISTS idx_resource_pool_hosts_directory_id ON resource_pool_hosts (directory_id)`,
		}
	}

	return []string{
		`CREATE TABLE IF NOT EXISTS resource_directories (
			id BIGSERIAL PRIMARY KEY,
			parent_id BIGINT,
			name VARCHAR(200) NOT NULL,
			description VARCHAR(500),
			path VARCHAR(500),
			level INT NOT NULL DEFAULT 1,
			sort_order INT NOT NULL DEFAULT 0,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_by VARCHAR(100),
			updated_by VARCHAR(100),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_directories_parent_id ON resource_directories (parent_id)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_directories_path ON resource_directories (path)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_directories_default ON resource_directories (is_default)`,
		`CREATE TABLE IF NOT EXISTS resource_pool_hosts (
			host_id UUID PRIMARY KEY,
			directory_id BIGINT NOT NULL,
			imported_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			imported_by VARCHAR(100),
			remark VARCHAR(500)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_pool_hosts_directory_id ON resource_pool_hosts (directory_id)`,
	}
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
