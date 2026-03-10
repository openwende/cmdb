# Aggregate Instance List Repair Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Repair the remaining failed acceptance pages by unifying aggregate instance list/detail sources and removing the last mock-backed resource-pool tabs.

**Architecture:** Extend the aggregate instance backend to dispatch by model family instead of assuming all instances live in `resources`, add the missing runtime support tables needed by aggregate instance operations, then switch the failing frontend pages to the aggregate contracts. Finish with browser validation on the previously failing pages only.

**Tech Stack:** Go, Gin, GORM, PostgreSQL, React, TypeScript, Zustand, Axios, Vitest

---

### Task 1: Add failing backend tests for aggregate instance source unification

**Files:**
- Modify: `~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service_test.go`

**Step 1: Write the failing tests**

Add tests that prove the current aggregate service does not support the real data sources:

```go
func TestAggregateInstance_ListAggregateInstances_ReturnsMainlineNodes(t *testing.T) {
    items, total, err := svc.ListAggregateInstances(ctx, "set", 1, 20)
    require.NoError(t, err)
    require.Equal(t, int64(1), total)
    require.Equal(t, "set:2", items[0].InstanceKey)
}

func TestAggregateInstance_ListAggregateInstances_ReturnsHosts(t *testing.T) {
    items, total, err := svc.ListAggregateInstances(ctx, "host", 1, 20)
    require.NoError(t, err)
    require.Equal(t, int64(1), total)
    require.Equal(t, "host:"+hostID.String(), items[0].InstanceKey)
}

func TestAggregateInstance_GetInstance_ReturnsMainlineBindingContext(t *testing.T) {
    view, err := svc.GetAggregateInstance(ctx, "set:2")
    require.NoError(t, err)
    require.Equal(t, "mainline", view.BindingContext["source"])
}
```

**Step 2: Run tests to verify they fail**

Run: `go test ./internal/core/instance/... -run AggregateInstance -v`
Expected: FAIL because the service only queries `resources`.

**Step 3: Write minimal test fixtures**

- Seed `mainline_instances` rows for `set` / `module`
- Seed `hosts`, `host_business_relations`, and `host_module_relations`
- Keep existing `resources` fixtures for dynamic-resource coverage

**Step 4: Run tests again to confirm the failures are real**

Run: `go test ./internal/core/instance/... -run AggregateInstance -v`
Expected: FAIL with missing mainline/host support.

**Step 5: Commit**

```bash
git add ~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service_test.go
git commit -m "test: cover aggregate instance source adapters"
```

### Task 2: Implement aggregate instance list/detail adapters

**Files:**
- Modify: `~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/api/handlers/instance_aggregate_handler.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/types/aggregate_instance.go`
- Test: `~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service_test.go`

**Step 1: Make the failing tests pass with minimal implementation**

Implement dispatching logic inside the aggregate service:

```go
switch modelUID {
case "business", "set", "module":
    return s.listMainlineAggregateInstances(ctx, modelUID, page, pageSize)
case "host":
    return s.listHostAggregateInstances(ctx, page, pageSize)
default:
    return s.listResourceAggregateInstances(ctx, modelUID, page, pageSize)
}
```

For detail loading:

```go
switch modelUID {
case "business", "set", "module":
    return s.getMainlineAggregateInstance(ctx, modelUID, refID)
case "host":
    return s.getHostAggregateInstance(ctx, hostID)
default:
    return s.getResourceAggregateInstance(ctx, modelUID, resourceID)
}
```

**Step 2: Normalize contracts**

- keep `instance_key`
- ensure `properties` contains user-facing fields
- set `binding_context["source"]` to `mainline`, `host`, or `resource`
- keep `allowed_actions` stable across sources

**Step 3: Run tests to verify they pass**

Run: `go test ./internal/core/instance/... ./internal/api/handlers/... -run AggregateInstance -v`
Expected: PASS

**Step 4: Run focused API verification**

Run: `go test ./internal/api/handlers/... -run AggregateInstance -v`
Expected: PASS

**Step 5: Commit**

```bash
git add ~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service.go ~/Projects/wende-cmdb-backend/internal/api/handlers/instance_aggregate_handler.go ~/Projects/wende-cmdb-backend/internal/types/aggregate_instance.go ~/Projects/wende-cmdb-backend/internal/core/instance/aggregate_service_test.go
git commit -m "feat: unify aggregate instance sources"
```

### Task 3: Add failing tests for Docker runtime support tables

**Files:**
- Modify: `~/Projects/wende-cmdb-backend/internal/storage/dynamic_model_migrations_test.go`
- Modify: `~/Projects/wende-cmdb-backend/internal/storage/dynamic_model_migrations.go`

**Step 1: Write the failing test**

```go
func TestMigrateRuntimeSupportTablesCreatesResourceInstanceTables(t *testing.T) {
    err := MigrateRuntimeSupportTables(db)
    require.NoError(t, err)
    require.True(t, db.Migrator().HasTable("resources"))
    require.True(t, db.Migrator().HasTable("resource_states"))
    require.True(t, db.Migrator().HasTable("resource_histories"))
}
```

**Step 2: Run tests to verify they fail**

Run: `go test ./internal/storage -run RuntimeSupportTables -v`
Expected: FAIL because `MigrateRuntimeSupportTables` does not create resource instance tables.

**Step 3: Write minimal implementation**

Extend `runtimeSupportDDL(...)` with the minimal `resources`, `resource_states`, and `resource_histories` tables required by aggregate instance flows for both SQLite and PostgreSQL.

