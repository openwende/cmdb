package dynamic_model

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"github.com/wend/cmdb-backend/internal/types"
)

// Service 动态模型服务
type Service struct {
	db         *gorm.DB
	attrCache  *AttributeCache
	modelCache *ModelCache
}

// NewService 创建服务实例
func NewService(db *gorm.DB) *Service {
	return &Service{
		db:         db,
		attrCache:  NewAttributeCache(db),
		modelCache: NewModelCache(db),
	}
}

// DB 返回数据库连接（用于适配器等需要直接访问的场景）
func (s *Service) DB() *gorm.DB {
	return s.db
}

// isValidFieldName 校验字段名是否安全（防止 SQL 注入）
// 只允许字母、数字、下划线，且不以数字开头，长度限制 1-64
func isValidFieldName(field string) bool {
	if len(field) == 0 || len(field) > 64 {
		return false
	}
	for i, c := range field {
		// 首字符不能是数字
		if i == 0 && (c >= '0' && c <= '9') {
			return false
		}
		// 只允许字母、数字、下划线
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return false
		}
	}
	return true
}

// AttributeCache 属性定义缓存
type AttributeCache struct {
	sync.RWMutex
	db    *gorm.DB
	cache map[string][]types.DynamicAttribute // modelUID -> attributes
}

func NewAttributeCache(db *gorm.DB) *AttributeCache {
	return &AttributeCache{
		db:    db,
		cache: make(map[string][]types.DynamicAttribute),
	}
}

// Get 获取模型的属性定义（带缓存）
func (c *AttributeCache) Get(modelUID string) ([]types.DynamicAttribute, error) {
	c.RLock()
	attrs, exists := c.cache[modelUID]
	c.RUnlock()

	if exists {
		return attrs, nil
	}

	// 从数据库加载
	var attributes []types.DynamicAttribute
	if err := c.db.Where("model_uid = ?", modelUID).Find(&attributes).Error; err != nil {
		return nil, err
	}

	// 写入缓存
	c.Lock()
	c.cache[modelUID] = attributes
	c.Unlock()

	return attributes, nil
}

// Invalidate 使缓存失效
func (c *AttributeCache) Invalidate(modelUID string) {
	c.Lock()
	delete(c.cache, modelUID)
	c.Unlock()
}

// ModelCache 模型定义缓存
type ModelCache struct {
	sync.RWMutex
	db    *gorm.DB
	cache map[string]*types.DynamicModel // modelUID -> Model
}

func NewModelCache(db *gorm.DB) *ModelCache {
	return &ModelCache{
		db:    db,
		cache: make(map[string]*types.DynamicModel),
	}
}

func (c *ModelCache) Get(modelUID string) (*types.DynamicModel, error) {
	c.RLock()
	model, exists := c.cache[modelUID]
	c.RUnlock()

	if exists {
		return model, nil
	}

	var m types.DynamicModel
	if err := c.db.Where("uid = ?", modelUID).First(&m).Error; err != nil {
		return nil, err
	}

	c.Lock()
	c.cache[modelUID] = &m
	c.Unlock()

	return &m, nil
}

// AuditContext 审计上下文
type AuditContext struct {
	UserID    string
	ClientIP  string
	UserAgent string
}

