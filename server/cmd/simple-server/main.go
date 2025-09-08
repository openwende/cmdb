package main

import (
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
	Message   string    `json:"message"`
}

func main() {
	// Create Gin router
	r := gin.Default()

	// CORS middleware for frontend integration
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Health endpoint
	r.GET("/health", func(c *gin.Context) {
		response := HealthResponse{
			Status:    "healthy",
			Timestamp: time.Now(),
			Version:   "1.0.0",
			Message:   "WEND CMDB Backend is running successfully!",
		}
		c.JSON(http.StatusOK, response)
	})

	// Root endpoint
	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Welcome to WEND CMDB Backend",
			"version": "1.0.0",
			"docs":    "/swagger/index.html",
			"health":  "/health",
		})
	})

	// API info endpoint
	r.GET("/api/info", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"service": "WEND CMDB Backend",
			"version": "1.0.0",
			"features": []string{
				"REST API",
				"GraphQL",
				"Plugin System",
				"Event System",
				"Authentication",
				"Audit Logging",
			},
			"endpoints": map[string]string{
				"health":   "/health",
				"api":      "/api/v1",
				"graphql":  "/graphql",
				"swagger":  "/swagger/index.html",
				"metrics":  "/metrics",
			},
		})
	})

	// Test database connection simulation
	r.GET("/api/v1/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"database":    "connected (simulated)",
			"redis":       "connected (simulated)",
			"plugins":     "system ready",
			"events":      "system ready",
			"features": map[string]bool{
				"authentication": true,
				"authorization":  true,
				"audit_logging":  true,
				"plugin_system":  true,
				"event_system":   true,
				"graphql":        true,
				"rest_api":       true,
			},
		})
	})

	// Business topology endpoints
	r.GET("/api/v1/business", func(c *gin.Context) {
		businessNodes := []map[string]interface{}{
			{
				"id":          "biz-1",
				"name":        "电商平台",
				"parent_id":   nil,
				"level":       1,
				"path":        "/电商平台",
				"description": "在线电商业务系统",
				"metadata": map[string]interface{}{
					"owner":         "platform-team",
					"contact":       "platform@company.com",
					"business_type": "e-commerce",
				},
				"children": []map[string]interface{}{
					{
						"id":       "biz-2",
						"name":     "用户服务",
						"level":    2,
						"path":     "/电商平台/用户服务",
						"instance_count": 5,
					},
					{
						"id":       "biz-3", 
						"name":     "订单服务",
						"level":    2,
						"path":     "/电商平台/订单服务",
						"instance_count": 8,
					},
					{
						"id":       "biz-4",
						"name":     "支付服务", 
						"level":    2,
						"path":     "/电商平台/支付服务",
						"instance_count": 3,
					},
				},
				"instance_count": 16,
				"created_at":     time.Now().Add(-7 * 24 * time.Hour),
				"updated_at":     time.Now().Add(-1 * time.Hour),
			},
			{
				"id":          "biz-5",
				"name":        "管理后台",
				"parent_id":   nil,
				"level":       1,
				"path":        "/管理后台",
				"description": "系统管理和运维后台",
				"metadata": map[string]interface{}{
					"owner":   "ops-team",
					"contact": "ops@company.com",
				},
				"children": []map[string]interface{}{
					{
						"id":       "biz-6",
						"name":     "监控系统",
						"level":    2,
						"path":     "/管理后台/监控系统",
						"instance_count": 4,
					},
				},
				"instance_count": 4,
				"created_at":     time.Now().Add(-5 * 24 * time.Hour),
				"updated_at":     time.Now().Add(-2 * time.Hour),
			},
		}
		c.JSON(http.StatusOK, gin.H{
			"business_nodes": businessNodes,
			"total":          len(businessNodes),
			"tree_stats": map[string]interface{}{
				"total_nodes":     6,
				"max_depth":       2,
				"total_instances": 20,
			},
		})
	})

	r.GET("/api/v1/business/tree", func(c *gin.Context) {
		treeData := map[string]interface{}{
			"nodes": []map[string]interface{}{
				{
					"id":    "biz-1",
					"name":  "电商平台",
					"level": 1,
					"children": []map[string]interface{}{
						{
							"id":    "biz-2",
							"name":  "用户服务",
							"level": 2,
							"instances": []map[string]interface{}{
								{"id": "inst-1", "name": "user-service-01", "role": "primary"},
								{"id": "inst-3", "name": "user-db-01", "role": "database"},
							},
						},
						{
							"id":    "biz-3",
							"name":  "订单服务", 
							"level": 2,
							"instances": []map[string]interface{}{
								{"id": "inst-2", "name": "nginx-service", "role": "loadbalancer"},
							},
						},
					},
				},
				{
					"id":    "biz-5",
					"name":  "管理后台",
					"level": 1,
					"children": []map[string]interface{}{
						{
							"id":    "biz-6",
							"name":  "监控系统",
							"level": 2,
						},
					},
				},
			},
			"total_nodes": 6,
			"max_depth":   2,
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    treeData,
		})
	})

	r.GET("/api/v1/business/stats", func(c *gin.Context) {
		stats := map[string]interface{}{
			"node_count":     6,
			"instance_count": 20,
			"max_depth":      2,
			"model_distribution": map[string]int{
				"应用":   8,
				"服务器":  6,
				"数据库":  4,
				"负载均衡": 2,
			},
			"level_distribution": map[string]int{
				"1": 2,
				"2": 4,
			},
			"business_health": map[string]interface{}{
				"healthy_nodes":   5,
				"warning_nodes":   1,
				"critical_nodes":  0,
				"health_score":    0.83,
			},
		}
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"data":    stats,
		})
	})

	// Simulate some API endpoints
	r.GET("/api/v1/models", func(c *gin.Context) {
		models := []map[string]interface{}{
			{
				"id":          "model-1",
				"name":        "Server",
				"description": "Physical and virtual servers",
				"fields": []map[string]string{
					{"name": "hostname", "type": "string", "required": "true"},
					{"name": "ip_address", "type": "string", "required": "true"},
					{"name": "os", "type": "string", "required": "false"},
					{"name": "cpu_cores", "type": "integer", "required": "false"},
					{"name": "memory_gb", "type": "integer", "required": "false"},
				},
				"created_at": time.Now().Add(-24 * time.Hour),
				"updated_at": time.Now(),
			},
			{
				"id":          "model-2",
				"name":        "Application",
				"description": "Software applications and services",
				"fields": []map[string]string{
					{"name": "name", "type": "string", "required": "true"},
					{"name": "version", "type": "string", "required": "true"},
					{"name": "port", "type": "integer", "required": "false"},
					{"name": "protocol", "type": "string", "required": "false"},
				},
				"created_at": time.Now().Add(-12 * time.Hour),
				"updated_at": time.Now(),
			},
		}
		c.JSON(http.StatusOK, gin.H{
			"models": models,
			"total":  len(models),
		})
	})

	r.GET("/api/v1/instances", func(c *gin.Context) {
		instances := []map[string]interface{}{
			{
				"id":       "inst-1",
				"model_id": "model-1",
				"name":     "web-server-01",
				"data": map[string]interface{}{
					"hostname":   "web01.example.com",
					"ip_address": "192.168.1.100",
					"os":         "Ubuntu 22.04",
					"cpu_cores":  4,
					"memory_gb":  16,
				},
				"created_at": time.Now().Add(-6 * time.Hour),
				"updated_at": time.Now().Add(-1 * time.Hour),
			},
			{
				"id":       "inst-2",
				"model_id": "model-2",
				"name":     "nginx-service",
				"data": map[string]interface{}{
					"name":     "nginx",
					"version":  "1.22.1",
					"port":     80,
					"protocol": "HTTP",
				},
				"created_at": time.Now().Add(-3 * time.Hour),
				"updated_at": time.Now().Add(-30 * time.Minute),
			},
		}
		c.JSON(http.StatusOK, gin.H{
			"instances": instances,
			"total":     len(instances),
		})
	})

	// Plugin system status
	r.GET("/api/v1/plugins", func(c *gin.Context) {
		plugins := []map[string]interface{}{
			{
				"id":      "email-validator",
				"name":    "Email Validator",
				"type":    "field",
				"version": "1.0.0",
				"status":  "active",
				"author":  "WEND Team",
			},
			{
				"id":      "csv-exporter",
				"name":    "CSV Exporter",
				"type":    "exporter",
				"version": "1.0.0",
				"status":  "active",
				"author":  "WEND Team",
			},
		}
		c.JSON(http.StatusOK, gin.H{
			"plugins": plugins,
			"total":   len(plugins),
			"types": []string{
				"field", "exporter", "importer", "validator",
				"notifier", "transformer", "collector", "action",
			},
		})
	})

	// Print startup information
	fmt.Println("🚀 WEND CMDB Backend - Verification Server")
	fmt.Println("📡 Server starting on port 8080")
	fmt.Println("🔗 Available endpoints:")
	fmt.Println("   • Health Check:    http://localhost:8080/health")
	fmt.Println("   • API Info:        http://localhost:8080/api/info")
	fmt.Println("   • System Status:   http://localhost:8080/api/v1/status")
	fmt.Println("   • Models:          http://localhost:8080/api/v1/models")
	fmt.Println("   • Instances:       http://localhost:8080/api/v1/instances")
	fmt.Println("   • Plugins:         http://localhost:8080/api/v1/plugins")
	fmt.Println("✨ This is a simplified verification server to test the core concepts")
	fmt.Println()

	// Start server
	if err := r.Run(":8080"); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}