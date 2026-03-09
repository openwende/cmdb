package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/core/instance"
	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	dsn := "host=localhost user=cmdb password=password dbname=cmdb port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	modelRepo := storage.NewModelRepository(db)
	instanceRepo := storage.NewInstanceRepository(db)
	instanceService := instance.NewService(instanceRepo, modelRepo, db, mainline.NewService(db))

	ctx := context.Background()
	tenantID := uuid.New().String() // Random tenant for test

	// 1. Create a Host Instance
	fmt.Println("Creating Host Instance...")
	req := &types.CreateInstanceRequest{
		Properties: map[string]interface{}{
			"inner_ip":  "192.168.1.100",
			"hostname":  "web-server-01",
			"os_name":   "Ubuntu 22.04",
			"cpu_cores": 4,    // Int
			"memory_mb": 8192, // Int
		},
	}

	inst, err := instanceService.CreateInstance(ctx, tenantID, "host", req)
	if err != nil {
		log.Fatalf("Failed to create instance: %v", err)
	}

	fmt.Printf("Successfully created instance ID: %s\n", inst.ID)

	// 2. Query Instance (Filter by IP)
	fmt.Println("Querying Host Instance by IP...")
	filterParams := types.QueryParams{
		Page:     1,
		PageSize: 10,
		Filters: map[string]interface{}{
			"inner_ip": "192.168.1.100",
		},
	}

	list, total, err := instanceService.ListInstances(ctx, tenantID, "host", filterParams)
	if err != nil {
		log.Fatalf("Failed to list instances: %v", err)
	}

	fmt.Printf("Found %d instances (Total: %d)\n", len(list), total)
	if len(list) > 0 {
		var props map[string]interface{}
		json.Unmarshal(list[0].Properties, &props) // Ignore error
		fmt.Printf("Instance[0] Hostname: %v\n", props["hostname"])
	}
}
