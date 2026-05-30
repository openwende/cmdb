package audit

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

// fakeAuditRepo 是 storage.AuditRepository 的测试替身，记录收到的查询参数并返回预设数据。
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

func TestModelUIDsForAuditType(t *testing.T) {
	tests := []struct {
		name         string
		auditType    string
		resourceType string
		wantInclude  []string
		wantExclude  []string
	}{
		{
			name:        "host tab",
			auditType:   "host",
			wantInclude: []string{"host"},
		},
		{
			name:        "business tab expands to sorted business models",
			auditType:   "business",
			wantInclude: []string{"biz", "business", "module", "set"},
		},
		{
			name:        "resource tab excludes host and business models",
			auditType:   "resource",
			wantExclude: []string{"biz", "business", "host", "module", "set"},
		},
		{
			name:         "resource_type overrides the host tab",
			auditType:    "host",
			resourceType: "switch",
			wantInclude:  []string{"switch"},
		},
		{
			name:         "resource_type overrides the resource tab",
			auditType:    "resource",
			resourceType: "router",
			wantInclude:  []string{"router"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			include, exclude := modelUIDsForAuditType(tt.auditType, tt.resourceType)
			require.Equal(t, tt.wantInclude, include)
			require.Equal(t, tt.wantExclude, exclude)
		})
	}
}

func TestBuildParams_Pagination(t *testing.T) {
	tests := []struct {
		name         string
		page         int
		pageSize     int
		wantPage     int
		wantPageSize int
	}{
		{name: "zero values fall back to defaults", page: 0, pageSize: 0, wantPage: 1, wantPageSize: 20},
		{name: "negative values fall back to defaults", page: -3, pageSize: -7, wantPage: 1, wantPageSize: 20},
		{name: "valid values pass through", page: 3, pageSize: 50, wantPage: 3, wantPageSize: 50},
		{name: "oversized page size is capped at 200", page: 1, pageSize: 999, wantPage: 1, wantPageSize: 200},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			params, err := buildParams(&QueryRequest{
				AuditType: "host",
				Page:      tt.page,
				PageSize:  tt.pageSize,
			})
			require.NoError(t, err)
			require.Equal(t, tt.wantPage, params.Page)
			require.Equal(t, tt.wantPageSize, params.PageSize)
		})
	}
}

func TestBuildParams_TimeRange(t *testing.T) {
	t.Run("parses start and makes end inclusive of the whole day", func(t *testing.T) {
		params, err := buildParams(&QueryRequest{
			AuditType: "host",
			StartTime: "2024-01-02",
			EndTime:   "2024-01-02",
		})
		require.NoError(t, err)
		require.True(t, time.Date(2024, 1, 2, 0, 0, 0, 0, time.UTC).Equal(params.StartTime))
		require.True(t, time.Date(2024, 1, 2, 23, 59, 59, 0, time.UTC).Equal(params.EndTime))
	})

	t.Run("rejects invalid start_time", func(t *testing.T) {
		_, err := buildParams(&QueryRequest{AuditType: "host", StartTime: "not-a-date"})
		require.Error(t, err)
	})

	t.Run("rejects invalid end_time", func(t *testing.T) {
		_, err := buildParams(&QueryRequest{AuditType: "host", EndTime: "not-a-date"})
		require.Error(t, err)
	})

	t.Run("empty times stay zero", func(t *testing.T) {
		params, err := buildParams(&QueryRequest{AuditType: "host"})
		require.NoError(t, err)
		require.True(t, params.StartTime.IsZero())
		require.True(t, params.EndTime.IsZero())
	})
}

func TestBuildParams_FieldPassthrough(t *testing.T) {
	params, err := buildParams(&QueryRequest{
		AuditType:    "resource",
		BusinessID:   1001,
		Actions:      []string{"create", "update"},
		Account:      "alice",
		AccountMatch: "exclude",
		HostKeyword:  "10.0.0.1",
		Instance:     "mysql-01",
		InstanceType: "name",
	})
	require.NoError(t, err)
	require.Equal(t, int64(1001), params.BusinessID)
	require.Equal(t, []string{"create", "update"}, params.Actions)
	require.Equal(t, "alice", params.Account)
	require.Equal(t, "exclude", params.AccountMatch)
	require.Equal(t, "10.0.0.1", params.HostKeyword)
	require.Equal(t, "mysql-01", params.InstanceKeyword)
}

