package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/dynamic_group"
	"github.com/wend/cmdb-backend/internal/types"
)

type DynamicGroupHandler struct {
	service *dynamic_group.Service
}

func NewDynamicGroupHandler(service *dynamic_group.Service) *DynamicGroupHandler {
	return &DynamicGroupHandler{service: service}
}

type DynamicGroupUpsertRequest struct {
	Name              string                             `json:"name" binding:"required"`
	BKObjID           string                             `json:"bk_obj_id" binding:"required"`
	TargetModelUID    string                             `json:"target_model_uid,omitempty"`
	Condition         []types.DynamicGroupConditionGroup `json:"condition"`
	VariableCondition []types.DynamicGroupConditionGroup `json:"variable_condition"`
	Description       string                             `json:"description"`
}

type DynamicGroupPreviewRequest struct {
	BKObjID           string                             `json:"bk_obj_id" binding:"required"`
	TargetModelUID    string                             `json:"target_model_uid,omitempty"`
	Condition         []types.DynamicGroupConditionGroup `json:"condition"`
	VariableCondition []types.DynamicGroupConditionGroup `json:"variable_condition"`
	Limit             int                                `json:"limit"`
}

func (h *DynamicGroupHandler) List(c *gin.Context) {
	businessID, ok := parseBusinessID(c)
	if !ok {
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	items, total, err := h.service.List(
		c.Request.Context(),
		businessID,
		c.Query("target"),
		c.Query("keyword"),
		limit,
		offset,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items":  items,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (h *DynamicGroupHandler) Get(c *gin.Context) {
	businessID, ok := parseBusinessID(c)
	if !ok {
		return
	}
	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	item, err := h.service.Get(c.Request.Context(), businessID, groupID)
	if err != nil {
		status := http.StatusInternalServerError
		if err == gorm.ErrRecordNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": item})
}

func (h *DynamicGroupHandler) Create(c *gin.Context) {
	businessID, ok := parseBusinessID(c)
	if !ok {
		return
	}
	var req DynamicGroupUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.service.Create(c.Request.Context(), businessID, &dynamic_group.CreateDynamicGroupInput{
		Name:              req.Name,
		TargetModelUID:    firstNonEmpty(req.TargetModelUID, req.BKObjID),
		Condition:         req.Condition,
		VariableCondition: req.VariableCondition,
		Description:       req.Description,
		CreatedBy:         c.GetHeader("X-User-ID"),
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": item})
}

func (h *DynamicGroupHandler) Update(c *gin.Context) {
	businessID, ok := parseBusinessID(c)
	if !ok {
		return
	}
	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	var req DynamicGroupUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	item, err := h.service.Update(c.Request.Context(), businessID, groupID, &dynamic_group.UpdateDynamicGroupInput{
		Name:              req.Name,
		TargetModelUID:    firstNonEmpty(req.TargetModelUID, req.BKObjID),
		Condition:         req.Condition,
		VariableCondition: req.VariableCondition,
		Description:       req.Description,
		UpdatedBy:         c.GetHeader("X-User-ID"),
	})
	if err != nil {
		status := http.StatusBadRequest
		if err == gorm.ErrRecordNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": item})
}

func (h *DynamicGroupHandler) Delete(c *gin.Context) {
	businessID, ok := parseBusinessID(c)
	if !ok {
		return
	}
	groupID, err := uuid.Parse(c.Param("group_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	if err := h.service.Delete(c.Request.Context(), businessID, groupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
}

func (h *DynamicGroupHandler) Meta(c *gin.Context) {
	if _, ok := parseBusinessID(c); !ok {
		return
	}
	data, err := h.service.GetMeta(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": data})
}

func (h *DynamicGroupHandler) Preview(c *gin.Context) {
	businessID, ok := parseBusinessID(c)
	if !ok {
		return
	}
	var req DynamicGroupPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	items, total, err := h.service.Preview(
		c.Request.Context(),
		businessID,
		firstNonEmpty(req.TargetModelUID, req.BKObjID),
		req.Condition,
		req.VariableCondition,
		req.Limit,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"items": items, "total": total}})
}

func parseBusinessID(c *gin.Context) (uuid.UUID, bool) {
	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid business id"})
		return uuid.Nil, false
	}
	return businessID, true
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
