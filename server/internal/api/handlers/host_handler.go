package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/openwende/cmdb-server/internal/api/response"
	"github.com/openwende/cmdb-server/internal/core/host"
	"github.com/openwende/cmdb-server/internal/types"
	"github.com/openwende/cmdb-server/pkg/apperrors"
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

// GetHostStatistics 主机维度聚合统计（os_type / 业务 / 管控区域），供运营概览分布图
// GET /api/v1/hosts/statistics
//
// 采用统一响应规范（R8 标准的示范端点）：成功 response.OK → {"code":0,"data":...}。
func (h *HostHandler) GetHostStatistics(c *gin.Context) {
	stats, err := h.service.HostStatistics(c.Request.Context())
	if err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	response.OK(c, stats)
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

	tenantID := systemTenantUUID
	createdBy := currentUserID(c)

	host, err := h.service.CreateHost(c.Request.Context(), tenantID, &req, createdBy)
	if err != nil {
		c.JSON(apperrors.HTTPStatus(err), gin.H{"error": err.Error()})
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
//
// 采用统一响应规范（R8）：成功 response.OK → {"code":0,"data":<BatchImportResult>}，
// 批量统一 HTTP 200——部分/全部失败由响应体的 successful/failed/errors 表达，
// 不再用 207/400 混合状态码（前端统一按 body 判定，见 docs/API_RESPONSE_STANDARD.md）。
func (h *HostHandler) BatchImportHosts(c *gin.Context) {
	var req types.BatchImportHostsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	tenantID := systemTenantUUID
	createdBy := currentUserID(c)

	result, err := h.service.BatchImportHosts(c.Request.Context(), tenantID, &req, createdBy)
	if err != nil {
		response.Error(c, apperrors.HTTPStatus(err), err.Error())
		return
	}

	response.OK(c, result)
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
//
// 采用统一响应规范（R8）：response.List → {"code":0,"data":{"items":[...],
// "pagination":{"page","page_size","total"}}}（HostListResponse 仅描述 items 载荷形状，
// 实际响应为标准 envelope，详见 docs/API_RESPONSE_STANDARD.md）。
func (h *HostHandler) ListHosts(c *gin.Context) {
	var params types.HostQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		response.Error(c, http.StatusBadRequest, err.Error())
		return
	}

	// 设置默认分页
	if params.Page == 0 {
		params.Page = 1
	}
	if params.PageSize == 0 {
		params.PageSize = 20
	}

	tenantID := systemTenantUUID

	hosts, total, err := h.service.ListHosts(c.Request.Context(), tenantID, &params)
	if err != nil {
		response.Error(c, apperrors.HTTPStatus(err), err.Error())
		return
	}

	response.List(c, hosts, params.Page, params.PageSize, total)
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

	updatedBy := currentUserID(c)

	host, err := h.service.UpdateHost(c.Request.Context(), id, &req, updatedBy)
	if err != nil {
		c.JSON(apperrors.HTTPStatus(err), gin.H{"error": err.Error()})
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

	updatedBy := currentUserID(c)

	host, err := h.service.UpdateCustomFields(c.Request.Context(), id, req.CustomFields, updatedBy)
	if err != nil {
		c.JSON(apperrors.HTTPStatus(err), gin.H{"error": err.Error()})
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
		c.JSON(apperrors.HTTPStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
