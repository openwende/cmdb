package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/wend/cmdb-backend/internal/api/response"
	"github.com/wend/cmdb-backend/internal/core/host"
	"github.com/wend/cmdb-backend/internal/types"
)

type fakeHostRepo struct {
	createTenantID uuid.UUID
	listTenantID   uuid.UUID
}

func (f *fakeHostRepo) CreateHost(_ context.Context, tenantID uuid.UUID, req *types.CreateHostRequest, _ *uuid.UUID) (*types.Host, error) {
	f.createTenantID = tenantID

	return &types.Host{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CloudAreaID: req.CloudAreaID,
		HostName:    req.HostName,
		PrimaryIP:   req.PrimaryIP,
		Status:      types.HostStatusRunning,
	}, nil
}

func (f *fakeHostRepo) BatchCreateHosts(context.Context, uuid.UUID, []*types.Host) error {
	return nil
}

func (f *fakeHostRepo) GetHost(_ context.Context, id uuid.UUID) (*types.Host, error) {
	return &types.Host{ID: id}, nil
}

func (f *fakeHostRepo) GetHostByCloudInstance(context.Context, string, string) (*types.Host, error) {
	return nil, nil
}

func (f *fakeHostRepo) GetHostByCloudAreaIP(context.Context, uuid.UUID, string) (*types.Host, error) {
	return nil, nil
}

func (f *fakeHostRepo) ListHosts(_ context.Context, tenantID uuid.UUID, params *types.HostQueryParams) ([]types.Host, int64, error) {
	f.listTenantID = tenantID

	return []types.Host{
		{
			ID:        uuid.New(),
			TenantID:  tenantID,
			HostName:  "seed-host",
			PrimaryIP: "10.0.0.1",
			Status:    types.HostStatusRunning,
		},
	}, int64(params.PageSize), nil
}

func (f *fakeHostRepo) UpdateHost(context.Context, uuid.UUID, *types.UpdateHostRequest, *uuid.UUID) (*types.Host, error) {
	return nil, nil
}

func (f *fakeHostRepo) UpdateCustomFields(context.Context, uuid.UUID, map[string]interface{}, *uuid.UUID) (*types.Host, error) {
	return nil, nil
}

func (f *fakeHostRepo) AssignToBusiness(context.Context, uuid.UUID, uint64) error {
	return nil
}

func (f *fakeHostRepo) ReclaimToPool(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeHostRepo) MarkAsDestroyed(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeHostRepo) DeleteHost(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeHostRepo) CheckIPConflict(context.Context, *uuid.UUID, string, *uuid.UUID) (bool, error) {
	return false, nil
}

func (f *fakeHostRepo) HostStatistics(context.Context) (*types.HostStatistics, error) {
	return &types.HostStatistics{}, nil
}

type fakeCloudAreaRepo struct {
	defaultArea *types.CloudArea
}

func (f *fakeCloudAreaRepo) CreateCloudArea(context.Context, uuid.UUID, *types.CreateCloudAreaRequest) (*types.CloudArea, error) {
	return nil, nil
}

func (f *fakeCloudAreaRepo) GetCloudArea(context.Context, uuid.UUID) (*types.CloudArea, error) {
	return f.defaultArea, nil
}

func (f *fakeCloudAreaRepo) GetCloudAreaByIdentifier(context.Context, uuid.UUID, string) (*types.CloudArea, error) {
	return nil, nil
}

func (f *fakeCloudAreaRepo) GetDefaultCloudArea(context.Context) (*types.CloudArea, error) {
	return f.defaultArea, nil
}

func (f *fakeCloudAreaRepo) ListCloudAreas(context.Context, uuid.UUID, *types.CloudAreaQueryParams) ([]types.CloudArea, int64, error) {
	return nil, 0, nil
}

func (f *fakeCloudAreaRepo) UpdateCloudArea(context.Context, uuid.UUID, *types.UpdateCloudAreaRequest) (*types.CloudArea, error) {
	return nil, nil
}

