package projection

import (
	"context"
	"strconv"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

func seedProjectionBusiness(t *testing.T, db *gorm.DB, name string) uuid.UUID {
	t.Helper()

	bizID := uuid.New()
	description := name + " description"
	biz := types.Business{
		ID:          bizID,
		TenantID:    uuid.New(),
		Name:        name,
		Identifier:  name,
		Description: &description,
		Lifecycle:   types.BusinessLifecycleOnline,
		Timezone:    "UTC",
		Language:    "en",
	}
	require.NoError(t, db.Create(&biz).Error)
	return bizID
}

func seedProjectionBusinessPersonnel(
	t *testing.T,
	db *gorm.DB,
	businessID uuid.UUID,
	role string,
	identities ...string,
) {
	t.Helper()

	for _, identity := range identities {
		require.NoError(t, db.Exec(
			`INSERT INTO business_personnel (id, created_at, business_id, identity, role)
			VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)`,
			uuid.NewString(),
			businessID.String(),
			identity,
			role,
		).Error)
	}
}

func seedProjectionHost(t *testing.T, db *gorm.DB, hostName, primaryIP string) uuid.UUID {
	t.Helper()

	hostID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO hosts (id, tenant_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		hostID.String(),
		uuid.New().String(),
		hostName,
		primaryIP,
		"running",
	).Error)
	return hostID
}

func TestBusinessTopologyCommandService_InitializeBusinessTopology_CreatesIdleBranch(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "init-biz")

	svc := NewBusinessTopologyCommandService(db)
	require.NoError(t, svc.InitializeBusinessTopology(context.Background(), bizID))

	readSvc := NewBusinessTopologyService(db)
	tree, err := readSvc.GetTopologyTree(context.Background(), bizID.String(), false, 3, "")
	require.NoError(t, err)
	require.Len(t, tree, 1)
	require.Len(t, tree[0].Children, 1)
	require.True(t, tree[0].Children[0].IsDefault)
	require.Len(t, tree[0].Children[0].Children, 1)
	require.True(t, tree[0].Children[0].Children[0].IsDefault)
}

func TestBusinessTopologyCommandService_InitializeBusinessTopology_SeedsBusinessCanonicalFields(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "detail-biz")
	seedProjectionBusinessPersonnel(t, db, bizID, "sre", "alice@example.com", "bob@example.com")
	seedProjectionBusinessPersonnel(t, db, bizID, "developer", "dev@example.com")
	seedProjectionBusinessPersonnel(t, db, bizID, "tester", "qa@example.com")
	seedProjectionBusinessPersonnel(t, db, bizID, "bizops", "pm@example.com")

	svc := NewBusinessTopologyCommandService(db)
	require.NoError(t, svc.InitializeBusinessTopology(context.Background(), bizID))

	detail, err := NewBusinessTopologyService(db).GetNodeDetail(context.Background(), "business-"+bizID.String())
	require.NoError(t, err)
	require.Equal(t, "online", detail.BindingSummary["lifecycle"])
	require.Equal(t, "UTC", detail.BindingSummary["timezone"])
	require.Equal(t, "en", detail.BindingSummary["language"])
	require.ElementsMatch(t, []any{"alice@example.com", "bob@example.com"}, detail.BindingSummary["sres"])
	require.ElementsMatch(t, []any{"dev@example.com"}, detail.BindingSummary["developers"])
	require.ElementsMatch(t, []any{"qa@example.com"}, detail.BindingSummary["testers"])
	require.ElementsMatch(t, []any{"pm@example.com"}, detail.BindingSummary["bizops"])
}

func TestBusinessTopologyCommandService_CreateAndUpdateSet_ReflectsInProjection(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "set-biz")

	svc := NewBusinessTopologyCommandService(db)
	setNode, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID:  bizID,
		Name:        "online",
		Description: "prod set",
		EnvType:     "prod",
		SortOrder:   20,
	})
	require.NoError(t, err)
	require.Equal(t, "online", setNode.Name)

	updated, err := svc.UpdateSet(context.Background(), setNode.ID, &types.UpdateSetRequest{
		Name:    ptr("online-v2"),
		EnvType: ptr("staging"),
	})
	require.NoError(t, err)
	require.Equal(t, "online-v2", updated.Name)
	require.Equal(t, "staging", updated.EnvType)

	readSvc := NewBusinessTopologyService(db)
	tree, err := readSvc.GetTopologyTree(context.Background(), bizID.String(), false, 2, "")
	require.NoError(t, err)
	require.Len(t, tree, 1)
	require.Len(t, tree[0].Children, 1)
	require.Equal(t, "online-v2", tree[0].Children[0].Name)
	require.Equal(t, "2", tree[0].Children[0].Extra["bk_set_env"])
}

func TestBusinessTopologyCommandService_CreateAndUpdateModule_ReflectsInProjection(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "module-biz")

	svc := NewBusinessTopologyCommandService(db)
	setNode, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-a",
	})
	require.NoError(t, err)

	module, err := svc.CreateModule(context.Background(), &types.CreateModuleRequest{
		SetID:       setNode.ID,
		Name:        "gateway",
		ServiceType: "web",
		SortOrder:   5,
	})
	require.NoError(t, err)
	require.Equal(t, "gateway", module.Name)

	updated, err := svc.UpdateModule(context.Background(), module.ID, &types.UpdateModuleRequest{
		Name:        ptr("gateway-v2"),
		ServiceType: ptr("db"),
	})
	require.NoError(t, err)
	require.Equal(t, "gateway-v2", updated.Name)
	require.Equal(t, "db", updated.ServiceType)

	readSvc := NewBusinessTopologyService(db)
	tree, err := readSvc.GetTopologyTree(context.Background(), bizID.String(), false, 3, "")
	require.NoError(t, err)
	require.Len(t, tree[0].Children, 1)
	require.Len(t, tree[0].Children[0].Children, 1)
	require.Equal(t, "gateway-v2", tree[0].Children[0].Children[0].Name)
	require.Equal(t, "2", tree[0].Children[0].Children[0].Extra["bk_module_type"])
}

