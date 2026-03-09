package types

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAggregateContracts_MarshalStableFields(t *testing.T) {
	t.Run("topology", func(t *testing.T) {
		node := AggregateTopologyNode{
			ModelUID:       "module",
			AllowedActions: []string{"create_child"},
		}
		raw, err := json.Marshal(node)
		require.NoError(t, err)
		require.Contains(t, string(raw), "allowed_actions")
	})

	t.Run("instance", func(t *testing.T) {
		view := AggregateInstanceView{
			InstanceKey: "host:1",
			BindingContext: map[string]any{
				"node_id": "module:1",
			},
		}
		raw, err := json.Marshal(view)
		require.NoError(t, err)
		require.Contains(t, string(raw), "binding_context")
	})

	t.Run("relation", func(t *testing.T) {
		caps := AggregateRelationCapabilities{
			CandidateTargets: []map[string]any{{"instance_key": "host:2"}},
			ImpactSummary: map[string]any{
				"affected_relations": 1,
			},
		}
		raw, err := json.Marshal(caps)
		require.NoError(t, err)
		require.Contains(t, string(raw), "candidate_targets")
		require.Contains(t, string(raw), "impact_summary")
	})

	t.Run("schema", func(t *testing.T) {
		schema := AggregateSchemaContract{
			ModelUID: "module",
			Fields: []ModelFormField{
				{Name: "name", DisplayName: "名称"},
			},
		}
		raw, err := json.Marshal(schema)
		require.NoError(t, err)
		require.Contains(t, string(raw), "model_uid")
	})

	t.Run("resource-pool", func(t *testing.T) {
		host := AggregateResourcePoolHost{
			HostID:         "host-1",
			LifecycleState: "allocated",
		}
		raw, err := json.Marshal(host)
		require.NoError(t, err)
		require.Contains(t, string(raw), "lifecycle_state")
	})
}
