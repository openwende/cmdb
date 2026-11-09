package resource_graph

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/internal/types"
)

func setupResourceGraphTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, storage.MigrateResourceGraphTables(db))

	return db
}

func hostSchema() map[string]any {
	return map[string]any{
		"type":     "object",
		"required": []any{"inner_ip"},
		"properties": map[string]any{
			"inner_ip": map[string]any{"type": "string"},
			"hostname": map[string]any{"type": "string"},
		},
	}
}

func TestService_CreateType_StoresSchemaAndIdentityRules(t *testing.T) {
	db := setupResourceGraphTestDB(t)
	svc := NewService(db)

	item, err := svc.CreateType(context.Background(), CreateTypeInput{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
		Schema:      hostSchema(),
		IdentityRules: types.IdentityRules{
			UniqueKeys: [][]string{{"inner_ip"}},
		},
	})

	require.NoError(t, err)
	require.Equal(t, "host", item.Name)
	require.Equal(t, "infra", item.Category)
	require.Equal(t, [][]string{{"inner_ip"}}, item.IdentityRules.UniqueKeys)
}

func TestService_CreateResource_RejectsInvalidSpecAgainstSchema(t *testing.T) {
	db := setupResourceGraphTestDB(t)
	svc := NewService(db)

	_, err := svc.CreateType(context.Background(), CreateTypeInput{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
		Schema:      hostSchema(),
		IdentityRules: types.IdentityRules{
			UniqueKeys: [][]string{{"inner_ip"}},
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateResource(context.Background(), CreateResourceInput{
		TypeName: "host",
		Spec: map[string]any{
			"inner_ip": 1,
		},
	})
	require.Error(t, err)
}

func TestService_BatchUpsert_UpdatesByIdentityKey(t *testing.T) {
	db := setupResourceGraphTestDB(t)
	svc := NewService(db)

	_, err := svc.CreateType(context.Background(), CreateTypeInput{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
		Schema:      hostSchema(),
		IdentityRules: types.IdentityRules{
			UniqueKeys: [][]string{{"inner_ip"}},
		},
	})
	require.NoError(t, err)

	result, err := svc.BatchUpsertResources(context.Background(), BatchUpsertInput{
		TypeName: "host",
		Items: []map[string]any{
			{"inner_ip": "10.0.1.10", "hostname": "a"},
			{"inner_ip": "10.0.1.10", "hostname": "b"},
		},
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Created)
	require.Equal(t, 1, result.Updated)

	var stored types.ResourceV2
	require.NoError(t, db.Where("type_name = ?", "host").First(&stored).Error)
	require.Equal(t, "b", stored.Spec["hostname"])
}

func TestService_SearchResources_FiltersByTypeAndSpec(t *testing.T) {
	db := setupResourceGraphTestDB(t)
	svc := NewService(db)

	_, err := svc.CreateType(context.Background(), CreateTypeInput{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
		Schema:      hostSchema(),
		IdentityRules: types.IdentityRules{
			UniqueKeys: [][]string{{"inner_ip"}},
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateResource(context.Background(), CreateResourceInput{
		TypeName: "host",
		Spec: map[string]any{
			"inner_ip": "10.0.1.10",
			"hostname": "alpha",
		},
	})
	require.NoError(t, err)

	_, err = svc.CreateResource(context.Background(), CreateResourceInput{
		TypeName: "host",
		Spec: map[string]any{
			"inner_ip": "10.0.1.11",
			"hostname": "beta",
		},
	})
	require.NoError(t, err)

	items, err := svc.SearchResources(context.Background(), SearchResourcesInput{
		TypeName: "host",
		Filters: map[string]any{
			"hostname": "beta",
		},
	})
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, "beta", items[0].Spec["hostname"])
}

func TestService_CreateEdge_StoresEdgeAndListsByResource(t *testing.T) {
	db := setupResourceGraphTestDB(t)
	svc := NewService(db)

	_, err := svc.CreateType(context.Background(), CreateTypeInput{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
		Schema:      hostSchema(),
		IdentityRules: types.IdentityRules{
			UniqueKeys: [][]string{{"inner_ip"}},
		},
	})
	require.NoError(t, err)

	source, err := svc.CreateResource(context.Background(), CreateResourceInput{
		TypeName: "host",
		Spec: map[string]any{
			"inner_ip": "10.0.1.10",
			"hostname": "alpha",
		},
	})
	require.NoError(t, err)

	target, err := svc.CreateResource(context.Background(), CreateResourceInput{
		TypeName: "host",
		Spec: map[string]any{
			"inner_ip": "10.0.1.11",
			"hostname": "beta",
		},
	})
	require.NoError(t, err)

	edge, err := svc.CreateEdge(context.Background(), CreateEdgeInput{
		FromID:  source.ID,
		ToID:    target.ID,
		RelType: "connects_to",
		Data:    map[string]any{"port": 3306},
	})
	require.NoError(t, err)
	require.Equal(t, "connects_to", edge.RelType)

	items, err := svc.ListResourceEdges(context.Background(), source.ID, "connects_to")
	require.NoError(t, err)
	require.Len(t, items, 1)
	require.Equal(t, target.ID, items[0].ToID)
}

func TestService_ListEvents_ReturnsResourceAndEdgeEvents(t *testing.T) {
	db := setupResourceGraphTestDB(t)
	svc := NewService(db)

	_, err := svc.CreateType(context.Background(), CreateTypeInput{
		Name:        "host",
		DisplayName: "Host",
		Category:    "infra",
		Schema:      hostSchema(),
		IdentityRules: types.IdentityRules{
			UniqueKeys: [][]string{{"inner_ip"}},
		},
	})
	require.NoError(t, err)

	resource, err := svc.CreateResource(context.Background(), CreateResourceInput{
		TypeName: "host",
		Spec: map[string]any{
			"inner_ip": "10.0.1.10",
			"hostname": "alpha",
		},
	})
	require.NoError(t, err)

	events, err := svc.ListEvents(context.Background(), ListEventsInput{
		ResourceID: resource.ID,
	})
	require.NoError(t, err)
	require.Len(t, events, 1)
	require.Equal(t, "resource.created", events[0].EventType)
}
