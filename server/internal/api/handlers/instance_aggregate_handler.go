package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/core/instance"
)

type InstanceAggregateHandler struct {
	service *instance.AggregateService
}

func NewInstanceAggregateHandler(service *instance.AggregateService) *InstanceAggregateHandler {
	return &InstanceAggregateHandler{service: service}
}

func (h *InstanceAggregateHandler) GetInstance(c *gin.Context) {
	view, err := h.service.GetAggregateInstance(c.Request.Context(), c.Param("instanceKey"))
	if err != nil {
		switch {
		case errors.Is(err, instance.ErrInvalidInstanceKey):
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的实例标识"})
		case isDynamicResourceNotFound(err):
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": view,
	})
}

func (h *InstanceAggregateHandler) ListInstances(c *gin.Context) {
	modelUID := c.Query("model_uid")
	if modelUID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 model_uid 参数"})
		return
	}

	page, pageSize := parsePaginationParams(c, 20, 100)
	items, total, err := h.service.ListAggregateInstances(c.Request.Context(), modelUID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": items,
			"pagination": gin.H{
				"page":       page,
				"page_size":  pageSize,
				"total":      total,
				"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
			},
		},
	})
}

func isDynamicResourceNotFound(err error) bool {
	var target *dynamic_model.ResourceNotFoundError
	return errors.As(err, &target)
}
