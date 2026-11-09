package storage

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/openwende/cmdb-server/internal/types"
	"gorm.io/gorm"
)

// MigrateDynamicModels 执行动态模型相关的数据库迁移
// 包括创建表、生成列、唯一索引等
func MigrateDynamicModels(db *gorm.DB) error {
	// 1. 创建基础表（使用 GORM AutoMigrate）
	// 注意：AutoMigrate 无法处理 Generated Columns，需要手动添加
	if err := db.AutoMigrate(
		&types.DynamicModel{},
		&types.DynamicAttribute{},
		&types.Resource{},
		&types.ResourceState{},
		&types.AssociationType{},
		&types.DynamicModelAssociation{},
		&types.Relation{},
		&types.ResourceHistory{},
		&types.ModelUniqueRule{},
		&types.ModelUniqueRuleField{},
	); err != nil {
		return fmt.Errorf("自动迁移失败: %w", err)
	}

	// 2. 添加生成列（Generated Columns）
	if err := addGeneratedColumns(db); err != nil {
		return fmt.Errorf("添加生成列失败: %w", err)
	}

	// 3. 创建特殊索引
	if err := createSpecialIndexes(db); err != nil {
		return fmt.Errorf("创建索引失败: %w", err)
	}

	// 4. 设置表参数
	if err := setTableParameters(db); err != nil {
		return fmt.Errorf("设置表参数失败: %w", err)
	}

	// 5. 初始化预定义数据
	if err := seedBuiltinData(db); err != nil {
		return fmt.Errorf("初始化预定义数据失败: %w", err)
	}
	if err := seedBuiltinDynamicModelsFromStaticModels(db); err != nil {
		return fmt.Errorf("同步内置模型失败: %w", err)
	}

	return nil
}

// MigrateRuntimeSupportTables 仅初始化当前运行时依赖的动态模型元数据表。
// Docker 本地部署只需要关系能力相关表，避免触发完整动态引擎迁移中的历史兼容问题。
func MigrateRuntimeSupportTables(db *gorm.DB) error {
	for _, stmt := range runtimeSupportDDL(db.Dialector.Name()) {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("创建运行时支持表失败: %w", err)
		}
	}

	if err := upgradeResourceHistoriesColumns(db); err != nil {
		return fmt.Errorf("升级审计日志冗余列失败: %w", err)
	}

	// seed(关联类型 + A→B 套同步)已收敛到 storage.SeedBuiltins / SeedDynamicFromStatic,
	// 由 main.go 在 canonical 建表 + mainline 内置模型之后无条件、按正确顺序调用。
	return nil
}

// upgradeResourceHistoriesColumns 为存量数据库幂等补齐审计日志冗余列。
// resource_name / biz_name 写入时落库，使审计记录自包含。
// 开发期不回填历史数据：老记录的两列保持空串，必要时直接清库即可。
// 仅针对 PostgreSQL：SQLite 仅用于测试，建表语句已直接包含这两列。
func upgradeResourceHistoriesColumns(db *gorm.DB) error {
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	addColumns := []string{
		`ALTER TABLE resource_histories ADD COLUMN IF NOT EXISTS resource_name VARCHAR(200) NOT NULL DEFAULT ''`,
		`ALTER TABLE resource_histories ADD COLUMN IF NOT EXISTS biz_name VARCHAR(200) NOT NULL DEFAULT ''`,
	}
	for _, stmt := range addColumns {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}

	return nil
}

