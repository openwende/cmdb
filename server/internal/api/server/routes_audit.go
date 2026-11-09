package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/api/handlers"
	auditcore "github.com/openwende/cmdb-server/internal/core/audit"
	"github.com/openwende/cmdb-server/internal/storage"
)

// RegisterAuditRoutes 注册审计日志路由
func RegisterAuditRoutes(router *gin.Engine, db *gorm.DB) {
	repo := storage.NewAuditRepository(db)
	service := auditcore.NewService(repo)
	handler := handlers.NewAuditHandler(service)

	v1 := router.Group("/api/v1")
	{
		v1.GET("/audit", handler.ListAuditLogs)
		v1.GET("/audit/:id", handler.GetAuditLog)
	}
}