// UpsertInstance 智能写入/更新资源实例
// 自动分流配置数据和状态数据，支持审计日志
func (s *Service) UpsertInstance(ctx context.Context, modelUID string, data map[string]interface{}, auditCtx *AuditContext) (uint64, error) {
	// 1. 检查模型是否存在
	model, err := s.modelCache.Get(modelUID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return 0, NewModelNotFoundError(modelUID)
		}
		return 0, err
	}

	if model.IsPaused {
		return 0, fmt.Errorf("模型 %s 已停用", modelUID)
	}

	// 2. 获取属性定义
	attributes, err := s.attrCache.Get(modelUID)
	if err != nil {
		return 0, err
	}

	// 3. 校验数据
	validator := NewValidator(attributes)
	validatedData, err := validator.ValidateData(data)
	if err != nil {
		return 0, err
	}

	// 4. 分流数据：config（主表） vs state（侧车表）
	configData, stateData := SplitDataByCategory(validatedData, attributes)

	// 5. 事务写入
	var resourceID uint64
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 5.1 Upsert resources 表
		resource := &types.Resource{
			ModelUID: modelUID,
			Name:     getResourceName(configData),
			Configs:  marshalJSON(configData),
		}

		// 检查是否是更新操作（通过唯一键查找）
		existingResource, findErr := s.findExistingResource(tx, modelUID, configData, model)
		if findErr == nil && existingResource != nil {
			// 更新操作
			resource.ID = existingResource.ID

			// 记录审计日志（变更前的数据）
			if auditCtx != nil {
				if err := s.recordHistory(tx, existingResource.ID, modelUID, "update", existingResource.Configs, resource.Configs, auditCtx); err != nil {
					return err
				}
			}

			// 更新
			if err := tx.Model(&types.Resource{}).Where("id = ?", resource.ID).Updates(map[string]interface{}{
				"name":       resource.Name,
				"configs":    resource.Configs,
				"updated_at": time.Now(),
			}).Error; err != nil {
				return ParseDBError(err, modelUID)
			}
		} else {
			// 创建操作
			if err := tx.Create(resource).Error; err != nil {
				return ParseDBError(err, modelUID)
			}

			// 记录审计日志
			if auditCtx != nil {
				if err := s.recordHistory(tx, resource.ID, modelUID, "create", nil, resource.Configs, auditCtx); err != nil {
					return err
				}
			}
		}

		resourceID = resource.ID

		// 5.2 Upsert resource_states 表（如果有状态数据）
		if len(stateData) > 0 {
			state := &types.ResourceState{
				ResourceID:    resourceID,
				LastCheckTime: time.Now(),
				HealthStatus:  0, // 默认健康
				Metrics:       marshalJSON(stateData),
			}

			if err := tx.Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "resource_id"}},
				DoUpdates: clause.AssignmentColumns([]string{"last_check_time", "metrics", "updated_at"}),
			}).Create(state).Error; err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return 0, err
	}

	return resourceID, nil
}

// findExistingResource 根据唯一键查找已存在的资源
func (s *Service) findExistingResource(tx *gorm.DB, modelUID string, configData map[string]interface{}, model *types.DynamicModel) (*types.Resource, error) {
	// 解析唯一键配置
	var uniqueConfig types.UniqueFieldConfig
	if model.UniqueFields != nil {
		if err := json.Unmarshal(model.UniqueFields, &uniqueConfig); err != nil {
			return nil, err
		}
	}

	if len(uniqueConfig.Fields) == 0 {
		// 没有唯一键，无法判断是否重复
		return nil, gorm.ErrRecordNotFound
	}

	// 构建查询条件
	query := tx.Model(&types.Resource{}).Where("model_uid = ?", modelUID)
	for _, field := range uniqueConfig.Fields {
		// SQL 注入防护：校验字段名
		if !isValidFieldName(field) {
			return nil, fmt.Errorf("invalid field name in unique config: %s", field)
		}
		value, exists := configData[field]
		if !exists {
			// 唯一键字段缺失，无法查询
			return nil, gorm.ErrRecordNotFound
		}
		// 使用 JSONB 查询
		query = query.Where(fmt.Sprintf("configs->>'%s' = ?", field), fmt.Sprint(value))
	}

	var resource types.Resource
	if err := query.First(&resource).Error; err != nil {
		return nil, err
	}

	return &resource, nil
}

// getResourceName 从配置数据中提取资源名称
func getResourceName(configData map[string]interface{}) string {
	// 优先使用 name 字段
	if name, ok := configData["name"].(string); ok && name != "" {
		return name
	}

	// 其次使用 hostname
	if hostname, ok := configData["hostname"].(string); ok && hostname != "" {
		return hostname
	}

	// 使用 inner_ip
	if ip, ok := configData["inner_ip"].(string); ok && ip != "" {
		return ip
	}

	return "未命名资源"
}

// recordHistory 记录审计日志
func (s *Service) recordHistory(tx *gorm.DB, resourceID uint64, modelUID, changeType string, beforeData, afterData datatypes.JSON, auditCtx *AuditContext) error {
	history := &types.ResourceHistory{
		ResourceID: resourceID,
		ModelUID:   modelUID,
		ChangeType: changeType,
		BeforeData: beforeData,
		AfterData:  afterData,
		ChangedAt:  time.Now(),
	}

	if auditCtx != nil {
		history.ChangedBy = auditCtx.UserID
		history.ClientIP = auditCtx.ClientIP
		history.UserAgent = auditCtx.UserAgent
	}

	return tx.Create(history).Error
}

