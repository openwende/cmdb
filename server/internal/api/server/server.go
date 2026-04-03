package server

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/wend/cmdb-backend/internal/api/handlers"
	"github.com/wend/cmdb-backend/internal/core/business"
	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/core/instance"
	"github.com/wend/cmdb-backend/internal/core/model"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/pkg/config"
)

type Server struct {
	config          *config.Config
	router          *gin.Engine
	httpServer      *http.Server
	businessHandler *handlers.BusinessHandler
	modelHandler    *handlers.ModelHandler
	instanceHandler *handlers.InstanceHandler
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

	s := &Server{
		config:          cfg,
		router:          router,
		businessHandler: businessHandler,
		modelHandler:    modelHandler,
		instanceHandler: instanceHandler,
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
	RegisterDynamicModelRoutes(s.router, dynamicModelService)

	// ==========================
	// Import/Export APIs
	// ==========================
	uploadDir := "/tmp/cmdb-uploads" // 上传文件目录
	RegisterImportExportRoutes(s.router, db.DB(), uploadDir)

	// ==========================
	// Business Topology APIs
	// ==========================
	RegisterTopologyRoutes(s.router, db.DB())
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
