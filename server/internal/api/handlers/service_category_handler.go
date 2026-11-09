package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/openwende/cmdb-server/internal/core/service_category"
)

type ServiceCategoryHandler struct {
	service service_category.Service
}

func NewServiceCategoryHandler(service service_category.Service) *ServiceCategoryHandler {
	return &ServiceCategoryHandler{service: service}
}

func (h *ServiceCategoryHandler) ListCategories(c *gin.Context) {
	businessID, err := strconv.ParseUint(c.Query("business_id"), 10, 64)
	if err != nil || businessID == 0 {
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
