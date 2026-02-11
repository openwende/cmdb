package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

func main() {
	// 1. 连接数据库
	dsn := "host=localhost user=postgres password=postgres dbname=cmdb port=5432 sslmode=disable"
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("连接数据库失败:", err)
	}

	// 2. 执行迁移
	fmt.Println("执行数据库迁移...")
	if err := storage.MigrateDynamicModels(db); err != nil {
		log.Fatal("迁移失败:", err)
	}
	fmt.Println("✅ 迁移完成")

	// 3. 创建服务实例
	service := dynamic_model.NewService(db)
	ctx := context.Background()

	// ========== 示例 1: 定义主机模型 ==========
	fmt.Println("\n========== 示例 1: 定义主机模型 ==========")

	// 创建模型
	hostModel := &types.DynamicModel{
		UID:         "host",
		Name:        "主机",
		Description: "物理机或虚拟机",
		Icon:        "server",
		UniqueFields: marshalJSON(types.UniqueFieldConfig{
			Fields: []string{"cloud_id", "inner_ip"},
			Name:   "idx_unique_host",
		}),
	}
	if err := db.Create(hostModel).Error; err != nil {
		fmt.Println("模型已存在，跳过创建")
	} else {
		fmt.Println("✅ 创建主机模型成功")
	}

	// 定义属性
	hostAttributes := []types.DynamicAttribute{
		// 配置字段（category=config，存入 resources 表）
		{
			ModelUID:    "host",
			FieldUID:    "cloud_id",
			FieldName:   "云区域 ID",
			FieldType:   "int",
			Category:    "config",
			IsRequired:  true,
			UniqueGroup: "primary",
		},
		{
			ModelUID:    "host",
			FieldUID:    "inner_ip",
			FieldName:   "内网 IP",
			FieldType:   "string",
			Category:    "config",
			IsRequired:  true,
			UniqueGroup: "primary",
			Validators: marshalJSON(types.FieldValidators{
				Pattern:      stringPtr(`^(\d{1,3}\.){3}\d{1,3}$`),
				ErrorMessage: "IP 地址格式不正确",
			}),
		},
		{
			ModelUID:   "host",
			FieldUID:   "hostname",
			FieldName:  "主机名",
			FieldType:  "string",
			Category:   "config",
			IsRequired: true,
			Validators: marshalJSON(types.FieldValidators{
				MinLength:    intPtr(3),
				MaxLength:    intPtr(63),
				Pattern:      stringPtr(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`),
				ErrorMessage: "主机名必须符合 DNS 规范",
			}),
		},
		{
			ModelUID: "host",
			FieldUID: "cpu_cores",
			FieldName: "CPU 核数",
			FieldType: "int",
			Category: "config",
			Unit:     "核",
			Validators: marshalJSON(types.FieldValidators{
				Min:          float64Ptr(1),
				Max:          float64Ptr(256),
				ErrorMessage: "CPU 核数必须在 1-256 之间",
			}),
		},
		{
			ModelUID: "host",
			FieldUID: "memory_gb",
			FieldName: "内存大小",
			FieldType: "float",
			Category: "config",
			Unit:     "GB",
			Validators: marshalJSON(types.FieldValidators{
				Min: float64Ptr(0.5),
				Max: float64Ptr(1024),
			}),
		},
		{
			ModelUID: "host",
			FieldUID: "os_type",
			FieldName: "操作系统类型",
			FieldType: "enum",
			Category: "config",
			Validators: marshalJSON(types.FieldValidators{
				EnumValues:   []string{"linux", "windows", "aix", "unix"},
				ErrorMessage: "不支持的操作系统类型",
			}),
		},

		// 状态字段（category=state，存入 resource_states 表）
		{
			ModelUID:  "host",
			FieldUID:  "cpu_usage",
			FieldName: "CPU 使用率",
			FieldType: "float",
			Category:  "state",
			Unit:      "%",
		},
		{
			ModelUID:  "host",
			FieldUID:  "memory_usage",
			FieldName: "内存使用率",
			FieldType: "float",
			Category:  "state",
			Unit:      "%",
		},
		{
			ModelUID:  "host",
			FieldUID:  "disk_usage",
			FieldName: "磁盘使用率",
			FieldType: "float",
			Category:  "state",
			Unit:      "%",
		},
	}

	for _, attr := range hostAttributes {
		if err := db.FirstOrCreate(&attr, types.DynamicAttribute{
			ModelUID: attr.ModelUID,
			FieldUID: attr.FieldUID,
		}).Error; err != nil {
			log.Fatal("创建属性失败:", err)
		}
	}
	fmt.Println("✅ 创建主机属性定义成功")

	// 同步唯一索引
	if err := service.SyncUniqueIndexes(ctx); err != nil {
		log.Fatal("同步索引失败:", err)
	}
	fmt.Println("✅ 同步唯一索引成功")

	// ========== 示例 2: 创建主机实例 ==========
	fmt.Println("\n========== 示例 2: 创建主机实例 ==========")

	hostData := map[string]interface{}{
		// 配置数据
		"cloud_id":   0,
		"inner_ip":   "192.168.1.100",
		"hostname":   "web-server-01",
		"cpu_cores":  16,
		"memory_gb":  64.0,
		"os_type":    "linux",

		// 状态数据
		"cpu_usage":    45.5,
		"memory_usage": 60.2,
		"disk_usage":   30.8,
	}

	auditCtx := &dynamic_model.AuditContext{
		UserID:    "admin",
		ClientIP:  "127.0.0.1",
		UserAgent: "Example/1.0",
	}

	resourceID, err := service.UpsertInstance(ctx, "host", hostData, auditCtx)
	if err != nil {
		log.Fatal("创建主机失败:", err)
	}
	fmt.Printf("✅ 创建主机成功，资源 ID: %d\n", resourceID)

	// ========== 示例 3: 更新主机实例（自动识别为更新操作）==========
	fmt.Println("\n========== 示例 3: 更新主机实例 ==========")

	updatedData := map[string]interface{}{
		"cloud_id":     0,
		"inner_ip":     "192.168.1.100", // 相同的唯一键
		"hostname":     "web-server-01",
		"cpu_cores":    32, // 升级了 CPU
		"memory_gb":    128.0, // 升级了内存
		"os_type":      "linux",
		"cpu_usage":    25.3, // 更新状态
		"memory_usage": 40.1,
		"disk_usage":   35.0,
	}

	resourceID, err = service.UpsertInstance(ctx, "host", updatedData, auditCtx)
	if err != nil {
		log.Fatal("更新主机失败:", err)
	}
	fmt.Printf("✅ 更新主机成功，资源 ID: %d\n", resourceID)

	// ========== 示例 4: 查询主机实例 ==========
	fmt.Println("\n========== 示例 4: 查询主机实例 ==========")

	resource, err := service.GetInstance(ctx, resourceID)
	if err != nil {
		log.Fatal("查询主机失败:", err)
	}

	fmt.Printf("主机 ID: %d\n", resource.ID)
	fmt.Printf("模型: %s\n", resource.ModelUID)
	fmt.Printf("名称: %s\n", resource.Name)
	fmt.Printf("配置数据: %s\n", string(resource.Configs))
	if resource.State != nil {
		fmt.Printf("状态数据: %s\n", string(resource.State.Metrics))
		fmt.Printf("健康状态: %d\n", resource.State.HealthStatus)
	}

	// ========== 示例 5: 创建关联类型和模型关联 ==========
	fmt.Println("\n========== 示例 5: 配置关联关系 ==========")

	// 创建交换机模型（简化版）
	switchModel := &types.DynamicModel{
		UID:         "switch",
		Name:        "交换机",
		Description: "网络交换机",
	}
	db.FirstOrCreate(switchModel, types.DynamicModel{UID: "switch"})

	// 定义模型关联：主机连接到交换机
	modelAssoc := &types.DynamicModelAssociation{
		SourceModelUID: "host",
		TargetModelUID: "switch",
		AssociationUID: types.AssocConnectsTo,
		Mapping:        "N:N",
		OnDelete:       "restrict",
		Description:    "主机通过网线连接到交换机",
	}
	if err := db.FirstOrCreate(modelAssoc, types.DynamicModelAssociation{
		SourceModelUID: "host",
		TargetModelUID: "switch",
		AssociationUID: types.AssocConnectsTo,
	}).Error; err != nil {
		log.Fatal("创建模型关联失败:", err)
	}
	fmt.Println("✅ 配置关联关系成功")

	// ========== 示例 6: 列表查询 ==========
	fmt.Println("\n========== 示例 6: 列表查询 ==========")

	filters := map[string]interface{}{
		"os_type": "linux",
	}
	resources, total, err := service.ListInstances(ctx, "host", filters, 1, 10)
	if err != nil {
		log.Fatal("查询列表失败:", err)
	}

	fmt.Printf("找到 %d 台 Linux 主机\n", total)
	for _, res := range resources {
		fmt.Printf("  - ID: %d, 名称: %s\n", res.ID, res.Name)
	}

	// ========== 示例 7: 查看审计日志 ==========
	fmt.Println("\n========== 示例 7: 查看审计日志 ==========")

	var histories []types.ResourceHistory
	db.Where("resource_id = ?", resourceID).Order("changed_at DESC").Find(&histories)

	for _, h := range histories {
		fmt.Printf("变更类型: %s, 操作人: %s, 时间: %s\n",
			h.ChangeType, h.ChangedBy, h.ChangedAt.Format("2006-01-02 15:04:05"))
		if h.ChangeType == "update" {
			fmt.Printf("  变更前: %s\n", string(h.BeforeData))
			fmt.Printf("  变更后: %s\n", string(h.AfterData))
		}
	}

	fmt.Println("\n✅ 所有示例执行完成！")
}

// 辅助函数
func marshalJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func float64Ptr(f float64) *float64 {
	return &f
}
