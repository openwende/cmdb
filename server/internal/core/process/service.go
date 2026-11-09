package process

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/types"
)

// Service 进程管理服务
type Service interface {
	CreateProcessTemplate(ctx context.Context, req *types.CreateProcessTemplateRequest) (*types.ProcessTemplate, error)
	GetProcessTemplate(ctx context.Context, id uint64) (*types.ProcessTemplate, error)
	ListProcessTemplates(ctx context.Context, businessID uint64, serviceTemplateID *uint64) ([]types.ProcessTemplate, error)
	UpdateProcessTemplate(ctx context.Context, id uint64, req *types.UpdateProcessTemplateRequest) (*types.ProcessTemplate, error)
	DeleteProcessTemplate(ctx context.Context, id uint64) error
	CreateProcess(ctx context.Context, req *types.CreateProcessRequest) (*types.Process, error)
	GetProcess(ctx context.Context, id uint64) (*types.Process, error)
	ListProcesses(ctx context.Context, params *ProcessQueryParams) ([]types.Process, int64, error)
	UpdateProcess(ctx context.Context, id uint64, req *types.UpdateProcessRequest) (*types.Process, error)
	DeleteProcess(ctx context.Context, id uint64) error
	BatchCreateProcesses(ctx context.Context, req *types.BatchCreateProcessRequest) (*types.BatchOperationResult, error)
	UpdateProcessStatus(ctx context.Context, status *types.ProcessStatus) error
	GetProcessStatus(ctx context.Context, processID uint64) (*types.ProcessStatus, error)
	ListProcessesWithStatus(ctx context.Context, hostID uuid.UUID) ([]types.ProcessWithStatus, error)
	GetModuleProcessSummary(ctx context.Context, moduleID uint64) (map[string]int, error)
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

// ========== 进程模板管理 ==========

// CreateProcessTemplate 创建进程模板
func (s *service) CreateProcessTemplate(ctx context.Context, req *types.CreateProcessTemplateRequest) (*types.ProcessTemplate, error) {
	// 验证业务是否存在
	var business types.Business
	if err := s.db.Where("id = ?", req.BusinessID).First(&business).Error; err != nil {
		return nil, fmt.Errorf("业务不存在: %w", err)
	}

	// 序列化绑定信息
	var bindInfoJSON []byte
	if len(req.BindInfo) > 0 {
		bindInfoJSON, _ = json.Marshal(req.BindInfo)
	}

	autoStart := true
	if req.AutoStart != nil {
		autoStart = *req.AutoStart
	}

	autoRecover := true
	if req.AutoRecover != nil {
		autoRecover = *req.AutoRecover
	}

	template := &types.ProcessTemplate{
		Name:           req.Name,
		BusinessID:     req.BusinessID,
		StartCommand:   req.StartCommand,
		StopCommand:    req.StopCommand,
		RestartCommand: req.RestartCommand,
		ReloadCommand:  req.ReloadCommand,
		WorkPath:       req.WorkPath,
		PidFile:        req.PidFile,
		User:           req.User,
		ProcNum:        req.ProcNum,
		Priority:       req.Priority,
		Timeout:        req.Timeout,
		AutoStart:      autoStart,
		AutoRecover:    autoRecover,
		BindInfo:       bindInfoJSON,
		Description:    req.Description,
	}

	if template.ProcNum <= 0 {
		template.ProcNum = 1
	}
	if template.Timeout <= 0 {
		template.Timeout = 60
	}

	if err := s.db.Create(template).Error; err != nil {
		return nil, err
	}

	return template, nil
}

// GetProcessTemplate 获取进程模板
func (s *service) GetProcessTemplate(ctx context.Context, id uint64) (*types.ProcessTemplate, error) {
	var template types.ProcessTemplate
	if err := s.db.First(&template, id).Error; err != nil {
		return nil, err
	}
	return &template, nil
}

// ListProcessTemplates 获取进程模板列表
func (s *service) ListProcessTemplates(ctx context.Context, businessID uint64, serviceTemplateID *uint64) ([]types.ProcessTemplate, error) {
	var templates []types.ProcessTemplate
	query := s.db.Where("business_id = ?", businessID)

	if serviceTemplateID != nil {
		query = query.Where("service_template_id = ?", *serviceTemplateID)
	}

	if err := query.Order("priority ASC, id ASC").Find(&templates).Error; err != nil {
		return nil, err
	}
	return templates, nil
}

// UpdateProcessTemplate 更新进程模板
func (s *service) UpdateProcessTemplate(ctx context.Context, id uint64, req *types.UpdateProcessTemplateRequest) (*types.ProcessTemplate, error) {
	updates := make(map[string]interface{})

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.StartCommand != nil {
		updates["start_command"] = *req.StartCommand
	}
	if req.StopCommand != nil {
		updates["stop_command"] = *req.StopCommand
	}
	if req.RestartCommand != nil {
		updates["restart_command"] = *req.RestartCommand
	}
	if req.ReloadCommand != nil {
		updates["reload_command"] = *req.ReloadCommand
	}
	if req.WorkPath != nil {
		updates["work_path"] = *req.WorkPath
	}
	if req.PidFile != nil {
		updates["pid_file"] = *req.PidFile
	}
	if req.User != nil {
		updates["user"] = *req.User
	}
	if req.ProcNum != nil {
		updates["proc_num"] = *req.ProcNum
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.Timeout != nil {
		updates["timeout"] = *req.Timeout
	}
	if req.AutoStart != nil {
		updates["auto_start"] = *req.AutoStart
	}
	if req.AutoRecover != nil {
		updates["auto_recover"] = *req.AutoRecover
	}
	if len(req.BindInfo) > 0 {
		bindInfoJSON, _ := json.Marshal(req.BindInfo)
		updates["bind_info"] = bindInfoJSON
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	if err := s.db.Model(&types.ProcessTemplate{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetProcessTemplate(ctx, id)
}

// DeleteProcessTemplate 删除进程模板
func (s *service) DeleteProcessTemplate(ctx context.Context, id uint64) error {
	// 检查是否有进程实例使用此模板
	var count int64
	s.db.Model(&types.Process{}).Where("process_template_id = ?", id).Count(&count)
	if count > 0 {
		return fmt.Errorf("进程模板被 %d 个进程实例使用，无法删除", count)
	}

	return s.db.Delete(&types.ProcessTemplate{}, id).Error
}

// ========== 进程实例管理 ==========

// CreateProcess 创建进程实例
func (s *service) CreateProcess(ctx context.Context, req *types.CreateProcessRequest) (*types.Process, error) {
	// 获取进程模板
	template, err := s.GetProcessTemplate(ctx, req.ProcessTemplateID)
	if err != nil {
		return nil, fmt.Errorf("进程模板不存在: %w", err)
	}

	// 验证主机存在
	var host types.Host
	if err := s.db.Where("id = ?", req.HostID).First(&host).Error; err != nil {
		return nil, fmt.Errorf("主机不存在: %w", err)
	}

	// 验证模块存在
	var module types.Module
	if err := s.db.First(&module, req.ModuleID).Error; err != nil {
		return nil, fmt.Errorf("模块不存在: %w", err)
	}

	// 序列化绑定信息
	var bindInfoJSON []byte
	if len(req.BindInfo) > 0 {
		bindInfoJSON, _ = json.Marshal(req.BindInfo)
	}

	processName := req.ProcessName
	if processName == "" {
		processName = template.Name
	}

	process := &types.Process{
		ProcessTemplateID: req.ProcessTemplateID,
		HostID:            req.HostID,
		ModuleID:          req.ModuleID,
		BusinessID:        module.BusinessID,
		ProcessName:       processName,
		BindInfo:          bindInfoJSON,
		StartCommand:      req.StartCommand,
		User:              req.User,
		WorkPath:          req.WorkPath,
		Priority:          req.Priority,
		ProcNum:           req.ProcNum,
		Description:       req.Description,
	}

	if err := s.db.Create(process).Error; err != nil {
		return nil, err
	}

	return process, nil
}

// GetProcess 获取进程实例
func (s *service) GetProcess(ctx context.Context, id uint64) (*types.Process, error) {
	var process types.Process
	if err := s.db.Preload("ProcessTemplate").Preload("Host").First(&process, id).Error; err != nil {
		return nil, err
	}
	return &process, nil
}

// ListProcesses 获取进程列表
func (s *service) ListProcesses(ctx context.Context, params *ProcessQueryParams) ([]types.Process, int64, error) {
	var processes []types.Process
	var total int64

	query := s.db.Model(&types.Process{})

	if params.BusinessID != nil {
		query = query.Where("business_id = ?", *params.BusinessID)
	}
	if params.ModuleID != nil {
		query = query.Where("module_id = ?", *params.ModuleID)
	}
	if params.HostID != nil {
		query = query.Where("host_id = ?", *params.HostID)
	}
	if params.ProcessTemplateID != nil {
		query = query.Where("process_template_id = ?", *params.ProcessTemplateID)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (params.Page - 1) * params.PageSize
	if err := query.Preload("ProcessTemplate").
		Offset(offset).Limit(params.PageSize).
		Order("id ASC").
		Find(&processes).Error; err != nil {
		return nil, 0, err
	}

	return processes, total, nil
}

// ProcessQueryParams 进程查询参数
type ProcessQueryParams struct {
	BusinessID        *uint64
	ModuleID          *uint64
	HostID            *uuid.UUID
	ProcessTemplateID *uint64
	Page              int
	PageSize          int
}

// UpdateProcess 更新进程实例
func (s *service) UpdateProcess(ctx context.Context, id uint64, req *types.UpdateProcessRequest) (*types.Process, error) {
	updates := make(map[string]interface{})

	if req.ProcessName != nil {
		updates["process_name"] = *req.ProcessName
	}
	if len(req.BindInfo) > 0 {
		bindInfoJSON, _ := json.Marshal(req.BindInfo)
		updates["bind_info"] = bindInfoJSON
	}
	if req.StartCommand != nil {
		updates["start_command"] = *req.StartCommand
	}
	if req.User != nil {
		updates["user"] = *req.User
	}
	if req.WorkPath != nil {
		updates["work_path"] = *req.WorkPath
	}
	if req.Priority != nil {
		updates["priority"] = *req.Priority
	}
	if req.ProcNum != nil {
		updates["proc_num"] = *req.ProcNum
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	if err := s.db.Model(&types.Process{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetProcess(ctx, id)
}

// DeleteProcess 删除进程实例
func (s *service) DeleteProcess(ctx context.Context, id uint64) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 删除进程状态
		tx.Where("process_id = ?", id).Delete(&types.ProcessStatus{})
		// 删除进程实例
		return tx.Delete(&types.Process{}, id).Error
	})
}

// BatchCreateProcesses 批量创建进程（为多台主机创建相同进程）
func (s *service) BatchCreateProcesses(ctx context.Context, req *types.BatchCreateProcessRequest) (*types.BatchOperationResult, error) {
	result := &types.BatchOperationResult{
		Total:  len(req.HostIDs),
		Errors: make([]string, 0),
	}

	for _, hostID := range req.HostIDs {
		createReq := &types.CreateProcessRequest{
			ProcessTemplateID: req.ProcessTemplateID,
			HostID:            hostID,
			ModuleID:          req.ModuleID,
		}

		_, err := s.CreateProcess(ctx, createReq)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, fmt.Sprintf("主机 %s: %s", hostID, err.Error()))
		} else {
			result.Successful++
		}
	}

	return result, nil
}

// ========== 进程状态管理 ==========

// UpdateProcessStatus 更新进程状态（Agent 上报）
func (s *service) UpdateProcessStatus(ctx context.Context, status *types.ProcessStatus) error {
	return s.db.Save(status).Error
}

// GetProcessStatus 获取进程状态
func (s *service) GetProcessStatus(ctx context.Context, processID uint64) (*types.ProcessStatus, error) {
	var status types.ProcessStatus
	if err := s.db.Where("process_id = ?", processID).First(&status).Error; err != nil {
		return nil, err
	}
	return &status, nil
}

// ListProcessesWithStatus 获取进程列表（含状态）
func (s *service) ListProcessesWithStatus(ctx context.Context, hostID uuid.UUID) ([]types.ProcessWithStatus, error) {
	var processes []types.Process
	if err := s.db.Where("host_id = ?", hostID).
		Preload("ProcessTemplate").
		Find(&processes).Error; err != nil {
		return nil, err
	}

	result := make([]types.ProcessWithStatus, 0, len(processes))
	for _, p := range processes {
		pws := types.ProcessWithStatus{Process: p}

		var status types.ProcessStatus
		if err := s.db.Where("process_id = ?", p.ID).First(&status).Error; err == nil {
			pws.Status = &status
		}

		result = append(result, pws)
	}

	return result, nil
}

// GetModuleProcessSummary 获取模块的进程统计摘要
func (s *service) GetModuleProcessSummary(ctx context.Context, moduleID uint64) (map[string]int, error) {
	summary := map[string]int{
		"total":   0,
		"running": 0,
		"stopped": 0,
		"unknown": 0,
	}

	var processes []types.Process
	if err := s.db.Where("module_id = ?", moduleID).Find(&processes).Error; err != nil {
		return nil, err
	}

	summary["total"] = len(processes)

	for _, p := range processes {
		var status types.ProcessStatus
		if err := s.db.Where("process_id = ?", p.ID).First(&status).Error; err != nil {
			summary["unknown"]++
		} else {
			switch status.Status {
			case types.ProcessStatusRunning:
				summary["running"]++
			case types.ProcessStatusStopped:
				summary["stopped"]++
			default:
				summary["unknown"]++
			}
		}
	}

	return summary, nil
}