func TestBusinessTopologyCommandService_MoveModule_ChangesParentSet(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "move-module-biz")

	svc := NewBusinessTopologyCommandService(db)
	setA, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-a",
		SortOrder:  10,
	})
	require.NoError(t, err)
	setB, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-b",
		SortOrder:  20,
	})
	require.NoError(t, err)
	module, err := svc.CreateModule(context.Background(), &types.CreateModuleRequest{
		SetID: setA.ID,
		Name:  "battle",
	})
	require.NoError(t, err)

	require.NoError(t, svc.MoveModule(context.Background(), module.ID, setB.ID))

	tree, err := NewBusinessTopologyService(db).GetTopologyTree(context.Background(), bizID.String(), false, 3, "")
	require.NoError(t, err)
	require.Empty(t, tree[0].Children[0].Children)
	require.Len(t, tree[0].Children[1].Children, 1)
	require.Equal(t, "battle", tree[0].Children[1].Children[0].Name)
}

func TestBusinessTopologyCommandService_DeleteModule_RemovesNode(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "delete-module-biz")

	svc := NewBusinessTopologyCommandService(db)
	setNode, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-a",
	})
	require.NoError(t, err)
	module, err := svc.CreateModule(context.Background(), &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "battle",
	})
	require.NoError(t, err)

	require.NoError(t, svc.DeleteModule(context.Background(), module.ID))

	modules, err := svc.ListModules(context.Background(), setNode.ID)
	require.NoError(t, err)
	require.Empty(t, modules)
}

func TestBusinessTopologyCommandService_MoveSetAndDeleteSet(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizA := seedProjectionBusiness(t, db, "move-set-a")
	bizB := seedProjectionBusiness(t, db, "move-set-b")

	svc := NewBusinessTopologyCommandService(db)
	setNode, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID: bizA,
		Name:       "set-a",
	})
	require.NoError(t, err)

	require.NoError(t, svc.MoveSet(context.Background(), setNode.ID, bizB))

	treeA, err := NewBusinessTopologyService(db).GetTopologyTree(context.Background(), bizA.String(), false, 2, "")
	require.NoError(t, err)
	require.Empty(t, treeA[0].Children)

	treeB, err := NewBusinessTopologyService(db).GetTopologyTree(context.Background(), bizB.String(), false, 2, "")
	require.NoError(t, err)
	require.Len(t, treeB[0].Children, 1)
	require.Equal(t, "set-a", treeB[0].Children[0].Name)

	require.NoError(t, svc.DeleteSet(context.Background(), setNode.ID))

	treeB, err = NewBusinessTopologyService(db).GetTopologyTree(context.Background(), bizB.String(), false, 2, "")
	require.NoError(t, err)
	require.Empty(t, treeB[0].Children)
}

func TestBusinessTopologyCommandService_TransferHostsAndReleaseToPool(t *testing.T) {
	db := setupProjectionTestDB(t)
	bizID := seedProjectionBusiness(t, db, "host-biz")

	svc := NewBusinessTopologyCommandService(db)
	setNode, err := svc.CreateSet(context.Background(), &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-a",
	})
	require.NoError(t, err)
	module, err := svc.CreateModule(context.Background(), &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "module-a",
	})
	require.NoError(t, err)
	hostID := seedProjectionHost(t, db, "host-a", "10.0.0.10")

	result, err := svc.TransferHosts(context.Background(), &types.TransferHostsRequest{
		HostIDs:        []uuid.UUID{hostID},
		TargetModuleID: module.ID,
	})
	require.NoError(t, err)
	require.Equal(t, 1, result.Successful)

	readSvc := NewBusinessTopologyService(db)
	hostList, err := readSvc.ListNodeHosts(context.Background(), "module-"+strconv.FormatUint(module.ID, 10), 1, 20, "")
	require.NoError(t, err)
	require.Len(t, hostList.Items, 1)
	require.Equal(t, hostID.String(), hostList.Items[0].HostID)

	releaseResult, err := svc.TransferHostsToPool(context.Background(), []uuid.UUID{hostID})
	require.NoError(t, err)
	require.Equal(t, 1, releaseResult.Successful)

	sets, err := svc.ListSets(context.Background(), bizID)
	require.NoError(t, err)
	var idleSetID uint64
	for _, item := range sets {
		if item.IsDefault {
			idleSetID = item.ID
			break
		}
	}
	require.NotZero(t, idleSetID)

	idleList, err := readSvc.ListNodeHosts(context.Background(), "idle_set-"+strconv.FormatUint(idleSetID, 10), 1, 20, "")
	require.NoError(t, err)
	require.Len(t, idleList.Items, 1)
	require.Equal(t, hostID.String(), idleList.Items[0].HostID)
}

func ptr[T any](value T) *T {
	return &value
}
