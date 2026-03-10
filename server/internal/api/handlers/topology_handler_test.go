package handlers

import (
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

	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/core/topology"
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
			id TEXT PRIMARY KEY,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			created_by TEXT,
			updated_by TEXT,
			tenant_id TEXT NOT NULL,
			name TEXT NOT NULL,
			identifier TEXT NOT NULL,
			business_id BIGINT,
			description TEXT,
			lifecycle TEXT NOT NULL DEFAULT 'online',
			timezone TEXT NOT NULL DEFAULT 'UTC',
			language TEXT NOT NULL DEFAULT 'en',
			maintainers TEXT,
			is_built_in BOOLEAN NOT NULL DEFAULT FALSE
		)`,
		`CREATE TABLE sets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id TEXT NOT NULL,
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
			business_id TEXT NOT NULL,
			service_template_id BIGINT,
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
			business_id TEXT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)`,
		`CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id BIGINT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
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

func seedTopologyHandlerBusiness(t *testing.T, db *gorm.DB, name string) uuid.UUID {
	t.Helper()

	bizID := uuid.New()
	description := name + " description"
	biz := types.Business{
		ID:          bizID,
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
	return bizID
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
