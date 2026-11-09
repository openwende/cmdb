package topology

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/openwende/cmdb/server/internal/core/mainline"
	"github.com/openwende/cmdb/server/internal/types"
)

func TestAggregateService_GetNodeDetail_ReturnsAllowedActions(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	aggregate := NewAggregateService(db, svc, mainline.NewService(db))
	ctx := context.Background()
	bizID := seedBusiness(t, db, "aggregate-biz")

	setNode, err := svc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "blue",
	})
	require.NoError(t, err)

	module, err := svc.CreateModule(ctx, &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "api",
	})
	require.NoError(t, err)

	detail, err := aggregate.GetNodeDetail(ctx, fmt.Sprintf("module-%d", module.ID))
	require.NoError(t, err)
	require.Equal(t, "module", detail.ModelUID)
	require.Contains(t, detail.AllowedActions, "move")
	require.NotEmpty(t, detail.Path)
}

func TestAggregateService_GetNodeDetail_NormalizesIdleNodes(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	aggregate := NewAggregateService(db, svc, mainline.NewService(db))
	ctx := context.Background()
	bizID := seedBusiness(t, db, "aggregate-idle-biz")

	require.NoError(t, svc.InitializeBusinessTopology(ctx, bizID))

	var idleSet types.Set
	require.NoError(t, db.WithContext(ctx).Where("business_id = ? AND is_default = ?", bizID, true).First(&idleSet).Error)

	var idleModule types.Module
	require.NoError(t, db.WithContext(ctx).Where("set_id = ? AND is_default = ?", idleSet.ID, true).First(&idleModule).Error)

	setDetail, err := aggregate.GetNodeDetail(ctx, fmt.Sprintf("idle_set-%d", idleSet.ID))
	require.NoError(t, err)
	require.Equal(t, fmt.Sprintf("idle_set-%d", idleSet.ID), setDetail.NodeID)
	require.Equal(t, "set", setDetail.ModelUID)

	moduleDetail, err := aggregate.GetNodeDetail(ctx, fmt.Sprintf("idle_module-%d", idleModule.ID))
	require.NoError(t, err)
	require.Equal(t, fmt.Sprintf("idle_module-%d", idleModule.ID), moduleDetail.NodeID)
	require.Equal(t, "module", moduleDetail.ModelUID)
}
