package migration

import (
	"context"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/types"
)

// HostMigration 主机迁移工具
type HostMigration struct {
	db             *gorm.DB
	dynamicService *dynamic_model.Service
}

// NewHostMigration 创建迁移工具
func NewHostMigration(db *gorm.DB, dynamicService *dynamic_model.Service) *HostMigration {
	return &HostMigration{
		db:             db,
		dynamicService: dynamicService,
	}
}

// Step1_InitializeHostModel 步骤1：初始化主机模型定义
func (m *HostMigration) Step1_InitializeHostModel(ctx context.Context) error {
	fmt.Println("步骤1：初始化主机模型定义...")

	// 1. 创建主机模型
	hostModel := &types.DynamicModel{
		UID:         "host",
		Name:        "主机",
		Description: "物理机或虚拟机",
		Icon:        "server",
		UniqueFields: marshalJSON(types.UniqueFieldConfig{
			Fields: []string{"cloud_area_id", "primary_ip"},
			Name:   "idx_unique_host_cloud_ip",
		}),
	}

	if err := m.dynamicService.CreateModel(ctx, hostModel); err != nil {
		return fmt.Errorf("创建模型失败: %w", err)
	}
	fmt.Println("✅ 主机模型创建成功")

	// 2. 定义属性（配置字段）
	configAttributes := []types.DynamicAttribute{
		// 核心标识字段
		{
			ModelUID:    "host",
			FieldUID:    "cloud_area_id",
			FieldName:   "云区域ID",
			FieldType:   "string",
			Category:    "config",
			IsRequired:  true,
			UniqueGroup: "primary",
			Placeholder: "云区域UUID，用于IP隔离",
		},
		{
			ModelUID:    "host",
			FieldUID:    "primary_ip",
			FieldName:   "主IP地址",
			FieldType:   "string",
			Category:    "config",
			IsRequired:  true,
			UniqueGroup: "primary",
			Validators: marshalJSON(types.FieldValidators{
				Pattern:      stringPtr(`^(\d{1,3}\.){3}\d{1,3}$`),
				ErrorMessage: "IP地址格式不正确",
			}),
		},
		{
			ModelUID:   "host",
			FieldUID:   "host_name",
			FieldName:  "主机名",
			FieldType:  "string",
			Category:   "config",
			IsRequired: true,
		},
		{
			ModelUID:    "host",
			FieldUID:    "business_id",
			FieldName:   "业务ID",
			FieldType:   "string",
			Category:    "config",
			Placeholder: "业务归属UUID，NULL表示在资源池",
		},

		// 云平台信息
		{
			ModelUID:  "host",
			FieldUID:  "cloud_vendor",
			FieldName: "云厂商",
			FieldType: "enum",
			Category:  "config",
			Validators: marshalJSON(types.FieldValidators{
				EnumValues: []string{"aws", "tencent_cloud", "aliyun", "custom"},
			}),
		},
		{
			ModelUID:  "host",
			FieldUID:  "cloud_instance_id",
			FieldName: "云实例ID",
			FieldType: "string",
			Category:  "config",
		},
		{
			ModelUID:  "host",
			FieldUID:  "cloud_region",
			FieldName: "云区域",
			FieldType: "string",
			Category:  "config",
		},
		{
			ModelUID:  "host",
			FieldUID:  "vpc_id",
			FieldName: "VPC ID",
			FieldType: "string",
			Category:  "config",
		},
		{
			ModelUID:  "host",
			FieldUID:  "subnet_id",
			FieldName: "子网ID",
			FieldType: "string",
			Category:  "config",
		},

		// 硬件配置
		{
			ModelUID:  "host",
			FieldUID:  "cpu",
			FieldName: "CPU核数",
			FieldType: "int",
			Category:  "config",
			Unit:      "核",
			Validators: marshalJSON(types.FieldValidators{
				Min: float64Ptr(1),
				Max: float64Ptr(256),
			}),
		},
		{
			ModelUID:  "host",
			FieldUID:  "memory",
			FieldName: "内存",
			FieldType: "int",
			Category:  "config",
			Unit:      "MB",
			Validators: marshalJSON(types.FieldValidators{
				Min: float64Ptr(1),
			}),
		},
		{
			ModelUID:  "host",
			FieldUID:  "disk_size",
			FieldName: "磁盘大小",
			FieldType: "int",
			Category:  "config",
			Unit:      "GB",
		},
		{
			ModelUID:  "host",
			FieldUID:  "os_type",
			FieldName: "操作系统类型",
			FieldType: "enum",
			Category:  "config",
			Validators: marshalJSON(types.FieldValidators{
				EnumValues: []string{"linux", "windows"},
			}),
		},
		{
			ModelUID:  "host",
			FieldUID:  "os_version",
			FieldName: "操作系统版本",
			FieldType: "string",
			Category:  "config",
		},

		// 状态字段（可选，放到state表）
		{
			ModelUID:  "host",
			FieldUID:  "status",
			FieldName: "运行状态",
			FieldType: "enum",
			Category:  "state",
			Validators: marshalJSON(types.FieldValidators{
				EnumValues: []string{"running", "stopped", "terminated"},
			}),
		},
		{
			ModelUID:  "host",
			FieldUID:  "is_destroyed",
			FieldName: "是否已销毁",
			FieldType: "bool",
			Category:  "state",
		},
	}

	for _, attr := range configAttributes {
		if err := m.dynamicService.CreateAttribute(ctx, &attr); err != nil {
			return fmt.Errorf("创建属性 %s 失败: %w", attr.FieldUID, err)
		}
	}
	fmt.Printf("✅ 成功创建 %d 个属性定义\n", len(configAttributes))

	// 3. 同步唯一索引
	if err := m.dynamicService.SyncUniqueIndexes(ctx); err != nil {
		return fmt.Errorf("同步索引失败: %w", err)
	}
	fmt.Println("✅ 唯一索引同步成功")

	return nil
}

