# 手工接口测试清单（快速版）

适用范围：`/api/v1` 下当前服务已注册的接口（含健康检查）。

## 1) 先跑一轮自动冒烟（10 分钟）

先用现有脚本兜底，快速发现明显问题，再做手工验证。

```bash
# 方式 1：覆盖较多模块
bash scripts/test-api.sh

# 方式 2：另一套回归脚本
bash scripts/api_test.sh
```

如果服务不是 `localhost:8080`，可这样传参：

```bash
BASE_URL=http://localhost:8080 bash scripts/test-api.sh
bash scripts/api_test.sh http://localhost:8080
```

## 2) 手工测试环境模板（建议固定）

- `baseUrl`: `http://localhost:8080`
- `tenantId`: `ce307a3d-a1a7-4838-ab0b-23182f9851c3`（动态模型相关接口建议带上）
- 公共 Header:
  - `Content-Type: application/json`
  - `X-Tenant-ID: {{tenantId}}`（动态模型/实例相关）

## 3) 测试执行顺序（避免数据依赖卡住）

1. 健康检查
2. 业务与业务集
3. 云区域与主机
4. 拓扑（Set/Module/主机转移）
5. 服务模板/进程模板/进程
6. 资源池目录与资源池主机
7. 动态模型（新）与导入导出
8. 兼容动态模型（`/models`）
9. 清理测试数据

## 4) 通用断言（每个接口最少做这 4 条）

- 成功场景：状态码正确（`200/201`），关键字段存在（`id/name/data`）。
- 参数错误：缺必填或类型错误，返回 `400`。
- 资源不存在：随机 UUID/ID，返回 `404`。
- 冲突场景：唯一键重复（如 identifier/IP），返回 `409`（若该接口有唯一约束）。

## 5) 全量接口清单（按模块）

说明：每条建议至少做 1 个成功用例；关键接口再补 1 个失败用例。

### A. 健康检查

- [ ] `GET /health`

### B. 业务管理（Business）

- [ ] `POST /api/v1/businesses`
- [ ] `GET /api/v1/businesses`
- [ ] `GET /api/v1/businesses/:id`
- [ ] `PUT /api/v1/businesses/:id`
- [ ] `DELETE /api/v1/businesses/:id`

### C. 业务集管理（Business Set）

- [ ] `POST /api/v1/business-sets`
- [ ] `GET /api/v1/business-sets`
- [ ] `GET /api/v1/business-sets/:id`
- [ ] `PUT /api/v1/business-sets/:id`
- [ ] `DELETE /api/v1/business-sets/:id`
- [ ] `POST /api/v1/business-sets/:id/members`
- [ ] `GET /api/v1/business-sets/:id/members`
- [ ] `DELETE /api/v1/business-sets/:id/members/:business_id`

### D. 云区域（Cloud Area）

- [ ] `POST /api/v1/cloud-areas`
- [ ] `GET /api/v1/cloud-areas`
- [ ] `GET /api/v1/cloud-areas/default`
- [ ] `GET /api/v1/cloud-areas/:id`
- [ ] `PUT /api/v1/cloud-areas/:id`
- [ ] `DELETE /api/v1/cloud-areas/:id`

### E. 主机管理（Host）

- [ ] `POST /api/v1/hosts`
- [ ] `POST /api/v1/hosts/batch`
- [ ] `GET /api/v1/hosts`
- [ ] `GET /api/v1/hosts/:id`
- [ ] `PUT /api/v1/hosts/:id`
- [ ] `PUT /api/v1/hosts/:id/custom-fields`
- [ ] `PUT /api/v1/hosts/:id/assign`
- [ ] `PUT /api/v1/hosts/:id/reclaim`
- [ ] `DELETE /api/v1/hosts/:id`

### F. 业务拓扑（Topology）

- [ ] `GET /api/v1/topology/tree`
- [ ] `GET /api/v1/topology/nodes/:type/:id/children`
- [ ] `GET /api/v1/topology/statistics`
- [ ] `POST /api/v1/topology/sets`
- [ ] `GET /api/v1/topology/sets`
- [ ] `GET /api/v1/topology/sets/:id`
- [ ] `PUT /api/v1/topology/sets/:id`
- [ ] `DELETE /api/v1/topology/sets/:id`
- [ ] `POST /api/v1/topology/sets/:id/move`
- [ ] `POST /api/v1/topology/modules`
- [ ] `GET /api/v1/topology/modules`
- [ ] `GET /api/v1/topology/modules/:id`
- [ ] `PUT /api/v1/topology/modules/:id`
- [ ] `DELETE /api/v1/topology/modules/:id`
- [ ] `POST /api/v1/topology/modules/:id/move`
- [ ] `GET /api/v1/topology/modules/:id/hosts`
- [ ] `POST /api/v1/topology/hosts/transfer`
- [ ] `POST /api/v1/topology/hosts/transfer-to-pool`
- [ ] `POST /api/v1/topology/businesses/:id/initialize`

### G. 进程模板与进程

- [ ] `POST /api/v1/process-templates`
- [ ] `GET /api/v1/process-templates`
- [ ] `GET /api/v1/process-templates/:id`
- [ ] `PUT /api/v1/process-templates/:id`
- [ ] `DELETE /api/v1/process-templates/:id`
- [ ] `POST /api/v1/processes`
- [ ] `GET /api/v1/processes`
- [ ] `POST /api/v1/processes/batch`
- [ ] `GET /api/v1/processes/:id`
- [ ] `PUT /api/v1/processes/:id`
- [ ] `DELETE /api/v1/processes/:id`
- [ ] `POST /api/v1/processes/:id/status`
- [ ] `GET /api/v1/hosts/:id/processes`
- [ ] `GET /api/v1/modules/:id/process-summary`

