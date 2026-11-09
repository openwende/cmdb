package resource_graph

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/openwende/cmdb-server/internal/types"
)

func TestIdentityRules_UseExternalKeysFirst(t *testing.T) {
	rules := types.IdentityRules{
		ExternalKeys: [][]string{{"source", "source_id"}},
		UniqueKeys:   [][]string{{"cloud_area", "inner_ip"}},
	}

	key, ok := MatchIdentity(rules, map[string]any{
		"source":    "manual",
		"source_id": "host-1",
		"inner_ip":  "10.0.1.10",
	})

	require.True(t, ok)
	require.Equal(t, "source=manual|source_id=host-1", key)
}

func TestIdentityRules_FallbackToUniqueKeys(t *testing.T) {
	rules := types.IdentityRules{
		ExternalKeys: [][]string{{"source", "source_id"}},
		UniqueKeys:   [][]string{{"cloud_area", "inner_ip"}},
	}

	key, ok := MatchIdentity(rules, map[string]any{
		"cloud_area": "default",
		"inner_ip":   "10.0.1.10",
	})

	require.True(t, ok)
	require.Equal(t, "cloud_area=default|inner_ip=10.0.1.10", key)
}

func TestIdentityRules_ReturnFalseWhenNoRuleMatches(t *testing.T) {
	rules := types.IdentityRules{
		UniqueKeys: [][]string{{"cloud_area", "inner_ip"}},
	}

	key, ok := MatchIdentity(rules, map[string]any{
		"inner_ip": "10.0.1.10",
	})

	require.False(t, ok)
	require.Empty(t, key)
}
