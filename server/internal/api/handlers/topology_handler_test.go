package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/internal/core/host_membership"
	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/core/topology"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

func setupTopologyHandlerTestDB(t *testing.T) *gorm.DB {
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
		`CREATE TABLE cloud_areas (
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
			business_id BIGINT NOT NULL,
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

	// 读切换(里程碑2)：测试库补建 host_node_memberships，读路径已改读新表
	require.NoError(t, db.Exec(`CREATE TABLE host_node_memberships (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		host_id TEXT NOT NULL,
		node_kind TEXT NOT NULL,
		node_id BIGINT NOT NULL,
		business_id BIGINT,
		set_id BIGINT,
		relation_type TEXT NOT NULL DEFAULT 'member_of',
		source TEXT,
		created_at DATETIME,
		created_by TEXT,
		UNIQUE (host_id, node_kind, node_id, relation_type)
	)`).Error)
	require.NoError(t, storage.MigrateResourceGraphTables(db))

	return db
}

func seedTopologyHandlerBusiness(t *testing.T, db *gorm.DB, name string) uint64 {
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

func TestTopologyHandler_GetNodeDetail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	ctx := context.Background()
	bizID := seedTopologyHandlerBusiness(t, db, "handler-biz")
	setNode, err := service.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "blue",
	})
	require.NoError(t, err)
	module, err := service.CreateModule(ctx, &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "api",
	})
	require.NoError(t, err)

	router := gin.New()
	router.GET("/api/v1/topology/nodes/:id", handler.GetNodeDetail)

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/topology/nodes/module-%d", module.ID), nil)
	require.NoError(t, err)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)

	var body struct {
		Code int                         `json:"code"`
		Data types.AggregateTopologyNode `json:"data"`
	}
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
	require.Equal(t, 0, body.Code)
	require.Equal(t, "module", body.Data.ModelUID)
	require.Contains(t, body.Data.AllowedActions, "move")
}

func TestTopologyHandler_GetNodeHosts(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	ctx := context.Background()
	bizID := seedTopologyHandlerBusiness(t, db, "host-scope-biz")
	setNode, err := service.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "scope-set",
	})
	require.NoError(t, err)
	module, err := service.CreateModule(ctx, &types.CreateModuleRequest{
		SetID: setNode.ID,
		Name:  "scope-module",
	})
	require.NoError(t, err)

	cloudAreaID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO cloud_areas (id, tenant_id, name, identifier, type, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		cloudAreaID.String(),
		uuid.New().String(),
		"default",
		"default",
		"direct",
	).Error)

	moduleHostID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO hosts (id, tenant_id, cloud_area_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		moduleHostID.String(),
		systemTenantUUID.String(),
		cloudAreaID.String(),
		"module-host",
		"10.0.0.10",
		"running",
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_business_relations (host_id, business_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
		moduleHostID.String(),
		bizID,
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_module_relations (host_id, module_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
		moduleHostID.String(),
		module.ID,
	).Error)
	// 读切换(里程碑2)：节点主机列表改读 host_node_memberships(biz_module)，补该主机的业务模块归属行
	require.NoError(t, db.Exec(
		`INSERT INTO host_node_memberships (host_id, node_kind, node_id, business_id, set_id, relation_type, source, created_at) VALUES (?, 'biz_module', ?, ?, ?, 'member_of', 'backfill', CURRENT_TIMESTAMP)`,
		moduleHostID.String(), module.ID, bizID, setNode.ID,
	).Error)

	otherTenantHostID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO hosts (id, tenant_id, cloud_area_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		otherTenantHostID.String(),
		uuid.New().String(),
		cloudAreaID.String(),
		"other-tenant-module-host",
		"10.0.0.11",
		"running",
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_business_relations (host_id, business_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
		otherTenantHostID.String(),
		bizID,
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_module_relations (host_id, module_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
		otherTenantHostID.String(),
		module.ID,
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_node_memberships (host_id, node_kind, node_id, business_id, set_id, relation_type, source, created_at) VALUES (?, 'biz_module', ?, ?, ?, 'member_of', 'backfill', CURRENT_TIMESTAMP)`,
		otherTenantHostID.String(), module.ID, bizID, setNode.ID,
	).Error)

	idleHostID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO hosts (id, tenant_id, cloud_area_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		idleHostID.String(),
		systemTenantUUID.String(),
		cloudAreaID.String(),
		"idle-host",
		"10.0.0.20",
		"running",
	).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_business_relations (host_id, business_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
		idleHostID.String(),
		bizID,
	).Error)
	// 新语义（R7 根治）：业务空闲机 = 该业务空闲机模块（is_default set/module）的真实归属，不再等同全局资源池。
	idleSetID, idleModuleID := uint64(900), uint64(900)
	require.NoError(t, db.Exec(
		`INSERT INTO sets (id, business_id, name, is_default, sort_order, created_at, updated_at)
		VALUES (?, ?, '空闲机池', 1, -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, idleSetID, bizID).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO modules (id, set_id, business_id, name, is_default, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, '空闲机', 1, -1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, idleModuleID, idleSetID, bizID).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_module_relations (host_id, module_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
		idleHostID.String(), idleModuleID).Error)
	require.NoError(t, db.Exec(
		`INSERT INTO host_node_memberships (host_id, node_kind, node_id, business_id, set_id, relation_type, source, created_at) VALUES (?, 'biz_module', ?, ?, ?, 'member_of', 'backfill', CURRENT_TIMESTAMP)`,
		idleHostID.String(), idleModuleID, bizID, idleSetID).Error)

	router := gin.New()
	router.GET("/api/v1/topology/nodes/:id/hosts", handler.GetNodeHosts)

	type hostRow struct {
		HostID    string `json:"host_id"`
		InnerIPv4 string `json:"inner_ipv4"`
		Module    *struct {
			ID   uint64 `json:"id"`
			Name string `json:"name"`
		} `json:"module"`
		Set *struct {
			ID   uint64 `json:"id"`
			Name string `json:"name"`
		} `json:"set"`
	}

	type responseBody struct {
		Code int `json:"code"`
		Data struct {
			Items []hostRow `json:"items"`
		} `json:"data"`
	}

	cases := []struct {
		name       string
		nodeID     string
		wantHostID string
		wantModule *uint64
		wantSet    *uint64
	}{
		{
			name:       "business scope returns all bound hosts",
			nodeID:     fmt.Sprintf("business-%d", bizID),
			wantHostID: moduleHostID.String(),
			wantModule: &module.ID,
			wantSet:    &setNode.ID,
		},
		{
			name:       "set scope returns hosts under set modules",
			nodeID:     fmt.Sprintf("set-%d", setNode.ID),
			wantHostID: moduleHostID.String(),
			wantModule: &module.ID,
			wantSet:    &setNode.ID,
		},
		{
			name:       "module scope returns module hosts",
			nodeID:     fmt.Sprintf("module-%d", module.ID),
			wantHostID: moduleHostID.String(),
			wantModule: &module.ID,
			wantSet:    &setNode.ID,
		},
		{
			name:       "idle scope returns business idle-module hosts",
			nodeID:     fmt.Sprintf("idle_set-%d", idleSetID),
			wantHostID: idleHostID.String(),
			wantModule: &idleModuleID,
			wantSet:    &idleSetID,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(http.MethodGet, "/api/v1/topology/nodes/"+tc.nodeID+"/hosts", nil)
			require.NoError(t, err)
			resp := httptest.NewRecorder()

			router.ServeHTTP(resp, req)

			require.Equal(t, http.StatusOK, resp.Code)

			var body responseBody
			require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &body))
			require.Equal(t, 0, body.Code)
			var item *hostRow
			for i := range body.Data.Items {
				if body.Data.Items[i].HostID == tc.wantHostID {
					item = &body.Data.Items[i]
					break
				}
			}
			require.NotNil(t, item)
			require.Equal(t, tc.wantModule == nil, item.Module == nil)
			require.Equal(t, tc.wantSet == nil, item.Set == nil)
			if tc.wantModule != nil {
				require.Equal(t, *tc.wantModule, item.Module.ID)
			}
			if tc.wantSet != nil {
				require.Equal(t, *tc.wantSet, item.Set.ID)
			}
		})
	}
}

func TestTopologyHandler_CreateSet_PersistsViaTopologyService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "projection-write-biz")

	router := gin.New()
	router.POST("/api/v1/topology/sets", handler.CreateSet)
	router.GET("/api/v1/topology/tree", handler.GetTopologyTree)

	payload, err := json.Marshal(map[string]any{
		"business_id": bizID,
		"name":        "write-set",
		"description": "created by projection",
		"env_type":    "prod",
		"sort_order":  10,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/topology/sets", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusCreated, resp.Code)
	require.Contains(t, resp.Body.String(), `"name":"write-set"`)

	treeReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/topology/tree?business_id=%d&max_depth=2", bizID), nil)
	treeResp := httptest.NewRecorder()
	router.ServeHTTP(treeResp, treeReq)

	require.Equal(t, http.StatusOK, treeResp.Code)
	require.Contains(t, treeResp.Body.String(), `"write-set"`)
}

func TestTopologyHandler_UpdateModule_PersistsViaTopologyService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "projection-module-biz")

	createRouter := gin.New()
	createRouter.POST("/api/v1/topology/sets", handler.CreateSet)
	createRouter.POST("/api/v1/topology/modules", handler.CreateModule)
	createRouter.PUT("/api/v1/topology/modules/:id", handler.UpdateModule)
	createRouter.GET("/api/v1/topology/tree", handler.GetTopologyTree)

	setPayload, err := json.Marshal(map[string]any{
		"business_id": bizID,
		"name":        "module-set",
	})
	require.NoError(t, err)

	setReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/sets", bytes.NewReader(setPayload))
	setReq.Header.Set("Content-Type", "application/json")
	setResp := httptest.NewRecorder()
	createRouter.ServeHTTP(setResp, setReq)
	require.Equal(t, http.StatusCreated, setResp.Code)

	var setBody struct {
		Data struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(setResp.Body.Bytes(), &setBody))

	modulePayload, err := json.Marshal(map[string]any{
		"set_id":       setBody.Data.ID,
		"name":         "gateway",
		"service_type": "web",
	})
	require.NoError(t, err)

	moduleReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/modules", bytes.NewReader(modulePayload))
	moduleReq.Header.Set("Content-Type", "application/json")
	moduleResp := httptest.NewRecorder()
	createRouter.ServeHTTP(moduleResp, moduleReq)
	require.Equal(t, http.StatusCreated, moduleResp.Code)

	var moduleBody struct {
		Data struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(moduleResp.Body.Bytes(), &moduleBody))

	updatePayload, err := json.Marshal(map[string]any{
		"name":         "gateway-v2",
		"service_type": "db",
	})
	require.NoError(t, err)

	updateReq := httptest.NewRequest(
		http.MethodPut,
		fmt.Sprintf("/api/v1/topology/modules/%d", moduleBody.Data.ID),
		bytes.NewReader(updatePayload),
	)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	createRouter.ServeHTTP(updateResp, updateReq)

	require.Equal(t, http.StatusOK, updateResp.Code)
	require.Contains(t, updateResp.Body.String(), `"name":"gateway-v2"`)

	treeReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/topology/tree?business_id=%d&max_depth=3", bizID), nil)
	treeResp := httptest.NewRecorder()
	createRouter.ServeHTTP(treeResp, treeReq)

	require.Equal(t, http.StatusOK, treeResp.Code)
	require.Contains(t, treeResp.Body.String(), `"gateway-v2"`)
}

func TestTopologyHandler_InitializeBusinessTopology_PersistsViaTopologyService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "projection-init-biz")

	router := gin.New()
	router.POST("/api/v1/topology/businesses/:id/initialize", handler.InitializeBusinessTopology)
	router.GET("/api/v1/topology/tree", handler.GetTopologyTree)

	req := httptest.NewRequest(http.MethodPost, fmt.Sprintf("/api/v1/topology/businesses/%d/initialize", bizID), nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	require.Equal(t, http.StatusOK, resp.Code)

	treeReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/topology/tree?business_id=%d&max_depth=3", bizID), nil)
	treeResp := httptest.NewRecorder()
	router.ServeHTTP(treeResp, treeReq)

	require.Equal(t, http.StatusOK, treeResp.Code)
	require.Contains(t, treeResp.Body.String(), `"is_default":true`)
}

func TestTopologyHandler_TransferHosts_PersistsViaTopologyService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	// 读切换(里程碑2)：transfer 后读路径改读 host_node_memberships；注入 hms 使写路径同事务回填新表（与生产一致）
	service := topology.NewService(db, mainlineSvc, topology.WithHostMembership(host_membership.NewService(db, nil)))
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "projection-host-transfer-biz")
	hostID := uuid.New()
	require.NoError(t, db.Exec(
		`INSERT INTO hosts (id, tenant_id, host_name, primary_ip, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		hostID.String(),
		uuid.New().String(),
		"host-transfer",
		"10.0.0.21",
		"running",
	).Error)

	router := gin.New()
	router.POST("/api/v1/topology/sets", handler.CreateSet)
	router.POST("/api/v1/topology/modules", handler.CreateModule)
	router.POST("/api/v1/topology/hosts/transfer", handler.TransferHosts)
	router.GET("/api/v1/topology/nodes/:id/hosts", handler.GetNodeHosts)

	setPayload, err := json.Marshal(map[string]any{
		"business_id": bizID,
		"name":        "host-set",
	})
	require.NoError(t, err)
	setReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/sets", bytes.NewReader(setPayload))
	setReq.Header.Set("Content-Type", "application/json")
	setResp := httptest.NewRecorder()
	router.ServeHTTP(setResp, setReq)
	require.Equal(t, http.StatusCreated, setResp.Code)

	var setBody struct {
		Data struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(setResp.Body.Bytes(), &setBody))

	modulePayload, err := json.Marshal(map[string]any{
		"set_id": setBody.Data.ID,
		"name":   "host-module",
	})
	require.NoError(t, err)
	moduleReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/modules", bytes.NewReader(modulePayload))
	moduleReq.Header.Set("Content-Type", "application/json")
	moduleResp := httptest.NewRecorder()
	router.ServeHTTP(moduleResp, moduleReq)
	require.Equal(t, http.StatusCreated, moduleResp.Code)

	var moduleBody struct {
		Data struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(moduleResp.Body.Bytes(), &moduleBody))

	transferPayload, err := json.Marshal(map[string]any{
		"host_ids":         []string{hostID.String()},
		"target_module_id": moduleBody.Data.ID,
	})
	require.NoError(t, err)
	transferReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/hosts/transfer", bytes.NewReader(transferPayload))
	transferReq.Header.Set("Content-Type", "application/json")
	transferResp := httptest.NewRecorder()
	router.ServeHTTP(transferResp, transferReq)

	require.Equal(t, http.StatusOK, transferResp.Code)
	require.Contains(t, transferResp.Body.String(), `"successful":1`)

	hostsReq := httptest.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/topology/nodes/module-%d/hosts", moduleBody.Data.ID), nil)
	hostsResp := httptest.NewRecorder()
	router.ServeHTTP(hostsResp, hostsReq)

	require.Equal(t, http.StatusOK, hostsResp.Code)
	require.Contains(t, hostsResp.Body.String(), hostID.String())
	require.Contains(t, hostsResp.Body.String(), `"module":{"id":`)
}

