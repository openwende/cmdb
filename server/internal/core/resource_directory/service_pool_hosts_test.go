package resource_directory

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/types"
)

// seedPoolHosts 资源池目录 1、2 下各有主机，另有一台在业务模块（不应出现在资源池列表）。
// 插入顺序故意和 display_id 不一致，用来验证结果按 display_id 升序。
func seedPoolHosts(t *testing.T, db *gorm.DB) {
	t.Helper()
	now := time.Now().UTC()
	host := func(display int, name, ip, kind string, nodeID uint64) {
		id := uuid.New()
		require.NoError(t, db.Exec(`INSERT INTO hosts (id, display_id, host_name, primary_ip, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, 'running', ?, ?)`, id, display, name, ip, now, now).Error)
		require.NoError(t, db.Create(&types.HostNodeMembership{
			HostID: id, NodeKind: kind, NodeID: nodeID, RelationType: types.HostMembershipRelMemberOf,
		}).Error)
	}
	host(3, "web-PROD-01", "10.0.1.5", types.NodeKindPoolDirectory, 1)
	host(1, "db-01", "10.0.2.7", types.NodeKindPoolDirectory, 1)
	host(5, "100%host", "10.9.9.9", types.NodeKindPoolDirectory, 2)
	host(2, "web_test", "192.168.1.10", types.NodeKindPoolDirectory, 2)
	host(4, "web-02", "10.0.1.15", types.NodeKindBizModule, 7)
}

func displayIDs(hosts []types.Host) []int64 {
	ids := make([]int64, len(hosts))
	for i, h := range hosts {
		ids[i] = h.DisplayID
	}
	return ids
}

func TestListPoolHosts_KeywordFilterTotalAndOrder(t *testing.T) {
	db := setupResourceLifecycleTestDB(t)
	seedPoolHosts(t, db)
	svc := newLifecycleService(db)
	ctx := context.Background()
	dir1 := uint64(1)

	tests := []struct {
		name      string
		directory *uint64
		keyword   string
		page      int
		pageSize  int
		wantTotal int64
		wantIDs   []int64
	}{
		{"no keyword lists every pool host by display_id", nil, "", 1, 20, 4, []int64{1, 2, 3, 5}},
		{"blank keyword is no filter", nil, "   ", 1, 20, 4, []int64{1, 2, 3, 5}},
		{"host name match is case-insensitive", nil, "WEB", 1, 20, 2, []int64{2, 3}},
		{"ip substring match, business host excluded", nil, "10.0.1", 1, 20, 1, []int64{3}},
		{"keyword combines with directory", &dir1, "web", 1, 20, 1, []int64{3}},
		{"directory without keyword", &dir1, "", 1, 20, 2, []int64{1, 3}},
		{"underscore is literal", nil, "_", 1, 20, 1, []int64{2}},
		{"percent is literal", nil, "%", 1, 20, 1, []int64{5}},
		{"no match", nil, "nope", 1, 20, 0, []int64{}},
		{"total counts all matches, page slices them", nil, "", 2, 2, 4, []int64{3, 5}},
		{"filtered total with paging", nil, "10.", 2, 1, 3, []int64{3}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hosts, total, err := svc.ListPoolHosts(ctx, tt.directory, tt.keyword, tt.page, tt.pageSize)
			require.NoError(t, err)
			require.Equal(t, tt.wantTotal, total)
			require.Equal(t, tt.wantIDs, displayIDs(hosts))
		})
	}
}
