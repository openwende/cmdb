package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/core/host"
	"github.com/wend/cmdb-backend/internal/types"
)

// HostHandler 主机处理器
type HostHandler struct {
	service *host.Service
}

// NewHostHandler 创建主机处理器实例
func NewHostHandler(service *host.Service) *HostHandler {
	return &HostHandler{
		service: service,
	}
}

// CreateHost 创建单个主机
// @Summary 创建主机
// @Tags Host
// @Accept json
// @Produce json
// @Param request body types.CreateHostRequest true "创建主机请求"
// @Success 201 {object} types.Host
// @Router /api/v1/hosts [post]
func (h *HostHandler) CreateHost(c *gin.Context) {
	var req types.CreateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: 从上下文获取租户ID和用户ID（需要认证中间件）
	tenantID := uuid.New() // 临时占位符
	var createdBy *uuid.UUID = nil

	host, err := h.service.CreateHost(c.Request.Context(), tenantID, &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, host)
}

// BatchImportHosts 批量导入主机
// @Summary 批量导入主机
// @Tags Host
// @Accept json
// @Produce json
// @Param request body types.BatchImportHostsRequest true "批量导入主机请求"
// @Success 200 {object} types.BatchImportResult
// @Router /api/v1/hosts/batch [post]
func (h *HostHandler) BatchImportHosts(c *gin.Context) {
	var req types.BatchImportHostsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: 从上下文获取租户ID和用户ID（需要认证中间件）
	tenantID := uuid.New() // 临时占位符
	var createdBy *uuid.UUID = nil

	result, err := h.service.BatchImportHosts(c.Request.Context(), tenantID, &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 如果有部分失败，返回 207 Multi-Status
	statusCode := http.StatusOK
	if result.Failed > 0 && result.Successful > 0 {
		statusCode = http.StatusMultiStatus
	} else if result.Failed > 0 && result.Successful == 0 {
		statusCode = http.StatusBadRequest
	}

	c.JSON(statusCode, result)
}

// GetHost 获取主机详情
// @Summary 获取主机详情
// @Tags Host
// @Produce json
// @Param id path string true "主机ID"
// @Success 200 {object} types.Host
// @Router /api/v1/hosts/{id} [get]
func (h *HostHandler) GetHost(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host id"})
		return
	}

	host, err := h.service.GetHost(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, host)
}

// ListHosts 获取主机列表
// @Summary 获取主机列表
// @Tags Host
// @Produce json
// @Param network_space_id query string false "网络空间ID"
// @Param cloud_vendor query string false "云厂商"
// @Param cloud_instance_id query string false "云实例ID"
// @Param status query string false "状态"
// @Param os_type query string false "操作系统类型"
// @Param include_destroyed query bool false "是否包含已销毁主机" default(false)
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} types.HostListResponse
// @Router /api/v1/hosts [get]
func (h *HostHandler) ListHosts(c *gin.Context) {
	var params types.HostQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 设置默认分页
	if params.Page == 0 {
		params.Page = 1
	}
	if params.PageSize == 0 {
		params.PageSize = 20
	}

	// TODO: 从上下文获取租户ID
	tenantID := uuid.New() // 临时占位符

	hosts, total, err := h.service.ListHosts(c.Request.Context(), tenantID, &params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, types.HostListResponse{
		Total:    int(total),
		Page:     params.Page,
		PageSize: params.PageSize,
		Hosts:    hosts,
	})
}

// UpdateHost 更新主机
// @Summary 更新主机
// @Tags Host
// @Accept json
// @Produce json
// @Param id path string true "主机ID"
// @Param request body types.UpdateHostRequest true "更新主机请求"
// @Success 200 {object} types.Host
// @Router /api/v1/hosts/{id} [put]
func (h *HostHandler) UpdateHost(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host id"})
		return
	}

	var req types.UpdateHostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: 从上下文获取用户ID
	var updatedBy *uuid.UUID = nil

	host, err := h.service.UpdateHost(c.Request.Context(), id, &req, updatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, host)
}

// UpdateHostCustomFields 更新主机自定义字段
// @Summary 更新主机自定义字段
// @Tags Host
// @Accept json
// @Produce json
// @Param id path string true "主机ID"
// @Param request body types.UpdateHostCustomFieldsRequest true "更新自定义字段请求"
// @Success 200 {object} types.Host
// @Router /api/v1/hosts/{id}/custom-fields [put]
func (h *HostHandler) UpdateHostCustomFields(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host id"})
		return
	}

	var req types.UpdateHostCustomFieldsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// TODO: 从上下文获取用户ID
	var updatedBy *uuid.UUID = nil

	host, err := h.service.UpdateCustomFields(c.Request.Context(), id, req.CustomFields, updatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, host)
}

// DeleteHost 删除主机
// @Summary 删除主机
// @Tags Host
// @Param id path string true "主机ID"
// @Param mark_destroyed query bool false "是否标记为已销毁" default(true)
// @Success 204
// @Router /api/v1/hosts/{id} [delete]
func (h *HostHandler) DeleteHost(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host id"})
		return
	}

	// 默认标记为已销毁（而不是软删除）
	markDestroyed := true
	if markDestroyedStr := c.Query("mark_destroyed"); markDestroyedStr == "false" {
		markDestroyed = false
	}

	if err := h.service.DeleteHost(c.Request.Context(), id, markDestroyed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}

// AssignToBusiness 分配主机到业务
// @Summary 分配主机到业务
// @Tags Host
// @Accept json
// @Produce json
// @Param id path string true "主机ID"
// @Param request body types.AssignHostToBusinessRequest true "分配到业务请求"
// @Success 200 {object} gin.H
// @Router /api/v1/hosts/{id}/assign [put]
func (h *HostHandler) AssignToBusiness(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host id"})
		return
	}

	var req types.AssignHostToBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AssignToBusiness(c.Request.Context(), id, req.BusinessID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "host assigned to business successfully"})
}

// ReclaimToPool 回收主机到资源池
// @Summary 回收主机到资源池
// @Tags Host
// @Produce json
// @Param id path string true "主机ID"
// @Success 200 {object} gin.H
// @Router /api/v1/hosts/{id}/reclaim [put]
func (h *HostHandler) ReclaimToPool(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid host id"})
		return
	}

	if err := h.service.ReclaimToPool(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "host reclaimed to resource pool successfully"})
}
