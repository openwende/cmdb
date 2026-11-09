package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/api/handlers"
	"github.com/openwende/cmdb/server/internal/core/dynamic_group"
)

func RegisterDynamicGroupRoutes(router *gin.Engine, db *gorm.DB) {
	service := dynamic_group.NewService(db)
	handler := handlers.NewDynamicGroupHandler(service)

	v1 := router.Group("/api/v1/businesses")
	{
		groupsAPI := v1.Group("/:id/dynamic-groups")
		{
			groupsAPI.GET("", handler.List)
			groupsAPI.POST("", handler.Create)
			groupsAPI.GET("/meta", handler.Meta)
			groupsAPI.POST("/preview", handler.Preview)
			groupsAPI.GET("/:group_id", handler.Get)
			groupsAPI.PUT("/:group_id", handler.Update)
			groupsAPI.DELETE("/:group_id", handler.Delete)
		}
	}
}
