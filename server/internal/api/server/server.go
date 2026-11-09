package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/openwende/cmdb-server/internal/api/handlers"
	authn "github.com/openwende/cmdb-server/internal/auth"
	authcore "github.com/openwende/cmdb-server/internal/core/auth"
	"github.com/openwende/cmdb-server/internal/core/business"
	"github.com/openwende/cmdb-server/internal/core/dynamic_model"
	"github.com/openwende/cmdb-server/internal/core/instance"
	"github.com/openwende/cmdb-server/internal/core/model"
	"github.com/openwende/cmdb-server/internal/mcpserver"
	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/pkg/config"
)

type Server struct {
	config          *config.Config
	router          *gin.Engine
	httpServer      *http.Server
	businessHandler *handlers.BusinessHandler
	modelHandler    *handlers.ModelHandler
	instanceHandler *handlers.InstanceHandler
	authHandler     *handlers.AuthHandler
}

func NewServer(
	cfg *config.Config,
	businessService business.Service,
	modelService model.Service,
	instanceService instance.Service,
	db *storage.Database,
) *Server {
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.Default()

	// Create handlers
	businessHandler := handlers.NewBusinessHandler(businessService)
	modelHandler := handlers.NewModelHandler(modelService)
	instanceHandler := handlers.NewInstanceHandler(instanceService)
	authRepo := storage.NewAuthRepository(db.DB())
	jwtManager := authn.NewJWTManager(cfg.Auth.JWT)
	authService := authcore.NewService(authRepo, jwtManager)
	authHandler := handlers.NewAuthHandler(authService, jwtManager)

	s := &Server{
		config:          cfg,
		router:          router,
		businessHandler: businessHandler,
		modelHandler:    modelHandler,
		instanceHandler: instanceHandler,
		authHandler:     authHandler,
	}

	s.setupRoutes(db) // Pass db connection for health check
	return s
}