// GetInstance 获取资源实例（含状态数据）
func (s *Service) GetInstance(ctx context.Context, resourceID uint64) (*types.Resource, error) {
	var resource types.Resource
	if err := s.db.Preload("State").First(&resource, resourceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, NewResourceNotFoundError(resourceID)
		}
		return nil, err
	}

	return &resource, nil
}

// ListInstances 查询资源实例列表
func (s *Service) ListInstances(ctx context.Context, modelUID string, filters map[string]interface{}, page, pageSize int) ([]types.Resource, int64, error) {
	query := s.db.Model(&types.Resource{}).Where("model_uid = ?", modelUID)

	// 应用过滤条件（JSONB 查询）
	for key, value := range filters {
		// SQL 注入防护：校验过滤字段名
		if !isValidFieldName(key) {
			return nil, 0, fmt.Errorf("invalid filter key: %s", key)
		}
		query = query.Where(fmt.Sprintf("configs->>'%s' = ?", key), fmt.Sprint(value))
	}

	// 统计总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	var resources []types.Resource
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("id DESC").Find(&resources).Error; err != nil {
		return nil, 0, err
	}

	return resources, total, nil
}

// DeleteInstance 删除资源实例（软删除）
func (s *Service) DeleteInstance(ctx context.Context, resourceID uint64, auditCtx *AuditContext) error {
	var resource types.Resource
	if err := s.db.First(&resource, resourceID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return NewResourceNotFoundError(resourceID)
		}
		return err
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 记录审计日志
		if auditCtx != nil {
			if err := s.recordHistory(tx, resourceID, resource.ModelUID, "delete", resource.Configs, nil, auditCtx); err != nil {
				return err
			}
		}

		// 软删除
		return tx.Delete(&resource).Error
	})
}

// CreateRelation 创建关联关系
func (s *Service) CreateRelation(ctx context.Context, sourceID, targetID uint64, associationUID string) error {
	// 1. 查询源和目标资源
	var source, target types.Resource
	if err := s.db.First(&source, sourceID).Error; err != nil {
		return NewResourceNotFoundError(sourceID)
	}
	if err := s.db.First(&target, targetID).Error; err != nil {
		return NewResourceNotFoundError(targetID)
	}

	// 2. 检查是否允许这种关联
	var modelAssoc types.DynamicModelAssociation
	err := s.db.Where(`
		source_model_uid = ? AND
		target_model_uid = ? AND
		association_uid = ?`,
		source.ModelUID, target.ModelUID, associationUID,
	).First(&modelAssoc).Error

	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return NewAssociationNotAllowedError(source.ModelUID, target.ModelUID, associationUID)
		}
		return err
	}

	// 3. 检查映射关系约束
	if err := s.checkCardinality(sourceID, targetID, associationUID, modelAssoc.Mapping); err != nil {
		return err
	}

	// 4. 创建关联
	relation := &types.Relation{
		SourceID:       sourceID,
		TargetID:       targetID,
		AssociationUID: associationUID,
		SourceModelUID: source.ModelUID,
		TargetModelUID: target.ModelUID,
	}

	return s.db.Create(relation).Error
}

// checkCardinality 检查关联基数约束
func (s *Service) checkCardinality(sourceID, targetID uint64, associationUID, mapping string) error {
	switch mapping {
	case "1:1":
		// 检查源是否已有关联
		var count int64
		s.db.Model(&types.Relation{}).Where("source_id = ? AND association_uid = ?", sourceID, associationUID).Count(&count)
		if count > 0 {
			return NewCardinalityViolationError(mapping, associationUID)
		}

		// 检查目标是否已有关联
		s.db.Model(&types.Relation{}).Where("target_id = ? AND association_uid = ?", targetID, associationUID).Count(&count)
		if count > 0 {
			return NewCardinalityViolationError(mapping, associationUID)
		}

	case "1:N":
		// 检查源是否已有关联
		var count int64
		s.db.Model(&types.Relation{}).Where("source_id = ? AND association_uid = ?", sourceID, associationUID).Count(&count)
		if count > 0 {
			return NewCardinalityViolationError(mapping, associationUID)
		}
	}

	return nil
}

