package service_template

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/types"
)

// Service 服务模板管理服务
type Service interface {
	CreateServiceTemplate(ctx context.Context, req *types.CreateServiceTemplateRequest, createdBy string) (*types.ServiceTemplate, error)
	GetServiceTemplate(ctx context.Context, id uint64) (*types.ServiceTemplate, error)
	ListServiceTemplates(ctx context.Context, businessID uint64) ([]types.ServiceTemplateWithStats, error)
	UpdateServiceTemplate(ctx context.Context, id uint64, req *types.UpdateServiceTemplateRequest, updatedBy string) (*types.ServiceTemplate, error)
	DeleteServiceTemplate(ctx context.Context, id uint64) error
	AddProcessTemplate(ctx context.Context, serviceTemplateID, processTemplateID uint64) error
	RemoveProcessTemplate(ctx context.Context, serviceTemplateID, processTemplateID uint64) error
	CreateModuleFromTemplate(ctx context.Context, templateID uint64, req *types.CreateModuleFromTemplateRequest) (*types.Module, error)
	SyncModulesToTemplate(ctx context.Context, templateID uint64, moduleIDs []uint64) (*types.BatchOperationResult, error)
	CreateSetTemplate(ctx context.Context, req *types.CreateSetTemplateRequest, createdBy string) (*types.SetTemplate, error)
	GetSetTemplate(ctx context.Context, id uint64) (*types.SetTemplate, error)
	ListSetTemplates(ctx context.Context, businessID uint64) ([]types.SetTemplate, error)
	DeleteSetTemplate(ctx context.Context, id uint64) error
	CreateSetFromTemplate(ctx context.Context, templateID uint64, req *types.CreateSetFromTemplateRequest) (*types.Set, error)
}

type service struct {
	db *gorm.DB
}

// NewService 创建服务实例
func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

// DB 返回数据库连接
func (s *service) DB() *gorm.DB {
	return s.db
}

// ========== 服务模板管理 ==========

// CreateServiceTemplate 创建服务模板
func (s *service) CreateServiceTemplate(ctx context.Context, req *types.CreateServiceTemplateRequest, createdBy string) (*types.ServiceTemplate, error) {
	// 验证业务是否存在
	var business types.Business
	if err := s.db.Where("id = ?", req.BusinessID).First(&business).Error; err != nil {
		return nil, fmt.Errorf("业务不存在: %w", err)
	}

	template := &types.ServiceTemplate{
		Name:        req.Name,
		BusinessID:  req.BusinessID,
		ServiceType: req.ServiceType,
		Description: req.Description,
		CreatedBy:   createdBy,
		UpdatedBy:   createdBy,
	}

	if err := s.db.Create(template).Error; err != nil {
		return nil, err
	}

	return template, nil
}

// GetServiceTemplate 获取服务模板
func (s *service) GetServiceTemplate(ctx context.Context, id uint64) (*types.ServiceTemplate, error) {
	var template types.ServiceTemplate
	if err := s.db.Preload("ProcessTemplates").First(&template, id).Error; err != nil {
		return nil, err
	}
	return &template, nil
}

// ListServiceTemplates 获取服务模板列表
func (s *service) ListServiceTemplates(ctx context.Context, businessID uint64) ([]types.ServiceTemplateWithStats, error) {
	var templates []types.ServiceTemplate
	if err := s.db.Where("business_id = ?", businessID).
		Order("created_at DESC").
		Find(&templates).Error; err != nil {
		return nil, err
	}

	result := make([]types.ServiceTemplateWithStats, 0, len(templates))
	for _, t := range templates {
		stats := types.ServiceTemplateWithStats{ServiceTemplate: t}

		// 统计进程模板数量
		var processCount int64
		s.db.Model(&types.ProcessTemplate{}).Where("service_template_id = ?", t.ID).Count(&processCount)
		stats.ProcessCount = int(processCount)

		// 统计关联模块数量
		var moduleCount int64
		s.db.Model(&types.Module{}).Where("service_template_id = ?", t.ID).Count(&moduleCount)
		stats.ModuleCount = int(moduleCount)

		// 统计主机数量
		var hostCount int64
		s.db.Model(&types.Host{}).
			Joins("JOIN host_node_memberships hnm ON hnm.host_id = hosts.id AND hnm.node_kind = ?", types.NodeKindBizModule).
			Joins("JOIN modules ON modules.id = hnm.node_id").
			Where("modules.service_template_id = ?", t.ID).
			Distinct("hosts.id").
			Count(&hostCount)
		stats.HostCount = int(hostCount)

		result = append(result, stats)
	}

	return result, nil
}

