package server

import (
	"github.com/gin-gonic/gin"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
)

// RegisterDynamicModelRoutes 注册动态模型路由
// 接收已创建的 Service 实例，保持 DI 风格一致
func RegisterDynamicModelRoutes(router *gin.Engine, service *dynamic_model.Service) {
	handler := handlers.NewDynamicModelHandler(service)

	// API v1 路由组
	v1 := router.Group("/api/v1")
	{
		// ========== 模型管理 ==========
		modelsAPI := v1.Group("/dynamic-models")
		{
			modelsAPI.POST("", handler.CreateModel)        // 创建模型
			modelsAPI.GET("", handler.ListModels)          // 列出所有模型
			modelsAPI.GET("/:uid", handler.GetModel)       // 获取模型详情
			modelsAPI.PUT("/:uid", handler.UpdateModel)    // 更新模型
			modelsAPI.DELETE("/:uid", handler.DeleteModel) // 删除模型

			// ========== 属性管理 ==========
			modelsAPI.POST("/:uid/attributes", handler.CreateAttribute)              // 创建属性
			modelsAPI.GET("/:uid/attributes", handler.ListAttributes)                // 列出属性
			modelsAPI.PUT("/:uid/attributes/:field_uid", handler.UpdateAttribute)    // 更新属性
			modelsAPI.DELETE("/:uid/attributes/:field_uid", handler.DeleteAttribute) // 删除属性

			// ========== 资源实例管理 ==========
			instancesAPI := modelsAPI.Group("/:uid/instances")
			{
				instancesAPI.POST("", handler.UpsertInstance)       // 创建/更新实例
				instancesAPI.GET("", handler.ListInstances)         // 列出实例
				instancesAPI.GET("/:id", handler.GetInstance)       // 获取实例详情
				instancesAPI.DELETE("/:id", handler.DeleteInstance) // 删除实例

				// 实例关联关系
				instancesAPI.GET("/:id/relations", handler.ListRelations)    // 查询关联关系
				instancesAPI.GET("/:id/topology", handler.GetTopology)       // 查询拓扑关系
				instancesAPI.GET("/:id/history", handler.GetResourceHistory) // 查询变更历史
			}
		}

		// ========== 关联关系管理（独立路由）==========
		relationsAPI := v1.Group("/dynamic-models/relations")
		{
			relationsAPI.POST("", handler.CreateRelation)       // 创建关联
			relationsAPI.DELETE("/:id", handler.DeleteRelation) // 删除关联
		}
	}
}