func TestTopologyHandler_TransferHosts_PersistsToLegacyTables(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "legacy-transfer-biz")
	hostID := uuid.New()
	now := time.Now().UTC()
	set := types.Set{
		BusinessID: bizID,
		Name:       "legacy-set",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&set).Error)
	module := types.Module{
		SetID:      set.ID,
		BusinessID: bizID,
		Name:       "legacy-module",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&module).Error)
	require.NoError(t, db.Create(&types.Host{
		ID:        hostID,
		TenantID:  uuid.New(),
		HostName:  "legacy-transfer-host",
		PrimaryIP: "10.0.0.41",
		Status:    types.HostStatusRunning,
		CreatedAt: now,
		UpdatedAt: now,
	}).Error)

	router := gin.New()
	router.POST("/api/v1/topology/hosts/transfer", handler.TransferHosts)

	payload, err := json.Marshal(map[string]any{
		"host_ids":         []string{hostID.String()},
		"target_module_id": module.ID,
	})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/topology/hosts/transfer", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"successful":1`)

	var moduleRelationCount int64
	require.NoError(t, db.Model(&types.HostModuleRelation{}).
		Where("host_id = ? AND module_id = ?", hostID, module.ID).
		Count(&moduleRelationCount).Error)
	require.EqualValues(t, 1, moduleRelationCount)

	var businessRelationCount int64
	require.NoError(t, db.Model(&types.HostBusinessRelation{}).
		Where("host_id = ? AND business_id = ?", hostID, bizID).
		Count(&businessRelationCount).Error)
	require.EqualValues(t, 1, businessRelationCount)
}

