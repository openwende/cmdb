package topology

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/internal/core/instance"
	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/core/model"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

func setupTopologyTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	sqls := []string{
		`CREATE TABLE businesses (
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
		)`,
		`CREATE TABLE sets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id BIGINT NOT NULL,
			name TEXT NOT NULL,
			description TEXT,
			env_type TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE modules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			set_id INTEGER NOT NULL,
			business_id BIGINT NOT NULL,
			service_template_id BIGINT,
			service_category_id BIGINT,
			name TEXT NOT NULL,
			description TEXT,
			service_type TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE hosts (
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
		)`,
		`CREATE TABLE host_business_relations (
			host_id TEXT NOT NULL,
			business_id BIGINT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)`,
		`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id BIGINT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)`,
		`CREATE TABLE resource_pool_hosts (
			host_id TEXT PRIMARY KEY,
			directory_id BIGINT NOT NULL,
			imported_at DATETIME,
			imported_by TEXT,
			remark TEXT
		)`,
		`CREATE TABLE model_groups (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL UNIQUE,
			display_name TEXT NOT NULL,
			description TEXT DEFAULT '',
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			created_at DATETIME,
			updated_at DATETIME
		)`,
		`CREATE TABLE models (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL UNIQUE,
			display_name TEXT NOT NULL,
			classification TEXT NOT NULL,
			group_id TEXT,
			icon TEXT,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			is_mainline BOOLEAN NOT NULL DEFAULT FALSE,
			mainline_scope TEXT NOT NULL DEFAULT 'none',
			mainline_level INTEGER,
			is_topology_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			mainline_parent_model_id TEXT,
			description TEXT,
				created_at DATETIME,
				updated_at DATETIME
			)`,
		`CREATE TABLE model_attributes (
				id TEXT PRIMARY KEY,
				model_id TEXT NOT NULL,
				name TEXT NOT NULL,
				display_name TEXT NOT NULL,
				field_type TEXT NOT NULL,
				is_required BOOLEAN NOT NULL DEFAULT FALSE,
				is_unique BOOLEAN NOT NULL DEFAULT FALSE,
				is_editable BOOLEAN NOT NULL DEFAULT TRUE,
				is_system BOOLEAN NOT NULL DEFAULT FALSE,
				sort_order INTEGER NOT NULL DEFAULT 0,
				options TEXT,
				created_at DATETIME,
				updated_at DATETIME
			)`,
		`CREATE TABLE model_instances (
				id TEXT PRIMARY KEY,
				model_id TEXT NOT NULL,
				tenant_id TEXT NOT NULL,
				business_id TEXT,
				properties TEXT NOT NULL,
				path TEXT,
				created_at DATETIME,
				updated_at DATETIME,
				deleted_at DATETIME
			)`,
		`CREATE TABLE mainline_instances (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				model_name TEXT NOT NULL,
			business_id TEXT NOT NULL,
			parent_id BIGINT,
			ref_id TEXT NOT NULL,
			name TEXT NOT NULL,
			path TEXT NOT NULL,
			level INTEGER NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			extra TEXT DEFAULT '{}',
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE UNIQUE INDEX idx_mainline_instances_model_ref ON mainline_instances (model_name, ref_id)`,
		`INSERT INTO model_groups (id, name, display_name, description, sort_order, is_builtin, created_at, updated_at)
		VALUES
			('11111111-1111-1111-1111-111111111111', 'core_topology', '核心拓扑', '承载业务主线内置模型', 10, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
			('22222222-2222-2222-2222-222222222222', 'resource_objects', '资源对象', '承载基础资源类模型', 20, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
			('33333333-3333-3333-3333-333333333333', 'custom_models', '自定义模型', '承载租户扩展的自定义模型', 30, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	}

	for _, sql := range sqls {
		require.NoError(t, db.Exec(sql).Error)
	}

	return db
}

func newTestTopologyService(db *gorm.DB) Service {
	return NewService(db, mainline.NewService(db))
}

func TestSetupTopologyTestDB_ModelSchemaSupportsModelGroups(t *testing.T) {
	db := setupTopologyTestDB(t)

	type pragmaColumn struct {
		Name string `gorm:"column:name"`
	}

	var columns []pragmaColumn
	require.NoError(t, db.Raw("PRAGMA table_info(models)").Scan(&columns).Error)

	hasGroupID := false
	for _, column := range columns {
		if column.Name == "group_id" {
			hasGroupID = true
			break
		}
	}
	require.True(t, hasGroupID, "models table should include group_id")

	require.NoError(t, db.Exec(`
		SELECT models.id
		FROM models
		LEFT JOIN model_groups ON model_groups.id = models.group_id
		LIMIT 1
	`).Error)
}

func seedBusiness(t *testing.T, db *gorm.DB, name string) uint64 {
	t.Helper()

	description := name + " description"
	biz := types.Business{
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
		TenantID:    uuid.New(),
		Name:        name,
		Identifier:  name,
		Description: &description,
		Lifecycle:   types.BusinessLifecycleOnline,
		Timezone:    "UTC",
		Language:    "en",
	}
	require.NoError(t, db.Create(&biz).Error)
	require.NotZero(t, biz.ID)
	return biz.ID
}

func TestInitializeBusinessTopologyBuildsMainlineTree(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	ctx := context.Background()
	bizID := seedBusiness(t, db, "game-biz")

	require.NoError(t, svc.InitializeBusinessTopology(ctx, bizID))

	var count int64
	require.NoError(t, db.Table("mainline_instances").Count(&count).Error)
	require.EqualValues(t, 3, count)

	tree, err := svc.GetTopologyTree(ctx, &types.GetTopologyTreeRequest{
		BusinessID: &bizID,
		MaxDepth:   3,
	})
	require.NoError(t, err)
	require.Len(t, tree, 1)
	require.Equal(t, types.NodeTypeBusiness, tree[0].NodeType)
	require.Len(t, tree[0].Children, 1)
	require.Equal(t, true, tree[0].Children[0].IsDefault)
	require.Len(t, tree[0].Children[0].Children, 1)
	require.Equal(t, true, tree[0].Children[0].Children[0].IsDefault)
}

func TestDefaultIdleModuleCountsResourcePoolHosts(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	ctx := context.Background()
	bizID := seedBusiness(t, db, "idle-count-biz")

	require.NoError(t, svc.InitializeBusinessTopology(ctx, bizID))

	hostIDs := []string{uuid.NewString(), uuid.NewString()}
	for index, hostID := range hostIDs {
		require.NoError(t, db.Table("hosts").Create(map[string]interface{}{
			"id":         hostID,
			"host_name":  fmt.Sprintf("idle-host-%d", index+1),
			"primary_ip": fmt.Sprintf("10.0.0.%d", index+1),
			"status":     "running",
		}).Error)
		require.NoError(t, db.Exec(
			`INSERT INTO resource_pool_hosts (host_id, directory_id, imported_at, imported_by, remark)
			VALUES (?, 1, CURRENT_TIMESTAMP, 'tester', 'idle host')`,
			hostID,
		).Error)
	}

	tree, err := svc.GetTopologyTree(ctx, &types.GetTopologyTreeRequest{
		BusinessID:   &bizID,
		IncludeHosts: false,
		MaxDepth:     3,
		ExpandNodeID: "",
	})
	require.NoError(t, err)
	require.Len(t, tree, 1)
	require.Len(t, tree[0].Children, 1)
	require.Len(t, tree[0].Children[0].Children, 1)

	idleModule := tree[0].Children[0].Children[0]
	require.Equal(t, types.NodeTypeModule, idleModule.NodeType)
	require.True(t, idleModule.IsDefault)
	require.Equal(t, 2, idleModule.Extra["host_count"])
	require.Equal(t, 2, idleModule.ChildCount)
}

func TestCreateAndMoveModuleKeepsMainlineTreeInSync(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	ctx := context.Background()
	bizID := seedBusiness(t, db, "ops-biz")

	require.NoError(t, svc.InitializeBusinessTopology(ctx, bizID))

	set1, err := svc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-a",
		SortOrder:  10,
	})
	require.NoError(t, err)

	set2, err := svc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "set-b",
		SortOrder:  20,
	})
	require.NoError(t, err)

	module, err := svc.CreateModule(ctx, &types.CreateModuleRequest{
		SetID:       set1.ID,
		Name:        "module-a",
		ServiceType: "web",
	})
	require.NoError(t, err)

	require.NoError(t, svc.MoveModule(ctx, module.ID, set2.ID))

	children, err := svc.GetNodeChildren(ctx, types.NodeTypeSet, set2.ID)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Equal(t, "module-a", children[0].Name)

	children, err = svc.GetNodeChildren(ctx, types.NodeTypeSet, set1.ID)
	require.NoError(t, err)
	require.Len(t, children, 0)
}

func TestModuleChildrenReturnHostsFromRelations(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	ctx := context.Background()
	bizID := seedBusiness(t, db, "host-biz")

	setNode, err := svc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "online",
	})
	require.NoError(t, err)

	module, err := svc.CreateModule(ctx, &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "api",
	})
	require.NoError(t, err)

	hostID := uuid.New()
	require.NoError(t, db.Table("hosts").Create(map[string]interface{}{
		"id":         hostID.String(),
		"host_name":  "host-1",
		"primary_ip": "10.0.0.1",
		"status":     "running",
	}).Error)
	require.NoError(t, db.Create(&types.HostModuleRelation{HostID: hostID, ModuleID: module.ID}).Error)

	children, err := svc.GetNodeChildren(ctx, types.NodeTypeModule, module.ID)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Equal(t, types.NodeTypeHost, children[0].NodeType)
	require.Equal(t, "host-1", children[0].Name)
}

func TestCustomMainlineInstanceAppearsInTopologyTree(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	ctx := context.Background()
	bizID := seedBusiness(t, db, "custom-mainline-biz")

	require.NoError(t, svc.InitializeBusinessTopology(ctx, bizID))

	setNode, err := svc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "blue",
	})
	require.NoError(t, err)

	modelRepo := storage.NewModelRepository(db)
	instanceRepo := storage.NewInstanceRepository(db)
	modelService := model.NewService(modelRepo)
	instanceService := instance.NewService(instanceRepo, modelRepo, db, mainline.NewService(db))

	rackLevel := 3
	_, err = modelService.CreateModel(ctx, &types.CreateModelRequest{
		Name:                "rack",
		DisplayName:         "机架",
		Classification:      "business",
		Icon:                "rack",
		IsMainline:          true,
		MainlineScope:       types.MainlineScopeBusiness,
		MainlineLevel:       &rackLevel,
		MainlineParentModel: "set",
	})
	require.NoError(t, err)

	parentRef := fmt.Sprintf("%d", setNode.ID)
	_, err = instanceService.CreateInstance(ctx, uuid.New().String(), "rack", &types.CreateInstanceRequest{
		BusinessID:          ptrString(fmt.Sprintf("%d", bizID)),
		MainlineParentRefID: &parentRef,
		Properties: map[string]interface{}{
			"name":       "rack-a",
			"sort_order": 20,
		},
	})
	require.NoError(t, err)

	children, err := svc.GetNodeChildren(ctx, types.NodeTypeSet, setNode.ID)
	require.NoError(t, err)
	require.Len(t, children, 1)
	require.Equal(t, "rack-a", children[0].Name)
	require.Equal(t, types.TopologyNodeType("rack"), children[0].NodeType)
	require.Equal(t, "rack", children[0].Icon)

	tree, err := svc.GetTopologyTree(ctx, &types.GetTopologyTreeRequest{
		BusinessID: &bizID,
		MaxDepth:   4,
	})
	require.NoError(t, err)
	require.Len(t, tree, 1)
	require.Len(t, tree[0].Children, 2)
	require.Equal(t, "rack-a", tree[0].Children[1].Children[0].Name)
}

func TestUpdateModulePersistsServiceCategoryID(t *testing.T) {
	db := setupTopologyTestDB(t)
	svc := newTestTopologyService(db)
	ctx := context.Background()

	bizID := seedBusiness(t, db, "category-biz")
	setNode, err := svc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "category-set",
	})
	require.NoError(t, err)

	module, err := svc.CreateModule(ctx, &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "category-module",
	})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`
		CREATE TABLE service_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id TEXT,
			name TEXT NOT NULL,
			parent_id BIGINT,
			root_id BIGINT NOT NULL,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)
	`).Error)

	categoryID := uint64(10)
	require.NoError(t, db.Exec(`
		INSERT INTO service_categories (id, business_id, name, parent_id, root_id, is_builtin, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, NULL, ?, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, categoryID, fmt.Sprintf("%d", bizID), "Database", categoryID).Error)

	updated, err := svc.UpdateModule(ctx, module.ID, &types.UpdateModuleRequest{
		ServiceCategoryID: &categoryID,
	})
	require.NoError(t, err)
	require.NotNil(t, updated.ServiceCategoryID)
	require.Equal(t, categoryID, *updated.ServiceCategoryID)
}

func ptrString(v string) *string {
	return &v
}
