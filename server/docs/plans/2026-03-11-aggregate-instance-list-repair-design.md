# Aggregate Instance List Repair Design

**Date:** 2026-03-11

## Context

Chrome DevTools smoke validation showed that the remaining broken pages are concentrated in two flows:

1. `/model/set/instances` and `/model/host/instances` render empty lists even when topology data exists.
2. `/resource/host` still mixes real backend data in the `未分配` tab with mock data in the `已分配` and `全部` tabs.

The immediate cause for the instance pages is that the frontend still reads the legacy `/api/v1/models/:name/instances` endpoint, while the actual runtime data is split across three storage domains:

- `mainline_instances` for `business` / `set` / `module`
- `hosts` for `host`
- `resources` for other dynamic-model-backed instances

The aggregate detail endpoint introduced in P0 already points the frontend toward `instance_key`, but the aggregate list endpoint is incomplete and cannot yet unify these sources.

## Goals

- Make `/model/set/instances` show topology-created `set` instances.
- Make `/model/host/instances` show real host instances.
- Keep instance list, instance drawer, relation capabilities, and instance detail on a single `instance_key` contract.
- Remove mock-backed data from `/resource/host` tabs that still do not use the real backend.
- Preserve the old `/api/v1/models/:name/instances` contract for compatibility while moving the repaired pages to aggregate APIs.

## Non-Goals

- Do not delete the legacy instance API in this round.
- Do not redesign unrelated pages outside the currently failing acceptance matrix.
- Do not attempt a full data migration from legacy instance storage into dynamic resources.

## Recommended Approach

Use `/api/v1/instances?model_uid=...` as the single list contract for repaired instance pages.

Backend aggregation rules:

- `business` / `set` / `module`: read from `mainline_instances`
- `host`: read from `hosts`
- all other model UIDs: read from `resources`

Frontend behavior:

- instance pages stop calling `/api/v1/models/:name/instances`
- list rows use `instance_key` as the stable identifier
- opening an instance drawer reuses `InstanceSceneStore.openInstance(instanceKey)` directly instead of reconstructing mixed IDs

## Data Contract

`GET /api/v1/instances?model_uid=set&page=1&page_size=20`

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "instance_key": "set:2",
        "model": {
          "model_uid": "set",
          "display_name": "集群"
        },
        "properties": {
          "name": "SmokeSet3",
          "description": "topology smoke set"
        },
        "binding_context": {
          "source": "mainline",
          "topology_bound": true,
          "business_id": "aff44c3a-c372-4fa4-94b6-1edcf44c3f04",
          "ref_id": "2"
        },
        "allowed_actions": [
          "view_relations",
          "view_history"
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_page": 1
    }
  }
}
```

Rules:

- `instance_key` is always the frontend primary key.
- `properties` carries the page-facing fields used in tables and drawers.
- `binding_context.source` explicitly marks `mainline`, `host`, or `resource`.
- aggregate list responses stay lightweight; relation/history summaries remain detail-only.

## Backend Design

### Aggregate instance service

Extend `internal/core/instance/aggregate_service.go` so list and detail queries dispatch by model family:

- mainline models query `mainline_instances`
- host queries `hosts`, enriching `binding_context` from host relations when useful
- dynamic resources keep using the current dynamic model service

The service should expose one normalized `AggregateInstanceView` for all three sources. For mainline-backed details, use `mainline_instances.name` and `extra`; for host-backed details, map host fields into `properties`.

### Runtime support schema

The Docker compatibility bootstrap currently creates only relation metadata tables and resource-pool tables. Aggregate instance flows for dynamic resources still fail if `resources` or related support tables are absent. The runtime DDL bootstrap should therefore also create the minimal dynamic instance tables required by aggregate instance detail/list operations:

- `resources`
- `resource_states`
- `resource_histories`

This keeps local Docker validation aligned with the repaired aggregate endpoints.

## Frontend Design

### Instance pages

Update the model instance pages to consume aggregate list items rather than legacy `ModelInstance` rows.

Required changes:

- add an aggregate list service in the frontend API layer
- update `InstanceWorkspace` and any direct model detail instance tab fetches
- use `instance_key` for drawer opening and row identity
- derive the visible name from `properties.name` first, with stable fallbacks

### Resource pool tabs

Remove the remaining mock data from `/resource/host`:

- `未分配` already uses real APIs and should remain unchanged
- `已分配` and `全部` should switch to backend-backed responses from the same resource-pool data source

## Testing Strategy

### Backend

- red/green tests for aggregate instance list over `set`, `module`, and `host`
- red/green tests for aggregate instance detail over `set` and `host`
- red/green tests for runtime support migrations creating resource instance tables

### Frontend

- red/green tests for instance list pages consuming aggregate list items
- red/green tests that drawer opening uses `instance_key`
- red/green tests for resource-pool tabs dropping mock data

### Browser validation

Re-run Chrome DevTools acceptance for:

- `/model/set/instances`
- `/model/host/instances`
- `/resource/host` `已分配`
- `/resource/host` `全部`

## Acceptance Criteria

- topology-created `set` / `module` instances appear in model instance pages
- real hosts appear in `/model/host/instances`
- instance drawer opens from aggregate list rows without ID mismatch
- `/resource/host` no longer shows hard-coded mock rows in `已分配` and `全部`
- no remaining `500` errors for the repaired flows under local Docker verification