### H. 服务模板与集群模板

- [ ] `POST /api/v1/service-templates`
- [ ] `GET /api/v1/service-templates`
- [ ] `GET /api/v1/service-templates/:id`
- [ ] `PUT /api/v1/service-templates/:id`
- [ ] `DELETE /api/v1/service-templates/:id`
- [ ] `POST /api/v1/service-templates/:id/process-templates`
- [ ] `DELETE /api/v1/service-templates/:id/process-templates/:ptid`
- [ ] `POST /api/v1/service-templates/:id/create-module`
- [ ] `POST /api/v1/service-templates/:id/sync`
- [ ] `POST /api/v1/set-templates`
- [ ] `GET /api/v1/set-templates`
- [ ] `GET /api/v1/set-templates/:id`
- [ ] `DELETE /api/v1/set-templates/:id`
- [ ] `POST /api/v1/set-templates/:id/create-set`

### I. 资源池（Resource Pool）

- [ ] `POST /api/v1/resource-pool/directories`
- [ ] `GET /api/v1/resource-pool/directories`
- [ ] `GET /api/v1/resource-pool/directories/tree`
- [ ] `GET /api/v1/resource-pool/directories/:id`
- [ ] `PUT /api/v1/resource-pool/directories/:id`
- [ ] `DELETE /api/v1/resource-pool/directories/:id`
- [ ] `POST /api/v1/resource-pool/directories/:id/move`
- [ ] `GET /api/v1/resource-pool/hosts`
- [ ] `POST /api/v1/resource-pool/hosts/import`
- [ ] `POST /api/v1/resource-pool/hosts/move`
- [ ] `POST /api/v1/resource-pool/hosts/allocate`
- [ ] `POST /api/v1/resource-pool/hosts/reclaim`
- [ ] `GET /api/v1/resource-pool/statistics`

### J. 动态模型（新路由 `/dynamic-models`）

- [ ] `POST /api/v1/dynamic-models`
- [ ] `GET /api/v1/dynamic-models`
- [ ] `GET /api/v1/dynamic-models/:uid`
- [ ] `PUT /api/v1/dynamic-models/:uid`
- [ ] `DELETE /api/v1/dynamic-models/:uid`
- [ ] `POST /api/v1/dynamic-models/:uid/attributes`
- [ ] `GET /api/v1/dynamic-models/:uid/attributes`
- [ ] `PUT /api/v1/dynamic-models/:uid/attributes/:field_uid`
- [ ] `DELETE /api/v1/dynamic-models/:uid/attributes/:field_uid`
- [ ] `POST /api/v1/dynamic-models/:uid/instances`
- [ ] `GET /api/v1/dynamic-models/:uid/instances`
- [ ] `GET /api/v1/dynamic-models/:uid/instances/:id`
- [ ] `DELETE /api/v1/dynamic-models/:uid/instances/:id`
- [ ] `GET /api/v1/dynamic-models/:uid/instances/:id/relations`
- [ ] `GET /api/v1/dynamic-models/:uid/instances/:id/topology`
- [ ] `GET /api/v1/dynamic-models/:uid/instances/:id/history`
- [ ] `POST /api/v1/dynamic-models/relations`
- [ ] `DELETE /api/v1/dynamic-models/relations/:id`

### K. 导入导出（动态模型扩展）

- [ ] `GET /api/v1/dynamic-models/:uid/template`
- [ ] `GET /api/v1/dynamic-models/:uid/template-info`
- [ ] `POST /api/v1/dynamic-models/:uid/import`
- [ ] `POST /api/v1/dynamic-models/:uid/validate-template`
- [ ] `GET /api/v1/dynamic-models/:uid/export`
- [ ] `GET /api/v1/dynamic-models/:uid/import-guide`

### L. 兼容动态模型（旧路由 `/models`）

- [ ] `GET /api/v1/models`
- [ ] `POST /api/v1/models`
- [ ] `GET /api/v1/models/:name`
- [ ] `POST /api/v1/models/:name/attributes`
- [ ] `POST /api/v1/models/:name/instances`
- [ ] `POST /api/v1/models/:name/instances/batch`
- [ ] `GET /api/v1/models/:name/instances`

## 6) 建议优先补测的高风险点

- [ ] 删除类接口的前置约束（如业务 lifecycle、默认云区域不可删）。
- [ ] 列表分页边界（`limit=0`、超大 `limit`、`offset` 越界）。
- [ ] 关联与转移接口（`assign/reclaim/transfer/move`）的数据一致性。
- [ ] 批量接口（`/batch`）的部分失败返回（`207`）与错误明细。
- [ ] 导入导出（模板校验失败、空文件、字段不匹配）。

## 7) 测试记录模板（直接复制）

```text
[模块] 主机管理
- 用例: PUT /api/v1/hosts/:id/assign（成功）
  - 请求参数: host_id=..., business_id=...
  - 期望: 200, 返回 business_id 更新
  - 结果: ✅ / ❌
  - 备注: ...

- 用例: PUT /api/v1/hosts/:id/assign（失败）
  - 请求参数: business_id=不存在
  - 期望: 404
  - 结果: ✅ / ❌
  - 备注: ...
```

---

路由来源：`internal/api/server/server.go`、`internal/api/server/routes_host.go`、`internal/api/server/routes_topology.go`、`internal/api/server/routes_process_template.go`、`internal/api/server/routes_dynamic_model.go`、`internal/api/server/routes_import_export.go`。
