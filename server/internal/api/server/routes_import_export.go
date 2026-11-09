package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/api/handlers"
	"github.com/openwende/cmdb/server/internal/core/dynamic_model"
)

// RegisterImportExportRoutes 注册导入导出路由
func RegisterImportExportRoutes(router *gin.Engine, db *gorm.DB, uploadDir string) {
	// 创建服务
	service := dynamic_model.NewService(db)
	handler := handlers.NewImportExportHandler(service, uploadDir)

	// API v1 路由组
	v1 := router.Group("/api/v1")
	{
		// 为每个模型提供导入导出功能
		v1.GET("/dynamic-models/:uid/template", handler.DownloadTemplate)           // 下载导入模板
		v1.GET("/dynamic-models/:uid/template-info", handler.GetTemplateInfo)       // 获取模板信息
		v1.POST("/dynamic-models/:uid/import", handler.UploadAndImport)             // 上传并导入
		v1.POST("/dynamic-models/:uid/validate-template", handler.ValidateTemplate) // 验证模板
		v1.GET("/dynamic-models/:uid/export", handler.ExportData)                   // 导出数据
		v1.GET("/dynamic-models/:uid/import-guide", handler.DownloadImportGuide)    // 下载导入指南
	}
}
