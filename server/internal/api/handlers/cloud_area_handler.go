package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/core/cloud_area"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"
)

// CloudAreaHandler 云区域处理器
type CloudAreaHandler struct {
	service *cloud_area.Service
}

// NewCloudAreaHandler 创建云区域处理器实例
func NewCloudAreaHandler(service *cloud_area.Service) *CloudAreaHandler {
	return &CloudAreaHandler{
		service: service,
	}
}

// CreateCloudArea 创建云区域
// @Summary 创建云区域
// @Tags CloudArea
// @Accept json
// @Produce json
// @Param request body types.CreateCloudAreaRequest true "创建云区域请求"
// @Success 201 {object} types.CloudArea
// @Router /api/v1/cloud-areas [post]
func (h *CloudAreaHandler) CreateCloudArea(c *gin.Context) {
	var req types.CreateCloudAreaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenantID := systemTenantUUID

	cloudArea, err := h.service.CreateCloudArea(c.Request.Context(), tenantID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cloudArea)
}

// GetCloudArea 获取云区域详情
// @Summary 获取云区域详情
// @Tags CloudArea
// @Produce json
// @Param id path string true "云区域ID"
// @Success 200 {object} types.CloudArea
// @Router /api/v1/cloud-areas/{id} [get]
func (h *CloudAreaHandler) GetCloudArea(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cloud area id"})
		return
	}

	cloudArea, err := h.service.GetCloudArea(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cloudArea)
}

// GetDefaultCloudArea 获取默认云区域
// @Summary 获取默认云区域（直连区域）
// @Tags CloudArea
// @Produce json
// @Success 200 {object} types.CloudArea
// @Router /api/v1/cloud-areas/default [get]
func (h *CloudAreaHandler) GetDefaultCloudArea(c *gin.Context) {
	cloudArea, err := h.service.GetDefaultCloudArea(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cloudArea)
}

// ListCloudAreas 获取云区域列表
// @Summary 获取云区域列表
// @Tags CloudArea
// @Produce json
// @Param cloud_vendor query string false "云厂商"
// @Param type query string false "类型"
// @Param region query string false "区域"
// @Param page query int false "页码" default(1)
// @Param page_size query int false "每页数量" default(20)
// @Success 200 {object} object
// @Router /api/v1/cloud-areas [get]
func (h *CloudAreaHandler) ListCloudAreas(c *gin.Context) {
	var params types.CloudAreaQueryParams
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

	tenantID := systemTenantUUID

	cloudAreas, total, err := h.service.ListCloudAreas(c.Request.Context(), tenantID, &params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":       total,
		"page":        params.Page,
		"page_size":   params.PageSize,
		"cloud_areas": cloudAreas,
	})
}

// UpdateCloudArea 更新云区域
// @Summary 更新云区域
// @Tags CloudArea
// @Accept json
// @Produce json
// @Param id path string true "云区域ID"
// @Param request body types.UpdateCloudAreaRequest true "更新云区域请求"
// @Success 200 {object} types.CloudArea
// @Router /api/v1/cloud-areas/{id} [put]
func (h *CloudAreaHandler) UpdateCloudArea(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cloud area id"})
		return
	}

	var req types.UpdateCloudAreaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	cloudArea, err := h.service.UpdateCloudArea(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cloudArea)
}

// DeleteCloudArea 删除云区域
// @Summary 删除云区域
// @Tags CloudArea
// @Param id path string true "云区域ID"
// @Success 204
// @Router /api/v1/cloud-areas/{id} [delete]
func (h *CloudAreaHandler) DeleteCloudArea(c *gin.Context) {
	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid cloud area id"})
		return
	}

	if err := h.service.DeleteCloudArea(c.Request.Context(), id); err != nil {
		c.JSON(apperrors.HTTPStatus(err), gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusNoContent)
}
