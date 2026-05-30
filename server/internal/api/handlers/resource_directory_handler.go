package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/core/resource_directory"
	"github.com/wend/cmdb-backend/internal/types"
)

// ResourceDirectoryHandler 资源目录 HTTP Handler
type ResourceDirectoryHandler struct {
	service resource_directory.Service
}

// NewResourceDirectoryHandler 创建 Handler
func NewResourceDirectoryHandler(service resource_directory.Service) *ResourceDirectoryHandler {
	return &ResourceDirectoryHandler{service: service}
}

// ========== 资源目录 API ==========

// CreateDirectory 创建资源目录
// POST /api/v1/resource-pool/directories
func (h *ResourceDirectoryHandler) CreateDirectory(c *gin.Context) {
	var req types.CreateResourceDirectoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	createdBy := c.GetString("user_id")
	if createdBy == "" {
		createdBy = "system"
	}

	dir, err := h.service.CreateDirectory(c.Request.Context(), &req, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": dir})
}

// GetDirectory 获取资源目录
// GET /api/v1/resource-pool/directories/:id
func (h *ResourceDirectoryHandler) GetDirectory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	dir, err := h.service.GetDirectory(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "目录不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": dir})
}

// ListDirectories 获取资源目录列表
// GET /api/v1/resource-pool/directories?parent_id=xxx
func (h *ResourceDirectoryHandler) ListDirectories(c *gin.Context) {
	var parentID *uint64
	if pidStr := c.Query("parent_id"); pidStr != "" {
		if pid, err := strconv.ParseUint(pidStr, 10, 64); err == nil {
			parentID = &pid
		}
	}

	dirs, err := h.service.ListDirectories(c.Request.Context(), parentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": dirs})
}

// GetDirectoryTree 获取目录树
// GET /api/v1/resource-pool/directories/tree
func (h *ResourceDirectoryHandler) GetDirectoryTree(c *gin.Context) {
	tree, err := h.service.GetDirectoryTree(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": tree})
}

// UpdateDirectory 更新资源目录
// PUT /api/v1/resource-pool/directories/:id
func (h *ResourceDirectoryHandler) UpdateDirectory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.UpdateResourceDirectoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updatedBy := c.GetString("user_id")
	if updatedBy == "" {
		updatedBy = "system"
	}

	dir, err := h.service.UpdateDirectory(c.Request.Context(), id, &req, updatedBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": dir})
}

// DeleteDirectory 删除资源目录
// DELETE /api/v1/resource-pool/directories/:id
func (h *ResourceDirectoryHandler) DeleteDirectory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	if err := h.service.DeleteDirectory(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "删除成功"})
}

// MoveDirectory 移动目录
// POST /api/v1/resource-pool/directories/:id/move
func (h *ResourceDirectoryHandler) MoveDirectory(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的ID"})
		return
	}

	var req types.MoveResourceDirectoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.MoveDirectory(c.Request.Context(), id, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "message": "移动成功"})
}

// ========== 资源池主机 API ==========

// ImportHostsToPool 导入主机到资源池
// POST /api/v1/resource-pool/hosts/import
func (h *ResourceDirectoryHandler) ImportHostsToPool(c *gin.Context) {
	var req types.ImportHostsToPoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	importedBy := c.GetString("user_id")
	if importedBy == "" {
		importedBy = "system"
	}

	result, err := h.service.ImportHostsToPool(c.Request.Context(), &req, importedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// MoveHostsInPool 在资源池内移动主机
// POST /api/v1/resource-pool/hosts/move
func (h *ResourceDirectoryHandler) MoveHostsInPool(c *gin.Context) {
	var req types.MoveHostsInPoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.MoveHostsInPool(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// AllocateHosts 分配主机到业务
// POST /api/v1/resource-pool/hosts/allocate
func (h *ResourceDirectoryHandler) AllocateHosts(c *gin.Context) {
	var req types.AllocateHostsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.AllocateHosts(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// ReclaimHosts 回收主机到资源池
// POST /api/v1/resource-pool/hosts/reclaim
func (h *ResourceDirectoryHandler) ReclaimHosts(c *gin.Context) {
	var req types.ReclaimHostsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	reclaimedBy := c.GetString("user_id")
	if reclaimedBy == "" {
		reclaimedBy = "system"
	}

	result, err := h.service.ReclaimHosts(c.Request.Context(), &req, reclaimedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// GetHostLifecycle 获取主机生命周期状态
// GET /api/v1/resource-pool/hosts/:id/lifecycle
func (h *ResourceDirectoryHandler) GetHostLifecycle(c *gin.Context) {
	hostID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的主机ID"})
		return
	}

	result, err := h.service.GetHostLifecycle(c.Request.Context(), hostID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
}

// ListPoolHosts 获取资源池主机列表
// GET /api/v1/resource-pool/hosts?directory_id=xxx&page=1&page_size=20
func (h *ResourceDirectoryHandler) ListPoolHosts(c *gin.Context) {
	var directoryID *uint64
	if dirIDStr := c.Query("directory_id"); dirIDStr != "" {
		if did, err := strconv.ParseUint(dirIDStr, 10, 64); err == nil {
			directoryID = &did
		}
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	hosts, total, err := h.service.ListPoolHosts(c.Request.Context(), directoryID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": hosts,
			"pagination": gin.H{
				"page":      page,
				"page_size": pageSize,
				"total":     total,
			},
		},
	})
}

// GetStatistics 获取资源池统计
// GET /api/v1/resource-pool/statistics
func (h *ResourceDirectoryHandler) GetStatistics(c *gin.Context) {
	stats, err := h.service.GetStatistics(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": stats})
}
