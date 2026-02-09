# 数据库迁移测试指南

## 📋 清理结果概述

本次清理从 `20260113120000_dynamic_model_engine` 迁移中删除了 **2 张未使用的表**：

- ❌ `model_relations` - 模型关系表（已删除）
- ❌ `instance_relations` - 实例关系表（已删除）

保留了 **3 张正在使用的动态引擎表**：

- ✅ `models` - 模型定义表
- ✅ `model_attributes` - 模型属性表
- ✅ `model_instances` - 模型实例表（分区表）

---

## 🧪 测试步骤

### 准备工作

#### 1️⃣ 启动 Docker（如果尚未运行）

```bash
# 启动 Docker Desktop（macOS）
# 或者从命令行启动 Docker 服务

# 验证 Docker 是否运行
docker --version
docker ps
```

#### 2️⃣ 启动数据库

```bash
# 方式1: 仅启动数据库
make dev-db

# 方式2: 使用 docker-compose
docker-compose up -d db

# 验证数据库是否启动
docker-compose ps db
```

#### 3️⃣ 等待数据库就绪

```bash
# 等待 PostgreSQL 完全启动（约 5-10 秒）
sleep 10

# 或手动检查日志
docker-compose logs -f db
# 看到 "database system is ready to accept connections" 后按 Ctrl+C
```

---

### 测试场景 1: 全新数据库（推荐）

**适用场景**：空数据库，首次运行迁移

```bash
# 1. 确保数据库为空（可选，如果是全新环境可跳过）
make db-migrate-down

# 2. 运行所有迁移
make db-migrate-up

# 3. 验证表是否正确创建
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "\dt"

# 预期输出应该包含 9 张表：
# - businesses
# - business_personnel
# - business_sets
# - business_set_members
# - models
# - model_attributes
# - model_instances
# - cloud_areas
# - hosts
```

---

### 测试场景 2: 已有数据库（增量更新）

**适用场景**：已经运行过旧版本迁移，需要更新

```bash
# 1. 检查当前迁移版本
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb \
  -c "SELECT version, dirty FROM schema_migrations;"

# 2. 回滚到 dynamic_model_engine 之前
make db-migrate-down
# 输入次数直到回滚到 20260113120000 之前

# 3. 重新运行更新后的迁移
make db-migrate-up

# 4. 验证不再有 model_relations 和 instance_relations 表
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb \
  -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      AND tablename IN ('model_relations', 'instance_relations');"

# 预期输出：(0 rows)
```

---

### 测试场景 3: SQL 语法验证

**验证迁移文件的 SQL 语法是否正确**

```bash
# 1. 验证 up 迁移文件语法
docker exec -i wend-cmdb-backend-db-1 psql -U cmdb -d postgres \
  -c "CREATE DATABASE test_migration;"

docker exec -i wend-cmdb-backend-db-1 psql -U cmdb -d test_migration \
  < migrations/20260113120000_dynamic_model_engine.up.sql

# 如果没有错误，说明语法正确

# 2. 清理测试数据库
docker exec -i wend-cmdb-backend-db-1 psql -U cmdb -d postgres \
  -c "DROP DATABASE test_migration;"
```

---

## ✅ 验证清单

运行以下命令验证迁移成功：

### 1. 检查表数量

```bash
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "\dt"
```

**预期结果**：9 张表 + schema_migrations 表 = 总共 10 张

### 2. 检查不应存在的表

```bash
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('model_relations', 'instance_relations');
"
```

**预期结果**：`(0 rows)`

### 3. 检查应该存在的表

```bash
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

**预期结果**：
```
tablename
-------------------------
businesses
business_personnel
business_set_members
business_sets
cloud_areas
hosts
model_attributes
model_instances
models
schema_migrations
(10 rows)
```

### 4. 检查 model_instances 分区表

```bash
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "
SELECT
  tablename,
  schemaname
FROM pg_tables
WHERE tablename = 'model_instances';
"
```

**预期结果**：应该显示 `model_instances` 表存在

### 5. 检查索引

```bash
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "
SELECT indexname FROM pg_indexes
WHERE tablename = 'model_instances'
ORDER BY indexname;
"
```

**预期结果**：应该有 5 个索引（包括主键）：
- `model_instances_pkey`
- `idx_model_instances_business`
- `idx_model_instances_deleted`
- `idx_model_instances_path_gist`
- `idx_model_instances_properties_gin`
- `idx_model_instances_tenant`

### 6. 检查扩展

```bash
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb -c "
SELECT extname FROM pg_extension WHERE extname = 'ltree';
"
```

**预期结果**：
```
extname
---------
ltree
(1 row)
```

---

## 🐛 常见问题

### Q1: Docker 无法启动

```bash
# macOS: 打开 Docker Desktop
open -a Docker

# 等待 Docker 完全启动（看到托盘图标稳定）
sleep 30

# 重试
make dev-db
```

### Q2: 数据库连接失败

```bash
# 检查数据库容器状态
docker-compose ps db

# 如果状态不是 "running"，重启
docker-compose down
docker-compose up -d db

# 查看日志
docker-compose logs -f db
```

### Q3: 迁移失败 "dirty database version"

```bash
# 强制修复迁移版本
docker exec -it wend-cmdb-backend-db-1 psql -U cmdb -d cmdb \
  -c "UPDATE schema_migrations SET dirty = false;"

# 或完全重置数据库
docker-compose down -v  # 删除所有数据
docker-compose up -d db
sleep 10
make db-migrate-up
```

### Q4: 找不到 golang-migrate

```bash
# Makefile 会自动下载，但如果失败可以手动安装
go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# 或使用 brew (macOS)
brew install golang-migrate
```

---

## 📊 清理效果总结

### 修改前

```
migrations/20260113120000_dynamic_model_engine.up.sql: 96 行
包含表：
  - models ✅
  - model_attributes ✅
  - model_relations ❌ (未使用)
  - model_instances ✅
  - instance_relations ❌ (未使用)
```

### 修改后

```
migrations/20260113120000_dynamic_model_engine.up.sql: 69 行 (-27 行)
包含表：
  - models ✅
  - model_attributes ✅
  - model_instances ✅
```

**减少**：
- 表数量：5 → 3 (-40%)
- 代码行数：96 → 69 (-28%)
- 未使用的索引：4 个

**好处**：
- ✅ 数据库更简洁
- ✅ 迁移时间更短
- ✅ 维护成本降低
- ✅ 避免未来的困惑

---

## 🎯 下一步

### 迁移测试通过后：

1. **更新文档**
   - ✅ 本测试指南已创建
   - 📝 更新 `HOST_IMPORT_GUIDE.md`（如果涉及）
   - 📝 更新 `ARCHITECTURE_REFACTOR_SUMMARY.md`

2. **提交更改**
   ```bash
   git add migrations/
   git commit -m "refactor: remove unused model_relations and instance_relations tables

   - Removed model_relations table (never used in code)
   - Removed instance_relations table (never used in code)
   - Updated migration down scripts
   - Reduced migration file from 96 to 69 lines
   - Kept only actively used tables: models, model_attributes, model_instances"
   ```

3. **通知团队**
   - 如果有团队成员，告知他们重新运行迁移
   - 更新团队文档和最佳实践

---

**测试完成！** 🎉

如果所有验证都通过，说明清理工作成功！