// Step2_MigrateExistingHosts 步骤2：迁移现有主机数据
func (m *HostMigration) Step2_MigrateExistingHosts(ctx context.Context, batchSize int) error {
	fmt.Println("步骤2：迁移现有主机数据...")

	if batchSize <= 0 {
		batchSize = 100
	}

	// 统计总数
	var totalCount int64
	if err := m.db.Model(&types.Host{}).Where("deleted_at IS NULL").Count(&totalCount).Error; err != nil {
		return fmt.Errorf("统计主机数量失败: %w", err)
	}

	if totalCount == 0 {
		fmt.Println("✅ 没有需要迁移的主机")
		return nil
	}

	fmt.Printf("📊 共有 %d 台主机需要迁移\n", totalCount)

	// 分批查询和迁移
	offset := 0
	successCount := 0
	failedCount := 0
	var errors []string

	for {
		var hosts []types.Host
		if err := m.db.Where("deleted_at IS NULL").
			Offset(offset).
			Limit(batchSize).
			Find(&hosts).Error; err != nil {
			return fmt.Errorf("查询主机失败: %w", err)
		}

		if len(hosts) == 0 {
			break
		}

		// 迁移当前批次
		for _, host := range hosts {
			if err := m.migrateOneHost(ctx, &host); err != nil {
				failedCount++
				errors = append(errors, fmt.Sprintf("主机 %s (%s): %v", host.HostName, host.ID, err))
				fmt.Printf("❌ 迁移失败: %s\n", host.HostName)
			} else {
				successCount++
				if successCount%10 == 0 {
					fmt.Printf("✅ 已迁移 %d/%d\n", successCount, totalCount)
				}
			}
		}

		offset += batchSize
	}

	fmt.Printf("\n迁移完成！\n")
	fmt.Printf("✅ 成功: %d\n", successCount)
	if failedCount > 0 {
		fmt.Printf("❌ 失败: %d\n", failedCount)
		fmt.Println("\n错误详情：")
		for _, err := range errors {
			fmt.Printf("  - %s\n", err)
		}
	}

	return nil
}

