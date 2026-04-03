package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/service_category"
)

func RegisterServiceCategoryRoutes(router *gin.Engine, db *gorm.DB) {
	service := service_category.NewService(db)
	handler := handlers.NewServiceCategoryHandler(service)

	v1 := router.Group("/api/v1")
	{
		v1.GET("/service-categories", handler.ListCategories)
	}
}
