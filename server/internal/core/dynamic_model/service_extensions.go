package dynamic_model

import (
	"context"
	"fmt"

	"github.com/wend/cmdb-backend/internal/types"
)

// ========== 模型管理方法 ==========

// CreateModel 创建模型
func (s *Service) CreateModel(ctx context.Context, model *types.DynamicModel) error {
	if err := s.db.Create(model).Error; err != nil {
		return err
	}

	// 同步唯一索引
	if err := s.syncModelUniqueIndex(*model); err != nil {
		return fmt.Errorf("同步唯一索引失败: %w", err)
	}

	return nil
}

// ListModels 列出所有模型
func (s *Service) ListModels(ctx context.Context) ([]types.DynamicModel, error) {
	var models []types.DynamicModel
	if err := s.db.Order("created_at DESC").Find(&models).Error; err != nil {
		return nil, err
	}
	return models, nil
}

// GetModel 获取模型
func (s *Service) GetModel(ctx context.Context, uid string) (*types.DynamicModel, error) {
	return s.modelCache.Get(uid)
}

// UpdateModel 更新模型
func (s *Service) UpdateModel(ctx context.Context, uid string, updates map[string]interface{}) error {
	if err := s.db.Model(&types.DynamicModel{}).Where("uid = ?", uid).Updates(updates).Error; err != nil {
		return err
	}

	// 使缓存失效
	s.modelCache.Invalidate(uid)

	// 如果更新了唯一键配置，重新同步索引
	if _, ok := updates["unique_fields"]; ok {
		model, err := s.modelCache.Get(uid)
		if err != nil {
			return err
		}
		if err := s.syncModelUniqueIndex(*model); err != nil {
			return fmt.Errorf("同步唯一索引失败: %w", err)
		}
	}

	return nil
}

// DeleteModel 删除模型
func (s *Service) DeleteModel(ctx context.Context, uid string) error {
	// TODO: 检查是否有实例存在
	var count int64
	s.db.Model(&types.Resource{}).Where("model_uid = ?", uid).Count(&count)
	if count > 0 {
		return fmt.Errorf("模型 %s 下还有 %d 个实例，无法删除", uid, count)
	}

	// 删除属性定义
	s.db.Where("model_uid = ?", uid).Delete(&types.DynamicAttribute{})

	// 删除模型
	if err := s.db.Where("uid = ?", uid).Delete(&types.DynamicModel{}).Error; err != nil {
		return err
	}

	// 使缓存失效
	s.modelCache.Invalidate(uid)
	s.attrCache.Invalidate(uid)

	return nil
}

// ========== 属性管理方法 ==========

// CreateAttribute 创建属性
func (s *Service) CreateAttribute(ctx context.Context, attr *types.DynamicAttribute) error {
	if err := s.db.Create(attr).Error; err != nil {
		return err
	}

	// 使缓存失效
	s.attrCache.Invalidate(attr.ModelUID)

	// 如果设置了唯一约束，同步索引
	if attr.IsUnique || attr.UniqueGroup != "" {
		model, err := s.modelCache.Get(attr.ModelUID)
		if err != nil {
			return err
		}
		if err := s.syncModelUniqueIndex(*model); err != nil {
			return fmt.Errorf("同步唯一索引失败: %w", err)
		}
	}

	return nil
}

// ListAttributes 列出模型的所有属性
func (s *Service) ListAttributes(ctx context.Context, modelUID string) ([]types.DynamicAttribute, error) {
	return s.attrCache.Get(modelUID)
}

// UpdateAttribute 更新属性
func (s *Service) UpdateAttribute(ctx context.Context, modelUID, fieldUID string, updates map[string]interface{}) error {
	if err := s.db.Model(&types.DynamicAttribute{}).
		Where("model_uid = ? AND field_uid = ?", modelUID, fieldUID).
		Updates(updates).Error; err != nil {
		return err
	}

	// 使缓存失效
	s.attrCache.Invalidate(modelUID)

	return nil
}

// DeleteAttribute 删除属性
func (s *Service) DeleteAttribute(ctx context.Context, modelUID, fieldUID string) error {
	if err := s.db.Where("model_uid = ? AND field_uid = ?", modelUID, fieldUID).
		Delete(&types.DynamicAttribute{}).Error; err != nil {
		return err
	}

	// 使缓存失效
	s.attrCache.Invalidate(modelUID)

	return nil
}

// ========== 关联关系管理方法 ==========

// ListRelations 查询资源的关联关系
// direction: "source" 只查源关系，"target" 只查目标关系，"both" 查两者
func (s *Service) ListRelations(ctx context.Context, resourceID uint64, direction, associationUID string) ([]types.Relation, error) {
	query := s.db.Model(&types.Relation{})

	switch direction {
	case "source":
		query = query.Where("source_id = ?", resourceID)
	case "target":
		query = query.Where("target_id = ?", resourceID)
	default: // "both"
		query = query.Where("source_id = ? OR target_id = ?", resourceID, resourceID)
	}

	if associationUID != "" {
		query = query.Where("association_uid = ?", associationUID)
	}

	var relations []types.Relation
	if err := query.Order("created_at DESC").Find(&relations).Error; err != nil {
		return nil, err
	}

	return relations, nil
}

// DeleteRelation 删除关联关系
func (s *Service) DeleteRelation(ctx context.Context, relationID uint64) error {
	return s.db.Delete(&types.Relation{}, relationID).Error
}

// ========== 审计日志查询 ==========

// GetResourceHistory 获取资源变更历史
func (s *Service) GetResourceHistory(ctx context.Context, resourceID uint64, page, pageSize int) ([]types.ResourceHistory, int64, error) {
	query := s.db.Model(&types.ResourceHistory{}).Where("resource_id = ?", resourceID)

	// 统计总数
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 分页查询
	var histories []types.ResourceHistory
	offset := (page - 1) * pageSize
	if err := query.Offset(offset).Limit(pageSize).Order("changed_at DESC").Find(&histories).Error; err != nil {
		return nil, 0, err
	}

	return histories, total, nil
}

// Invalidate 使缓存失效
func (c *ModelCache) Invalidate(modelUID string) {
	c.Lock()
	delete(c.cache, modelUID)
	c.Unlock()
}
