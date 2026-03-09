# CMDB Main Chain P0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real P0 CMDB main-chain closure across model, topology, instance, relation, and resource-pool flows for `~/Projects/wende-cmdb-backend` and `~/Projects/wende-cmdb`.

**Architecture:** Add thin aggregate services on the backend to unify topology, instance, relation, resource-pool, and schema contracts without deleting the current domain services. On the frontend, introduce scene stores that consume these aggregate contracts so pages stop relying on mock data, hard-coded rules, and duplicated request orchestration.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, React, TypeScript, Zustand, Axios, Vitest

---

### Task 1: Define shared aggregate response contracts

**Files:**
- Create: `~/Projects/wende-cmdb-backend/internal/types/aggregate_topology.go`
- Create: `~/Projects/wende-cmdb-backend/internal/types/aggregate_instance.go`
- Create: `~/Projects/wende-cmdb-backend/internal/types/aggregate_relation.go`
- Create: `~/Projects/wende-cmdb-backend/internal/types/aggregate_schema.go`
- Create: `~/Projects/wende-cmdb-backend/internal/types/aggregate_resource_pool.go`
- Test: `~/Projects/wende-cmdb-backend/internal/types/aggregate_contract_test.go`

**Step 1: Write the failing test**

```go
func TestAggregateContracts_MarshalStableFields(t *testing.T) {
    node := AggregateTopologyNode{ModelUID: "module", AllowedActions: []string{"create_child"}}
    raw, err := json.Marshal(node)
    require.NoError(t, err)
    require.Contains(t, string(raw), "allowed_actions")
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/types/... -run AggregateContracts -v`
Expected: FAIL with missing aggregate contract types.

**Step 3: Write minimal implementation**

```go
type AggregateTopologyNode struct {
    ModelUID       string   `json:"model_uid"`
    AllowedActions []string `json:"allowed_actions"`
}
```

Repeat the same pattern for instance, relation, schema, and resource-pool contracts.

**Step 4: Run test to verify it passes**

Run: `go test ./internal/types/... -run AggregateContracts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/types/aggregate_*.go internal/types/aggregate_contract_test.go
git commit -m "feat: add cmdb aggregate response contracts"
```

### Task 2: Add topology aggregate backend

**Files:**
- Create: `~/Projects/wende-cmdb-backend/internal/core/topology/aggregate_service.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/handlers/topology_handler.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/server/routes_topology.go`
- Test: `~/Projects/wende-cmdb-backend/internal/core/topology/aggregate_service_test.go`
- Test: `~/Projects/wende-cmdb-backend/internal/api/handlers/topology_handler_test.go`

**Step 1: Write the failing test**

```go
func TestAggregateService_GetNodeDetail_ReturnsAllowedActions(t *testing.T) {
    detail, err := svc.GetNodeDetail(ctx, nodeID)
    require.NoError(t, err)
    require.Contains(t, detail.AllowedActions, "move")
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/core/topology/... -run AggregateService -v`
Expected: FAIL with missing aggregate service.

**Step 3: Write minimal implementation**

- Compose current `mainline.Service` and `topology.Service`
- Return unified node detail with `model_uid`, `path`, `statistics`, `allowed_actions`
- Add `GET /api/v1/topology/nodes/:id`
- Keep old set/module endpoints temporarily, but route new frontend work to the aggregate endpoint

**Step 4: Run test to verify it passes**

