# 批量导入导出功能使用指南

## 📋 目录

1. [功能概述](#功能概述)
2. [导入模板生成](#导入模板生成)
3. [批量导入](#批量导入)
4. [数据导出](#数据导出)
5. [模板版本管理](#模板版本管理)
6. [API参考](#api参考)

---

## 功能概述

### 核心特性

✅ **智能模板生成** - 根据模型字段自动生成 Excel 导入模板
✅ **字段变更检测** - 自动检测字段定义变更，提示重新下载模板
✅ **严格数据校验** - 类型、范围、枚举、正则等全面校验
✅ **友好错误报告** - 详细的错误信息，定位到具体行和字段
✅ **批量导入优化** - 支持大批量数据导入（推荐每次 < 5000 条）
✅ **导入模式选择** - 支持仅验证、跳过错误等多种模式
✅ **数据导出** - 支持按条件导出数据为 Excel

---

## 导入模板生成

### 下载导入模板

```bash
# 下载主机模型的导入模板
curl -O http://localhost:8080/api/v1/dynamic-models/host/template
```

**生成的模板包含 3 个工作表**：

#### 1️⃣ 数据导入（Sheet1）

```
┌────────────────────────────────────────────────────────────┐
│ Row 1: 字段显示名称（表头）                                  │
│        - 红色背景 = 必填字段                                 │
│        - 蓝色背景 = 可选字段                                 │
├────────────────────────────────────────────────────────────┤
│ Row 2: 字段说明                                             │
│        - [类型] 必填 单位:核 范围:1-256                      │
├────────────────────────────────────────────────────────────┤
│ Row 3: 示例数据                                             │
│        - web-server-01, 192.168.1.100, 16...                │
├────────────────────────────────────────────────────────────┤
│ Row 4+: 从这里开始填写实际数据                              │
│                                                              │
└────────────────────────────────────────────────────────────┘
```

**功能亮点**：
- ✅ 冻结前 3 行，滚动时始终可见说明
- ✅ 枚举字段自动生成下拉列表（数据验证）
- ✅ 自动调整列宽
- ✅ 必填字段红色高亮提示

#### 2️⃣ 导入说明（Sheet2）

包含：
- 📋 基本信息（模型名称、字段数量、生成时间）
- 📝 使用步骤（6 步完整流程）
- ⚠️ 必填字段列表
- ⚠️ 注意事项

#### 3️⃣ 字段配置（Sheet3，隐藏）

用于导入时验证模板有效性，包含：
- 模板元数据（ModelUID, Version, FieldsHash）
- 完整的字段配置（FieldUID, Type, Validators）

**⚠️ 重要：请勿删除此工作表！**

---

## 批量导入

### Step 1: 获取模板信息（可选）

```bash
# 检查当前模板版本
curl http://localhost:8080/api/v1/dynamic-models/host/template-info
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "model_uid": "host",
    "model_name": "主机",
    "fields_hash": "abc123def456",
    "total_fields": 20,
    "required_fields": 5,
    "version": "v1"
  }
}
```

**用途**：前端可以缓存 `fields_hash`，下次导入时对比，如果不同提示用户重新下载模板。

---

### Step 2: 填写 Excel 模板

#### 示例数据：

| 云区域ID | 主IP地址 | 主机名 | CPU核数 | 内存(MB) | 操作系统 |
|---------|---------|--------|---------|---------|---------|
| 00000000-0000-0000-0000-000000000000 | 192.168.1.100 | web-server-01 | 16 | 32768 | linux |
| 00000000-0000-0000-0000-000000000000 | 192.168.1.101 | web-server-02 | 32 | 65536 | linux |
| 00000000-0000-0000-0000-000000000000 | 192.168.1.102 | db-server-01 | 64 | 131072 | linux |

#### 填写规范：

**✅ 正确示例**：
```
CPU核数: 16         ✅
内存:    32768      ✅
操作系统: linux      ✅ (从下拉列表选择)
主IP:    192.168.1.100  ✅
```

**❌ 错误示例**：
```
CPU核数: 16核       ❌ (不要带单位)
内存:    32GB       ❌ (应该用 MB，填 32768)
操作系统: centos     ❌ (不在枚举值列表中)
主IP:    192.168.1  ❌ (IP格式不完整)
```

---

### Step 3: 上传并导入

```bash
# 基本导入（遇到错误跳过，继续导入后续数据）
curl -X POST http://localhost:8080/api/v1/dynamic-models/host/import \
  -H "X-User-ID: admin" \
  -F "file=@主机_导入模板.xlsx" \
  -F "skip_errors=true" \
  -F "update_existing=true"
```

**请求参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|-------|------|
| `file` | file | 必填 | Excel 文件（.xlsx） |
| `skip_errors` | bool | true | 遇到错误是否继续导入 |
| `update_existing` | bool | true | 是否更新已存在记录（基于唯一键） |
| `validate_only` | bool | false | 仅验证，不实际导入 |

**响应示例**：

```json
{
  "code": 0,
  "data": {
    "total": 100,
    "successful": 95,
    "failed": 3,
    "skipped": 2,
    "errors": [
      {
        "row": 15,
        "row_data": {
          "主机名": "invalid-host",
          "主IP地址": "192.168.1"
        },
        "field": "主IP地址",
        "error": "IP地址格式不正确",
        "error_type": "validation"
      },
      {
        "row": 28,
        "error": "[DUPLICATE_RESOURCE] 资源已存在，字段 [cloud_id, inner_ip] 违反唯一性约束",
        "error_type": "duplicate"
      }
    ],
    "created_ids": [1, 2, 3, ...],
    "template_valid": true,
    "fields_changed": false
  },
  "message": "导入完成。成功: 95, 失败: 3, 跳过: 2"
}
```

---

### Step 4: 处理错误

#### 错误类型：

**1. validation（校验错误）**
```json
{
  "row": 15,
  "field": "CPU核数",
  "error": "字段 [CPU核数] 不能大于 256",
  "error_type": "validation"
}
```
**解决方法**：修正数据后重新导入

**2. duplicate（唯一性冲突）**
```json
{
  "row": 28,
  "error": "IP address 192.168.1.100 already exists",
  "error_type": "duplicate"
}
```
**解决方法**：
- 删除重复数据
- 或设置 `update_existing=true` 更新现有记录

**3. system（系统错误）**
```json
{
  "row": 50,
  "error": "数据库连接超时",
  "error_type": "system"
}
```
**解决方法**：检查系统状态，稍后重试

---

## 仅验证模式

在正式导入前，建议先验证数据：

```bash
curl -X POST http://localhost:8080/api/v1/dynamic-models/host/import \
  -F "file=@主机_导入模板.xlsx" \
  -F "validate_only=true"
```

**特点**：
- ✅ 不会实际写入数据库
- ✅ 快速检查所有行的数据格式
- ✅ 返回完整的校验报告

---

## 数据导出

### 导出所有数据

```bash
curl -O http://localhost:8080/api/v1/dynamic-models/host/export
```

### 按条件导出

```bash
# 导出所有 Linux 主机
curl -O "http://localhost:8080/api/v1/dynamic-models/host/export?os_type=linux"

# 导出特定云区域的主机
curl -O "http://localhost:8080/api/v1/dynamic-models/host/export?cloud_area_id=xxx-xxx-xxx"
```

**导出的 Excel 包含**：
- Sheet1: 导出数据（所有字段）
- Sheet2: 导出信息（模型名称、导出时间、记录数量）

---

## 模板版本管理

### 问题场景

管理员在系统中新增了一个必填字段 `owner`（负责人），但用户使用的是旧模板导入。

### 智能检测机制

#### 1. 下载新模板时自动记录字段配置

```json
// 隐藏的【字段配置】工作表
{
  "metadata": {
    "model_uid": "host",
    "fields_hash": "abc123",  // 字段配置哈希
    "generated_at": "2026-02-07T10:00:00Z",
    "total_fields": 21,
    "required_fields": 6
  }
}
```

#### 2. 导入时自动验证

```bash
# 用户上传旧模板
curl -X POST .../import -F "file=@旧模板.xlsx"
```

**系统检测到字段变更，返回错误**：
```json
{
  "error": "字段定义已变更，请重新下载最新模板",
  "result": {
    "template_valid": true,
    "fields_changed": true,
    "missing_fields": ["负责人"],  // 新增的必填字段
    "obsolete_fields": []          // 已删除的字段
  }
}
```

#### 3. 前端处理建议

```javascript
// 前端代码示例
async function checkTemplateVersion(modelUID) {
  // 获取最新模板信息
  const latestInfo = await fetch(`/api/v1/dynamic-models/${modelUID}/template-info`);
  const latest = await latestInfo.json();

  // 获取本地缓存的哈希
  const cachedHash = localStorage.getItem(`template_hash_${modelUID}`);

  if (cachedHash !== latest.data.fields_hash) {
    // 提示用户重新下载模板
    alert('模板已更新，请重新下载最新模板！');
    return false;
  }

  return true;
}
```

---

## API 参考

### 1. 下载导入模板
```http
GET /api/v1/dynamic-models/:uid/template
```

**响应**：Excel 文件流

---

### 2. 获取模板信息
```http
GET /api/v1/dynamic-models/:uid/template-info
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "model_uid": "host",
    "model_name": "主机",
    "fields_hash": "abc123",
    "total_fields": 20,
    "required_fields": 5,
    "version": "v1"
  }
}
```

---

### 3. 上传并导入
```http
POST /api/v1/dynamic-models/:uid/import
Content-Type: multipart/form-data

file: <Excel文件>
skip_errors: true
update_existing: true
validate_only: false
```

**响应**：ImportResult（见上文示例）

---

### 4. 验证模板
```http
POST /api/v1/dynamic-models/:uid/validate-template
Content-Type: multipart/form-data

file: <Excel文件>
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "valid": true,
    "fields_changed": false,
    "missing_fields": [],
    "obsolete_fields": [],
    "total_rows": 100,
    "validation_errors": []
  }
}
```

---

### 5. 导出数据
```http
GET /api/v1/dynamic-models/:uid/export?os_type=linux
```

**响应**：Excel 文件流

---

### 6. 下载导入指南
```http
GET /api/v1/dynamic-models/:uid/import-guide
```

**响应**：Markdown 文件

---

## 最佳实践

### 📌 大批量导入

如果需要导入超过 5000 条数据：

```bash
# 1. 将数据分割成多个文件（每个 < 5000 条）
split -l 5000 hosts.csv hosts_part_

# 2. 分别导入
for file in hosts_part_*; do
  curl -X POST .../import -F "file=@$file"
done
```

### 📌 增量导入

```bash
# 设置 update_existing=true，自动更新已存在的记录
curl -X POST .../import \
  -F "file=@增量数据.xlsx" \
  -F "update_existing=true"
```

### 📌 严格模式

```bash
# 设置 skip_errors=false，遇到第一个错误立即停止
curl -X POST .../import \
  -F "file=@数据.xlsx" \
  -F "skip_errors=false"
```

### 📌 导入前验证

```bash
# 1. 先验证
curl -X POST .../import -F "file=@数据.xlsx" -F "validate_only=true"

# 2. 检查错误

# 3. 修正后正式导入
curl -X POST .../import -F "file=@数据.xlsx"
```

---

## 常见问题

### Q1: 如何知道模板是否过期？

**A**: 调用 `/template-info` API 获取最新的 `fields_hash`，与本地缓存对比。

### Q2: 导入失败了怎么办？

**A**: 查看响应中的 `errors` 数组，定位具体的错误行和字段。

### Q3: 可以同时导入多个模型吗？

**A**: 不可以。每个模板只能导入对应的单一模型。

### Q4: 支持 CSV 格式吗？

**A**: 目前仅支持 Excel（.xlsx）。CSV 可以先转换为 Excel。

### Q5: 导入时会验证唯一性吗？

**A**: 会。系统会根据模型定义的唯一键（如 cloud_id + inner_ip）自动检测重复。

### Q6: 如何批量更新数据？

**A**: 使用 `update_existing=true` 参数，系统会根据唯一键自动判断是创建还是更新。

---

## 🎉 总结

这套批量导入导出系统提供了：

✅ **智能模板生成** - 字段定义自动同步
✅ **版本管理** - 字段变更自动检测
✅ **严格校验** - 类型、范围、枚举全覆盖
✅ **友好提示** - 详细的错误定位
✅ **灵活导入** - 支持多种模式
✅ **数据导出** - 按条件导出

**现在你可以高效地批量管理 CMDB 资源了！** 🚀
