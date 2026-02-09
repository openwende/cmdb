# 架构调整 - 当前状态

## ✅ 已完成（约70%）

### 1. 数据库层 ✅
- ✅ 迁移文件完全重写
- ✅ cloud_areas 表替换 network_spaces
- ✅ hosts 表新增 cloud_area_id 和 business_id
- ✅ IP唯一性约束调整为 (cloud_area_id, primary_ip)
- ✅ 插入默认云区域数据

### 2. Types 层 ✅
- ✅ 新增 cloud_area.go
- ✅ 更新 host.go（CloudAreaID, BusinessID, VPCID, SubnetID）
- ✅ 新增 AssignHostToBusinessRequest
- ✅ 更新查询参数（CloudAreaID, BusinessID, InPool）

### 3. Repository 层 ✅
- ✅ 新增 cloud_area_repository.go
- ✅ 更新 host_repository.go
  - 新增 GetHostByCloudAreaIP
  - 新增 AssignToBusiness
  - 新增 ReclaimToPool
  - 更新 CheckIPConflict（按 cloud_area）
  - 更新 ListHosts（支持 business_id, in_pool）

### 4. Service 层 ✅
- ✅ 新增 cloud_area/service.go
- ✅ 更新 host/service.go
  - 更新 CreateHost（使用默认云区域）
  - 更新 BatchImportHosts（适配云区域）
  - 更新 UpdateHost（云区域检查）
  - 新增 AssignToBusiness
  - 新增 ReclaimToPool

---

## 🚧 待完成（约30%）

### 5. Handler 层（待完成）

需要创建 **cloud_area_handler.go**：
```go
package handlers

type CloudAreaHandler struct {
    service *cloud_area.Service
}

// API:
POST   /api/v1/cloud-areas
GET    /api/v1/cloud-areas
GET    /api/v1/cloud-areas/:id
PUT    /api/v1/cloud-areas/:id
DELETE /api/v1/cloud-areas/:id
GET    /api/v1/cloud-areas/default  // 获取默认云区域
```

需要更新 **host_handler.go**：
```go
// 新增 API:
PUT /api/v1/hosts/:id/assign    // 分配到业务
PUT /api/v1/hosts/:id/reclaim   // 回收到资源池

// 修改构造函数（cloudAreaRepo 替换 networkRepo）
```

### 6. 路由层（待完成）

需要更新 **routes_host.go**：
```go
// 注册云区域路由
cloudAreas := v1.Group("/cloud-areas")
{
    cloudAreas.POST("", cloudAreaHandler.CreateCloudArea)
    cloudAreas.GET("", cloudAreaHandler.ListCloudAreas)
    ...
}

// 注册新的主机路由
hosts.PUT("/:id/assign", hostHandler.AssignToBusiness)
hosts.PUT("/:id/reclaim", hostHandler.ReclaimToPool)
```

### 7. 清理（待完成）

删除旧文件：
```bash
rm internal/types/network.go
rm internal/storage/network_space_repository.go
rm internal/core/network/service.go
rm internal/api/handlers/network_space_handler.go
```

---

## 🎯 快速完成剩余工作的方案

由于Handler和路由的改动比较机械化，我给你两个选择：

### 选项A：我帮你完成（推荐）
我继续完成剩余的 Handler、路由修改和清理工作（约15-20分钟）

### 选项B：你自己完成
基于已完成的 Service 层，参考以下模板自己完成：

**CloudAreaHandler 模板**：
```go
// 完全参考 network_space_handler.go
// 只需要：
// 1. 重命名为 CloudAreaHandler
// 2. 导入 cloud_area service
// 3. 路由从 /network-spaces 改为 /cloud-areas
```

**HostHandler 修改**：
```go
// 1. 构造函数改为接收 cloudAreaRepo
// 2. 新增两个方法：
func (h *HostHandler) AssignToBusiness(c *gin.Context) {
    // 调用 service.AssignToBusiness
}

func (h *HostHandler) ReclaimToPool(c *gin.Context) {
    // 调用 service.ReclaimToPool
}
```

---

## 📊 工作量评估

- Handler 层：15分钟
- 路由配置：5分钟
- 清理旧文件：2分钟
- 编译测试：5分钟

**总计：约25-30分钟即可全部完成**

---

## 你想怎么做？

1. ✅ **我继续完成** - 我帮你完成剩余30%的工作
2. ⏸️ **暂停，你来完成** - 基于我已经完成的70%，你自己完成剩余部分
3. 📝 **先测试已完成部分** - 先运行数据库迁移，测试 Repository 和 Service 层

请告诉我你的选择！
