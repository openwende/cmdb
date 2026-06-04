# API 响应格式规范（R8）

> 目的：收敛历史上三套并存的响应形状。**新端点一律遵循本规范；存量端点逐步迁移**——
> 切勿一次性改形状，否则会破坏依赖现有形状的前端消费端（详见迁移策略）。

## 历史问题（R8 现象）

| 端点 | 现有形状 |
|---|---|
| `/businesses` | `{ success, data: { items, total, limit, offset } }` |
| `/resource-pool/*`、`/topology/*` | `{ code: 0, data: { ..., pagination: { page, page_size, total } } }` |
| `/hosts/batch` | 裸 `{ created_ids, ... }` + HTTP **207** |

包裹结构（`success` vs `code`）、分页字段（`limit/offset` vs `page/page_size`）、批量状态码（207 vs 200）三处不一致。

## 统一规范

选 `code` 作为统一包裹标识（资源池/拓扑等多数端点已采用 `{code,data}`）。

| 场景 | 形状 | HTTP |
|---|---|---|
| 成功 | `{ "code": 0, "data": <payload> }` | 200 |
| 创建 | `{ "code": 0, "data": <payload> }` | 201 |
| 失败 | `{ "code": <非0>, "error": "<message>" }` | 对应状态码 |
| 分页列表 | `{ "code": 0, "data": { "items": [...], "pagination": { "page", "page_size", "total" } } }` | 200 |
| 批量 | HTTP **200**；体内 `{ total, successful, failed, errors/failed_items }` 表达部分失败 | 200 |

**批量统一为 200**：不要用 2xx/4xx/207 混合表达批量结果——前端统一按响应体的 `failed/successful` 判定（参见 `AssignModal`/`TransferHost` 的处理）。

## 助手（`internal/api/response`）

新端点用 `response` 包写响应，自动符合规范：

```go
import "github.com/wend/cmdb-backend/internal/api/response"

response.OK(c, data)                          // {"code":0,"data":data}            200
response.Created(c, data)                     // {"code":0,"data":data}            201
response.List(c, items, page, pageSize, total)// {"code":0,"data":{items,pagination}} 200
response.Error(c, http.StatusBadRequest, msg) // {"code":400,"error":msg}          400
```

示范端点：`GET /api/v1/hosts/statistics`（`HostHandler.GetHostStatistics`）已采用 `response.OK`。

## 迁移策略（存量端点）

存量端点的形状被前端各自依赖，**禁止一次性批量改形状**。按域逐接口迁移，每接口：

1. 后端改用 `response.*`；
2. 同步改对应前端消费端（适配新字段：`success→code`、`limit/offset→page/page_size`）；
3. 联调验证该接口的列表/详情/错误分支；
4. 一个 PR 收敛一个域，避免大范围回归。

> 状态：标准 + 助手 + 示范端点已落；存量迁移按上述策略逐接口推进。
> **已收口**：`/businesses`、`/hosts`、`/business-sets`、`/cloud-areas`、`/:id/dynamic-groups` 列表
> （均 `response.List`，仅 `{code,data:{items,pagination}}`）、
> `/hosts/batch` 批量导入（`response.OK`，批量统一 HTTP **200**——部分/全部失败由响应体
> `successful/failed/errors` 表达，不再用 207/400；前端按 body 判定，见 E2E 清单 R8）。
> - `/cloud-areas`：旧扁平 `{total,page,page_size,cloud_areas}` → 标准；前端无真实消费端
>   （`Foreignkey` 走 mock），纯后端替换。
> - `/:id/dynamic-groups`：旧 `{code,data:{items,total,limit,offset}}` → 标准 pagination；
>   前端 `DynamicGroup/index.tsx` 改读 `data.pagination?.total ?? data.total`（防御回退）。
> - `/models/:name/instances/batch`：旧裸 `{count,ids}`+201 → `response.Created`（`{code,data:{count,ids}}`+201）；
>   全成功/全失败语义保留 201，前端零消费此端点。`/processes/batch` 早已是 `{code,data}`。
> - `/models/:name/instances`（实例列表）：旧 `{data:[],meta:{total,page,page_size}}` → `response.List`；
>   无活前端消费端（唯一引用方 `ModelDetail` 是未路由死代码；活实例 tab 走另一端点 `/v1/instances` aggregate，早已标准）。
>   死代码读法 + 类型一并改标准形状以保持类型一致。
> **剩余**：v2 `resource_graph`（`{success}`）已裁定不扶正、不迁。R8 的 list/batch 存量端点（除 v2）已全部收口。
