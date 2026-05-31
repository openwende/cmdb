package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/host_membership"
	"github.com/wend/cmdb-backend/internal/core/process"
	"github.com/wend/cmdb-backend/internal/core/resource_directory"
	"github.com/wend/cmdb-backend/internal/core/service_template"
)

// RegisterProcessRoutes 注册进程管理相关路由
func RegisterProcessRoutes(router *gin.Engine, db *gorm.DB) {
	processService := process.NewService(db)
	handler := handlers.NewProcessHandler(processService)

	v1 := router.Group("/api/v1")
	{
		// 进程模板
		processTemplates := v1.Group("/process-templates")
		{
			processTemplates.POST("", handler.CreateProcessTemplate)
			processTemplates.GET("", handler.ListProcessTemplates)
			processTemplates.GET("/:id", handler.GetProcessTemplate)
			processTemplates.PUT("/:id", handler.UpdateProcessTemplate)
			processTemplates.DELETE("/:id", handler.DeleteProcessTemplate)
		}

		// 进程实例
		processes := v1.Group("/processes")
		{
			processes.POST("", handler.CreateProcess)
			processes.GET("", handler.ListProcesses)
			processes.POST("/batch", handler.BatchCreateProcesses)
			processes.GET("/:id", handler.GetProcess)
			processes.PUT("/:id", handler.UpdateProcess)
			processes.DELETE("/:id", handler.DeleteProcess)
			processes.POST("/:id/status", handler.UpdateProcessStatus)
		}

		// 主机进程
		v1.GET("/hosts/:id/processes", handler.ListHostProcessesWithStatus)

		// 模块进程摘要
		v1.GET("/modules/:id/process-summary", handler.GetModuleProcessSummary)
	}
}

// RegisterServiceTemplateRoutes 注册服务模板相关路由
func RegisterServiceTemplateRoutes(router *gin.Engine, db *gorm.DB) {
	templateService := service_template.NewService(db)
	handler := handlers.NewServiceTemplateHandler(templateService)

	v1 := router.Group("/api/v1")
	{
		// 服务模板
		serviceTemplates := v1.Group("/service-templates")
		{
			serviceTemplates.POST("", handler.CreateServiceTemplate)
			serviceTemplates.GET("", handler.ListServiceTemplates)
			serviceTemplates.GET("/:id", handler.GetServiceTemplate)
			serviceTemplates.PUT("/:id", handler.UpdateServiceTemplate)
			serviceTemplates.DELETE("/:id", handler.DeleteServiceTemplate)
			serviceTemplates.POST("/:id/process-templates", handler.AddProcessTemplate)
			serviceTemplates.DELETE("/:id/process-templates/:ptid", handler.RemoveProcessTemplate)
			serviceTemplates.POST("/:id/create-module", handler.CreateModuleFromTemplate)
			serviceTemplates.POST("/:id/sync", handler.SyncModules)
		}

		// 集群模板
		setTemplates := v1.Group("/set-templates")
		{
			setTemplates.POST("", handler.CreateSetTemplate)
			setTemplates.GET("", handler.ListSetTemplates)
			setTemplates.GET("/:id", handler.GetSetTemplate)
			setTemplates.DELETE("/:id", handler.DeleteSetTemplate)
			setTemplates.POST("/:id/create-set", handler.CreateSetFromTemplate)
		}
	}
}

// RegisterResourcePoolRoutes 注册资源池相关路由
func RegisterResourcePoolRoutes(router *gin.Engine, db *gorm.DB) {
	// 阶段 1：主机归属统一通道（双写旧三表过渡），注入使 allocate/reclaim 走它并停写 v2 投影（修 R1，配合空闲机读路径改造修 R7）
	hms := host_membership.NewService(db, host_membership.NewResourceHistoryAuditRecorder(), host_membership.WithLegacyMirror())
	dirService := resource_directory.NewService(db, resource_directory.WithHostMembership(hms))
	handler := handlers.NewResourceDirectoryHandler(dirService)

	v1 := router.Group("/api/v1/resource-pool")
	{
		// 资源目录
		directories := v1.Group("/directories")
		{
			directories.POST("", handler.CreateDirectory)
			directories.GET("", handler.ListDirectories)
			directories.GET("/tree", handler.GetDirectoryTree)
			directories.GET("/:id", handler.GetDirectory)
			directories.PUT("/:id", handler.UpdateDirectory)
			directories.DELETE("/:id", handler.DeleteDirectory)
			directories.POST("/:id/move", handler.MoveDirectory)
		}

		// 资源池主机
		hosts := v1.Group("/hosts")
		{
			hosts.GET("", handler.ListPoolHosts)
			hosts.GET("/:id/lifecycle", handler.GetHostLifecycle)
			hosts.POST("/import", handler.ImportHostsToPool)
			hosts.POST("/move", handler.MoveHostsInPool)
			hosts.POST("/allocate", handler.AllocateHosts)
			hosts.POST("/reclaim", handler.ReclaimHosts)
		}

		// 统计
		v1.GET("/statistics", handler.GetStatistics)
	}
}
