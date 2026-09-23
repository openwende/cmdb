package host

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/internal/auth"
	"github.com/wend/cmdb-backend/internal/types"
)

func setupHostAuditDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	for _, ddl := range []string{
		`CREATE TABLE resource_histories (id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER, model_uid TEXT, change_type TEXT, before_data TEXT, after_data TEXT, changed_by TEXT, changed_at DATETIME, client_ip TEXT, user_agent TEXT, resource_name TEXT, biz_name TEXT)`,
		`CREATE TABLE host_node_memberships (host_id TEXT, node_kind TEXT, node_id INTEGER, business_id INTEGER)`,
		`CREATE TABLE businesses (id INTEGER PRIMARY KEY, name TEXT)`,
	} {
		require.NoError(t, db.Exec(ddl).Error)
	}
	return db
}

type historyRow struct {
	ChangeType   string
	BeforeData   string
	AfterData    string
	ChangedBy    string
	ResourceName string
	BizName      string
}

func loadHistories(t *testing.T, db *gorm.DB) []historyRow {
	t.Helper()
	var rows []historyRow
	require.NoError(t, db.Table("resource_histories").
		Select("change_type, before_data, after_data, changed_by, resource_name, biz_name").
		Order("id").Scan(&rows).Error)
	return rows
}

func intPtr(v int) *int { return &v }

// 修改主机配置写 before/after 快照（自定义字段展开为 custom_fields.<名称>），操作人取自 context。
func TestRecordHostChange_UpdateWritesBeforeAfter(t *testing.T) {
	db := setupHostAuditDB(t)
	hostID := uuid.New()
	require.NoError(t, db.Exec(`INSERT INTO businesses (id, name) VALUES (1001, '支付清结算')`).Error)
	require.NoError(t, db.Exec(`INSERT INTO host_node_memberships (host_id, node_kind, node_id, business_id) VALUES (?, ?, 21, 1001)`,
		hostID, types.NodeKindBizModule).Error)

	before := &types.Host{ID: hostID, DisplayID: 42, HostName: "pay-api-01", PrimaryIP: "10.20.1.11", Status: "running",
		Memory: intPtr(16384), CustomFields: map[string]interface{}{"责任团队": "支付组"}}
	after := &types.Host{ID: hostID, DisplayID: 42, HostName: "pay-api-01", PrimaryIP: "10.20.1.11", Status: "running",
		Memory: intPtr(32768), CustomFields: map[string]interface{}{"责任团队": "支付组"}}

	rec := NewResourceHistoryAuditRecorder(db)
	rec.RecordHostChange(auth.WithOperator(context.Background(), "zhangwei"), "update", before, after)

	rows := loadHistories(t, db)
	require.Len(t, rows, 1)
	assert.Equal(t, "update", rows[0].ChangeType)
	assert.Equal(t, "zhangwei", rows[0].ChangedBy)
	assert.Equal(t, "10.20.1.11", rows[0].ResourceName)
	assert.Equal(t, "支付清结算", rows[0].BizName)

	var b, a map[string]any
	require.NoError(t, json.Unmarshal([]byte(rows[0].BeforeData), &b))
	require.NoError(t, json.Unmarshal([]byte(rows[0].AfterData), &a))
	assert.EqualValues(t, 16384, b["memory"])
	assert.EqualValues(t, 32768, a["memory"])
	assert.Equal(t, "支付组", a["custom_fields.责任团队"])
	assert.Equal(t, "1001", a["business_id"], "business_id 以字符串落快照，供审计按业务过滤")
}

// 配置没有任何变化时不落空审计。
func TestRecordHostChange_NoopUpdateSkipped(t *testing.T) {
	db := setupHostAuditDB(t)
	h := &types.Host{ID: uuid.New(), DisplayID: 1, HostName: "h1", PrimaryIP: "10.0.0.1", Status: "running"}
	same := *h

	NewResourceHistoryAuditRecorder(db).RecordHostChange(context.Background(), "update", h, &same)
	assert.Empty(t, loadHistories(t, db))
}

// 创建只有 after，删除只有 before；资源池主机无业务。
func TestRecordHostChange_CreateAndDelete(t *testing.T) {
	db := setupHostAuditDB(t)
	h := &types.Host{ID: uuid.New(), DisplayID: 7, HostName: "pool-01", PrimaryIP: "10.90.1.11", Status: "running"}
	rec := NewResourceHistoryAuditRecorder(db)

	rec.RecordHostChange(context.Background(), "create", nil, h)
	rec.RecordHostChange(context.Background(), "delete", h, nil)

	rows := loadHistories(t, db)
	require.Len(t, rows, 2)
	assert.Equal(t, "create", rows[0].ChangeType)
	assert.Empty(t, rows[0].BeforeData)
	assert.Contains(t, rows[0].AfterData, "10.90.1.11")
	assert.Equal(t, auth.SystemOperator, rows[0].ChangedBy)
	assert.Equal(t, "delete", rows[1].ChangeType)
	assert.Empty(t, rows[1].AfterData)
	assert.NotContains(t, rows[1].BeforeData, "business_id")
}

type fakeAuditRecorder struct {
	calls []struct {
		changeType    string
		before, after *types.Host
	}
}

func (f *fakeAuditRecorder) RecordHostChange(_ context.Context, changeType string, before, after *types.Host) {
	f.calls = append(f.calls, struct {
		changeType    string
		before, after *types.Host
	}{changeType, before, after})
}

// UpdateHost 以更新前后的主机记录调用审计。
func TestUpdateHost_RecordsAudit(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	audit := &fakeAuditRecorder{}
	service := NewService(mockHostRepo, new(MockCloudAreaRepository), WithAuditRecorder(audit))

	ctx := context.Background()
	id := uuid.New()
	before := &types.Host{ID: id, CPU: intPtr(4)}
	after := &types.Host{ID: id, CPU: intPtr(8)}
	req := &types.UpdateHostRequest{CPU: intPtr(8)}

	mockHostRepo.On("GetHost", ctx, id).Return(before, nil)
	mockHostRepo.On("UpdateHost", ctx, id, req, (*uuid.UUID)(nil)).Return(after, nil)

	_, err := service.UpdateHost(ctx, id, req, nil)
	require.NoError(t, err)
	require.Len(t, audit.calls, 1)
	assert.Equal(t, "update", audit.calls[0].changeType)
	assert.Same(t, before, audit.calls[0].before)
	assert.Same(t, after, audit.calls[0].after)
	mockHostRepo.AssertExpectations(t)
}

// 更新失败时不落审计。
func TestUpdateHost_NoAuditOnFailure(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	audit := &fakeAuditRecorder{}
	service := NewService(mockHostRepo, new(MockCloudAreaRepository), WithAuditRecorder(audit))

	ctx := context.Background()
	id := uuid.New()
	req := &types.UpdateHostRequest{CPU: intPtr(8)}
	mockHostRepo.On("GetHost", ctx, id).Return(&types.Host{ID: id}, nil)
	mockHostRepo.On("UpdateHost", ctx, id, req, mock.Anything).Return(nil, assert.AnError)

	_, err := service.UpdateHost(ctx, id, req, nil)
	require.Error(t, err)
	assert.Empty(t, audit.calls)
}
