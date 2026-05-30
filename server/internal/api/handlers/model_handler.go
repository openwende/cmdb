package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/lib/pq"
	"github.com/wend/cmdb-backend/internal/core/model"
	"github.com/wend/cmdb-backend/internal/types"
)

type ModelHandler struct {
	service model.Service
}

func NewModelHandler(service model.Service) *ModelHandler {
	return &ModelHandler{service: service}
}

// ListModelGroups - GET /api/v1/models/groups
func (h *ModelHandler) ListModelGroups(c *gin.Context) {
	groups, err := h.service.ListModelGroups(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, groups)
}

// CreateModelGroup - POST /api/v1/models/groups
func (h *ModelHandler) CreateModelGroup(c *gin.Context) {
	var req types.CreateModelGroupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group, err := h.service.CreateModelGroup(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, group)
}

// CreateModel - POST /api/v1/models
func (h *ModelHandler) CreateModel(c *gin.Context) {
	var req types.CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	m, err := h.service.CreateModel(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, m)
}

// ListModels - GET /api/v1/models
func (h *ModelHandler) ListModels(c *gin.Context) {
	models, err := h.service.ListModels(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, models)
}

// GetModel - GET /api/v1/models/:name
func (h *ModelHandler) GetModel(c *gin.Context) {
	name := c.Param("name")
	// Support getting full model with attributes
	model, attrs, err := h.service.GetFullModel(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"model":      model,
		"attributes": attrs,
	})
}

// CreateAttribute - POST /api/v1/models/:name/attributes
func (h *ModelHandler) CreateAttribute(c *gin.Context) {
	modelName := c.Param("name")
	model, err := h.service.GetModelByName(c.Request.Context(), modelName)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "model not found"})
		return
	}

	var req types.CreateAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attr, err := h.service.CreateAttribute(c.Request.Context(), model.ID.String(), &req)
	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			c.JSON(http.StatusConflict, gin.H{"error": "attribute name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, attr)
}
