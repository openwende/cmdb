package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/business_custom_field"
	"github.com/wend/cmdb-backend/internal/types"
)

type BusinessCustomFieldHandler struct {
	service *business_custom_field.Service
}

func NewBusinessCustomFieldHandler(service *business_custom_field.Service) *BusinessCustomFieldHandler {
	return &BusinessCustomFieldHandler{service: service}
}

func (h *BusinessCustomFieldHandler) ListCustomFields(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	objectType := c.Query("object_type")
	groups, err := h.service.ListGroups(c.Request.Context(), businessID, objectType)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"groups": groups}})
}

func (h *BusinessCustomFieldHandler) CreateGroup(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	var req types.BusinessCustomFieldGroupPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	group, err := h.service.CreateGroup(c.Request.Context(), businessID, &req, c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": group})
}

func (h *BusinessCustomFieldHandler) UpdateGroup(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	groupID, err := strconv.ParseUint(c.Param("group_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	var req types.BusinessCustomFieldGroupPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	group, err := h.service.UpdateGroup(c.Request.Context(), businessID, groupID, &req, c.GetHeader("X-User-ID"))
	if err != nil {
		status := http.StatusBadRequest
		if err == gorm.ErrRecordNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": group})
}

func (h *BusinessCustomFieldHandler) DeleteGroup(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	groupID, err := strconv.ParseUint(c.Param("group_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid group id"})
		return
	}
	if err := h.service.DeleteGroup(c.Request.Context(), businessID, groupID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
}

func (h *BusinessCustomFieldHandler) CreateField(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	var req types.BusinessCustomFieldPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	field, err := h.service.CreateField(c.Request.Context(), businessID, &req, c.GetHeader("X-User-ID"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": field})
}

func (h *BusinessCustomFieldHandler) UpdateField(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	fieldID, err := strconv.ParseUint(c.Param("field_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field id"})
		return
	}
	var req types.BusinessCustomFieldPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	field, err := h.service.UpdateField(c.Request.Context(), businessID, fieldID, &req, c.GetHeader("X-User-ID"))
	if err != nil {
		status := http.StatusBadRequest
		if err == gorm.ErrRecordNotFound {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": field})
}

func (h *BusinessCustomFieldHandler) DeleteField(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	fieldID, err := strconv.ParseUint(c.Param("field_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid field id"})
		return
	}
	if err := h.service.DeleteField(c.Request.Context(), businessID, fieldID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
}

func (h *BusinessCustomFieldHandler) GetFormSchema(c *gin.Context) {
	businessID, ok := parseBusinessUUID(c)
	if !ok {
		return
	}
	schema, err := h.service.GetFormSchema(c.Request.Context(), businessID, c.Param("object_type"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": schema})
}

func parseBusinessUUID(c *gin.Context) (uuid.UUID, bool) {
	businessID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid business id"})
		return uuid.Nil, false
	}
	return businessID, true
}
