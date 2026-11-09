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
	"github.com/stretchr/testify/require"

	"github.com/openwende/cmdb-server/internal/core/audit"
	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/internal/types"
)

// fakeAuditRepo records the params it receives and returns canned data so the
// handler can be exercised without a database.
type fakeAuditRepo struct {
	gotParams *types.AuditQueryParams
	rows      []types.AuditLogRow
	total     int64
	err       error
}

func (f *fakeAuditRepo) ListAuditLogs(_ context.Context, params *types.AuditQueryParams) ([]types.AuditLogRow, int64, error) {
	f.gotParams = params
	if f.err != nil {
		return nil, 0, f.err
	}
	return f.rows, f.total, nil
}

var _ storage.AuditRepository = (*fakeAuditRepo)(nil)

func doAuditRequest(repo storage.AuditRepository, rawQuery string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewAuditHandler(audit.NewService(repo))
	router.GET("/api/v1/audit", handler.ListAuditLogs)

	target := "/api/v1/audit"
	if rawQuery != "" {
		target += "?" + rawQuery
	}
	req := httptest.NewRequest(http.MethodGet, target, nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	return rec
}

func TestAuditHandler_ListAuditLogs_SuccessAndDefaults(t *testing.T) {
	repo := &fakeAuditRepo{
		rows: []types.AuditLogRow{
			{
				ID:         1,
				ModelUID:   "host",
				ChangeType: "create",
				ChangedAt:  time.Date(2024, 1, 2, 3, 4, 5, 0, time.UTC),
				AfterData:  map[string]interface{}{"name": "web-01"},
			},
		},
		total: 1,
	}

	rec := doAuditRequest(repo, "")
	require.Equal(t, http.StatusOK, rec.Code)

	var body struct {
		Code int `json:"code"`
		Data struct {
			Count int64 `json:"count"`
			Info  []struct {
				ID           uint64 `json:"id"`
				AuditType    string `json:"audit_type"`
				ResourceName string `json:"resource_name"`
			} `json:"info"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, 0, body.Code)
	require.Equal(t, int64(1), body.Data.Count)
	require.Len(t, body.Data.Info, 1)
	require.Equal(t, "host", body.Data.Info[0].AuditType)
	require.Equal(t, "web-01", body.Data.Info[0].ResourceName)

	// Unset query params fall back to their documented defaults.
	require.NotNil(t, repo.gotParams)
	require.Equal(t, []string{"host"}, repo.gotParams.ModelUIDs)
	require.Equal(t, "include", repo.gotParams.AccountMatch)
	require.Equal(t, 1, repo.gotParams.Page)
	require.Equal(t, 20, repo.gotParams.PageSize)
}

func TestAuditHandler_ListAuditLogs_InvalidAuditType(t *testing.T) {
	repo := &fakeAuditRepo{}
	rec := doAuditRequest(repo, "audit_type=nope")
	require.Equal(t, http.StatusBadRequest, rec.Code)
	// Validation fails before the repo is queried.
	require.Nil(t, repo.gotParams)
}

func TestAuditHandler_ListAuditLogs_InvalidBizID(t *testing.T) {
	repo := &fakeAuditRepo{}
	rec := doAuditRequest(repo, "bk_biz_id=abc")
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Nil(t, repo.gotParams)
}

func TestAuditHandler_ListAuditLogs_InvalidResourceID(t *testing.T) {
	for _, bad := range []string{"abc", "0", "-3", "1.5", "7x", "%20"} {
		repo := &fakeAuditRepo{}
		rec := doAuditRequest(repo, "audit_type=host&resource_id="+bad)
		require.Equal(t, http.StatusBadRequest, rec.Code, bad)
		require.Nil(t, repo.gotParams, bad)
	}
}

func TestAuditHandler_ListAuditLogs_ServiceError(t *testing.T) {
	repo := &fakeAuditRepo{err: errors.New("db down")}
	rec := doAuditRequest(repo, "")
	require.Equal(t, http.StatusInternalServerError, rec.Code)
}

func TestAuditHandler_ListAuditLogs_ParamMapping(t *testing.T) {
	tests := []struct {
		name  string
		query string
		check func(t *testing.T, p *types.AuditQueryParams)
	}{
		{
			name:  "actions are split and trimmed",
			query: "action=create,%20update%20,,delete",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, []string{"create", "update", "delete"}, p.Actions)
			},
		},
		{
			name:  "business id passes through",
			query: "bk_biz_id=1001",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, int64(1001), p.BusinessID)
			},
		},
		{
			name:  "resource id passes through",
			query: "audit_type=host&resource_id=42",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, uint64(42), p.ResourceID)
				require.Equal(t, []string{"host"}, p.ModelUIDs)
			},
		},
		{
			name:  "resource id absent means no filter",
			query: "audit_type=host",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Zero(t, p.ResourceID)
			},
		},
		{
			name:  "pagination passes through",
			query: "page=3&page_size=50",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, 3, p.Page)
				require.Equal(t, 50, p.PageSize)
			},
		},
		{
			name:  "oversized page size falls back to the default",
			query: "page_size=999",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, 20, p.PageSize)
			},
		},
		{
			name:  "business tab expands model uids",
			query: "audit_type=business",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, []string{"biz", "business", "module", "set"}, p.ModelUIDs)
			},
		},
		{
			name:  "resource tab excludes host and business models",
			query: "audit_type=resource",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Empty(t, p.ModelUIDs)
				require.Equal(t, []string{"biz", "business", "host", "module", "set"}, p.ExcludeModelUIDs)
			},
		},
		{
			name:  "resource_type overrides the tab model uids",
			query: "audit_type=resource&resource_type=switch",
			check: func(t *testing.T, p *types.AuditQueryParams) {
				require.Equal(t, []string{"switch"}, p.ModelUIDs)
				require.Empty(t, p.ExcludeModelUIDs)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeAuditRepo{}
			rec := doAuditRequest(repo, tt.query)
			require.Equal(t, http.StatusOK, rec.Code)
			require.NotNil(t, repo.gotParams)
			tt.check(t, repo.gotParams)
		})
	}
}

func doAuditGet(repo storage.AuditRepository, id string) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewAuditHandler(audit.NewService(repo))
	router.GET("/api/v1/audit/:id", handler.GetAuditLog)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/audit/"+id, nil))
	return rec
}

func TestAuditHandler_GetAuditLog(t *testing.T) {
	repo := &fakeAuditRepo{
		rows: []types.AuditLogRow{{
			ID:         895,
			ModelUID:   "host",
			ChangeType: "update",
			ChangedBy:  "chenjing",
			ChangedAt:  time.Date(2026, 9, 22, 11, 30, 0, 0, time.UTC),
			AfterData:  map[string]interface{}{"host_name": "pay-gw-02"},
		}},
		total: 1,
	}
	rec := doAuditGet(repo, "895")
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, uint64(895), repo.gotParams.ID)
	require.Empty(t, repo.gotParams.ModelUIDs, "按 ID 取时不按分类过滤")

	var body struct {
		Data types.AuditLogEntry `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, uint64(895), body.Data.ID)
	require.Equal(t, "host", body.Data.AuditType)
	require.Equal(t, "pay-gw-02", body.Data.ResourceName)
}

func TestAuditHandler_GetAuditLog_NotFoundAndInvalid(t *testing.T) {
	rec := doAuditGet(&fakeAuditRepo{}, "999999")
	require.Equal(t, http.StatusNotFound, rec.Code)
	var body map[string]interface{}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	require.Equal(t, "NOT_FOUND", body["error"])

	for _, bad := range []string{"abc", "0", "-1"} {
		require.Equal(t, http.StatusBadRequest, doAuditGet(&fakeAuditRepo{}, bad).Code, bad)
	}
	require.Equal(t, http.StatusInternalServerError, doAuditGet(&fakeAuditRepo{err: errors.New("db down")}, "1").Code)
}

func TestAuditTypeOf(t *testing.T) {
	require.Equal(t, "host", audit.AuditTypeOf("host"))
	require.Equal(t, "business", audit.AuditTypeOf("module"))
	require.Equal(t, "resource", audit.AuditTypeOf("switch"))
}
