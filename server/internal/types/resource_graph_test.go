package types

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestResourceType_MarshalStableFields(t *testing.T) {
	raw, err := json.Marshal(ResourceTypeV2{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
	})
	require.NoError(t, err)
	require.Contains(t, string(raw), `"name":"host"`)
	require.Contains(t, string(raw), `"category":"infra"`)
}

func TestResource_MarshalSpecAndStatus(t *testing.T) {
	raw, err := json.Marshal(ResourceV2{
		TypeName: "host",
		Spec:     map[string]any{"inner_ip": "10.0.1.10"},
		Status:   map[string]any{"health": "ok"},
	})
	require.NoError(t, err)
	require.Contains(t, string(raw), `"type_name":"host"`)
	require.Contains(t, string(raw), `"spec"`)
	require.Contains(t, string(raw), `"status"`)
}
