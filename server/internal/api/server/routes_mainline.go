package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/api/handlers"
	"github.com/openwende/cmdb/server/internal/core/mainline"
	"github.com/openwende/cmdb/server/internal/core/topology"
)

func RegisterMainlineRoutes(router *gin.Engine, db *gorm.DB) {
	mainlineService := mainline.NewService(db)
	topologyService := topology.NewService(db, mainlineService)
	handler := handlers.NewMainlineHandler(mainlineService, topologyService)

	v1 := router.Group("/api/v1/mainline")
	{
		v1.GET("/models", handler.ListModels)
		v1.POST("/models", handler.CreateModel)
		v1.PUT("/models/:uid", handler.UpdateModel)

		v1.GET("/tree", handler.GetTree)
		v1.GET("/settings/topology", handler.GetTopologySettings)

		nodes := v1.Group("/nodes")
		{
			nodes.POST("", handler.CreateNode)
			nodes.PUT("/:model_uid/:ref_id", handler.UpdateNode)
			nodes.DELETE("/:model_uid/:ref_id", handler.DeleteNode)
			nodes.POST("/:model_uid/:ref_id/move", handler.MoveNode)
		}
	}
}
