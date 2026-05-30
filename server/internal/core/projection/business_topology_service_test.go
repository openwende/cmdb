package projection

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/internal/core/resource_graph"
	"github.com/wend/cmdb-backend/internal/storage"
)

func setupProjectionTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, storage.MigrateResourceGraphTables(db))
	require.NoError(t, db.Exec(`CREATE TABLE businesses (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME,
		created_by TEXT,
		updated_by TEXT,
		tenant_id TEXT NOT NULL,
		name TEXT NOT NULL,
		identifier TEXT NOT NULL,
		description TEXT,
		lifecycle TEXT NOT NULL DEFAULT 'online',
		timezone TEXT NOT NULL DEFAULT 'UTC',
		language TEXT NOT NULL DEFAULT 'en',
		maintainers TEXT,
		is_built_in BOOLEAN NOT NULL DEFAULT FALSE
	)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE business_personnel (
		id TEXT PRIMARY KEY,
		created_at DATETIME,
		business_id INTEGER NOT NULL,
		user_id TEXT,
		identity TEXT NOT NULL,
		role TEXT NOT NULL
	)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE hosts (
		id TEXT PRIMARY KEY,
		display_id INTEGER,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME,
		tenant_id TEXT,
		created_by TEXT,
		updated_by TEXT,
		cloud_area_id TEXT,
		business_id BIGINT,
		host_name TEXT NOT NULL,
		primary_ip TEXT,
		ip_addresses TEXT,
		cloud_vendor TEXT,
		cloud_instance_id TEXT,
		cloud_region TEXT,
		vpc_id TEXT,
		subnet_id TEXT,
		cpu INTEGER,
		memory INTEGER,
		disk_size INTEGER,
		os_type TEXT,
		os_version TEXT,
		status TEXT,
		is_destroyed BOOLEAN NOT NULL DEFAULT FALSE,
		cloud_metadata TEXT,
		custom_fields TEXT
	)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE cloud_areas (
		id TEXT PRIMARY KEY,
		created_at DATETIME,
		updated_at DATETIME,
		deleted_at DATETIME,
		tenant_id TEXT,
		name TEXT NOT NULL,
		identifier TEXT NOT NULL,
		type TEXT NOT NULL,
		description TEXT,
		cloud_vendor TEXT,
		vpc_id TEXT,
		cidr_block TEXT,
		region TEXT,
		custom_fields TEXT
		)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE modules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			deleted_at DATETIME
		)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE host_business_relations (
			host_id TEXT NOT NULL,
			business_id INTEGER NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id INTEGER NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)`).Error)
	require.NoError(t, db.Exec(`CREATE TABLE resource_pool_hosts (
			host_id TEXT PRIMARY KEY,
			directory_id INTEGER NOT NULL,
			imported_at DATETIME,
			imported_by TEXT,
			remark TEXT
		)`).Error)

	return db
}

func registerProjectionType(t *testing.T, svc resource_graph.Service, name, category string) {
	t.Helper()

	_, err := svc.CreateType(context.Background(), resource_graph.CreateTypeInput{
		Name:        name,
		DisplayName: name,
		Category:    category,
		Schema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"ref_id": map[string]any{"type": "string"},
			},
		},
	})
	require.NoError(t, err)
}

func TestBusinessTopologyService_GetTopologyTree_ReturnsContainsHierarchy(t *testing.T) {
	db := setupProjectionTestDB(t)
	graphSvc := resource_graph.NewService(db)

	registerProjectionType(t, graphSvc, "business", "org")
	registerProjectionType(t, graphSvc, "set", "org")
	registerProjectionType(t, graphSvc, "module", "app")

	bizID := uuid.NewString()
	biz, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "business",
		Name:     "Star Rail",
		Spec: map[string]any{
			"ref_id":      bizID,
			"description": "space fantasy",
			"lifecycle":   "online",
		},
	})
	require.NoError(t, err)

	setNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "set",
		Name:     "prod-hz",
		Spec: map[string]any{
			"ref_id":      "101",
			"env_type":    "prod",
			"description": "hangzhou",
		},
	})
	require.NoError(t, err)

	moduleNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "module",
		Name:     "gateway",
		Spec: map[string]any{
			"ref_id":       "201",
			"service_type": "web",
		},
	})
	require.NoError(t, err)

	_, err = graphSvc.CreateEdge(context.Background(), resource_graph.CreateEdgeInput{
		FromID:  biz.ID,
		ToID:    setNode.ID,
		RelType: "contains",
	})
	require.NoError(t, err)
	_, err = graphSvc.CreateEdge(context.Background(), resource_graph.CreateEdgeInput{
		FromID:  setNode.ID,
		ToID:    moduleNode.ID,
		RelType: "contains",
	})
	require.NoError(t, err)

	svc := NewBusinessTopologyService(db)
	tree, err := svc.GetTopologyTree(context.Background(), bizID, false, 3, "")
	require.NoError(t, err)
	require.Len(t, tree, 1)
	require.Equal(t, "business_"+bizID, tree[0].ID)
	require.Equal(t, "Star Rail", tree[0].Name)
	require.Len(t, tree[0].Children, 1)
	require.Equal(t, "set_101", tree[0].Children[0].ID)
	require.Equal(t, 1, tree[0].Children[0].ChildCount)
	require.Len(t, tree[0].Children[0].Children, 1)
	require.Equal(t, "module_201", tree[0].Children[0].Children[0].ID)
	require.Equal(t, "web", tree[0].Children[0].Children[0].Extra["service_type"])
	require.Equal(t, []string{"create_child"}, tree[0].Extra["allowed_actions"])
	require.Equal(t, []string{"create_child", "move", "delete"}, tree[0].Children[0].Extra["allowed_actions"])
	require.NotEmpty(t, tree[0].Extra["created_at"])
	require.NotEmpty(t, tree[0].Extra["updated_at"])
	require.NotEmpty(t, tree[0].Children[0].Extra["created_at"])
	require.NotEmpty(t, tree[0].Children[0].Children[0].Extra["updated_at"])
}

