package main

import (
	"context"
	"fmt"
	"log"

	"github.com/openwende/cmdb/server/internal/core/model"
	"github.com/openwende/cmdb/server/internal/storage"
	"github.com/openwende/cmdb/server/internal/types"
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
	modelService := model.NewService(modelRepo)
	ctx := context.Background()

	// 1. Define Core Models
	models := []types.CreateModelRequest{
		{
			Name:           "business",
			DisplayName:    "业务",
			Classification: "organization",
			Description:    "业务线/产品线",
		},
		{
			Name:           "cluster",
			DisplayName:    "集群",
			Classification: "organization",
			Description:    "业务下的逻辑集群",
		},
		{
			Name:           "module",
			DisplayName:    "模块",
			Classification: "organization",
			Description:    "集群下的功能模块",
		},
		{
			Name:           "host",
			DisplayName:    "主机",
			Classification: "resource",
			Description:    "物理机/虚拟机实例",
		},
	}

	for _, req := range models {
		_, err := modelService.GetModelByName(ctx, req.Name)
		if err == nil {
			fmt.Printf("Model '%s' already exists, skipping...\n", req.Name)
			continue
		}

		m, err := modelService.CreateModel(ctx, &req)
		if err != nil {
			log.Printf("Error creating model '%s': %v\n", req.Name, err)
		} else {
			fmt.Printf("Created model: %s (ID: %s)\n", m.Name, m.ID)
		}
	}

	// 2. Define Attributes for Host
	hostModel, _ := modelService.GetModelByName(ctx, "host")
	if hostModel != nil {
		hostAttrs := []types.CreateAttributeRequest{
			{
				Name:        "inner_ip",
				DisplayName: "内网IP",
				FieldType:   "string",
				IsRequired:  true,
				IsUnique:    true,
				SortOrder:   1,
			},
			{
				Name:        "hostname",
				DisplayName: "主机名",
				FieldType:   "string",
				IsRequired:  true,
				SortOrder:   2, // Fixed: removed comma
			},
			{
				Name:        "os_name",
				DisplayName: "操作系统",
				FieldType:   "string",
				SortOrder:   3,
			},
			{
				Name:        "cpu_cores",
				DisplayName: "CPU核数",
				FieldType:   "int",
				SortOrder:   4,
			},
			{
				Name:        "memory_mb",
				DisplayName: "内存(MB)",
				FieldType:   "int",
				SortOrder:   5,
			},
		}

		for _, attr := range hostAttrs {
			_, err := modelService.CreateAttribute(ctx, hostModel.ID.String(), &attr)
			if err != nil {
				// Ignore if already exists (constraint violation)
				fmt.Printf("Attribute '%s' creation output: %v\n", attr.Name, err)
			} else {
				fmt.Printf("Created attribute: %s for model Host\n", attr.Name)
			}
		}
	}

	fmt.Println("Seeding completed successfully!")
}
