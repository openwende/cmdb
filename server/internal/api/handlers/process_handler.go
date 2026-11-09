package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/openwende/cmdb/server/internal/core/process"
	"github.com/openwende/cmdb/server/internal/types"
)

// ProcessHandler 进程管理 HTTP Handler
type ProcessHandler struct {
	service process.Service
}

// NewProcessHandler 创建 Handler
func NewProcessHandler(service process.Service) *ProcessHandler {
	return &ProcessHandler{service: service}
}

// ========== 进程模板 API ==========

// CreateProcessTemplate 创建进程模板
// POST /api/v1/process-templates
func (h *ProcessHandler) CreateProcessTemplate(c *gin.Context) {
	var req types.CreateProcessTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	template, err := h.service.CreateProcessTemplate(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": template})
}

// GetProcessTemplate 获取进程模板
// GET /api/v1/process-templates/:id
func (h *ProcessHandler) GetProcessTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	template, err := h.service.GetProcessTemplate(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "进程模板不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": template})
}

// ListProcessTemplates 获取进程模板列表
// GET /api/v1/process-templates?business_id=xxx&service_template_id=xxx
func (h *ProcessHandler) ListProcessTemplates(c *gin.Context) {
	businessIDStr := c.Query("business_id")
	if businessIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "business_id 参数必填"})
		return
	}

	businessID, err := strconv.ParseUint(businessIDStr, 10, 64)
	if err != nil || businessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 business_id"})
		return
	}

	var serviceTemplateID *uint64
	if stIDStr := c.Query("service_template_id"); stIDStr != "" {
		if id, err := strconv.ParseUint(stIDStr, 10, 64); err == nil {
			serviceTemplateID = &id
		}
	}

	templates, err := h.service.ListProcessTemplates(c.Request.Context(), businessID, serviceTemplateID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": templates})
}

// UpdateProcessTemplate 更新进程模板
// PUT /api/v1/process-templates/:id
func (h *ProcessHandler) UpdateProcessTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.UpdateProcessTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	template, err := h.service.UpdateProcessTemplate(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": template})
}

// DeleteProcessTemplate 删除进程模板
// DELETE /api/v1/process-templates/:id
func (h *ProcessHandler) DeleteProcessTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.service.DeleteProcessTemplate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// ========== 进程实例 API ==========

// CreateProcess 创建进程实例
// POST /api/v1/processes
func (h *ProcessHandler) CreateProcess(c *gin.Context) {
	var req types.CreateProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	proc, err := h.service.CreateProcess(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": proc})
}

// GetProcess 获取进程实例
// GET /api/v1/processes/:id
func (h *ProcessHandler) GetProcess(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	proc, err := h.service.GetProcess(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "进程不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": proc})
}

// ListProcesses 获取进程列表
// GET /api/v1/processes?business_id=xxx&module_id=xxx&host_id=xxx
func (h *ProcessHandler) ListProcesses(c *gin.Context) {
	params := &process.ProcessQueryParams{
		Page:     1,
		PageSize: 20,
	}

	if p, _ := strconv.Atoi(c.DefaultQuery("page", "1")); p > 0 {
		params.Page = p
	}
	if ps, _ := strconv.Atoi(c.DefaultQuery("page_size", "20")); ps > 0 {
		params.PageSize = ps
	}

	if bizID := c.Query("business_id"); bizID != "" {
		if id, err := strconv.ParseUint(bizID, 10, 64); err == nil {
			params.BusinessID = &id
		}
	}
	if modID := c.Query("module_id"); modID != "" {
		if id, err := strconv.ParseUint(modID, 10, 64); err == nil {
			params.ModuleID = &id
		}
	}
	if hostID := c.Query("host_id"); hostID != "" {
		if id, err := uuid.Parse(hostID); err == nil {
			params.HostID = &id
		}
	}
	if ptID := c.Query("process_template_id"); ptID != "" {
		if id, err := strconv.ParseUint(ptID, 10, 64); err == nil {
			params.ProcessTemplateID = &id
		}
	}

	processes, total, err := h.service.ListProcesses(c.Request.Context(), params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": processes,
			"pagination": gin.H{
				"page":      params.Page,
				"page_size": params.PageSize,
				"total":     total,
			},
		},
	})
}

// UpdateProcess 更新进程实例
// PUT /api/v1/processes/:id
func (h *ProcessHandler) UpdateProcess(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.UpdateProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	proc, err := h.service.UpdateProcess(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": proc})
}

// DeleteProcess 删除进程实例
// DELETE /api/v1/processes/:id
func (h *ProcessHandler) DeleteProcess(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.service.DeleteProcess(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// BatchCreateProcesses 批量创建进程
// POST /api/v1/processes/batch
func (h *ProcessHandler) BatchCreateProcesses(c *gin.Context) {
	var req types.BatchCreateProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.BatchCreateProcesses(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// ListHostProcessesWithStatus 获取主机进程列表（含状态）
// GET /api/v1/hosts/:id/processes
func (h *ProcessHandler) ListHostProcessesWithStatus(c *gin.Context) {
	hostID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的主机ID"})
		return
	}

	processes, err := h.service.ListProcessesWithStatus(c.Request.Context(), hostID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": processes})
}

// GetModuleProcessSummary 获取模块进程摘要
// GET /api/v1/modules/:id/process-summary
func (h *ProcessHandler) GetModuleProcessSummary(c *gin.Context) {
	moduleID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模块ID"})
		return
	}

	summary, err := h.service.GetModuleProcessSummary(c.Request.Context(), moduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": summary})
}

// UpdateProcessStatus Agent 上报进程状态
// POST /api/v1/processes/:id/status
func (h *ProcessHandler) UpdateProcessStatus(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var status types.ProcessStatus
	if err := c.ShouldBindJSON(&status); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	status.ProcessID = id
	if err := h.service.UpdateProcessStatus(c.Request.Context(), &status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "状态更新成功"})
}