func TestTopologyHandler_TransferHosts_MovesHostFromSourceModule(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "legacy-transfer-source-biz")
	hostID := uuid.New()
	now := time.Now().UTC()
	set := types.Set{
		BusinessID: bizID,
		Name:       "legacy-source-set",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&set).Error)
	sourceModule := types.Module{
		SetID:      set.ID,
		BusinessID: bizID,
		Name:       "legacy-source-module",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&sourceModule).Error)
	targetModule := types.Module{
		SetID:      set.ID,
		BusinessID: bizID,
		Name:       "legacy-target-module",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&targetModule).Error)
	require.NoError(t, db.Create(&types.Host{
		ID:        hostID,
		TenantID:  uuid.New(),
		HostName:  "legacy-source-transfer-host",
		PrimaryIP: "10.0.0.42",
		Status:    types.HostStatusRunning,
		CreatedAt: now,
		UpdatedAt: now,
	}).Error)
	require.NoError(t, db.Create(&types.HostModuleRelation{
		HostID:    hostID,
		ModuleID:  sourceModule.ID,
		CreatedAt: now,
	}).Error)

	router := gin.New()
	router.POST("/api/v1/topology/hosts/transfer", handler.TransferHosts)

	payload, err := json.Marshal(map[string]any{
		"host_ids":         []string{hostID.String()},
		"target_module_id": targetModule.ID,
		"source_module_id": sourceModule.ID,
	})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/topology/hosts/transfer", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"successful":1`)

	var sourceRelationCount int64
	require.NoError(t, db.Model(&types.HostModuleRelation{}).
		Where("host_id = ? AND module_id = ?", hostID, sourceModule.ID).
		Count(&sourceRelationCount).Error)
	require.EqualValues(t, 0, sourceRelationCount)

	var targetRelationCount int64
	require.NoError(t, db.Model(&types.HostModuleRelation{}).
		Where("host_id = ? AND module_id = ?", hostID, targetModule.ID).
		Count(&targetRelationCount).Error)
	require.EqualValues(t, 1, targetRelationCount)
}

