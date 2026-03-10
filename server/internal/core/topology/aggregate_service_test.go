package topology

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/types"
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
