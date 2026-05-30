package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/core/business"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"
)

type BusinessHandler struct {
	service business.Service
}

func NewBusinessHandler(service business.Service) *BusinessHandler {
	return &BusinessHandler{service: service}
}

// SetTopologyInitializer wires the topology initializer into the business service.
// Called from server setup after both services are constructed.
func (h *BusinessHandler) SetTopologyInitializer(fn business.TopologyInitializer) {
	h.service.SetTopologyInitializer(fn)
}

// CreateBusiness handles business creation
func (h *BusinessHandler) CreateBusiness(c *gin.Context) {
	var req types.CreateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	// Basic validation
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business name is required"})
		return
	}

	if len(req.Name) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business name must be less than 100 characters"})
		return
	}

	if req.Description != nil && len(*req.Description) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business description must be less than 500 characters"})
		return
	}

	business, err := h.service.CreateBusiness(c.Request.Context(), &req)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    business,
		"message": "Business created successfully",
	})
}

// ListBusinesses handles listing businesses with pagination
func (h *BusinessHandler) ListBusinesses(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	tenantID := types.SystemTenantID

	businesses, total, err := h.service.ListBusinesses(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":  businesses,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// GetBusiness handles retrieving a single business
func (h *BusinessHandler) GetBusiness(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
		return
	}
	businessID, err := strconv.ParseUint(id, 10, 64)
	if err != nil || businessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
		return
	}

	tenantID := types.SystemTenantID

	business, err := h.service.GetBusiness(c.Request.Context(), tenantID, businessID)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    business,
	})
}

// UpdateBusiness handles updating a business
func (h *BusinessHandler) UpdateBusiness(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
		return
	}
	businessID, err := strconv.ParseUint(id, 10, 64)
	if err != nil || businessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
		return
	}

	var req types.UpdateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business name cannot be empty"})
		return
	}

	tenantID := types.SystemTenantID

	business, err := h.service.UpdateBusiness(c.Request.Context(), tenantID, businessID, &req)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    business,
		"message": "Business updated successfully",
	})
}

// DeleteBusiness handles deleting a business
func (h *BusinessHandler) DeleteBusiness(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
		return
	}
	businessID, err := strconv.ParseUint(id, 10, 64)
	if err != nil || businessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
		return
	}

	tenantID := types.SystemTenantID

	err = h.service.DeleteBusiness(c.Request.Context(), tenantID, businessID)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Business deleted successfully",
	})
}

// CreateBusinessSet handles business set creation
func (h *BusinessHandler) CreateBusinessSet(c *gin.Context) {
	var req types.CreateBusinessSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set name is required"})
		return
	}
	if req.BusinessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "BusinessID is required"})
		return
	}

	businessSet, err := h.service.CreateBusinessSet(c.Request.Context(), &req)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    businessSet,
		"message": "Business set created successfully",
	})
}

// GetBusinessSet handles retrieving a single business set
func (h *BusinessHandler) GetBusinessSet(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set ID is required"})
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business set ID format"})
		return
	}

	tenantID := types.SystemTenantID

	businessSet, err := h.service.GetBusinessSet(c.Request.Context(), tenantID, id)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    businessSet,
	})
}

// ListBusinessSets handles listing business sets with pagination
func (h *BusinessHandler) ListBusinessSets(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	tenantID := types.SystemTenantID

	businessSets, total, err := h.service.ListBusinessSets(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":  businessSets,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

// UpdateBusinessSet handles updating a business set
func (h *BusinessHandler) UpdateBusinessSet(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set ID is required"})
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business set ID format"})
		return
	}

	var req types.UpdateBusinessSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set name cannot be empty"})
		return
	}

	tenantID := types.SystemTenantID

	businessSet, err := h.service.UpdateBusinessSet(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    businessSet,
		"message": "Business set updated successfully",
	})
}

// DeleteBusinessSet handles deleting a business set
func (h *BusinessHandler) DeleteBusinessSet(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set ID is required"})
		return
	}
	if _, err := uuid.Parse(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business set ID format"})
		return
	}

	tenantID := types.SystemTenantID

	err := h.service.DeleteBusinessSet(c.Request.Context(), tenantID, id)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Business set deleted successfully",
	})
}

// AddBusinessToSet handles adding a business to a business set
func (h *BusinessHandler) AddBusinessToSet(c *gin.Context) {
	businessSetID := c.Param("id")
	if businessSetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set ID is required"})
		return
	}
	businessSetUUID, err := uuid.Parse(businessSetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business set ID format"})
		return
	}

	var req types.AddBusinessToSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	if req.BusinessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
		return
	}

	err = h.service.AddBusinessToSet(c.Request.Context(), businessSetUUID, &req)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Business added to set successfully",
	})
}

// RemoveBusinessFromSet handles removing a business from a business set
func (h *BusinessHandler) RemoveBusinessFromSet(c *gin.Context) {
	businessSetID := c.Param("id")
	businessID := c.Param("business_id")

	if businessSetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set ID is required"})
		return
	}
	if businessID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
		return
	}

	businessSetUUID, err := uuid.Parse(businessSetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business set ID format"})
		return
	}

	bizID, err := strconv.ParseUint(businessID, 10, 64)
	if err != nil || bizID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
		return
	}

	err = h.service.RemoveBusinessFromSet(c.Request.Context(), businessSetUUID, bizID)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Business removed from set successfully",
	})
}

// ListBusinessSetMembers handles listing all businesses in a business set
func (h *BusinessHandler) ListBusinessSetMembers(c *gin.Context) {
	businessSetID := c.Param("id")
	if businessSetID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business set ID is required"})
		return
	}

	businessSetUUID, err := uuid.Parse(businessSetID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business set ID format"})
		return
	}

	members, err := h.service.ListBusinessSetMembers(c.Request.Context(), businessSetUUID)
	if err != nil {
		status := apperrors.HTTPStatus(err)
		c.JSON(status, apperrors.NewErrorResponse(err, ""))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"business_ids": members,
			"count":        len(members),
		},
	})
}
