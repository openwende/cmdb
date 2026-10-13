package topology

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/wend/cmdb-backend/internal/types"
)

// GetNodeHosts 的 keyword：主机名或主 IP 子串，不区分大小写，% 和 _ 按字面匹配；先过滤再计总数。
func TestGetNodeHosts_KeywordFilter(t *testing.T) {
	db := setupTopologyTestDB(t)
	require.NoError(t, db.Exec(`CREATE TABLE cloud_areas (id TEXT PRIMARY KEY, name TEXT, deleted_at DATETIME)`).Error)
	svc := newTestTopologyService(db)
	ctx := context.Background()
	bizID := seedBusiness(t, db, "keyword-biz")

	setNode, err := svc.CreateSet(ctx, &types.CreateSetRequest{BusinessID: bizID, Name: "online"})
	require.NoError(t, err)
	module, err := svc.CreateModule(ctx, &types.CreateModuleRequest{SetID: setNode.ID, Name: "api"})
	require.NoError(t, err)

	bid, sid := bizID, setNode.ID
	for i, h := range []struct{ name, ip string }{
		{"web-PROD-01", "10.0.1.5"},
		{"db-01", "10.0.2.7"},
		{"web_test", "192.168.1.10"},
		{"100%host", "10.9.9.9"},
	} {
		id := uuid.New()
		require.NoError(t, db.Table("hosts").Create(map[string]interface{}{
			"id": id.String(), "display_id": i + 1, "host_name": h.name, "primary_ip": h.ip, "status": "running",
		}).Error)
		require.NoError(t, db.Create(&types.HostNodeMembership{
			HostID: id, NodeKind: types.NodeKindBizModule, NodeID: module.ID,
			BusinessID: &bid, SetID: &sid, RelationType: types.HostMembershipRelMemberOf,
		}).Error)
	}

	// 返回行不带主机名，用 display_id 断言：1 web-PROD-01、2 db-01、3 web_test、4 100%host
	ids := func(keyword string) ([]int64, int64) {
		rows, total, err := svc.GetNodeHosts(ctx, "module", fmt.Sprint(module.ID), keyword, 1, 20)
		require.NoError(t, err)
		out := []int64{}
		for _, r := range rows {
			out = append(out, r.DisplayID)
		}
		return out, total
	}

	tests := []struct {
		keyword   string
		wantTotal int64
		want      []int64
	}{
		{"", 4, []int64{1, 2, 3, 4}},
		{"WEB", 2, []int64{1, 3}},
		{"prod", 1, []int64{1}},
		{"10.0.", 2, []int64{1, 2}},
		{"168.1", 1, []int64{3}},
		{"_", 1, []int64{3}},
		{"%", 1, []int64{4}},
		{"nope", 0, []int64{}},
	}
	for _, tt := range tests {
		got, total := ids(tt.keyword)
		require.Equal(t, tt.wantTotal, total, tt.keyword)
		require.ElementsMatch(t, tt.want, got, tt.keyword)
	}
}