func TestTopologyHandler_TransferHostsToPool_PersistsToLegacyTables(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "legacy-pool-biz")
	hostID := uuid.New()
	now := time.Now().UTC()
	set := types.Set{
		BusinessID: bizID,
		Name:       "legacy-pool-set",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&set).Error)
	module := types.Module{
		SetID:      set.ID,
		BusinessID: bizID,
		Name:       "legacy-pool-module",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	require.NoError(t, db.Create(&module).Error)
	require.NoError(t, db.Create(&types.Host{
		ID:        hostID,
		TenantID:  uuid.New(),
		HostName:  "legacy-pool-host",
		PrimaryIP: "10.0.0.51",
		Status:    types.HostStatusRunning,
		CreatedAt: now,
		UpdatedAt: now,
	}).Error)
	require.NoError(t, db.Create(&types.HostModuleRelation{
		HostID:    hostID,
		ModuleID:  module.ID,
		CreatedAt: now,
	}).Error)
	require.NoError(t, db.Create(&types.HostBusinessRelation{
		HostID:     hostID,
		BusinessID: bizID,
		CreatedAt:  now,
	}).Error)

	router := gin.New()
	router.POST("/api/v1/topology/hosts/transfer-to-pool", handler.TransferHostsToPool)

	payload, err := json.Marshal(map[string]any{
		"host_ids": []string{hostID.String()},
	})
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/topology/hosts/transfer-to-pool", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"successful":1`)

	var moduleRelationCount int64
	require.NoError(t, db.Model(&types.HostModuleRelation{}).
		Where("host_id = ?", hostID).
		Count(&moduleRelationCount).Error)
	require.EqualValues(t, 0, moduleRelationCount)

	var businessRelationCount int64
	require.NoError(t, db.Model(&types.HostBusinessRelation{}).
		Where("host_id = ?", hostID).
		Count(&businessRelationCount).Error)
	require.EqualValues(t, 0, businessRelationCount)
}