func runtimeSupportDDL(dialect string) []string {
	if dialect == "sqlite" {
		return []string{
			`CREATE TABLE IF NOT EXISTS dynamic_models (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				uid TEXT NOT NULL,
				name TEXT NOT NULL,
				is_paused BOOLEAN NOT NULL DEFAULT FALSE,
				description TEXT,
				icon TEXT,
				unique_fields TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_dynamic_models_uid ON dynamic_models (uid)`,
			`CREATE TABLE IF NOT EXISTS dynamic_attributes (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				model_uid TEXT NOT NULL,
				field_uid TEXT NOT NULL,
				field_name TEXT NOT NULL,
				field_type TEXT NOT NULL,
				category TEXT NOT NULL DEFAULT 'config',
				is_required BOOLEAN NOT NULL DEFAULT FALSE,
				is_unique BOOLEAN NOT NULL DEFAULT FALSE,
				unique_group TEXT,
				is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
				default_value TEXT,
				placeholder TEXT,
				unit TEXT,
				validators TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_dynamic_attributes_model_field
				ON dynamic_attributes (model_uid, field_uid)`,
			`CREATE TABLE IF NOT EXISTS association_types (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				uid TEXT NOT NULL,
				name TEXT NOT NULL,
				source_to_dest_desc TEXT,
				dest_to_source_desc TEXT,
				is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
				description TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_association_types_uid ON association_types (uid)`,
			`CREATE TABLE IF NOT EXISTS model_associations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source_model_uid TEXT NOT NULL,
				target_model_uid TEXT NOT NULL,
				association_uid TEXT NOT NULL,
				mapping TEXT NOT NULL,
				on_delete TEXT,
				description TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_model_association
				ON model_associations (source_model_uid, target_model_uid, association_uid)`,
			`CREATE INDEX IF NOT EXISTS idx_model_associations_source_assoc
				ON model_associations (source_model_uid, association_uid)`,
			`CREATE INDEX IF NOT EXISTS idx_model_associations_target_assoc
				ON model_associations (target_model_uid, association_uid)`,
			`CREATE TABLE IF NOT EXISTS relations (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				source_id INTEGER NOT NULL,
				target_id INTEGER NOT NULL,
				association_uid TEXT NOT NULL,
				source_model_uid TEXT,
				target_model_uid TEXT,
				properties TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS idx_relations_source_assoc
				ON relations (source_id, association_uid)`,
			`CREATE INDEX IF NOT EXISTS idx_relations_target_assoc
				ON relations (target_id, association_uid)`,
			`CREATE INDEX IF NOT EXISTS idx_relations_models_assoc
				ON relations (source_model_uid, target_model_uid, association_uid)`,
			`CREATE TABLE IF NOT EXISTS resources (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				model_uid TEXT NOT NULL,
				name TEXT NOT NULL,
				configs TEXT NOT NULL,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_resources_model_uid
				ON resources (model_uid)`,
			`CREATE TABLE IF NOT EXISTS resource_states (
				resource_id INTEGER PRIMARY KEY,
				last_check_time DATETIME,
				health_status INTEGER NOT NULL DEFAULT 0,
				metrics TEXT,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE TABLE IF NOT EXISTS resource_histories (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				resource_id INTEGER NOT NULL,
				model_uid TEXT NOT NULL,
				change_type TEXT NOT NULL,
				before_data TEXT,
				after_data TEXT,
				changed_by TEXT,
				changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				client_ip TEXT,
				user_agent TEXT,
				resource_name TEXT NOT NULL DEFAULT '',
				biz_name TEXT NOT NULL DEFAULT ''
			)`,
			`CREATE INDEX IF NOT EXISTS idx_resource_histories_resource_time
				ON resource_histories (resource_id, changed_at DESC)`,
		}
	}

	return []string{
		`CREATE TABLE IF NOT EXISTS dynamic_models (
			id BIGSERIAL PRIMARY KEY,
			uid VARCHAR(50) NOT NULL,
			name VARCHAR(100) NOT NULL,
			is_paused BOOLEAN NOT NULL DEFAULT FALSE,
			description VARCHAR(500),
			icon VARCHAR(50),
			unique_fields JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_dynamic_models_uid ON dynamic_models (uid)`,
		`CREATE TABLE IF NOT EXISTS dynamic_attributes (
			id BIGSERIAL PRIMARY KEY,
			model_uid VARCHAR(50) NOT NULL,
			field_uid VARCHAR(50) NOT NULL,
			field_name VARCHAR(100) NOT NULL,
			field_type VARCHAR(20) NOT NULL,
			category VARCHAR(20) NOT NULL DEFAULT 'config',
			is_required BOOLEAN NOT NULL DEFAULT FALSE,
			is_unique BOOLEAN NOT NULL DEFAULT FALSE,
			unique_group VARCHAR(50),
			is_read_only BOOLEAN NOT NULL DEFAULT FALSE,
			default_value VARCHAR(500),
			placeholder VARCHAR(200),
			unit VARCHAR(20),
			validators JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_dynamic_attributes_model_field
			ON dynamic_attributes (model_uid, field_uid)`,
		`CREATE TABLE IF NOT EXISTS association_types (
			id BIGSERIAL PRIMARY KEY,
			uid VARCHAR(50) NOT NULL,
			name VARCHAR(100) NOT NULL,
			source_to_dest_desc VARCHAR(100),
			dest_to_source_desc VARCHAR(100),
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			description VARCHAR(500),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_association_types_uid ON association_types (uid)`,
		`CREATE TABLE IF NOT EXISTS model_associations (
			id BIGSERIAL PRIMARY KEY,
			source_model_uid VARCHAR(50) NOT NULL,
			target_model_uid VARCHAR(50) NOT NULL,
			association_uid VARCHAR(50) NOT NULL,
			mapping VARCHAR(10) NOT NULL,
			on_delete VARCHAR(20),
			description VARCHAR(500),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_model_association
			ON model_associations (source_model_uid, target_model_uid, association_uid)`,
		`CREATE INDEX IF NOT EXISTS idx_model_associations_source_assoc
			ON model_associations (source_model_uid, association_uid)`,
		`CREATE INDEX IF NOT EXISTS idx_model_associations_target_assoc
			ON model_associations (target_model_uid, association_uid)`,
		`CREATE TABLE IF NOT EXISTS relations (
			id BIGSERIAL PRIMARY KEY,
			source_id BIGINT NOT NULL,
			target_id BIGINT NOT NULL,
			association_uid VARCHAR(50) NOT NULL,
			source_model_uid VARCHAR(50),
			target_model_uid VARCHAR(50),
			properties JSONB,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_source_assoc
			ON relations (source_id, association_uid)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_target_assoc
			ON relations (target_id, association_uid)`,
		`CREATE INDEX IF NOT EXISTS idx_relations_models_assoc
			ON relations (source_model_uid, target_model_uid, association_uid)`,
		`CREATE TABLE IF NOT EXISTS resources (
			id BIGSERIAL PRIMARY KEY,
			model_uid VARCHAR(50) NOT NULL,
			name VARCHAR(200) NOT NULL,
			configs JSONB NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_resources_model_uid
			ON resources (model_uid)`,
		`CREATE TABLE IF NOT EXISTS resource_states (
			resource_id BIGINT PRIMARY KEY,
			last_check_time TIMESTAMPTZ,
			health_status INTEGER NOT NULL DEFAULT 0,
			metrics JSONB,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS resource_histories (
			id BIGSERIAL PRIMARY KEY,
			resource_id BIGINT NOT NULL,
			model_uid VARCHAR(50) NOT NULL,
			change_type VARCHAR(20) NOT NULL,
			before_data JSONB,
			after_data JSONB,
			changed_by VARCHAR(100),
			changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			client_ip VARCHAR(50),
			user_agent VARCHAR(500),
			resource_name VARCHAR(200) NOT NULL DEFAULT '',
			biz_name VARCHAR(200) NOT NULL DEFAULT ''
		)`,
		`CREATE INDEX IF NOT EXISTS idx_resource_histories_resource_time
			ON resource_histories (resource_id, changed_at DESC)`,
		// 审计列表按 changed_at DESC 排序 + 时间范围过滤（resource 标签页排除 model 时主走此索引）
		`CREATE INDEX IF NOT EXISTS idx_resource_histories_changed_at
			ON resource_histories (changed_at DESC)`,
		// host/business 标签页按 model_uid 过滤 + 时间排序
		`CREATE INDEX IF NOT EXISTS idx_resource_histories_model_time
			ON resource_histories (model_uid, changed_at DESC)`,
		// 业务过滤：快照 configs->>'business_id' 等值匹配（表达式索引，需与查询表达式一致）
		`CREATE INDEX IF NOT EXISTS idx_resource_histories_biz
			ON resource_histories ((COALESCE(after_data, before_data) ->> 'business_id'))`,
	}
}

