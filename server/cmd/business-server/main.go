package main

import (
    "fmt"
    "log"
    "net/http"
    "strconv"
    "strings"
    "time"

    "github.com/wend/cmdb-backend/internal/core/business"
    "github.com/wend/cmdb-backend/internal/storage"
    "github.com/wend/cmdb-backend/internal/types"
    "github.com/wend/cmdb-backend/pkg/config"

    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
)

// BusinessServer HTTP服务器
type BusinessServer struct {
	businessService business.Service
}

func main() {
	// 从环境变量或配置加载数据库配置（优先环境变量）
	cfg, err := config.Load("")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	database, err := storage.NewDatabase(&cfg.Database)
	mockMode := false
	var businessService business.Service
	if err != nil {
		log.Printf("Warning: Failed to connect to database: %v", err)
		log.Println("Starting in mock mode without database")
		businessService = business.NewMockService() // We'll need to implement this
		mockMode = true
	} else {
		defer func() { _ = database.Close() }()
		// 初始化仓储层和核心服务
		gormDB := database.DB()
		businessRepo := storage.NewBusinessRepository(gormDB)
		businessSetRepo := storage.NewBusinessSetRepository(gormDB)
		businessService = business.NewService(businessRepo, businessSetRepo)
	}

	server := &BusinessServer{
		businessService: businessService,
	}

	// 创建Gin路由
	r := gin.Default()

    // CORS中间件（避免 * + credentials 的无效组合）
    r.Use(func(c *gin.Context) {
        c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
        c.Writer.Header().Set("Access-Control-Allow-Credentials", "false")
        c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
        c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

        if c.Request.Method == http.MethodOptions {
            c.AbortWithStatus(http.StatusNoContent)
            return
        }
        c.Next()
    })

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		// 真实的数据库健康检查（在非 mock 模式下）
		dbStatus := "Not connected (mock mode)"
		status := "healthy"
		if !mockMode && database != nil {
			dbStatus = "Connected"
			if sqlDB, err := database.DB().DB(); err != nil {
				dbStatus = "Error: " + err.Error()
				status = "unhealthy"
			} else if err := sqlDB.Ping(); err != nil {
				dbStatus = "Ping failed: " + err.Error()
				status = "unhealthy"
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"status":       status,
			"timestamp":    time.Now(),
			"version":      "2.1.0-MVP",
			"architecture": "Layered Architecture",
			"database":     "PostgreSQL (" + dbStatus + ")",
			"mock_mode":    mockMode,
		})
	})

	// API v1 路由组
	v1 := r.Group("/api/v1")
	{
		// 业务管理API
		businessAPI := v1.Group("/businesses")
		{
			businessAPI.POST("", server.createBusiness)
			businessAPI.GET("", server.listBusinesses)
			businessAPI.GET("/:id", server.getBusiness)
			businessAPI.PUT("/:id", server.updateBusiness)
			businessAPI.DELETE("/:id", server.deleteBusiness)
		}

		// 业务集管理API
		businessSetAPI := v1.Group("/business-sets")
		{
			businessSetAPI.POST("", server.createBusinessSet)
		}
	}

	// 启动信息
	fmt.Println("🚀 WEND CMDB Business Server v2.1.0-MVP")
	fmt.Println("✅ Layered Architecture Refactoring Complete")
	if mockMode {
		fmt.Println("🗄️  Database: Mock mode (no DB connection)")
	} else {
		fmt.Println("🗄️  Database: PostgreSQL (Connected)")
	}
    fmt.Printf("🌐 Server starting on port %d\n", cfg.Server.Port)

    // 启动服务器
    addr := fmt.Sprintf(":%d", cfg.Server.Port)
    if err := r.Run(addr); err != nil {
        log.Fatal("Failed to start server:", err)
    }
}

// HTTP处理函数
func (s *BusinessServer) createBusiness(c *gin.Context) {
	var req types.CreateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	// 基础验证
	if strings.TrimSpace(req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business name is required"})
		return
	}

	if len(req.Name) > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business name must be less than 100 characters"})
		return
	}

	if req.Description != nil && len(*req.Description) > 500 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business description must be less than 500 characters"})
		return
	}

	business, err := s.businessService.CreateBusiness(c.Request.Context(), &req)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, gin.H{"error": "Business identifier already exists", "details": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create business", "details": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    business,
		"message": "Business created successfully",
	})
}

func (s *BusinessServer) listBusinesses(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	// 使用默认租户ID（在实际应用中应该从认证信息中获取）
	tenantID := "00000000-0000-0000-0000-000000000001"

	businesses, total, err := s.businessService.ListBusinesses(c.Request.Context(), tenantID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list businesses", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"items":  businesses,
			"total":  total,
			"limit":  limit,
			"offset": offset,
		},
	})
}

func (s *BusinessServer) getBusiness(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
        return
    }
    if _, err := uuid.Parse(id); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
        return
    }

	// 使用默认租户ID（在实际应用中应该从认证信息中获取）
	tenantID := "00000000-0000-0000-0000-000000000001"

	business, err := s.businessService.GetBusiness(c.Request.Context(), tenantID, id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Business not found", "details": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get business", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    business,
	})
}

func (s *BusinessServer) updateBusiness(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
        return
    }
    if _, err := uuid.Parse(id); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
        return
    }

	var req types.UpdateBusinessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
		return
	}

	// 基础验证
	if req.Name != nil && strings.TrimSpace(*req.Name) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Business name cannot be empty"})
		return
	}

	// 使用默认租户ID（在实际应用中应该从认证信息中获取）
	tenantID := "00000000-0000-0000-0000-000000000001"

	business, err := s.businessService.UpdateBusiness(c.Request.Context(), tenantID, id, &req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Business not found", "details": err.Error()})
			return
		}
		if strings.Contains(err.Error(), "already exists") {
			c.JSON(http.StatusConflict, gin.H{"error": "Business identifier already exists", "details": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update business", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    business,
		"message": "Business updated successfully",
	})
}

func (s *BusinessServer) deleteBusiness(c *gin.Context) {
    id := c.Param("id")
    if id == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Business ID is required"})
        return
    }
    if _, err := uuid.Parse(id); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid business ID format"})
        return
    }

	// 使用默认租户ID（在实际应用中应该从认证信息中获取）
	tenantID := "00000000-0000-0000-0000-000000000001"

	err := s.businessService.DeleteBusiness(c.Request.Context(), tenantID, id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			c.JSON(http.StatusNotFound, gin.H{"error": "Business not found", "details": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete business", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Business deleted successfully",
	})
}

func (s *BusinessServer) createBusinessSet(c *gin.Context) {
    var req types.CreateBusinessSetRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request format", "details": err.Error()})
        return
    }

    // Basic validation
    if strings.TrimSpace(req.Name) == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "Business set name is required"})
        return
    }
    if req.BusinessID == uuid.Nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "BusinessID is required"})
        return
    }

    businessSet, err := s.businessService.CreateBusinessSet(c.Request.Context(), &req)
    if err != nil {
        if strings.Contains(err.Error(), "already exists") {
            c.JSON(http.StatusConflict, gin.H{"error": "Business set identifier already exists", "details": err.Error()})
            return
        }
        if strings.Contains(strings.ToLower(err.Error()), "not found") {
            c.JSON(http.StatusBadRequest, gin.H{"error": "Related business not found", "details": err.Error()})
            return
        }
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create business set", "details": err.Error()})
        return
    }

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    businessSet,
		"message": "Business set created successfully",
	})
}