Run: `go test ./internal/core/topology/... ./internal/api/handlers/... -run 'AggregateService|TopologyHandler' -v`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/core/topology/aggregate_service.go internal/api/handlers/topology_handler.go internal/api/server/routes_topology.go internal/core/topology/aggregate_service_test.go internal/api/handlers/topology_handler_test.go
git commit -m "feat: add aggregate topology node contracts"
```

### Task 3: Add topology scene store and node detail flow

**Files:**
- Create: `~/Projects/wende-cmdb/src/store/TopologySceneStore.ts`
- Create: `~/Projects/wende-cmdb/src/store/NodeDetailStore.ts`
- Modify: `~/Projects/wende-cmdb/src/api/services/business.ts`
- Modify: `~/Projects/wende-cmdb/src/pages/Business/BusinessTopology/TopologyView/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Business/BusinessTopology/NodeInfo/index.tsx`
- Test: `~/Projects/wende-cmdb/src/utils/__tests__/topology-scene.test.ts`

**Step 1: Write the failing test**

```ts
it('loads node detail after selectNode', async () => {
  const store = useTopologySceneStore.getState()
  await store.selectNode('module-1')
  expect(useNodeDetailStore.getState().selectedNodeId).toBe('module-1')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/utils/__tests__/topology-scene.test.ts`
Expected: FAIL with missing topology scene store.

**Step 3: Write minimal implementation**

- Add `selectNode(nodeId)` in `TopologySceneStore`
- Add `loadNodeDetail(nodeId)` in `NodeDetailStore`
- Change `TopologyView` to stop passing full node business rules down the component tree

**Step 4: Run test to verify it passes**

Run: `pnpm vitest src/utils/__tests__/topology-scene.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/TopologySceneStore.ts src/store/NodeDetailStore.ts src/api/services/business.ts src/pages/Business/BusinessTopology/TopologyView/index.tsx src/pages/Business/BusinessTopology/NodeInfo/index.tsx src/utils/__tests__/topology-scene.test.ts
git commit -m "feat: add topology scene state flow"
```

### Task 4: Add instance aggregate backend

**Files:**
- Create: `~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/handlers/dynamic_model_handler.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/server/routes_dynamic_model.go`
- Create: `~/Projects/wende-cmdb-backend/internal/api/handlers/instance_aggregate_handler.go`
- Create: `~/Projects/wende-cmdb-backend/internal/api/server/routes_instance_aggregate.go`
- Test: `~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service_test.go`

**Step 1: Write the failing test**

```go
func TestInstanceAggregate_GetInstance_ReturnsBindingContext(t *testing.T) {
    view, err := svc.GetAggregateInstance(ctx, "host:1")
    require.NoError(t, err)
    require.NotNil(t, view.BindingContext)
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/core/instance/... -run AggregateInstance -v`
Expected: FAIL with missing aggregate instance service.

**Step 3: Write minimal implementation**

- Create `/api/v1/instances` and `/api/v1/instances/:instanceKey`
- Reuse existing dynamic model detail, history, and relation services
- Add `binding_context` and `allowed_actions` to the aggregate response

**Step 4: Run test to verify it passes**

Run: `go test ./internal/core/instance/... ./internal/api/handlers/... -run AggregateInstance -v`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/core/instance/aggregate_service.go internal/api/handlers/instance_aggregate_handler.go internal/api/server/routes_instance_aggregate.go internal/api/handlers/dynamic_model_handler.go internal/api/server/routes_dynamic_model.go internal/core/instance/aggregate_service_test.go
git commit -m "feat: add aggregate instance detail endpoints"
```

### Task 5: Replace instance mock flows in frontend

**Files:**
- Create: `~/Projects/wende-cmdb/src/store/InstanceSceneStore.ts`
- Modify: `~/Projects/wende-cmdb/src/api/services/modelInstance.ts`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Model/components/InstanceWorkspace/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Business/BusinessTopology/ServiceInstance/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Business/BusinessTopology/ServiceInstance/Instance/index.tsx`
- Test: `~/Projects/wende-cmdb/src/utils/__tests__/instance-scene.test.ts`

**Step 1: Write the failing test**

```ts
it('loads aggregate instance detail once for both model and topology entry points', async () => {
  await useInstanceSceneStore.getState().openInstance('host:1')
  expect(useInstanceSceneStore.getState().detail?.instance_key).toBe('host:1')
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/utils/__tests__/instance-scene.test.ts`
Expected: FAIL with missing instance scene store.

**Step 3: Write minimal implementation**

- Add `openInstance(instanceKey)`
- Point instance detail loading at aggregate endpoints
- Remove mock-backed list/detail behavior from topology service instance panels

**Step 4: Run test to verify it passes**

Run: `pnpm vitest src/utils/__tests__/instance-scene.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/InstanceSceneStore.ts src/api/services/modelInstance.ts src/pages/Resource/Model/components/InstanceWorkspace/index.tsx src/pages/Business/BusinessTopology/ServiceInstance/index.tsx src/pages/Business/BusinessTopology/ServiceInstance/Instance/index.tsx src/utils/__tests__/instance-scene.test.ts
git commit -m "feat: unify instance scene state"
```

### Task 6: Add relation capability backend

**Files:**
- Create: `~/Projects/wende-cmdb-backend/internal/core/dynamic_model/relation_aggregate_service.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/handlers/dynamic_model_handler.go`
- Test: `~/Projects/wende-cmdb-backend/internal/core/dynamic_model/relation_aggregate_service_test.go`

**Step 1: Write the failing test**

```go
func TestRelationAggregate_InstanceCapabilities_ReturnsCandidateTargets(t *testing.T) {
    caps, err := svc.GetInstanceRelationCapabilities(ctx, "host", 1)
    require.NoError(t, err)
    require.NotNil(t, caps.CandidateTargets)
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/core/dynamic_model/... -run RelationAggregate -v`
Expected: FAIL with missing relation aggregate service.

**Step 3: Write minimal implementation**

- Add model relation capability endpoint
- Add instance relation capability endpoint
- Return `constraints`, `candidate_targets`, `conflict_details`, `impact_summary`

**Step 4: Run test to verify it passes**

Run: `go test ./internal/core/dynamic_model/... -run RelationAggregate -v`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/core/dynamic_model/relation_aggregate_service.go internal/api/handlers/dynamic_model_handler.go internal/core/dynamic_model/relation_aggregate_service_test.go
git commit -m "feat: add relation capability responses"
```

### Task 7: Split model relation and instance relation frontend state

**Files:**
- Create: `~/Projects/wende-cmdb/src/store/ModelRelationStore.ts`
- Create: `~/Projects/wende-cmdb/src/store/InstanceRelationStore.ts`
- Modify: `~/Projects/wende-cmdb/src/api/services/modelRelation.ts`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Model/pages/RelationDetail/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Model/components/InstanceWorkspace/index.tsx`
- Test: `~/Projects/wende-cmdb/src/utils/__tests__/relation-scene.test.ts`

**Step 1: Write the failing test**

```ts
it('loads instance relation capabilities before creating a relation', async () => {
  await useInstanceRelationStore.getState().loadCapabilities('host:1')
  expect(useInstanceRelationStore.getState().capabilities.length).toBeGreaterThanOrEqual(0)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/utils/__tests__/relation-scene.test.ts`
Expected: FAIL with missing relation stores.

**Step 3: Write minimal implementation**

- Load model relation capabilities in relation detail page
- Load instance relation capabilities in instance workspace
- Remove ad hoc candidate-target construction from components

**Step 4: Run test to verify it passes**

Run: `pnpm vitest src/utils/__tests__/relation-scene.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/ModelRelationStore.ts src/store/InstanceRelationStore.ts src/api/services/modelRelation.ts src/pages/Resource/Model/pages/RelationDetail/index.tsx src/pages/Resource/Model/components/InstanceWorkspace/index.tsx src/utils/__tests__/relation-scene.test.ts
git commit -m "feat: separate relation scene state"
```

### Task 8: Add resource-pool lifecycle backend

**Files:**
- Modify: `~/Projects/wende-cmdb-backend/internal/core/resource_directory/service.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/handlers/resource_directory_handler.go`
- Create: `~/Projects/wende-cmdb-backend/internal/types/resource_pool_lifecycle.go`
- Test: `~/Projects/wende-cmdb-backend/internal/core/resource_directory/service_lifecycle_test.go`

**Step 1: Write the failing test**

```go
func TestAllocateHosts_ReturnsStructuredFailures(t *testing.T) {
    result, err := svc.AllocateHosts(ctx, req)
    require.NoError(t, err)
    require.NotNil(t, result.FailedItems)
}
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/core/resource_directory/... -run AllocateHosts -v`
Expected: FAIL with missing structured lifecycle result.

**Step 3: Write minimal implementation**

- Add `resource_status`
- Add structured `succeeded_items` and `failed_items`
- Add host lifecycle query endpoint

**Step 4: Run test to verify it passes**

Run: `go test ./internal/core/resource_directory/... -run 'AllocateHosts|ReclaimHosts|Lifecycle' -v`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/core/resource_directory/service.go internal/api/handlers/resource_directory_handler.go internal/types/resource_pool_lifecycle.go internal/core/resource_directory/service_lifecycle_test.go
git commit -m "feat: add resource pool lifecycle responses"
```

### Task 9: Replace resource-pool mock state in frontend

**Files:**
- Create: `~/Projects/wende-cmdb/src/store/ResourcePoolSceneStore.ts`
- Create: `~/Projects/wende-cmdb/src/store/DirectoryStore.ts`
- Create: `~/Projects/wende-cmdb/src/store/PoolHostStore.ts`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Host/Directory/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Host/HostList/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Host/HostView/index.tsx`
- Test: `~/Projects/wende-cmdb/src/utils/__tests__/resource-pool-scene.test.ts`

**Step 1: Write the failing test**

```ts
it('refreshes host list when active directory changes', async () => {
  await useDirectoryStore.getState().setActiveDirectory(1)
  expect(usePoolHostStore.getState().query.directoryId).toBe(1)
})
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest src/utils/__tests__/resource-pool-scene.test.ts`
Expected: FAIL with missing resource pool stores.

**Step 3: Write minimal implementation**

- Replace `hostDirectoryMock` and host list mock loading
- Make directory selection update the host list query state
- Use lifecycle result payloads for allocate/reclaim feedback

**Step 4: Run test to verify it passes**

Run: `pnpm vitest src/utils/__tests__/resource-pool-scene.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/ResourcePoolSceneStore.ts src/store/DirectoryStore.ts src/store/PoolHostStore.ts src/pages/Resource/Host/Directory/index.tsx src/pages/Resource/Host/HostList/index.tsx src/pages/Resource/Host/HostView/index.tsx src/utils/__tests__/resource-pool-scene.test.ts
git commit -m "feat: wire real resource pool scene state"
```

### Task 10: Add schema center backend and frontend integration

**Files:**
- Create: `~/Projects/wende-cmdb-backend/internal/core/dynamic_model/schema_service.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/handlers/dynamic_model_handler.go`
- Create: `~/Projects/wende-cmdb/src/store/SchemaCenterStore.ts`
- Modify: `~/Projects/wende-cmdb/src/pages/Business/BusinessTopology/components/CreateNodeModal/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Model/pages/FieldDesigner/index.tsx`
- Test: `~/Projects/wende-cmdb-backend/internal/core/dynamic_model/schema_service_test.go`
- Test: `~/Projects/wende-cmdb/src/utils/__tests__/schema-center.test.ts`

**Step 1: Write the failing test**

```go
func TestSchemaService_GetFormSchema_MergesBusinessOverrides(t *testing.T) {
    schema, err := svc.GetFormSchema(ctx, "module", "topology_create", bizID)
    require.NoError(t, err)
    require.NotEmpty(t, schema.Fields)
}
```

```ts
it('caches form schema by model and scene', async () => {
  await useSchemaCenterStore.getState().loadFormSchema('module', 'topology_create')
  expect(useSchemaCenterStore.getState().formSchemas['module:topology_create']).toBeDefined()
})
```

**Step 2: Run test to verify it fails**

Run: `go test ./internal/core/dynamic_model/... -run SchemaService -v`
Run: `pnpm vitest src/utils/__tests__/schema-center.test.ts`
Expected: FAIL with missing schema service and store.

**Step 3: Write minimal implementation**

- Add `/api/v1/dynamic-models/:uid/schema`
- Add `/api/v1/dynamic-models/:uid/form-schema`
- Merge dynamic model fields and business custom fields by scene
- Update `CreateNodeModal` to stop branching between built-in and generic field sources

**Step 4: Run test to verify it passes**

Run: `go test ./internal/core/dynamic_model/... -run SchemaService -v`
Run: `pnpm vitest src/utils/__tests__/schema-center.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add internal/core/dynamic_model/schema_service.go internal/api/handlers/dynamic_model_handler.go internal/core/dynamic_model/schema_service_test.go src/store/SchemaCenterStore.ts src/pages/Business/BusinessTopology/components/CreateNodeModal/index.tsx src/pages/Resource/Model/pages/FieldDesigner/index.tsx src/utils/__tests__/schema-center.test.ts
git commit -m "feat: add schema center for cmdb scenes"
```

### Task 11: Full verification pass

**Files:**
- Modify: `~/Projects/wende-cmdb-backend/docs/plans/2026-03-09-cmdb-missing-core-capabilities-design.md`
- Modify: `~/Projects/wende-cmdb-backend/docs/plans/2026-03-09-cmdb-main-chain-p0-implementation.md`

**Step 1: Run backend verification**

Run: `go test ./internal/api/... ./internal/core/... ./internal/types/... -v`
Expected: PASS

**Step 2: Run frontend verification**

Run: `pnpm test`
Expected: PASS

**Step 3: Run type and lint checks**

Run: `pnpm typecheck`
Run: `pnpm lint`
Expected: PASS

**Step 4: Update design docs if implementation drifted**

- Capture any final endpoint name drift
- Update the design and implementation plan docs only if needed

**Step 5: Commit**

```bash
git add docs/plans/2026-03-09-cmdb-missing-core-capabilities-design.md docs/plans/2026-03-09-cmdb-main-chain-p0-implementation.md
git commit -m "docs: align cmdb plan after implementation"
```