type builtinStaticModelSeed struct {
	UID         string
	Name        string
	Description string
	Icon        string
}

func seedBuiltinDynamicModelsFromStaticModels(db *gorm.DB) error {
	if db == nil || !db.Migrator().HasTable("models") {
		return nil
	}

	var items []builtinStaticModelSeed
	if err := db.Table("models").
		Select("name AS uid, display_name AS name, description, icon").
		Where("is_builtin = ?", true).
		Order("name ASC").
		Scan(&items).Error; err != nil {
		return err
	}

	now := time.Now()
	for _, item := range items {
		if item.UID == "" || item.Name == "" {
			continue
		}

		if err := db.Exec(
			`INSERT INTO dynamic_models (uid, name, is_paused, description, icon, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(uid) DO UPDATE
			 SET name = excluded.name,
			     description = excluded.description,
			     icon = excluded.icon,
			     updated_at = excluded.updated_at`,
			item.UID,
			item.Name,
			false,
			item.Description,
			item.Icon,
			now,
			now,
		).Error; err != nil {
			return err
		}
	}

	return nil
}

type builtinStaticAttributeSeed struct {
	ModelUID   string
	FieldUID   string
	FieldName  string
	FieldType  string
	IsRequired bool
	IsUnique   bool
	IsEditable bool
	IsSystem   bool
	Options    []byte
}