func (f *fakeCloudAreaRepo) DeleteCloudArea(context.Context, uuid.UUID) error {
	return nil
}

func (f *fakeCloudAreaRepo) CountHostsInCloudArea(context.Context, uuid.UUID) (int64, error) {
	return 0, nil
}

func TestHostHandler_CreateHostUsesDefaultTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	hostRepo := &fakeHostRepo{}
	cloudAreaID := uuid.New()
	cloudAreaRepo := &fakeCloudAreaRepo{
		defaultArea: &types.CloudArea{ID: cloudAreaID},
	}
	handler := NewHostHandler(host.NewService(hostRepo, cloudAreaRepo))

	router := gin.New()
	router.POST("/hosts", handler.CreateHost)

	body, err := json.Marshal(types.CreateHostRequest{
		HostName:  "smoke-host",
		PrimaryIP: "10.0.0.1",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/hosts", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusCreated, resp.Code)
	require.Equal(t, systemTenantUUID, hostRepo.createTenantID)
}

func TestHostHandler_ListHostsUsesDefaultTenant(t *testing.T) {
	gin.SetMode(gin.TestMode)

	hostRepo := &fakeHostRepo{}
	cloudAreaRepo := &fakeCloudAreaRepo{
		defaultArea: &types.CloudArea{ID: uuid.New()},
	}
	handler := NewHostHandler(host.NewService(hostRepo, cloudAreaRepo))

	router := gin.New()
	router.GET("/hosts", handler.ListHosts)

	req := httptest.NewRequest(http.MethodGet, "/hosts?page=1&page_size=20", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Equal(t, systemTenantUUID, hostRepo.listTenantID)

	// R8：列表响应为统一 envelope {"code":0,"data":{"items":[...],"pagination":{...}}}。
	var envelope struct {
		Code int `json:"code"`
		Data struct {
			Items      []types.Host       `json:"items"`
			Pagination response.Pagination `json:"pagination"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &envelope))
	require.Equal(t, response.CodeOK, envelope.Code)
	require.Len(t, envelope.Data.Items, 1)
	require.Equal(t, 1, envelope.Data.Pagination.Page)
	require.Equal(t, 20, envelope.Data.Pagination.PageSize)
	require.Equal(t, int64(20), envelope.Data.Pagination.Total)
}

// TestHostHandler_BatchImportPartialFailureReturns200Envelope 锁定 R8 契约：
// 批量导入即便部分失败也返回 HTTP 200（曾为 207），且响应体为统一 envelope
// {"code":0,"data":<BatchImportResult>}，部分失败由 body 的 successful/failed 表达。
func TestHostHandler_BatchImportPartialFailureReturns200Envelope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	hostRepo := &fakeHostRepo{}
	cloudAreaRepo := &fakeCloudAreaRepo{
		defaultArea: &types.CloudArea{ID: uuid.New()},
	}
	handler := NewHostHandler(host.NewService(hostRepo, cloudAreaRepo))

	router := gin.New()
	router.POST("/hosts/batch", handler.BatchImportHosts)

	// 一台合法主机 + 一台 primary_ip 非法 → 部分失败（skip_errors 跳过继续）。
	body, err := json.Marshal(types.BatchImportHostsRequest{
		Hosts: []types.CreateHostRequest{
			{HostName: "ok-host", PrimaryIP: "10.0.0.1"},
			{HostName: "bad-host", PrimaryIP: "not-an-ip"},
		},
		SkipErrors:          true,
		UseDefaultCloudArea: true,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/hosts/batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	// 部分失败也是 200（不再 207）。
	require.Equal(t, http.StatusOK, resp.Code)

	var envelope struct {
		Code int                     `json:"code"`
		Data types.BatchImportResult `json:"data"`
	}
	require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &envelope))
	require.Equal(t, response.CodeOK, envelope.Code)
	require.Equal(t, 2, envelope.Data.Total)
	require.Equal(t, 1, envelope.Data.Successful)
	require.Equal(t, 1, envelope.Data.Failed)
	require.Len(t, envelope.Data.Errors, 1)
}
