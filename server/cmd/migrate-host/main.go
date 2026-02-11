package main

import (
	"context"
	"flag"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/migration"
)

func main() {
	// 命令行参数
	dsn := flag.String("dsn", "host=localhost user=postgres password=postgres dbname=cmdb port=5432 sslmode=disable", "数据库连接字符串")
	batchSize := flag.Int("batch", 100, "批量迁移数量")
	step := flag.String("step", "all", "执行步骤: init, migrate, verify, all")
	flag.Parse()

	// 连接数据库
	db, err := gorm.Open(postgres.Open(*dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}

	// 创建服务
	dynamicService := dynamic_model.NewService(db)
	migrator := migration.NewHostMigration(db, dynamicService)

	ctx := context.Background()

	// 执行迁移步骤
	switch *step {
	case "init":
		log.Println("执行步骤1：初始化模型定义")
		if err := migrator.Step1_InitializeHostModel(ctx); err != nil {
			log.Fatal("步骤1失败:", err)
		}

	case "migrate":
		log.Println("执行步骤2：迁移数据")
		if err := migrator.Step2_MigrateExistingHosts(ctx, *batchSize); err != nil {
			log.Fatal("步骤2失败:", err)
		}

	case "verify":
		log.Println("执行步骤3：验证迁移")
		if err := migrator.Step3_VerifyMigration(ctx); err != nil {
			log.Fatal("步骤3失败:", err)
		}

	case "all":
		log.Println("执行完整迁移流程")
		if err := migrator.ExecuteFullMigration(ctx); err != nil {
			log.Fatal("迁移失败:", err)
		}

	default:
		log.Fatal("未知步骤，可选值: init, migrate, verify, all")
	}

	log.Println("✅ 操作完成")
}
