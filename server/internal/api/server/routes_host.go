package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/cloud_area"
	"github.com/wend/cmdb-backend/internal/core/host"
	"github.com/wend/cmdb-backend/internal/storage"
)

// RegisterHostRoutes 注册主机相关路由（包括云区域）
func RegisterHostRoutes(router *gin.Engine, db *gorm.DB) {
	// 创建 Repository
	hostRepo := storage.NewHostRepository(db)
	cloudAreaRepo := storage.NewCloudAreaRepository(db)

	// 创建 Service
	hostService := host.NewService(hostRepo, cloudAreaRepo, host.WithAuditRecorder(host.NewResourceHistoryAuditRecorder(db)))
	cloudAreaService := cloud_area.NewService(cloudAreaRepo)

	// 创建 Handler
	hostHandler := handlers.NewHostHandler(hostService)
	cloudAreaHandler := handlers.NewCloudAreaHandler(cloudAreaService)

	// API v1 路由组
	v1 := router.Group("/api/v1")
	{
		// 云区域路由（替换原来的网络空间）
		cloudAreas := v1.Group("/cloud-areas")
		{
			cloudAreas.POST("", cloudAreaHandler.CreateCloudArea)
			cloudAreas.GET("", cloudAreaHandler.ListCloudAreas)
			cloudAreas.GET("/default", cloudAreaHandler.GetDefaultCloudArea) // 获取默认云区域
			cloudAreas.GET("/:id", cloudAreaHandler.GetCloudArea)
			cloudAreas.PUT("/:id", cloudAreaHandler.UpdateCloudArea)
			cloudAreas.DELETE("/:id", cloudAreaHandler.DeleteCloudArea)
		}

		// 主机路由
		hosts := v1.Group("/hosts")
		{
			hosts.POST("", hostHandler.CreateHost)
			hosts.POST("/batch", hostHandler.BatchImportHosts) // 批量导入
			hosts.GET("", hostHandler.ListHosts)
			hosts.GET("/statistics", hostHandler.GetHostStatistics) // 运营概览分布图聚合数据
			hosts.GET("/:id", hostHandler.GetHost)
			hosts.PUT("/:id", hostHandler.UpdateHost)
			hosts.PUT("/:id/custom-fields", hostHandler.UpdateHostCustomFields)
			hosts.DELETE("/:id", hostHandler.DeleteHost)
		}
	}
}
