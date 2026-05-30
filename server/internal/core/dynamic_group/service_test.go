package dynamic_group

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDynamicGroupHostIPColumnsStripCIDR(t *testing.T) {
	column, err := mapColumn(modelHost, "bk_host_innerip")
	require.NoError(t, err)
	require.Equal(t, "host(h.primary_ip)", column)

	selectColumns := strings.Join(previewHostSelectColumns(), ",")
	require.Contains(t, selectColumns, "host(h.primary_ip) AS internal_ipv4")
	require.NotContains(t, selectColumns, "h.primary_ip::text")
}

func TestDynamicGroupSupportsServiceTemplateCondition(t *testing.T) {
	column, err := mapColumn(modelModule, "service_template_id")
	require.NoError(t, err)
	require.Equal(t, "m.service_template_id", column)
}

func TestDynamicGroupTargetSupportsHostOnly(t *testing.T) {
	svc := &service{}

	require.NoError(t, svc.validateInput(targetHost, nil))
	require.Error(t, svc.validateInput(modelSet, nil))
	require.Error(t, svc.validateInput("business", nil))
}
