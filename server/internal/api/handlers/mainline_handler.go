package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/core/projection"
	"github.com/wend/cmdb-backend/internal/core/topology"
	"github.com/wend/cmdb-backend/internal/types"
)

type MainlineHandler struct {
	mainlineService *mainline.Service
	topologyService *topology.Service
	projection      *projection.BusinessTopologyService
}

func NewMainlineHandler(
	mainlineService *mainline.Service,
	topologyService *topology.Service,
	projectionSvc *projection.BusinessTopologyService,
) *MainlineHandler {
	return &MainlineHandler{
		mainlineService: mainlineService,
		topologyService: topologyService,
		projection:      projectionSvc,
	}
}

func (h *MainlineHandler) ListModels(c *gin.Context) {
	models, err := h.mainlineService.ListMainlineModels(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	items := make([]types.MainlineModelResponse, 0, len(models))
	for _, model := range models {
		item := types.MainlineModelResponse{
			UID:               model.Name,
			DisplayName:       model.DisplayName,
			Classification:    model.Classification,
			Icon:              model.Icon,
			Description:       model.Description,
			Scope:             model.MainlineScope,
			Level:             model.MainlineLevel,
			IsBuiltin:         model.IsBuiltin,
			IsTopologyBuiltin: model.IsTopologyBuiltin,
		}
		if model.MainlineParentModelID != nil {
			if parent, err := h.mainlineService.GetModelByID(c.Request.Context(), *model.MainlineParentModelID); err == nil {
				parentUID := parent.Name
				item.ParentModelUID = &parentUID
			}
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"items": items}})
}

func (h *MainlineHandler) CreateModel(c *gin.Context) {
	var req types.CreateMainlineModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	model, err := h.mainlineService.CreateMainlineModel(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": gin.H{
		"uid":                 model.Name,
		"display_name":        model.DisplayName,
		"classification":      model.Classification,
		"icon":                model.Icon,
		"description":         model.Description,
		"scope":               model.MainlineScope,
		"level":               model.MainlineLevel,
		"is_builtin":          model.IsBuiltin,
		"is_topology_builtin": model.IsTopologyBuiltin,
	}})
}

func (h *MainlineHandler) UpdateModel(c *gin.Context) {
	uid := strings.TrimSpace(c.Param("uid"))
	if uid == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing uid"})
		return
	}
	var req types.UpdateMainlineModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	model, err := h.mainlineService.UpdateMainlineModel(c.Request.Context(), uid, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{
		"uid":                 model.Name,
		"display_name":        model.DisplayName,
		"classification":      model.Classification,
		"icon":                model.Icon,
		"description":         model.Description,
		"scope":               model.MainlineScope,
		"level":               model.MainlineLevel,
		"is_builtin":          model.IsBuiltin,
		"is_topology_builtin": model.IsTopologyBuiltin,
	}})
}

func (h *MainlineHandler) GetTree(c *gin.Context) {
	var req types.GetTopologyTreeRequest
	if bizIDStr := c.Query("business_id"); bizIDStr != "" {
		bizID, err := uuid.Parse(bizIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid business_id"})
			return
		}
		req.BusinessID = &bizID
	}
	req.IncludeHosts = c.Query("include_hosts") == "true"
	req.MaxDepth, _ = strconv.Atoi(c.DefaultQuery("max_depth", "10"))
	req.ExpandNodeID = c.Query("expand_node_id")

	if h.projection != nil {
		var businessRef string
		if req.BusinessID != nil {
			businessRef = req.BusinessID.String()
		}

		tree, err := h.projection.GetTopologyTree(
			c.Request.Context(),
			businessRef,
			req.IncludeHosts,
			req.MaxDepth,
			req.ExpandNodeID,
		)
		switch {
		case err == nil && len(tree) > 0:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": tree})
			return
		case err != nil && !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tree, err := h.topologyService.GetTopologyTree(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": tree})
}

func (h *MainlineHandler) GetTopologySettings(c *gin.Context) {
	settings, err := h.mainlineService.GetTopologySettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": settings})
}

func (h *MainlineHandler) CreateNode(c *gin.Context) {
	var req types.CreateMainlineNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	node, err := h.mainlineService.CreateCustomNode(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": node})
}

func (h *MainlineHandler) UpdateNode(c *gin.Context) {
	modelUID := strings.TrimSpace(c.Param("model_uid"))
	refID := strings.TrimSpace(c.Param("ref_id"))
	var req types.UpdateMainlineNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	node, err := h.mainlineService.UpdateCustomNode(c.Request.Context(), modelUID, refID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": node})
}

func (h *MainlineHandler) DeleteNode(c *gin.Context) {
	modelUID := strings.TrimSpace(c.Param("model_uid"))
	refID := strings.TrimSpace(c.Param("ref_id"))
	if err := h.mainlineService.DeleteCustomNode(c.Request.Context(), modelUID, refID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "deleted"}})
}

func (h *MainlineHandler) MoveNode(c *gin.Context) {
	modelUID := strings.TrimSpace(c.Param("model_uid"))
	refID := strings.TrimSpace(c.Param("ref_id"))
	var req types.MoveMainlineNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	node, err := h.mainlineService.MoveCustomNode(c.Request.Context(), modelUID, refID, &req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": node})
}
