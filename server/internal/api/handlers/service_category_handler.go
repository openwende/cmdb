package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/core/service_category"
)

type ServiceCategoryHandler struct {
	service *service_category.Service
}

func NewServiceCategoryHandler(service *service_category.Service) *ServiceCategoryHandler {
	return &ServiceCategoryHandler{service: service}
}

func (h *ServiceCategoryHandler) ListCategories(c *gin.Context) {
	businessID, err := uuid.Parse(c.Query("business_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的业务ID"})
		return
	}

	rows, err := h.service.ListCategories(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rows})
}
