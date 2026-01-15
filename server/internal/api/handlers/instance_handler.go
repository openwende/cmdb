package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/wend/cmdb-backend/internal/core/instance"
	"github.com/wend/cmdb-backend/internal/types"
)

type InstanceHandler struct {
	service instance.Service
}

func NewInstanceHandler(service instance.Service) *InstanceHandler {
	return &InstanceHandler{service: service}
}

// CreateInstance - POST /api/v1/models/:name/instances
func (h *InstanceHandler) CreateInstance(c *gin.Context) {
	modelName := c.Param("name")
	// TODO: Get Tenant ID from context/middleware
	// For POC, we'll accept it in header or hardcode test tenant
	tenantID := c.GetHeader("X-Tenant-ID")
	if tenantID == "" {
		// Fallback for easy testing
		tenantID = "ce307a3d-a1a7-4838-ab0b-23182f9851c3"
	}

	var req types.CreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	inst, err := h.service.CreateInstance(c.Request.Context(), tenantID, modelName, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, inst)
}

// BatchCreateInstances - POST /api/v1/models/:name/instances/batch
func (h *InstanceHandler) BatchCreateInstances(c *gin.Context) {
	modelName := c.Param("name")
	tenantID := c.GetHeader("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "ce307a3d-a1a7-4838-ab0b-23182f9851c3"
	}

	var req types.BatchCreateInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	instances, err := h.service.BatchCreateInstances(c.Request.Context(), tenantID, modelName, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"count": len(instances),
		"ids":   extractIDs(instances),
	})
}

func extractIDs(instances []types.Instance) []string {
	ids := make([]string, len(instances))
	for i, inst := range instances {
		ids[i] = inst.ID.String()
	}
	return ids
}

// ListInstances - GET /api/v1/models/:name/instances
func (h *InstanceHandler) ListInstances(c *gin.Context) {
	modelName := c.Param("name")
	tenantID := c.GetHeader("X-Tenant-ID")
	if tenantID == "" {
		tenantID = "ce307a3d-a1a7-4838-ab0b-23182f9851c3"
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	q := c.DefaultQuery("q", "")

	params := types.QueryParams{
		Page:     page,
		PageSize: pageSize,
		Filters:  make(map[string]interface{}),
	}

	if q != "" {
		var filters map[string]interface{}
		if err := json.Unmarshal([]byte(q), &filters); err == nil {
			params.Filters = filters
		}
	}

	instances, total, err := h.service.ListInstances(c.Request.Context(), tenantID, modelName, params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": instances,
		"meta": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}