func TestTopologyHandler_UpdateModule_PersistsServiceCategoryID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	require.NoError(t, db.Exec(`
		CREATE TABLE service_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id BIGINT,
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

	mainlineSvc := mainline.NewService(db)
	service := topology.NewService(db, mainlineSvc)
	aggregate := topology.NewAggregateService(db, service, mainlineSvc)
	handler := NewTopologyHandler(service, aggregate)

	bizID := seedTopologyHandlerBusiness(t, db, "projection-category-biz")
	categoryID := uint64(10)
	require.NoError(t, db.Exec(`
		INSERT INTO service_categories (id, business_id, name, parent_id, root_id, is_builtin, sort_order, created_at, updated_at)
		VALUES (?, ?, ?, NULL, ?, FALSE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, categoryID, bizID, "Database", categoryID).Error)

	router := gin.New()
	router.POST("/api/v1/topology/sets", handler.CreateSet)
	router.POST("/api/v1/topology/modules", handler.CreateModule)
	router.PUT("/api/v1/topology/modules/:id", handler.UpdateModule)

	setPayload, err := json.Marshal(map[string]any{
		"business_id": bizID,
		"name":        "module-set",
	})
	require.NoError(t, err)

	setReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/sets", bytes.NewReader(setPayload))
	setReq.Header.Set("Content-Type", "application/json")
	setResp := httptest.NewRecorder()
	router.ServeHTTP(setResp, setReq)
	require.Equal(t, http.StatusCreated, setResp.Code)

	var setBody struct {
		Data struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(setResp.Body.Bytes(), &setBody))

	modulePayload, err := json.Marshal(map[string]any{
		"set_id": setBody.Data.ID,
		"name":   "gateway",
	})
	require.NoError(t, err)

	moduleReq := httptest.NewRequest(http.MethodPost, "/api/v1/topology/modules", bytes.NewReader(modulePayload))
	moduleReq.Header.Set("Content-Type", "application/json")
	moduleResp := httptest.NewRecorder()
	router.ServeHTTP(moduleResp, moduleReq)
	require.Equal(t, http.StatusCreated, moduleResp.Code)

	var moduleBody struct {
		Data struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(moduleResp.Body.Bytes(), &moduleBody))

	updatePayload, err := json.Marshal(map[string]any{
		"service_category_id": categoryID,
	})
	require.NoError(t, err)

	updateReq := httptest.NewRequest(
		http.MethodPut,
		fmt.Sprintf("/api/v1/topology/modules/%d", moduleBody.Data.ID),
		bytes.NewReader(updatePayload),
	)
	updateReq.Header.Set("Content-Type", "application/json")
	updateResp := httptest.NewRecorder()
	router.ServeHTTP(updateResp, updateReq)

	require.Equal(t, http.StatusOK, updateResp.Code)
	require.Contains(t, updateResp.Body.String(), `"service_category_id":10`)
}