func TestConvertRow(t *testing.T) {
	t.Run("maps fields, diffs update fields, and extracts business id from float", func(t *testing.T) {
		row := types.AuditLogRow{
			ID:         7,
			ResourceID: 42,
			ModelUID:   "host",
			ChangeType: "update",
			BeforeData: map[string]interface{}{"name": "old", "cpu": 2},
			AfterData:  map[string]interface{}{"name": "new", "cpu": 2, "mem": 8},
			ChangedBy:  "alice",
			ChangedAt:  time.Date(2024, 3, 4, 5, 6, 7, 0, time.UTC),
			// ResourceName intentionally empty to exercise the fallback.
			ResourceConfigs: map[string]interface{}{"business_id": float64(1001)},
		}

		entry := convertRow(row, "host")

		require.Equal(t, uint64(7), entry.ID)
		require.Equal(t, "host", entry.AuditType)
		require.Equal(t, "alice", entry.User)
		require.Equal(t, "host", entry.ResourceType)
		require.Equal(t, "update", entry.Action)
		require.Equal(t, "user", entry.OperateFrom)
		require.Equal(t, "2024-03-04 05:06:07", entry.OperationTime)
		require.Equal(t, int64(1001), entry.BkBizID)
		require.Equal(t, uint64(42), entry.ResourceID)
		// cpu unchanged -> excluded; name changed and mem added -> included, sorted.
		require.Equal(t, []string{"mem", "name"}, entry.OperationDetail.Details.UpdateFields)
		require.Equal(t, "host", entry.OperationDetail.BkObjID)
		// ResourceName falls back to the name field in AfterData.
		require.Equal(t, "new", entry.ResourceName)
	})

	t.Run("prefers explicit ResourceName and parses string business id", func(t *testing.T) {
		row := types.AuditLogRow{
			ModelUID:        "switch",
			ChangeType:      "create",
			ChangedAt:       time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			ResourceName:    "explicit-name",
			ResourceConfigs: map[string]interface{}{"business_id": "2002"},
		}

		entry := convertRow(row, "resource")

		require.Equal(t, "explicit-name", entry.ResourceName)
		require.Equal(t, int64(2002), entry.BkBizID)
	})

	t.Run("create with no before data leaves update fields empty", func(t *testing.T) {
		row := types.AuditLogRow{
			ModelUID:   "host",
			ChangeType: "create",
			ChangedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
			AfterData:  map[string]interface{}{"name": "created"},
		}

		entry := convertRow(row, "host")

		require.Empty(t, entry.OperationDetail.Details.UpdateFields)
		require.Equal(t, "created", entry.ResourceName)
	})
}

func TestExtractName(t *testing.T) {
	tests := []struct {
		name string
		data map[string]interface{}
		want string
	}{
		{name: "name wins", data: map[string]interface{}{"name": "n", "hostname": "h"}, want: "n"},
		{name: "falls through to hostname", data: map[string]interface{}{"hostname": "h1"}, want: "h1"},
		{name: "skips empty string and uses next key", data: map[string]interface{}{"name": "", "primary_ip": "1.2.3.4"}, want: "1.2.3.4"},
		{name: "ignores non-string values", data: map[string]interface{}{"name": 123}, want: ""},
		{name: "no known keys", data: map[string]interface{}{"foo": "bar"}, want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, extractName(tt.data))
		})
	}
}

func TestIsBusinessModel(t *testing.T) {
	for _, uid := range []string{"biz", "business", "set", "module", "BIZ", "Set"} {
		require.True(t, IsBusinessModel(uid), "expected %q to be a business model", uid)
	}
	for _, uid := range []string{"host", "switch", "router", ""} {
		require.False(t, IsBusinessModel(uid), "expected %q not to be a business model", uid)
	}
}

func TestQuery(t *testing.T) {
	t.Run("builds params, applies conversion, and returns the total", func(t *testing.T) {
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
			total: 5,
		}

		result, err := NewService(repo).Query(context.Background(), &QueryRequest{AuditType: "host"})
		require.NoError(t, err)
		require.Equal(t, int64(5), result.Count)
		require.Len(t, result.Info, 1)
		require.Equal(t, "host", result.Info[0].AuditType)
		require.Equal(t, "web-01", result.Info[0].ResourceName)
		// Params were built from the request before hitting the repo.
		require.NotNil(t, repo.gotParams)
		require.Equal(t, []string{"host"}, repo.gotParams.ModelUIDs)
	})

	t.Run("returns build errors before touching the repo", func(t *testing.T) {
		repo := &fakeAuditRepo{}
		_, err := NewService(repo).Query(context.Background(), &QueryRequest{AuditType: "host", StartTime: "bad"})
		require.Error(t, err)
		require.Nil(t, repo.gotParams)
	})

	t.Run("propagates repo errors", func(t *testing.T) {
		repo := &fakeAuditRepo{err: context.DeadlineExceeded}
		_, err := NewService(repo).Query(context.Background(), &QueryRequest{AuditType: "host"})
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})
}