// migrateOneHost 迁移单个主机
func (m *HostMigration) migrateOneHost(ctx context.Context, host *types.Host) error {
	// 转换为动态模型数据格式
	data := map[string]interface{}{
		"host_name":  host.HostName,
		"primary_ip": host.PrimaryIP,
	}

	// 云区域ID（必填）
	if host.CloudAreaID != nil {
		data["cloud_area_id"] = host.CloudAreaID.String()
	} else {
		// 如果没有云区域，使用特殊标记
		data["cloud_area_id"] = "00000000-0000-0000-0000-000000000000"
	}

	// 业务ID
	if host.BusinessID != nil {
		data["business_id"] = fmt.Sprintf("%d", *host.BusinessID)
	}

	// IP地址列表
	if len(host.IPAddresses) > 0 {
		ipsJSON, _ := json.Marshal(host.IPAddresses)
		data["ip_addresses"] = string(ipsJSON)
	}

	// 云平台信息
	if host.CloudVendor != nil {
		data["cloud_vendor"] = *host.CloudVendor
	}
	if host.CloudInstanceID != nil {
		data["cloud_instance_id"] = *host.CloudInstanceID
	}
	if host.CloudRegion != nil {
		data["cloud_region"] = *host.CloudRegion
	}
	if host.VPCID != nil {
		data["vpc_id"] = *host.VPCID
	}
	if host.SubnetID != nil {
		data["subnet_id"] = *host.SubnetID
	}

	// 硬件配置
	if host.CPU != nil {
		data["cpu"] = *host.CPU
	}
	if host.Memory != nil {
		data["memory"] = *host.Memory
	}
	if host.DiskSize != nil {
		data["disk_size"] = *host.DiskSize
	}
	if host.OSType != nil {
		data["os_type"] = *host.OSType
	}
	if host.OSVersion != nil {
		data["os_version"] = *host.OSVersion
	}

	// 状态字段
	data["status"] = host.Status
	data["is_destroyed"] = host.IsDestroyed

	// 自定义字段
	if len(host.CustomFields) > 0 {
		for k, v := range host.CustomFields {
			data[k] = v
		}
	}

	// 审计上下文
	auditCtx := &dynamic_model.AuditContext{
		UserID:    "system_migration",
		ClientIP:  "127.0.0.1",
		UserAgent: "Migration Script",
	}

	// 执行Upsert
	_, err := m.dynamicService.UpsertInstance(ctx, "host", data, auditCtx)
	return err
}

// Step3_VerifyMigration 步骤3：验证迁移结果
func (m *HostMigration) Step3_VerifyMigration(ctx context.Context) error {
	fmt.Println("步骤3：验证迁移结果...")

	// 统计原表数量
	var oldCount int64
	if err := m.db.Model(&types.Host{}).Where("deleted_at IS NULL").Count(&oldCount).Error; err != nil {
		return fmt.Errorf("统计原表失败: %w", err)
	}

	// 统计新表数量
	var newCount int64
	if err := m.db.Model(&types.Resource{}).Where("model_uid = 'host' AND deleted_at IS NULL").Count(&newCount).Error; err != nil {
		return fmt.Errorf("统计新表失败: %w", err)
	}

	fmt.Printf("原表数量: %d\n", oldCount)
	fmt.Printf("新表数量: %d\n", newCount)

	if oldCount == newCount {
		fmt.Println("✅ 数据数量一致，迁移成功！")
	} else {
		fmt.Printf("⚠️  数量不一致，差异: %d\n", oldCount-newCount)
	}

	// 随机抽样验证
	fmt.Println("\n随机抽样验证数据一致性...")
	var sampleHosts []types.Host
	if err := m.db.Where("deleted_at IS NULL").Limit(5).Find(&sampleHosts).Error; err != nil {
		return err
	}

	for _, host := range sampleHosts {
		// 查询对应的动态模型资源
		var resource types.Resource
		err := m.db.Where("model_uid = 'host' AND configs->>'primary_ip' = ? AND configs->>'cloud_area_id' = ?",
			host.PrimaryIP,
			host.CloudAreaID.String(),
		).First(&resource).Error

		if err != nil {
			fmt.Printf("❌ 主机 %s 在新表中未找到\n", host.HostName)
		} else {
			fmt.Printf("✅ 主机 %s 验证通过\n", host.HostName)
		}
	}

	return nil
}

// ExecuteFullMigration 执行完整迁移流程
func (m *HostMigration) ExecuteFullMigration(ctx context.Context) error {
	fmt.Println("========== 开始主机数据迁移 ==========")

	// 步骤1：初始化模型
	if err := m.Step1_InitializeHostModel(ctx); err != nil {
		return fmt.Errorf("步骤1失败: %w", err)
	}
	fmt.Println()

	// 步骤2：迁移数据
	if err := m.Step2_MigrateExistingHosts(ctx, 100); err != nil {
		return fmt.Errorf("步骤2失败: %w", err)
	}
	fmt.Println()

	// 步骤3：验证
	if err := m.Step3_VerifyMigration(ctx); err != nil {
		return fmt.Errorf("步骤3失败: %w", err)
	}

	fmt.Println("\n========== 迁移完成 ==========")
	return nil
}

// 辅助函数
func marshalJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func stringPtr(s string) *string {
	return &s
}

func float64Ptr(f float64) *float64 {
	return &f
}
