package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

type fakeHostDetailRepo struct {
	gotDisplayID int64
	detail       *types.HostDetail
	err          error
}

func (f *fakeHostDetailRepo) GetHostDetailByDisplayID(_ context.Context, displayID int64) (*types.HostDetail, error) {
	f.gotDisplayID = displayID
	return f.detail, f.err
}

var _ storage.HostDetailRepository = (*fakeHostDetailRepo)(nil)

func doHostDetailGet(repo storage.HostDetailRepository, id string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/api/v1/hosts/display/:display_id", NewHostDetailHandler(repo).GetHostByDisplayID)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/hosts/display/"+id, nil))
	return rec
}

func TestHostDetailHandler_GetHostByDisplayID(t *testing.T) {
	cpu, area := 8, uuid.New()
	repo := &fakeHostDetailRepo{detail: &types.HostDetail{
		Host: types.Host{
			ID: uuid.New(), DisplayID: 12, HostName: "pay-gw-01", PrimaryIP: "10.20.1.11",
			IPAddresses: types.StringArray{"10.20.1.11"}, CloudAreaID: &area, CPU: &cpu, Status: "running",
			IsDestroyed: true, CustomFields: map[string]interface{}{"固资编号": "WD-1"},
			CloudMetadata: map[string]interface{}{"zone": "gz-3"},
			CreatedAt:     time.Date(2026, 9, 20, 2, 0, 0, 0, time.UTC), UpdatedAt: time.Date(2026, 9, 21, 2, 0, 0, 0, time.UTC),
		},
		CloudAreaName: "广州 VPC",
		Placements: []types.HostPlacement{
			{Kind: types.HostPlacementBusiness, BusinessID: 1001, BusinessName: "支付清结算", SetID: 11, SetName: "生产集群", ModuleID: 111, ModuleName: "支付网关"},
			{Kind: types.HostPlacementBusiness, BusinessID: 1001, BusinessName: "支付清结算", SetID: 11, SetName: "生产集群", ModuleID: 112, ModuleName: "风控服务"},
		},
	}}

	rec := doHostDetailGet(repo, "12")
	require.Equal(t, http.StatusOK, rec.Code)
	require.EqualValues(t, 12, repo.gotDisplayID)

	var body struct {
		Code int                    `json:"code"`
		Data map[string]interface{} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, 0, body.Code)
	// 主机字段平铺在 data 里，和 Host 的 JSON 一致
	for _, key := range []string{"id", "display_id", "host_name", "primary_ip", "ip_addresses", "cloud_area_id", "cpu", "status",
		"is_destroyed", "custom_fields", "cloud_metadata", "created_at", "updated_at", "tenant_id", "cloud_area_name", "placements"} {
		require.Contains(t, body.Data, key)
	}
	require.EqualValues(t, 12, body.Data["display_id"])
	require.Equal(t, true, body.Data["is_destroyed"])
	require.Equal(t, "广州 VPC", body.Data["cloud_area_name"])
	require.Equal(t, map[string]interface{}{"固资编号": "WD-1"}, body.Data["custom_fields"])

	placements := body.Data["placements"].([]interface{})
	require.Len(t, placements, 2)
	require.Equal(t, map[string]interface{}{
		"kind": "business", "business_id": float64(1001), "business_name": "支付清结算",
		"set_id": float64(11), "set_name": "生产集群", "module_id": float64(111), "module_name": "支付网关",
	}, placements[0])

	pool := &fakeHostDetailRepo{detail: &types.HostDetail{
		Host:       types.Host{DisplayID: 2, HostName: "pool-hc-01"},
		Placements: []types.HostPlacement{{Kind: types.HostPlacementPool, DirectoryID: 2, DirectoryName: "高配计算"}},
	}}
	rec = doHostDetailGet(pool, "2")
	require.Equal(t, http.StatusOK, rec.Code)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, []interface{}{map[string]interface{}{"kind": "pool", "directory_id": float64(2), "directory_name": "高配计算"}},
		body.Data["placements"])
}

func TestHostDetailHandler_GetHostByDisplayID_Errors(t *testing.T) {
	rec := doHostDetailGet(&fakeHostDetailRepo{}, "999")
	require.Equal(t, http.StatusNotFound, rec.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, "NOT_FOUND", body["error"])

	for _, bad := range []string{"abc", "0", "-1", "1.5", "00000000-0000-0000-0000-000000000001"} {
		repo := &fakeHostDetailRepo{}
		rec := doHostDetailGet(repo, bad)
		require.Equal(t, http.StatusBadRequest, rec.Code, bad)
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		require.Equal(t, "INVALID_INPUT", body["error"], bad)
		require.Zero(t, repo.gotDisplayID, "非法 ID 不查库")
	}

	require.Equal(t, http.StatusInternalServerError, doHostDetailGet(&fakeHostDetailRepo{err: errors.New("db down")}, "1").Code)
}
