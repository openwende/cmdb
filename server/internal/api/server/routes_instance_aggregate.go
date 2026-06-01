package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/core/instance"
)

func RegisterInstanceAggregateRoutes(router *gin.Engine, dynamicModelService dynamic_model.Service, db *gorm.DB) {
	aggregateService := instance.NewAggregateService(db, dynamicModelService)
	handler := handlers.NewInstanceAggregateHandler(aggregateService)
	dynamicHandler := handlers.NewDynamicModelHandler(dynamicModelService, db)

	v1 := router.Group("/api/v1/instances")
	{
		v1.GET("", handler.ListInstances)
		v1.GET("/statistics", handler.GetInstanceStatistics) // 运营概览实例分布图聚合数据
		v1.GET("/:instanceKey/relation-capabilities", dynamicHandler.GetAggregateInstanceRelationCapabilities)
		v1.GET("/:instanceKey", handler.GetInstance)
	}
}
