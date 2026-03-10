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

func (f *fakeHostRepo) AssignToBusiness(context.Context, uuid.UUID, int64) error {
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
	require.Equal(t, defaultTenantUUID, hostRepo.createTenantID)
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
	require.Equal(t, defaultTenantUUID, hostRepo.listTenantID)
}
