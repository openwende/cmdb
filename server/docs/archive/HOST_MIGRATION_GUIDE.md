# 主机系统迁移到动态模型 - 完整指南

## 📋 目录

1. [迁移概述](#迁移概述)
2. [迁移前准备](#迁移前准备)
3. [迁移方案](#迁移方案)
4. [执行迁移](#执行迁移)
5. [验证和回滚](#验证和回滚)
6. [API兼容性](#api兼容性)

---

## 迁移概述

### 现有架构
```
hosts 表（专用表，UUID 主键）
  ↓
HostRepository（Repository 层）
  ↓
HostService（业务逻辑层）
  ↓
HTTP API（现有接口）
```

### 目标架构
```
resources 表（通用表，动态模型）
  ↓
DynamicModelService（通用服务）
  ↓
DynamicModelAdapter（适配器层） ← 保持API兼容
  ↓
HTTP API（现有接口继续可用）
```

---

## 迁移前准备

### 1. 数据备份
```bash
# 备份数据库
pg_dump -U postgres -d cmdb -t hosts > hosts_backup.sql
pg_dump -U postgres -d cmdb -t cloud_areas > cloud_areas_backup.sql

# 或使用完整备份
pg_dump -U postgres -d cmdb > cmdb_full_backup_$(date +%Y%m%d).sql
```

### 2. 检查数据完整性
```sql
-- 检查主机数量
SELECT COUNT(*) FROM hosts WHERE deleted_at IS NULL;

-- 检查云区域关联
SELECT
    COUNT(*) as total,
    COUNT(cloud_area_id) as with_cloud_area,
    COUNT(*) - COUNT(cloud_area_id) as without_cloud_area
FROM hosts
WHERE deleted_at IS NULL;

-- 检查重复IP
SELECT cloud_area_id, primary_ip, COUNT(*) as cnt
FROM hosts
WHERE deleted_at IS NULL
GROUP BY cloud_area_id, primary_ip
HAVING COUNT(*) > 1;
```

### 3. 环境检查
```bash
# 检查PostgreSQL版本（需要 >= 14）
psql -U postgres -c "SELECT version();"

# 检查磁盘空间（迁移需要额外空间）
df -h

# 检查Go版本
go version
```

---

## 迁移方案

### 方案 A：适配器模式（推荐，平滑过渡）

#### 优点
- ✅ 现有API完全兼容，无需修改前端
- ✅ 可以逐步迁移，风险低
- ✅ 支持回滚

#### 缺点
- ❌ 需要维护适配器层代码
- ❌ 短期内有两套数据结构并存

#### 实现步骤
```
1. 创建动态模型定义（host模型 + 属性）
2. 迁移现有数据到 resources 表
3. 使用适配器层保持API兼容
4. 验证迁移结果
5. 停用旧表（可选）
```

### 方案 B：直接替换（激进）

#### 优点
- ✅ 架构简洁，无冗余代码

#### 缺点
- ❌ 需要同时修改前端API调用
- ❌ 回滚困难

---

## 执行迁移

### 方式 1：使用迁移脚本（推荐）

#### 编译迁移工具
```bash
cd ~/Projects/wend-cmdb-backend
go build -o bin/migrate-host cmd/migrate-host/main.go
```

#### 执行完整迁移
```bash
./bin/migrate-host \
  --dsn "host=localhost user=postgres password=postgres dbname=cmdb port=5432 sslmode=disable" \
  --batch 100 \
  --step all
```

#### 分步执行（推荐用于大数据量）
```bash
# 步骤1：初始化模型定义
./bin/migrate-host --step init

# 步骤2：迁移数据（可多次执行，幂等）
./bin/migrate-host --step migrate --batch 100

# 步骤3：验证迁移结果
./bin/migrate-host --step verify
```

### 方式 2：手动执行

#### 步骤1：初始化模型
```go
package main

import (
	"context"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/migration"
)

func main() {
	dsn := "host=localhost user=postgres password=postgres dbname=cmdb port=5432 sslmode=disable"
	db, _ := gorm.Open(postgres.Open(dsn), &gorm.Config{})

	service := dynamic_model.NewService(db)
	migrator := migration.NewHostMigration(db, service)

	ctx := context.Background()
	if err := migrator.Step1_InitializeHostModel(ctx); err != nil {
		log.Fatal(err)
	}

	log.Println("✅ 模型初始化完成")
}
```

#### 步骤2：迁移数据
运行完整迁移脚本（见上方代码）

---

## 验证和回滚

### 验证迁移结果

#### 1. 数据数量对比
```sql
-- 原表数量
SELECT COUNT(*) as old_count FROM hosts WHERE deleted_at IS NULL;

-- 新表数量
SELECT COUNT(*) as new_count FROM resources WHERE model_uid = 'host' AND deleted_at IS NULL;
```

#### 2. 抽样验证
```sql
-- 随机抽取5台主机对比
SELECT
    h.id,
    h.host_name,
    h.primary_ip,
    r.id as resource_id,
    r.configs->>'host_name' as new_host_name,
    r.configs->>'primary_ip' as new_primary_ip
FROM hosts h
LEFT JOIN resources r ON
    r.model_uid = 'host' AND
    r.configs->>'primary_ip' = h.primary_ip AND
    r.configs->>'cloud_area_id' = h.cloud_area_id::text
WHERE h.deleted_at IS NULL
LIMIT 5;
```

#### 3. API测试
```bash
# 通过新API查询主机列表
curl http://localhost:8080/api/v1/dynamic-models/host/instances

# 通过旧API查询（使用适配器）
curl http://localhost:8080/api/v1/hosts
```

### 回滚方案

#### 方案 A：保留旧表（推荐）
```bash
# 1. 停止应用
systemctl stop cmdb-backend

# 2. 恢复配置，使用旧的 Repository
# （修改代码，重新部署使用 HostRepository 而非 DynamicModelAdapter）

# 3. 删除迁移的数据（可选）
psql -U postgres -d cmdb -c "DELETE FROM resources WHERE model_uid = 'host'"

# 4. 重启应用
systemctl start cmdb-backend
```

#### 方案 B：从备份恢复
```bash
# 1. 停止应用
systemctl stop cmdb-backend

# 2. 恢复备份
psql -U postgres -d cmdb < hosts_backup.sql

# 3. 重启应用
systemctl start cmdb-backend
```

---

## API兼容性

### 现有API继续可用

使用适配器后，所有现有API保持100%兼容：

```bash
# ✅ 创建主机（现有API）
POST /api/v1/hosts
{
  "host_name": "web-server-01",
  "cloud_area_id": "xxx-xxx-xxx",
  "primary_ip": "192.168.1.100",
  "cpu": 16
}

# ✅ 查询主机列表
GET /api/v1/hosts?page=1&page_size=20

# ✅ 更新主机
PUT /api/v1/hosts/:id

# ✅ 删除主机
DELETE /api/v1/hosts/:id
```

### 新增的动态模型API

迁移后还可以使用新的动态模型API：

```bash
# 🆕 通过动态模型API创建主机
POST /api/v1/dynamic-models/host/instances
{
  "data": {
    "host_name": "web-server-01",
    "cloud_area_id": "xxx-xxx-xxx",
    "primary_ip": "192.168.1.100",
    "cpu": 16
  }
}

# 🆕 查询拓扑关系
GET /api/v1/dynamic-models/instances/123/topology

# 🆕 查看变更历史
GET /api/v1/dynamic-models/instances/123/history
```

---

## 迁移时间估算

### 小规模（< 1万台主机）
- 初始化模型：< 1分钟
- 数据迁移：5-10分钟
- 验证：1-2分钟
- **总计：约15分钟**

### 中规模（1-10万台主机）
- 初始化模型：< 1分钟
- 数据迁移：30-60分钟
- 验证：5分钟
- **总计：约1小时**

### 大规模（> 10万台主机）
- 初始化模型：< 1分钟
- 数据迁移：2-4小时（建议分批执行）
- 验证：10分钟
- **总计：约4小时**

---

## 性能优化建议

### 迁移过程优化

```bash
# 1. 临时禁用触发器（如有）
ALTER TABLE resources DISABLE TRIGGER ALL;

# 2. 执行迁移
./bin/migrate-host --batch 500

# 3. 重新启用触发器
ALTER TABLE resources ENABLE TRIGGER ALL;

# 4. 重建索引（如需要）
REINDEX TABLE resources;

# 5. 更新统计信息
ANALYZE resources;
```

### 批量大小调优

```bash
# 小内存服务器
--batch 50

# 中等服务器
--batch 100   # 默认

# 高性能服务器
--batch 500
```

---

## 常见问题

### Q1: 迁移过程中服务需要停机吗？
**A**: 不需要。迁移脚本会创建新表并迁移数据，不影响现有表。但建议在低峰期执行。

### Q2: 迁移失败了怎么办？
**A**: 迁移脚本是幂等的，可以重新执行。如果部分数据迁移失败，会输出详细错误日志。

### Q3: 如何确保数据一致性？
**A**: 使用验证脚本对比新旧表数据，并进行抽样测试。

### Q4: 迁移后旧表可以删除吗？
**A**: 建议保留1-2周，确认无问题后再删除。删除前务必备份。

### Q5: 性能会有影响吗？
**A**: 迁移后查询性能基本相当，部分场景（JSONB查询）可能稍慢，但通过索引优化后可以达到相近水平。

---

## 检查清单

迁移前：
- [ ] 数据库已备份
- [ ] 检查数据完整性
- [ ] 检查磁盘空间
- [ ] 编译迁移工具
- [ ] 在测试环境验证

迁移中：
- [ ] 执行步骤1：初始化模型
- [ ] 执行步骤2：迁移数据
- [ ] 执行步骤3：验证结果
- [ ] 记录迁移日志

迁移后：
- [ ] 验证数据数量一致
- [ ] 抽样对比数据正确性
- [ ] 测试现有API
- [ ] 测试新API
- [ ] 监控性能指标
- [ ] 更新文档

---

## 支持和帮助

如遇问题，请检查：

1. 迁移日志文件
2. PostgreSQL 日志
3. 应用日志

或联系技术支持。

---

**祝迁移顺利！** 🚀
