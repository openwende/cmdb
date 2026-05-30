package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/wend/cmdb-backend/internal/core/service_template"
	"github.com/wend/cmdb-backend/internal/types"
)

// ServiceTemplateHandler 服务模板 HTTP Handler
type ServiceTemplateHandler struct {
	service service_template.Service
}

// NewServiceTemplateHandler 创建 Handler
func NewServiceTemplateHandler(service service_template.Service) *ServiceTemplateHandler {
	return &ServiceTemplateHandler{service: service}
}

// ========== 服务模板 API ==========

// CreateServiceTemplate 创建服务模板
// POST /api/v1/service-templates
func (h *ServiceTemplateHandler) CreateServiceTemplate(c *gin.Context) {
	var req types.CreateServiceTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := c.GetString("user_id")
	if createdBy == "" {
		createdBy = "system"
	}

	template, err := h.service.CreateServiceTemplate(c.Request.Context(), &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": template})
}

// GetServiceTemplate 获取服务模板
// GET /api/v1/service-templates/:id
func (h *ServiceTemplateHandler) GetServiceTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	template, err := h.service.GetServiceTemplate(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "服务模板不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": template})
}

// ListServiceTemplates 获取服务模板列表
// GET /api/v1/service-templates?business_id=xxx
func (h *ServiceTemplateHandler) ListServiceTemplates(c *gin.Context) {
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

	templates, err := h.service.ListServiceTemplates(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": templates})
}

// UpdateServiceTemplate 更新服务模板
// PUT /api/v1/service-templates/:id
func (h *ServiceTemplateHandler) UpdateServiceTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.UpdateServiceTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updatedBy := c.GetString("user_id")
	if updatedBy == "" {
		updatedBy = "system"
	}

	template, err := h.service.UpdateServiceTemplate(c.Request.Context(), id, &req, updatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": template})
}

// DeleteServiceTemplate 删除服务模板
// DELETE /api/v1/service-templates/:id
func (h *ServiceTemplateHandler) DeleteServiceTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.service.DeleteServiceTemplate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// AddProcessTemplate 添加进程模板到服务模板
// POST /api/v1/service-templates/:id/process-templates
func (h *ServiceTemplateHandler) AddProcessTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.AddProcessToServiceTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AddProcessTemplate(c.Request.Context(), id, req.ProcessTemplateID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "添加成功"})
}

// RemoveProcessTemplate 从服务模板移除进程模板
// DELETE /api/v1/service-templates/:id/process-templates/:ptid
func (h *ServiceTemplateHandler) RemoveProcessTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的服务模板ID"})
		return
	}

	ptID, err := strconv.ParseUint(c.Param("ptid"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的进程模板ID"})
		return
	}

	if err := h.service.RemoveProcessTemplate(c.Request.Context(), id, ptID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "移除成功"})
}

// CreateModuleFromTemplate 从服务模板创建模块
// POST /api/v1/service-templates/:id/create-module
func (h *ServiceTemplateHandler) CreateModuleFromTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.CreateModuleFromTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	module, err := h.service.CreateModuleFromTemplate(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": module})
}

// SyncModules 同步模块到模板
// POST /api/v1/service-templates/:id/sync
func (h *ServiceTemplateHandler) SyncModules(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.SyncModulesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.SyncModulesToTemplate(c.Request.Context(), id, req.ModuleIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// ========== 集群模板 API ==========

// CreateSetTemplate 创建集群模板
// POST /api/v1/set-templates
func (h *ServiceTemplateHandler) CreateSetTemplate(c *gin.Context) {
	var req types.CreateSetTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := c.GetString("user_id")
	if createdBy == "" {
		createdBy = "system"
	}

	template, err := h.service.CreateSetTemplate(c.Request.Context(), &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": template})
}

// GetSetTemplate 获取集群模板
// GET /api/v1/set-templates/:id
func (h *ServiceTemplateHandler) GetSetTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	template, err := h.service.GetSetTemplate(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "集群模板不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": template})
}

// ListSetTemplates 获取集群模板列表
// GET /api/v1/set-templates?business_id=xxx
func (h *ServiceTemplateHandler) ListSetTemplates(c *gin.Context) {
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

	templates, err := h.service.ListSetTemplates(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": templates})
}

// DeleteSetTemplate 删除集群模板
// DELETE /api/v1/set-templates/:id
func (h *ServiceTemplateHandler) DeleteSetTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.service.DeleteSetTemplate(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// CreateSetFromTemplate 从集群模板创建集群
// POST /api/v1/set-templates/:id/create-set
func (h *ServiceTemplateHandler) CreateSetFromTemplate(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.CreateSetFromTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	set, err := h.service.CreateSetFromTemplate(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": set})
}
