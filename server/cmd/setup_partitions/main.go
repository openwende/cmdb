package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/wend/cmdb-backend/internal/storage"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func main() {
	// 优先使用环境变量，避免硬编码密码
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// 仅用于本地开发，生产环境必须设置 DATABASE_URL
		dsn = "host=localhost user=cmdb password=password dbname=cmdb port=5432 sslmode=disable"
		log.Println("WARNING: DATABASE_URL not set, using default DSN. Set DATABASE_URL in production!")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	modelRepo := storage.NewModelRepository(db)
	ctx := context.Background()

	models, err := modelRepo.ListModels(ctx)
	if err != nil {
		log.Fatalf("failed to list models: %v", err)
	}

	for _, m := range models {
		tableName := fmt.Sprintf("model_instances_%s", strings.ReplaceAll(m.Name, "-", "_"))
		// Sanitize name just in case

		fmt.Printf("Creating partition table '%s' for model '%s' (%s)...\n", tableName, m.Name, m.ID)

		// Safe raw SQL execution
		sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" PARTITION OF model_instances FOR VALUES IN ('%s');`, tableName, m.ID)

		if err := db.Exec(sql).Error; err != nil {
			log.Printf("Failed to create partition for %s: %v\n", m.Name, err)
		} else {
			log.Println("Success.")
		}
	}
}