// GetTopology 递归查询拓扑关系
// startID: 起始资源 ID
// maxDepth: 最大递归深度
// associationUIDs: 关联类型过滤（nil 表示所有类型）
// reverse: 是否反向查询（查找父节点）
func (s *Service) GetTopology(ctx context.Context, startID uint64, maxDepth int, associationUIDs []string, reverse bool) ([]types.TopologyNode, error) {
	if maxDepth <= 0 || maxDepth > 10 {
		maxDepth = 10 // 限制最大深度
	}

	// 构建 WITH RECURSIVE CTE 查询
	sql := s.buildTopologySQL(startID, maxDepth, associationUIDs, reverse)

	var nodes []types.TopologyNode
	if err := s.db.Raw(sql).Scan(&nodes).Error; err != nil {
		return nil, err
	}

	return nodes, nil
}

// buildTopologySQL 构建拓扑查询 SQL
func (s *Service) buildTopologySQL(startID uint64, maxDepth int, associationUIDs []string, reverse bool) string {
	sourceCol, targetCol := "source_id", "target_id"
	if reverse {
		sourceCol, targetCol = targetCol, sourceCol
	}

	assocFilter := ""
	if len(associationUIDs) > 0 {
		quotedUIDs := make([]string, len(associationUIDs))
		for i, uid := range associationUIDs {
			quotedUIDs[i] = fmt.Sprintf("'%s'", uid)
		}
		assocFilter = fmt.Sprintf("AND r.association_uid IN (%s)", strings.Join(quotedUIDs, ", "))
	}

	return fmt.Sprintf(`
		WITH RECURSIVE topology AS (
			-- 起始节点
			SELECT
				res.id AS resource_id,
				res.model_uid,
				res.name,
				''::varchar AS association_uid,
				0 AS depth,
				res.id::text AS path
			FROM resources res
			WHERE res.id = %d AND res.deleted_at IS NULL

			UNION ALL

			-- 递归部分
			SELECT
				res.id AS resource_id,
				res.model_uid,
				res.name,
				r.association_uid,
				t.depth + 1 AS depth,
				t.path || '.' || res.id::text AS path
			FROM topology t
			INNER JOIN relations r ON r.%s = t.resource_id
			INNER JOIN resources res ON res.id = r.%s
			WHERE t.depth < %d
			  AND res.deleted_at IS NULL
			  %s
		)
		SELECT * FROM topology
		ORDER BY depth, resource_id
	`, startID, sourceCol, targetCol, maxDepth, assocFilter)
}

// SyncUniqueIndexes 同步唯一索引（启动时调用）
func (s *Service) SyncUniqueIndexes(ctx context.Context) error {
	var models []types.DynamicModel
	if err := s.db.Find(&models).Error; err != nil {
		return err
	}

	for _, model := range models {
		if err := s.syncModelUniqueIndex(model); err != nil {
			return fmt.Errorf("同步模型 %s 的唯一索引失败: %w", model.UID, err)
		}
	}

	return nil
}

// syncModelUniqueIndex 同步单个模型的唯一索引
func (s *Service) syncModelUniqueIndex(model types.DynamicModel) error {
	// 解析唯一键配置
	var uniqueConfig types.UniqueFieldConfig
	if model.UniqueFields != nil {
		if err := json.Unmarshal(model.UniqueFields, &uniqueConfig); err != nil {
			return err
		}
	}

	if len(uniqueConfig.Fields) == 0 {
		return nil // 没有唯一键
	}

	// 构建索引 SQL
	indexName := uniqueConfig.Name
	if indexName == "" {
		indexName = fmt.Sprintf("idx_unique_%s", model.UID)
	}

	var cols []string
	for _, field := range uniqueConfig.Fields {
		cols = append(cols, fmt.Sprintf("(configs->>'%s')", field))
	}

	sql := fmt.Sprintf(`
		CREATE UNIQUE INDEX IF NOT EXISTS %s
		ON resources (%s)
		WHERE model_uid = '%s' AND deleted_at IS NULL
	`, indexName, strings.Join(cols, ", "), model.UID)

	return s.db.Exec(sql).Error
}

// marshalJSON 辅助函数：将 map 转为 JSONB
func marshalJSON(data map[string]interface{}) datatypes.JSON {
	if data == nil {
		return datatypes.JSON("{}")
	}
	b, _ := json.Marshal(data)
	return datatypes.JSON(b)
}
