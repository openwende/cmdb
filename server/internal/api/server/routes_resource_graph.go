package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/api/handlers"
	"github.com/openwende/cmdb-server/internal/core/resource_graph"
)

func RegisterResourceGraphRoutes(router *gin.Engine, db *gorm.DB) {
	service := resource_graph.NewService(db)
	handler := handlers.NewResourceGraphHandler(service)

	v2 := router.Group("/api/v2")
	{
		v2.GET("/types", handler.ListTypes)
		v2.POST("/types", handler.CreateType)
		v2.GET("/types/:name", handler.GetType)

		v2.POST("/resources", handler.CreateResource)
		v2.POST("/resources/batch", handler.BatchUpsertResources)
		v2.POST("/resources/search", handler.SearchResources)
		v2.GET("/resources/:id/edges", handler.ListResourceEdges)

		v2.POST("/edges", handler.CreateEdge)
		v2.GET("/events", handler.ListEvents)
	}
}
