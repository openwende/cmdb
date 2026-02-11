package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/topology"
)

// RegisterTopologyRoutes 注册业务拓扑路由
func RegisterTopologyRoutes(router *gin.Engine, db *gorm.DB) {
	// 创建服务
	service := topology.NewService(db)
	handler := handlers.NewTopologyHandler(service)

	// API v1 路由组
	v1 := router.Group("/api/v1/topology")
	{
		// ========== 拓扑树 ==========
		v1.GET("/tree", handler.GetTopologyTree)                           // 获取拓扑树
		v1.GET("/nodes/:type/:id/children", handler.GetNodeChildren)       // 获取节点子节点（懒加载）
		v1.GET("/statistics", handler.GetStatistics)                       // 获取统计信息

		// ========== 集群（Set）==========
		setsAPI := v1.Group("/sets")
		{
			setsAPI.POST("", handler.CreateSet)           // 创建集群
			setsAPI.GET("", handler.ListSets)             // 列出集群（需要 business_id）
			setsAPI.GET("/:id", handler.GetSet)           // 获取集群详情
			setsAPI.PUT("/:id", handler.UpdateSet)        // 更新集群
			setsAPI.DELETE("/:id", handler.DeleteSet)     // 删除集群
			setsAPI.POST("/:id/move", handler.MoveSet)    // 移动集群到另一个业务
		}

		// ========== 模块（Module）==========
		modulesAPI := v1.Group("/modules")
		{
			modulesAPI.POST("", handler.CreateModule)                // 创建模块
			modulesAPI.GET("", handler.ListModules)                  // 列出模块（需要 set_id 或 business_id）
			modulesAPI.GET("/:id", handler.GetModule)                // 获取模块详情
			modulesAPI.PUT("/:id", handler.UpdateModule)             // 更新模块
			modulesAPI.DELETE("/:id", handler.DeleteModule)          // 删除模块
			modulesAPI.POST("/:id/move", handler.MoveModule)         // 移动模块到另一个集群
			modulesAPI.GET("/:id/hosts", handler.GetModuleHosts)     // 获取模块下的主机
		}

		// ========== 主机转移 ==========
		hostsAPI := v1.Group("/hosts")
		{
			hostsAPI.POST("/transfer", handler.TransferHosts)              // 转移主机到目标模块
			hostsAPI.POST("/transfer-to-pool", handler.TransferHostsToPool) // 转移主机到资源池
		}

		// ========== 业务拓扑初始化 ==========
		businessesAPI := v1.Group("/businesses")
		{
			businessesAPI.POST("/:id/initialize", handler.InitializeBusinessTopology) // 初始化业务拓扑
		}
	}
}