func TestBusinessTopologyService_GetTopologyTree_RespectsIncludeHosts(t *testing.T) {
	db := setupProjectionTestDB(t)
	graphSvc := resource_graph.NewService(db)

	registerProjectionType(t, graphSvc, "business", "org")
	registerProjectionType(t, graphSvc, "set", "org")
	registerProjectionType(t, graphSvc, "module", "app")
	registerProjectionType(t, graphSvc, "host", "infra")

	bizID := uuid.NewString()
	biz, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "business",
		Name:     "ZZZ",
		Spec:     map[string]any{"ref_id": bizID},
	})
	require.NoError(t, err)
	setNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "set",
		Name:     "prod",
		Spec:     map[string]any{"ref_id": "11"},
	})
	require.NoError(t, err)
	moduleNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "module",
		Name:     "battle",
		Spec:     map[string]any{"ref_id": "22"},
	})
	require.NoError(t, err)
	hostNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "host",
		Name:     "host-1",
		Spec: map[string]any{
			"ref_id":     uuid.NewString(),
			"primary_ip": "10.0.0.8",
			"status":     "running",
		},
	})
	require.NoError(t, err)

	for _, edge := range []resource_graph.CreateEdgeInput{
		{FromID: biz.ID, ToID: setNode.ID, RelType: "contains"},
		{FromID: setNode.ID, ToID: moduleNode.ID, RelType: "contains"},
		{FromID: moduleNode.ID, ToID: hostNode.ID, RelType: "contains"},
	} {
		_, err := graphSvc.CreateEdge(context.Background(), edge)
		require.NoError(t, err)
	}

	svc := NewBusinessTopologyService(db)

	treeWithoutHosts, err := svc.GetTopologyTree(context.Background(), bizID, false, 4, "")
	require.NoError(t, err)
	moduleWithoutHosts := treeWithoutHosts[0].Children[0].Children[0]
	require.True(t, moduleWithoutHosts.IsLeaf)
	require.False(t, moduleWithoutHosts.Expandable)
	require.Equal(t, 1, moduleWithoutHosts.ChildCount)
	require.Equal(t, 1, moduleWithoutHosts.Extra["host_count"])
	require.Empty(t, moduleWithoutHosts.Children)

	treeWithHosts, err := svc.GetTopologyTree(context.Background(), bizID, true, 4, "")
	require.NoError(t, err)
	moduleWithHosts := treeWithHosts[0].Children[0].Children[0]
	require.False(t, moduleWithHosts.IsLeaf)
	require.True(t, moduleWithHosts.Expandable)
	require.Equal(t, 1, moduleWithHosts.Extra["host_count"])
	require.Len(t, moduleWithHosts.Children, 1)
	require.Equal(t, "host", string(moduleWithHosts.Children[0].NodeType))
}

func TestBusinessTopologyService_GetNodeDetail_ReturnsPathAndStatistics(t *testing.T) {
	db := setupProjectionTestDB(t)
	graphSvc := resource_graph.NewService(db)

	registerProjectionType(t, graphSvc, "business", "org")
	registerProjectionType(t, graphSvc, "set", "org")
	registerProjectionType(t, graphSvc, "module", "app")

	bizID := uuid.NewString()
	biz, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "business",
		Name:     "Genshin",
		Spec:     map[string]any{"ref_id": bizID},
	})
	require.NoError(t, err)
	setNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "set",
		Name:     "cn-prod",
		Spec:     map[string]any{"ref_id": "301"},
	})
	require.NoError(t, err)
	moduleNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "module",
		Name:     "matchmaker",
		Spec: map[string]any{
			"ref_id":       "401",
			"service_type": "api",
		},
	})
	require.NoError(t, err)

	for _, edge := range []resource_graph.CreateEdgeInput{
		{FromID: biz.ID, ToID: setNode.ID, RelType: "contains"},
		{FromID: setNode.ID, ToID: moduleNode.ID, RelType: "contains"},
	} {
		_, err := graphSvc.CreateEdge(context.Background(), edge)
		require.NoError(t, err)
	}

	svc := NewBusinessTopologyService(db)
	detail, err := svc.GetNodeDetail(context.Background(), "module-401")
	require.NoError(t, err)
	require.Equal(t, "module-401", detail.NodeID)
	require.Equal(t, "module", detail.ModelUID)
	require.Contains(t, detail.AllowedActions, "move")
	require.Len(t, detail.Path, 3)
	require.Equal(t, "business-"+bizID, detail.Path[0].NodeID)
	require.NotNil(t, detail.Statistics)
	require.EqualValues(t, 1, detail.Statistics.BusinessCount)
	require.EqualValues(t, 1, detail.Statistics.SetCount)
	require.EqualValues(t, 1, detail.Statistics.ModuleCount)
	require.Equal(t, "api", detail.BindingSummary["service_type"])
}