**Step 4: Run tests to verify they pass**

Run: `go test ./internal/storage -run RuntimeSupportTables -v`
Expected: PASS

**Step 5: Commit**

```bash
git add ~/Projects/wende-cmdb-backend/internal/storage/dynamic_model_migrations.go ~/Projects/wende-cmdb-backend/internal/storage/dynamic_model_migrations_test.go
git commit -m "fix: bootstrap aggregate instance runtime tables"
```

### Task 4: Switch frontend instance pages to aggregate list contracts

**Files:**
- Modify: `~/Projects/wende-cmdb/src/api/services/modelInstance.ts`
- Modify: `~/Projects/wende-cmdb/src/api/types/model.ts`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Model/ModelDetail/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Model/components/InstanceWorkspace/index.tsx`
- Add: `~/Projects/wende-cmdb/src/utils/__tests__/instance-workspace-aggregate-list.test.tsx`

**Step 1: Write the failing test**

```ts
it('renders aggregate instance rows and opens the drawer with instance_key', async () => {
  render(<InstanceWorkspace />)
  expect(await screen.findByText('SmokeSet3')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /view instance detail/i }))
  expect(openInstance).toHaveBeenCalledWith('set:2')
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest src/utils/__tests__/instance-workspace-aggregate-list.test.tsx`
Expected: FAIL because the component still reads legacy model-instance rows.

**Step 3: Write minimal implementation**

- add `listAggregateInstances(modelUID, params)` in `modelInstance.ts`
- introduce a frontend aggregate list item type with `instance_key`
- update table row rendering to read `properties.name`
- open drawers with `record.instance_key`
- keep the drawer detail flow on `InstanceSceneStore`

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest src/utils/__tests__/instance-workspace-aggregate-list.test.tsx src/utils/__tests__/instance-scene.test.ts`
Expected: PASS

**Step 5: Run typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git -C ~/Projects/wende-cmdb add ~/Projects/wende-cmdb/src/api/services/modelInstance.ts ~/Projects/wende-cmdb/src/api/types/model.ts ~/Projects/wende-cmdb/src/pages/Resource/Model/ModelDetail/index.tsx ~/Projects/wende-cmdb/src/pages/Resource/Model/components/InstanceWorkspace/index.tsx ~/Projects/wende-cmdb/src/utils/__tests__/instance-workspace-aggregate-list.test.tsx
git -C ~/Projects/wende-cmdb commit -m "feat: use aggregate instance lists in model pages"
```

### Task 5: Remove mock data from resource-pool assigned/all tabs

**Files:**
- Modify: `~/Projects/wende-cmdb/src/pages/Resource/Host/index.tsx`
- Modify: `~/Projects/wende-cmdb/src/store/ResourcePoolSceneStore.ts`
- Add: `~/Projects/wende-cmdb/src/utils/__tests__/resource-pool-tabs.test.tsx`

**Step 1: Write the failing test**

```ts
it('loads assigned and all tabs from the resource-pool store instead of mock rows', async () => {
  render(<HostPage />)
  await user.click(screen.getByRole('tab', { name: '已分配' }))
  expect(await screen.findByText('real-host-1')).toBeInTheDocument()
  expect(screen.queryByText('business2')).not.toBeInTheDocument()
})
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest src/utils/__tests__/resource-pool-tabs.test.tsx`
Expected: FAIL because `已分配` and `全部` still use mock rows.

**Step 3: Write minimal implementation**

- make the resource-pool page fetch all tabs from the scene store
- remove the hard-coded fallback rows used by `已分配` / `全部`
- keep the existing real API behavior for `未分配`

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest src/utils/__tests__/resource-pool-tabs.test.tsx src/utils/__tests__/resource-pool-scene.test.ts`
Expected: PASS

**Step 5: Run typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 6: Commit**

```bash
git -C ~/Projects/wende-cmdb add ~/Projects/wende-cmdb/src/pages/Resource/Host/index.tsx ~/Projects/wende-cmdb/src/store/ResourcePoolSceneStore.ts ~/Projects/wende-cmdb/src/utils/__tests__/resource-pool-tabs.test.tsx
git -C ~/Projects/wende-cmdb commit -m "fix: drop mock resource pool tabs"
```

### Task 6: Run focused verification and browser acceptance

**Files:**
- No code changes required

**Step 1: Run backend verification**

Run: `go test ./internal/core/instance/... ./internal/api/handlers/... ./internal/storage/... -run 'AggregateInstance|RuntimeSupportTables' -v`
Expected: PASS

**Step 2: Run frontend verification**

Run: `pnpm vitest src/utils/__tests__/instance-workspace-aggregate-list.test.tsx src/utils/__tests__/instance-scene.test.ts src/utils/__tests__/resource-pool-tabs.test.tsx src/utils/__tests__/resource-pool-scene.test.ts`
Expected: PASS

**Step 3: Run frontend typecheck**

Run: `./node_modules/.bin/tsc --noEmit`
Expected: PASS

**Step 4: Re-run Chrome DevTools acceptance**

Verify these pages with the repaired Docker backend:

- `http://localhost:5174/model/set/instances`
- `http://localhost:5174/model/host/instances`
- `http://localhost:5174/resource/host` `已分配`
- `http://localhost:5174/resource/host` `全部`

Expected:

- `set` / `host` instance pages show real rows
- opening instance drawers uses aggregate detail successfully
- resource-pool tabs no longer show mock values like `business2/set2/module2`

