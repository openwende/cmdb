package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/openwende/cmdb/server/internal/core/resource_graph"
	"github.com/openwende/cmdb/server/internal/types"
)

type ResourceGraphHandler struct {
	service resource_graph.Service
}

type createTypeRequest struct {
	Name          string              `json:"name"`
	DisplayName   string              `json:"display_name"`
	Category      string              `json:"category"`
	Icon          string              `json:"icon"`
	Schema        map[string]any      `json:"schema"`
	IdentityRules types.IdentityRules `json:"identity_rules"`
	Builtin       bool                `json:"builtin"`
}

type createResourceRequest struct {
	TypeName string         `json:"type_name"`
	Name     string         `json:"name"`
	Spec     map[string]any `json:"spec"`
	Status   map[string]any `json:"status"`
	Labels   map[string]any `json:"labels"`
	Source   string         `json:"source"`
	SourceID *string        `json:"source_id"`
}

type batchUpsertResourcesRequest struct {
	TypeName string           `json:"type_name"`
	Source   string           `json:"source"`
	Items    []map[string]any `json:"items"`
}

type searchResourcesRequest struct {
	TypeName string         `json:"type_name"`
	Source   string         `json:"source"`
	Filters  map[string]any `json:"filters"`
}

type createEdgeRequest struct {
	FromID  string         `json:"from_id"`
	ToID    string         `json:"to_id"`
	RelType string         `json:"rel_type"`
	Data    map[string]any `json:"data"`
}

func NewResourceGraphHandler(service resource_graph.Service) *ResourceGraphHandler {
	return &ResourceGraphHandler{service: service}
}

func (h *ResourceGraphHandler) ListTypes(c *gin.Context) {
	items, err := h.service.ListTypes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list resource types", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items}})
}

func (h *ResourceGraphHandler) CreateType(c *gin.Context) {
	var req createTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	item, err := h.service.CreateType(c.Request.Context(), resource_graph.CreateTypeInput{
		Name:          req.Name,
		DisplayName:   req.DisplayName,
		Category:      req.Category,
		Icon:          req.Icon,
		Schema:        req.Schema,
		IdentityRules: req.IdentityRules,
		Builtin:       req.Builtin,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create resource type", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": item})
}

func (h *ResourceGraphHandler) GetType(c *gin.Context) {
	name := strings.TrimSpace(c.Param("name"))
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Type name is required"})
		return
	}

	item, err := h.service.GetType(c.Request.Context(), name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Resource type not found", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": item})
}

func (h *ResourceGraphHandler) CreateResource(c *gin.Context) {
	var req createResourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	item, err := h.service.CreateResource(c.Request.Context(), resource_graph.CreateResourceInput{
		TypeName: req.TypeName,
		Name:     req.Name,
		Spec:     req.Spec,
		Status:   req.Status,
		Labels:   req.Labels,
		Source:   req.Source,
		SourceID: req.SourceID,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create resource", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": item})
}

func (h *ResourceGraphHandler) BatchUpsertResources(c *gin.Context) {
	var req batchUpsertResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	result, err := h.service.BatchUpsertResources(c.Request.Context(), resource_graph.BatchUpsertInput{
		TypeName: req.TypeName,
		Source:   req.Source,
		Items:    req.Items,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to batch upsert resources", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": result})
}

func (h *ResourceGraphHandler) SearchResources(c *gin.Context) {
	var req searchResourcesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	items, err := h.service.SearchResources(c.Request.Context(), resource_graph.SearchResourcesInput{
		TypeName: req.TypeName,
		Source:   req.Source,
		Filters:  req.Filters,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to search resources", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items}})
}

func (h *ResourceGraphHandler) CreateEdge(c *gin.Context) {
	var req createEdgeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	item, err := h.service.CreateEdge(c.Request.Context(), resource_graph.CreateEdgeInput{
		FromID:  req.FromID,
		ToID:    req.ToID,
		RelType: req.RelType,
		Data:    req.Data,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to create edge", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "data": item})
}

func (h *ResourceGraphHandler) ListResourceEdges(c *gin.Context) {
	resourceID := strings.TrimSpace(c.Param("id"))
	if resourceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Resource ID is required"})
		return
	}

	items, err := h.service.ListResourceEdges(c.Request.Context(), resourceID, c.Query("rel_type"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to list resource edges", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items}})
}

func (h *ResourceGraphHandler) ListEvents(c *gin.Context) {
	items, err := h.service.ListEvents(c.Request.Context(), resource_graph.ListEventsInput{
		ResourceID: c.Query("resource_id"),
		EventType:  c.Query("event_type"),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to list events", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"items": items}})
}