// UpdateServiceTemplate 更新服务模板
func (s *service) UpdateServiceTemplate(ctx context.Context, id uint64, req *types.UpdateServiceTemplateRequest, updatedBy string) (*types.ServiceTemplate, error) {
	updates := map[string]interface{}{
		"updated_by": updatedBy,
	}

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.ServiceType != nil {
		updates["service_type"] = *req.ServiceType
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	if err := s.db.Model(&types.ServiceTemplate{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetServiceTemplate(ctx, id)
}

// DeleteServiceTemplate 删除服务模板
func (s *service) DeleteServiceTemplate(ctx context.Context, id uint64) error {
	// 检查是否有模块使用此模板
	var moduleCount int64
	s.db.Model(&types.Module{}).Where("service_template_id = ?", id).Count(&moduleCount)
	if moduleCount > 0 {
		return fmt.Errorf("服务模板被 %d 个模块使用，无法删除", moduleCount)
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 解除进程模板的关联（不删除进程模板本身）
		if err := tx.Model(&types.ProcessTemplate{}).
			Where("service_template_id = ?", id).
			Update("service_template_id", nil).Error; err != nil {
			return err
		}

		// 删除服务模板
		return tx.Delete(&types.ServiceTemplate{}, id).Error
	})
}

// ========== 进程模板关联 ==========

// AddProcessTemplate 添加进程模板到服务模板
func (s *service) AddProcessTemplate(ctx context.Context, serviceTemplateID, processTemplateID uint64) error {
	// 验证服务模板存在
	var st types.ServiceTemplate
	if err := s.db.First(&st, serviceTemplateID).Error; err != nil {
		return fmt.Errorf("服务模板不存在")
	}

	// 验证进程模板存在且属于同一业务
	var pt types.ProcessTemplate
	if err := s.db.First(&pt, processTemplateID).Error; err != nil {
		return fmt.Errorf("进程模板不存在")
	}

	if pt.BusinessID != st.BusinessID {
		return fmt.Errorf("进程模板和服务模板必须属于同一业务")
	}

	// 更新进程模板的关联
	return s.db.Model(&types.ProcessTemplate{}).
		Where("id = ?", processTemplateID).
		Update("service_template_id", serviceTemplateID).Error
}

// RemoveProcessTemplate 从服务模板移除进程模板
func (s *service) RemoveProcessTemplate(ctx context.Context, serviceTemplateID, processTemplateID uint64) error {
	return s.db.Model(&types.ProcessTemplate{}).
		Where("id = ? AND service_template_id = ?", processTemplateID, serviceTemplateID).
		Update("service_template_id", nil).Error
}

// ========== 从模板创建模块 ==========

// CreateModuleFromTemplate 从服务模板创建模块
func (s *service) CreateModuleFromTemplate(ctx context.Context, templateID uint64, req *types.CreateModuleFromTemplateRequest) (*types.Module, error) {
	// 获取服务模板
	template, err := s.GetServiceTemplate(ctx, templateID)
	if err != nil {
		return nil, fmt.Errorf("服务模板不存在: %w", err)
	}

	// 验证集群存在
	var set types.Set
	if err := s.db.First(&set, req.SetID).Error; err != nil {
		return nil, fmt.Errorf("集群不存在: %w", err)
	}

	// 验证业务一致性
	if set.BusinessID != template.BusinessID {
		return nil, fmt.Errorf("集群和服务模板必须属于同一业务")
	}

	// 创建模块
	module := &types.Module{
		SetID:             req.SetID,
		BusinessID:        set.BusinessID,
		ServiceTemplateID: &templateID,
		Name:              req.Name,
		Description:       req.Description,
		ServiceType:       template.ServiceType,
	}

	if module.Description == "" {
		module.Description = template.Description
	}

	if err := s.db.Create(module).Error; err != nil {
		return nil, err
	}

	return module, nil
}

// SyncModulesToTemplate 同步模块配置到模板（将模板变更应用到关联模块）
func (s *service) SyncModulesToTemplate(ctx context.Context, templateID uint64, moduleIDs []uint64) (*types.BatchOperationResult, error) {
	// 获取服务模板
	template, err := s.GetServiceTemplate(ctx, templateID)
	if err != nil {
		return nil, fmt.Errorf("服务模板不存在: %w", err)
	}

	// 获取需要同步的模块
	query := s.db.Model(&types.Module{}).Where("service_template_id = ?", templateID)
	if len(moduleIDs) > 0 {
		query = query.Where("id IN ?", moduleIDs)
	}

	var modules []types.Module
	if err := query.Find(&modules).Error; err != nil {
		return nil, err
	}

	result := &types.BatchOperationResult{
		Total:  len(modules),
		Errors: make([]string, 0),
	}

	for _, module := range modules {
		updates := map[string]interface{}{
			"service_type": template.ServiceType,
		}

		if err := s.db.Model(&types.Module{}).Where("id = ?", module.ID).Updates(updates).Error; err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("模块 %d: %s", module.ID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// ========== 集群模板管理 ==========

// CreateSetTemplate 创建集群模板
func (s *service) CreateSetTemplate(ctx context.Context, req *types.CreateSetTemplateRequest, createdBy string) (*types.SetTemplate, error) {
	// 验证业务是否存在
	var business types.Business
	if err := s.db.Where("id = ?", req.BusinessID).First(&business).Error; err != nil {
		return nil, fmt.Errorf("业务不存在: %w", err)
	}

	var resultTemplate *types.SetTemplate

	err := s.db.Transaction(func(tx *gorm.DB) error {
		template := &types.SetTemplate{
			Name:        req.Name,
			BusinessID:  req.BusinessID,
			EnvType:     req.EnvType,
			Description: req.Description,
			CreatedBy:   createdBy,
			UpdatedBy:   createdBy,
		}

		if err := tx.Create(template).Error; err != nil {
			return err
		}

		// 创建服务模板绑定
		for i, stID := range req.ServiceTemplateIDs {
			binding := &types.SetTemplateServiceBinding{
				SetTemplateID:     template.ID,
				ServiceTemplateID: stID,
				SortOrder:         i,
			}
			if err := tx.Create(binding).Error; err != nil {
				return err
			}
		}

		resultTemplate = template
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resultTemplate, nil
}

// GetSetTemplate 获取集群模板
func (s *service) GetSetTemplate(ctx context.Context, id uint64) (*types.SetTemplate, error) {
	var template types.SetTemplate
	if err := s.db.Preload("ServiceBindings.ServiceTemplate").First(&template, id).Error; err != nil {
		return nil, err
	}
	return &template, nil
}

// ListSetTemplates 获取集群模板列表
func (s *service) ListSetTemplates(ctx context.Context, businessID uint64) ([]types.SetTemplate, error) {
	var templates []types.SetTemplate
	if err := s.db.Where("business_id = ?", businessID).
		Preload("ServiceBindings.ServiceTemplate").
		Order("created_at DESC").
		Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

// DeleteSetTemplate 删除集群模板
func (s *service) DeleteSetTemplate(ctx context.Context, id uint64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 删除绑定关系
		if err := tx.Where("set_template_id = ?", id).Delete(&types.SetTemplateServiceBinding{}).Error; err != nil {
			return err
		}
		// 删除集群模板
		return tx.Delete(&types.SetTemplate{}, id).Error
	})
}

// CreateSetFromTemplate 从集群模板创建集群
func (s *service) CreateSetFromTemplate(ctx context.Context, templateID uint64, req *types.CreateSetFromTemplateRequest) (*types.Set, error) {
	// 获取集群模板
	template, err := s.GetSetTemplate(ctx, templateID)
	if err != nil {
		return nil, fmt.Errorf("集群模板不存在: %w", err)
	}

	var resultSet *types.Set

	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 创建集群
		set := &types.Set{
			BusinessID:  template.BusinessID,
			Name:        req.Name,
			Description: req.Description,
			EnvType:     template.EnvType,
		}

		if set.Description == "" {
			set.Description = template.Description
		}

		if err := tx.Create(set).Error; err != nil {
			return err
		}

		// 根据服务模板绑定创建模块
		for _, binding := range template.ServiceBindings {
			module := &types.Module{
				SetID:             set.ID,
				BusinessID:        template.BusinessID,
				ServiceTemplateID: &binding.ServiceTemplateID,
				Name:              binding.ServiceTemplate.Name,
				Description:       binding.ServiceTemplate.Description,
				ServiceType:       binding.ServiceTemplate.ServiceType,
				SortOrder:         binding.SortOrder,
			}

			if err := tx.Create(module).Error; err != nil {
				return err
			}
		}

		resultSet = set
		return nil
	})

	if err != nil {
		return nil, err
	}

	return resultSet, nil
}