type builtinStaticAttributeDefinition struct {
	Name        string
	DisplayName string
	FieldType   string
	IsRequired  bool
	IsUnique    bool
	IsEditable  bool
	IsSystem    bool
	SortOrder   int
	Options     map[string]interface{}
}

func builtinStaticModelAttributes() map[string][]builtinStaticAttributeDefinition {
	return map[string][]builtinStaticAttributeDefinition{
		"business": {
			{Name: "bk_biz_id", DisplayName: "业务 ID", FieldType: "int", IsRequired: true, IsUnique: true, IsEditable: false, IsSystem: true, SortOrder: 10},
			{Name: "bk_biz_name", DisplayName: "业务名称", FieldType: "string", IsRequired: true, IsUnique: true, IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "life_cycle", DisplayName: "生命周期", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 30, Options: map[string]interface{}{"enum_values": []string{"testing", "online"}}},
			{Name: "time_zone", DisplayName: "时区", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 40},
			{Name: "language", DisplayName: "语言", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 50, Options: map[string]interface{}{"enum_values": []string{"zh", "en"}}},
			{Name: "bk_biz_maintainer", DisplayName: "运维负责人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 60},
			{Name: "bk_biz_productor", DisplayName: "产品负责人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 70},
			{Name: "bk_biz_tester", DisplayName: "测试负责人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 80},
			{Name: "bk_biz_developer", DisplayName: "开发负责人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 90},
			{Name: "operator", DisplayName: "操作人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 100},
		},
		"set": {
			{Name: "bk_set_id", DisplayName: "集群 ID", FieldType: "int", IsRequired: true, IsUnique: true, IsEditable: false, IsSystem: true, SortOrder: 10},
			{Name: "bk_set_name", DisplayName: "集群名称", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "bk_set_desc", DisplayName: "集群描述", FieldType: "text", IsEditable: true, IsSystem: true, SortOrder: 30},
			{Name: "bk_set_env", DisplayName: "环境类型", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 40, Options: map[string]interface{}{"enum_values": []string{"1", "2", "3"}}},
		},
		"module": {
			{Name: "bk_module_id", DisplayName: "模块 ID", FieldType: "int", IsRequired: true, IsUnique: true, IsEditable: false, IsSystem: true, SortOrder: 10},
			{Name: "bk_module_name", DisplayName: "模块名称", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "service_type", DisplayName: "服务类型", FieldType: "enum", IsEditable: true, IsSystem: true, SortOrder: 30, Options: map[string]interface{}{"enum_values": []string{"web", "api", "db", "cache", "mq", "other"}}},
			{Name: "service_category_id", DisplayName: "服务分类", FieldType: "int", IsEditable: true, IsSystem: true, SortOrder: 40},
			{Name: "operator", DisplayName: "主要维护人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 50},
			{Name: "bk_bak_operator", DisplayName: "备份维护人", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 60},
		},
		"host": {
			{Name: "bk_host_id", DisplayName: "主机 ID", FieldType: "string", IsRequired: true, IsUnique: true, IsEditable: false, IsSystem: true, SortOrder: 10},
			{Name: "bk_host_name", DisplayName: "主机名", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 20},
			{Name: "bk_host_innerip", DisplayName: "内网 IPv4", FieldType: "string", IsRequired: true, IsEditable: true, IsSystem: true, SortOrder: 30},
			{Name: "bk_host_innerip_v6", DisplayName: "内网 IPv6", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 40},
			{Name: "bk_cloud_id", DisplayName: "管控区域 ID", FieldType: "string", IsEditable: true, IsSystem: true, SortOrder: 50},
		},
	}
}

func seedBuiltinStaticModelAttributesFromBuiltinModels(db *gorm.DB) error {
	if db == nil || !db.Migrator().HasTable("models") || !db.Migrator().HasTable("model_attributes") {
		return nil
	}

	type modelRef struct {
		ID   string
		Name string
	}

	var models []modelRef
	if err := db.Table("models").
		Select("id", "name").
		Where("is_builtin = ?", true).
		Where("name IN ?", []string{"business", "set", "module", "host"}).
		Scan(&models).Error; err != nil {
		return err
	}

	now := time.Now()
	seedMap := builtinStaticModelAttributes()

	for _, model := range models {
		definitions := seedMap[model.Name]
		for _, def := range definitions {
			options := "{}"
			if len(def.Options) > 0 {
				raw, err := json.Marshal(def.Options)
				if err != nil {
					return err
				}
				options = string(raw)
			}

			var existingCount int64
			if err := db.Table("model_attributes").
				Where("model_id = ? AND name = ?", model.ID, def.Name).
				Count(&existingCount).Error; err != nil {
				return err
			}

			if existingCount > 0 {
				continue
			}

			if err := db.Exec(
				`INSERT INTO model_attributes (id, model_id, name, display_name, field_type, is_required, is_unique, is_editable, is_system, sort_order, options, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				uuid.New().String(),
				model.ID,
				def.Name,
				def.DisplayName,
				def.FieldType,
				def.IsRequired,
				def.IsUnique,
				def.IsEditable,
				def.IsSystem,
				def.SortOrder,
				options,
				now,
				now,
			).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

func seedRuntimeDynamicAttributesFromStaticModels(db *gorm.DB) error {
	if db == nil || !db.Migrator().HasTable("models") || !db.Migrator().HasTable("model_attributes") {
		return nil
	}

	var items []builtinStaticAttributeSeed
	if err := db.Table("model_attributes").
		Select(`
			models.name AS model_uid,
			model_attributes.name AS field_uid,
			model_attributes.display_name AS field_name,
			model_attributes.field_type AS field_type,
			model_attributes.is_required AS is_required,
			model_attributes.is_unique AS is_unique,
			model_attributes.is_editable AS is_editable,
			model_attributes.is_system AS is_system,
			model_attributes.options AS options
		`).
		Joins("JOIN models ON models.id = model_attributes.model_id").
		Scan(&items).Error; err != nil {
		return err
	}

	now := time.Now()
	for _, item := range items {
		placeholder, unit, defaultValue, validators := parseStaticAttributeOptions(item.Options)

		row := types.DynamicAttribute{
			ModelUID:     item.ModelUID,
			FieldUID:     item.FieldUID,
			FieldName:    item.FieldName,
			FieldType:    item.FieldType,
			Category:     "config",
			IsRequired:   item.IsRequired,
			IsUnique:     item.IsUnique,
			IsReadOnly:   !item.IsEditable,
			DefaultValue: defaultValue,
			Placeholder:  placeholder,
			Unit:         unit,
			Validators:   validators,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		if err := db.Where("model_uid = ? AND field_uid = ?", row.ModelUID, row.FieldUID).
			Assign(row).
			FirstOrCreate(&row).Error; err != nil {
			return err
		}
	}

	return nil
}

func parseStaticAttributeOptions(raw []byte) (placeholder string, unit string, defaultValue string, validators []byte) {
	if len(raw) == 0 {
		return "", "", "", nil
	}

	var data map[string]interface{}
	if err := json.Unmarshal(raw, &data); err != nil {
		return "", "", "", nil
	}

	fieldValidators := types.FieldValidators{}

	if value, ok := data["placeholder"].(string); ok {
		placeholder = value
	}
	if value, ok := data["unit"].(string); ok {
		unit = value
	}
	if value, exists := data["default"]; exists && value != nil {
		defaultValue = fmt.Sprint(value)
	}
	if value, ok := data["enum_values"].([]interface{}); ok {
		fieldValidators.EnumValues = make([]string, 0, len(value))
		for _, item := range value {
			if item == nil {
				continue
			}
			fieldValidators.EnumValues = append(fieldValidators.EnumValues, fmt.Sprint(item))
		}
	}
	if len(fieldValidators.EnumValues) > 0 {
		raw, err := json.Marshal(fieldValidators)
		if err == nil {
			validators = raw
		}
	}

	return placeholder, unit, defaultValue, validators
}

// addGeneratedColumns 添加生成列
// GORM AutoMigrate 不支持生成列，需要使用原生 SQL
func addGeneratedColumns(db *gorm.DB) error {
	sqls := []string{
		// 从 configs JSONB 中提取 cloud_id（云区域 ID）
		`ALTER TABLE resources
		 ADD COLUMN IF NOT EXISTS cloud_id bigint
		 GENERATED ALWAYS AS ((configs->>'cloud_id')::bigint) STORED`,

		// 从 configs JSONB 中提取 inner_ip（内网 IP）
		`ALTER TABLE resources
		 ADD COLUMN IF NOT EXISTS inner_ip varchar(50)
		 GENERATED ALWAYS AS (configs->>'inner_ip') STORED`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			// 忽略列已存在的错误
			if !isColumnExistsError(err) {
				return err
			}
		}
	}

	return nil
}

// createSpecialIndexes 创建特殊索引
func createSpecialIndexes(db *gorm.DB) error {
	sqls := []string{
		// 主机唯一性约束：cloud_id + inner_ip（仅针对 host 模型且未删除的记录）
		// 使用 Partial Index 提高性能
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_host_ip
		 ON resources (cloud_id, inner_ip)
		 WHERE model_uid = 'host' AND deleted_at IS NULL`,

		// resources 表的 JSONB 字段 GIN 索引（加速任意 key 查询）
		`CREATE INDEX IF NOT EXISTS idx_resources_configs_gin
		 ON resources USING GIN (configs)`,

		// resource_states 表的 JSONB 字段 GIN 索引
		`CREATE INDEX IF NOT EXISTS idx_resource_states_metrics_gin
		 ON resource_states USING GIN (metrics)`,

		// 复合索引：资源 ID + 变更时间（加速审计日志查询）
		`CREATE INDEX IF NOT EXISTS idx_history_resource_time
		 ON resource_histories (resource_id, changed_at DESC)`,

		// 关联关系的复合索引（加速拓扑查询）
		`CREATE INDEX IF NOT EXISTS idx_relations_source_assoc
		 ON relations (source_id, association_uid)`,

		`CREATE INDEX IF NOT EXISTS idx_relations_target_assoc
		 ON relations (target_id, association_uid)`,

		// 模型关联的唯一约束（防止重复定义）
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_model_association
		 ON model_associations (source_model_uid, target_model_uid, association_uid)`,

		`CREATE UNIQUE INDEX IF NOT EXISTS uk_model_unique_rules_name_active
		 ON model_unique_rules (model_uid, name)
		 WHERE deleted_at IS NULL`,

		`CREATE INDEX IF NOT EXISTS idx_model_unique_rules_model
		 ON model_unique_rules (model_uid, enabled)
		 WHERE deleted_at IS NULL`,

		`CREATE UNIQUE INDEX IF NOT EXISTS uk_model_unique_rule_fields
		 ON model_unique_rule_fields (rule_id, field_uid)`,

		`CREATE INDEX IF NOT EXISTS idx_model_unique_rule_fields_rule_sort
		 ON model_unique_rule_fields (rule_id, sort_order)`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			// 忽略索引已存在的错误
			if !isIndexExistsError(err) {
				return err
			}
		}
	}

	return nil
}

// setTableParameters 设置表参数
func setTableParameters(db *gorm.DB) error {
	sqls := []string{
		// resources 表设置 FILLFACTOR=80
		// 为 UPDATE 操作预留 20% 的空间，减少页分裂
		`ALTER TABLE resources SET (fillfactor = 80)`,

		// resource_states 表设置 FILLFACTOR=70（更频繁的更新）
		`ALTER TABLE resource_states SET (fillfactor = 70)`,
	}

	for _, sql := range sqls {
		if err := db.Exec(sql).Error; err != nil {
			// 忽略参数已设置的错误
			return err
		}
	}

	return nil
}

// seedBuiltinData 初始化预定义数据
func seedBuiltinData(db *gorm.DB) error {
	// 插入预定义的关联类型
	for _, assocType := range BuiltinAssociationTypes {
		var existing types.AssociationType
		err := db.Where("uid = ?", assocType.UID).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// 不存在，插入
			if err := db.Create(&assocType).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

// isColumnExistsError 检查是否是列已存在错误
func isColumnExistsError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := err.Error()
	return contains(errMsg, "already exists") || contains(errMsg, "duplicate column")
}

// isIndexExistsError 检查是否是索引已存在错误
func isIndexExistsError(err error) bool {
	if err == nil {
		return false
	}
	errMsg := err.Error()
	return contains(errMsg, "already exists")
}

// contains 检查字符串是否包含子串（不区分大小写）
func contains(s, substr string) bool {
	return len(s) >= len(substr) &&
		(s == substr || len(s) > len(substr) &&
			stringContains(toLower(s), toLower(substr)))
}

func stringContains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}

func toLower(s string) string {
	b := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		b[i] = c
	}
	return string(b)
}

// CreateAuditPartitions 创建审计日志分区表（可选，用于大数据量场景）
// 按月分区，提升查询性能
func CreateAuditPartitions(db *gorm.DB, startYear, endYear int) error {
	// 1. 将现有表转换为分区表（如果尚未分区）
	convertSQL := `
		ALTER TABLE resource_histories
		SET (
			PARTITION BY RANGE (changed_at)
		)
	`
	_ = db.Exec(convertSQL) // 如果已经是分区表会报错，忽略

	// 2. 创建各月份的分区
	for year := startYear; year <= endYear; year++ {
		for month := 1; month <= 12; month++ {
			partitionName := fmt.Sprintf("resource_histories_%d_%02d", year, month)
			nextMonth := month + 1
			nextYear := year
			if nextMonth > 12 {
				nextMonth = 1
				nextYear++
			}

			createSQL := fmt.Sprintf(`
				CREATE TABLE IF NOT EXISTS %s PARTITION OF resource_histories
				FOR VALUES FROM ('%d-%02d-01') TO ('%d-%02d-01')
			`, partitionName, year, month, nextYear, nextMonth)

			if err := db.Exec(createSQL).Error; err != nil {
				return err
			}
		}
	}

	return nil
}

// CleanupOldAuditLogs 清理超过保留期限的审计日志
// retentionDays: 保留天数，如 90 表示保留 90 天
func CleanupOldAuditLogs(db *gorm.DB, retentionDays int) error {
	sql := `
		DELETE FROM resource_histories
		WHERE changed_at < NOW() - INTERVAL '? days'
	`
	return db.Exec(sql, retentionDays).Error
}

// 以下是与 types 包的类型定义（为了避免循环依赖，这里简化引用）
// 在实际使用中，应该从 internal/types 导入

type Model struct {
	ID           uint64
	UID          string
	Name         string
	IsPaused     bool
	Description  string
	Icon         string
	UniqueFields interface{}
	CreatedAt    interface{}
	UpdatedAt    interface{}
}

type Attribute struct {
	ID           uint64
	ModelUID     string
	FieldUID     string
	FieldName    string
	FieldType    string
	Category     string
	IsRequired   bool
	IsUnique     bool
	UniqueGroup  string
	IsReadOnly   bool
	DefaultValue string
	Placeholder  string
	Unit         string
	Validators   interface{}
	CreatedAt    interface{}
	UpdatedAt    interface{}
}

type Resource struct {
	ID        uint64
	ModelUID  string
	Name      string
	Configs   interface{}
	CreatedAt interface{}
	UpdatedAt interface{}
	DeletedAt interface{}
	CloudID   int64
	InnerIP   string
	State     interface{}
}

type ResourceState struct {
	ResourceID    uint64
	LastCheckTime interface{}
	HealthStatus  int
	Metrics       interface{}
	UpdatedAt     interface{}
}

type AssociationType struct {
	ID               uint64
	UID              string
	Name             string
	SourceToDestDesc string
	DestToSourceDesc string
	IsBuiltin        bool
	Description      string
	CreatedAt        interface{}
	UpdatedAt        interface{}
}

type ModelAssociation struct {
	ID             uint64
	SourceModelUID string
	TargetModelUID string
	AssociationUID string
	Mapping        string
	OnDelete       string
	Description    string
	CreatedAt      interface{}
	UpdatedAt      interface{}
}

type Relation struct {
	ID             uint64
	SourceID       uint64
	TargetID       uint64
	AssociationUID string
	SourceModelUID string
	TargetModelUID string
	Properties     interface{}
	CreatedAt      interface{}
}

type ResourceHistory struct {
	ID         uint64
	ResourceID uint64
	ModelUID   string
	ChangeType string
	BeforeData interface{}
	AfterData  interface{}
	ChangedBy  string
	ChangedAt  interface{}
	ClientIP   string
	UserAgent  string
}

var BuiltinAssociationTypes = types.BuiltinAssociationTypes

type ModelUniqueRule struct {
	ID               uint64
	ModelUID         string
	Name             string
	IsDefault        bool
	IsAuxiliary      bool
	Enabled          bool
	IgnoreIfAllEmpty bool
	Description      string
	CreatedBy        string
	UpdatedBy        string
	CreatedAt        interface{}
	UpdatedAt        interface{}
	DeletedAt        interface{}
}

type ModelUniqueRuleField struct {
	ID        uint64
	RuleID    uint64
	FieldUID  string
	SortOrder int
	CreatedAt interface{}
}
