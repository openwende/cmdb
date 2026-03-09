package server

import (
	"github.com/gin-gonic/gin"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/core/instance"
)

func RegisterInstanceAggregateRoutes(router *gin.Engine, dynamicModelService *dynamic_model.Service) {
	aggregateService := instance.NewAggregateService(dynamicModelService.DB(), dynamicModelService)
	handler := handlers.NewInstanceAggregateHandler(aggregateService)
	dynamicHandler := handlers.NewDynamicModelHandler(dynamicModelService)

	v1 := router.Group("/api/v1/instances")
	{
		v1.GET("", handler.ListInstances)
		v1.GET("/:instanceKey/relation-capabilities", dynamicHandler.GetAggregateInstanceRelationCapabilities)
		v1.GET("/:instanceKey", handler.GetInstance)
	}
}
