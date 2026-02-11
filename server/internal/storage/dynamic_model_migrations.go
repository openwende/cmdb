package storage

import (
	"fmt"

	"gorm.io/gorm"
)

// MigrateDynamicModels 执行动态模型相关的数据库迁移
// 包括创建表、生成列、唯一索引等
func MigrateDynamicModels(db *gorm.DB) error {
	// 1. 创建基础表（使用 GORM AutoMigrate）
	// 注意：AutoMigrate 无法处理 Generated Columns，需要手动添加
	if err := db.AutoMigrate(
		&Model{},
		&Attribute{},
		&Resource{},
		&ResourceState{},
		&AssociationType{},
		&ModelAssociation{},
		&Relation{},
		&ResourceHistory{},
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

	return nil
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
		var existing AssociationType
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
	ID          uint64
	ModelUID    string
	FieldUID    string
	FieldName   string
	FieldType   string
	Category    string
	IsRequired  bool
	IsUnique    bool
	UniqueGroup string
	IsReadOnly  bool
	DefaultValue string
	Placeholder  string
	Unit         string
	Validators  interface{}
	CreatedAt   interface{}
	UpdatedAt   interface{}
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

var BuiltinAssociationTypes = []AssociationType{}