func (s *Server) setupRoutes(db *storage.Database) {
	// CORS middleware
	s.router.Use(func(c *gin.Context) {
		cfg := s.config.Server.CORS
		if cfg.Enabled {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*") // Simplify for now
			c.Writer.Header().Set("Access-Control-Allow-Credentials", "false")
			c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With, X-Tenant-ID")
			c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

			if c.Request.Method == http.MethodOptions {
				c.AbortWithStatus(http.StatusNoContent)
				return
			}
		}
		c.Next()
	})

	authMiddleware := authn.NewMiddleware(authn.NewJWTManager(s.config.Auth.JWT))
	s.router.Use(authMiddleware.ProtectAPI())

	// Health check
	s.router.GET("/health", func(c *gin.Context) {
		dbStatus := "Connected"
		status := "healthy"
		if err := db.Ping(); err != nil {
			dbStatus = "Error: " + err.Error()
			status = "unhealthy"
		}

		c.JSON(http.StatusOK, gin.H{
			"status":    status,
			"timestamp": time.Now(),
			"version":   "2.2.0-Refactored",
			"database":  "PostgreSQL (" + dbStatus + ")",
		})
	})

	// API v1
	v1 := s.router.Group("/api/v1")
	{
		authAPI := v1.Group("/auth")
		{
			authAPI.POST("/login", s.authHandler.Login)
			authAPI.GET("/me", s.authHandler.Me)
			adminAuthAPI := authAPI.Group("/users")
			adminAuthAPI.Use(authMiddleware.RequireAdmin())
			{
				adminAuthAPI.GET("", s.authHandler.ListUsers)
				adminAuthAPI.POST("", s.authHandler.CreateUser)
				adminAuthAPI.PUT("/:id", s.authHandler.UpdateUser)
				adminAuthAPI.PUT("/:id/password", s.authHandler.ResetPassword)
			}
		}

		// Business Domains
		businessAPI := v1.Group("/businesses")
		{
			businessAPI.POST("", s.businessHandler.CreateBusiness)
			businessAPI.GET("", s.businessHandler.ListBusinesses)
			businessAPI.GET("/:id", s.businessHandler.GetBusiness)
			businessAPI.PUT("/:id", s.businessHandler.UpdateBusiness)
			businessAPI.DELETE("/:id", s.businessHandler.DeleteBusiness)
		}

		businessSetAPI := v1.Group("/business-sets")
		{
			businessSetAPI.POST("", s.businessHandler.CreateBusinessSet)
			businessSetAPI.GET("", s.businessHandler.ListBusinessSets)
			businessSetAPI.GET("/:id", s.businessHandler.GetBusinessSet)
			businessSetAPI.PUT("/:id", s.businessHandler.UpdateBusinessSet)
			businessSetAPI.DELETE("/:id", s.businessHandler.DeleteBusinessSet)

			// Member management
			businessSetAPI.POST("/:id/members", s.businessHandler.AddBusinessToSet)
			businessSetAPI.GET("/:id/members", s.businessHandler.ListBusinessSetMembers)
			businessSetAPI.DELETE("/:id/members/:business_id", s.businessHandler.RemoveBusinessFromSet)
		}

		// Legacy/Compatible Routes (if needed) or redirection

		// ==========================
		// Dynamic Engine APIs
		// ==========================

		// Metadata API
		modelsAPI := v1.Group("/models")
		{
			modelsAPI.GET("/groups", s.modelHandler.ListModelGroups)
			modelsAPI.POST("/groups", s.modelHandler.CreateModelGroup)
			modelsAPI.GET("", s.modelHandler.ListModels)
			modelsAPI.POST("", s.modelHandler.CreateModel)
			modelsAPI.GET("/:name", s.modelHandler.GetModel)

			// Attributes
			modelsAPI.POST("/:name/attributes", s.modelHandler.CreateAttribute)

			// Generic Instance API under /models/:name/instances
			// e.g. GET /api/v1/models/host/instances
			instancesAPI := modelsAPI.Group("/:name/instances")
			{
				instancesAPI.POST("", s.instanceHandler.CreateInstance)
				instancesAPI.POST("/batch", s.instanceHandler.BatchCreateInstances)
				instancesAPI.GET("", s.instanceHandler.ListInstances)
				// TODO: GET /:id, PUT /:id
			}
		}
	}

	// ==========================
	// Host Management APIs (New)
	// ==========================
	// Register host and network space routes
	RegisterHostRoutes(s.router, db.DB())

	// ==========================
	// Dynamic Model APIs (New)
	// ==========================
	dynamicModelService := dynamic_model.NewService(db.DB())
	RegisterDynamicModelRoutes(s.router, dynamicModelService, db.DB())

	// ==========================
	// Import/Export APIs
	// ==========================
	uploadDir := "/tmp/cmdb-uploads" // 上传文件目录
	RegisterImportExportRoutes(s.router, db.DB(), uploadDir)

	// ==========================
	// Business Topology APIs
	// ==========================
	RegisterTopologyRoutesWithBusinessHandler(s.router, db.DB(), s.businessHandler)
	RegisterMainlineRoutes(s.router, db.DB())

	// ==========================
	// Process & Template APIs
	// ==========================
	RegisterProcessRoutes(s.router, db.DB())
	RegisterServiceTemplateRoutes(s.router, db.DB())
	RegisterServiceCategoryRoutes(s.router, db.DB())
	RegisterResourcePoolRoutes(s.router, db.DB())
	RegisterDynamicGroupRoutes(s.router, db.DB())
	RegisterBusinessCustomFieldRoutes(s.router, db.DB())
	RegisterResourceGraphRoutes(s.router, db.DB())

	// ==========================
	// Audit APIs
	// ==========================
	RegisterAuditRoutes(s.router, db.DB())

	// ==========================
	// MCP（Agent 工具）
	// ==========================
	// 挂在 /api 之外：ProtectAPI 要求 POST 必须是写角色，而 MCP 的只读调用也走 POST；
	// /mcp 自带 Bearer JWT 校验，任何已登录角色都可调用只读工具。
	s.router.Any("/mcp", gin.WrapH(mcpserver.NewHandler(db.DB(), authn.NewJWTManager(s.config.Auth.JWT))))
}

func (s *Server) Run() error {
	addr := s.config.Server.GetAddress()
	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	return s.httpServer.ListenAndServe()
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}
