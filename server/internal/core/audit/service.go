package audit

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/internal/types"
)

// businessModelUIDs are model UIDs classified under the "business" audit tab.
var businessModelUIDs = map[string]bool{
	"biz":      true,
	"business": true,
	"set":      true,
	"module":   true,
}

// Service 审计服务
type Service struct {
	repo storage.AuditRepository
}

// NewService 创建审计服务
func NewService(repo storage.AuditRepository) *Service {
	return &Service{repo: repo}
}

// QueryRequest 审计查询请求
type QueryRequest struct {
	AuditType    string   // host | business | resource
	BusinessID   int64    // 0 = no filter
	ResourceID   uint64   // 0 = no filter; exact resource_histories.resource_id (host display_id for host audits)
	ResourceType string   // optional model_uid filter within the tab
	Actions      []string // create | update | delete | ...
	StartTime    string   // YYYY-MM-DD
	EndTime      string   // YYYY-MM-DD
	Account      string
	AccountMatch string // include | exclude
	HostKeyword  string
	HostType     string // ip | hostname
	Instance     string
	InstanceType string // name | id
	Page         int
	PageSize     int
}

// QueryResult 审计查询结果
type QueryResult struct {
	Count int64                 `json:"count"`
	Info  []types.AuditLogEntry `json:"info"`
}

// Query 查询审计日志
func (s *Service) Query(ctx context.Context, req *QueryRequest) (*QueryResult, error) {
	params, err := buildParams(req)
	if err != nil {
		return nil, err
	}

	rows, total, err := s.repo.ListAuditLogs(ctx, params)
	if err != nil {
		return nil, err
	}

	entries := make([]types.AuditLogEntry, 0, len(rows))
	for _, row := range rows {
		entries = append(entries, convertRow(row, req.AuditType))
	}

	return &QueryResult{Count: total, Info: entries}, nil
}

// Get 按 ID 取单条审计记录，结构和 Query 列表里的一项相同；不存在时返回 nil。
// 审计分类（host / business / resource）按记录的 model_uid 推出，和列表各分类的划分一致。
func (s *Service) Get(ctx context.Context, id uint64) (*types.AuditLogEntry, error) {
	rows, _, err := s.repo.ListAuditLogs(ctx, &types.AuditQueryParams{ID: id, Page: 1, PageSize: 1})
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	entry := convertRow(rows[0], AuditTypeOf(rows[0].ModelUID))
	return &entry, nil
}

// AuditTypeOf 返回模型所属的审计分类。
func AuditTypeOf(modelUID string) string {
	switch {
	case strings.EqualFold(modelUID, "host"):
		return "host"
	case IsBusinessModel(modelUID):
		return "business"
	default:
		return "resource"
	}
}

func buildParams(req *QueryRequest) (*types.AuditQueryParams, error) {
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 200 {
		pageSize = 200
	}

	modelUIDs, excludeModelUIDs := modelUIDsForAuditType(req.AuditType, req.ResourceType)

	var startTime, endTime time.Time
	if req.StartTime != "" {
		t, err := time.Parse("2006-01-02", req.StartTime)
		if err != nil {
			return nil, fmt.Errorf("invalid start_time: %w", err)
		}
		startTime = t
	}
	if req.EndTime != "" {
		t, err := time.Parse("2006-01-02", req.EndTime)
		if err != nil {
			return nil, fmt.Errorf("invalid end_time: %w", err)
		}
		endTime = t.Add(24*time.Hour - time.Second) // inclusive end of day
	}

	return &types.AuditQueryParams{
		ModelUIDs:        modelUIDs,
		ExcludeModelUIDs: excludeModelUIDs,
		Actions:          req.Actions,
		StartTime:        startTime,
		EndTime:          endTime,
		Account:          req.Account,
		AccountMatch:     req.AccountMatch,
		HostKeyword:      req.HostKeyword,
		InstanceKeyword:  req.Instance,
		BusinessID:       req.BusinessID,
		ResourceID:       req.ResourceID,
		Page:             page,
		PageSize:         pageSize,
	}, nil
}

// modelUIDsForAuditType returns (includeUIDs, excludeUIDs) for a given audit tab.
// If resourceType is set, it overrides the tab-level model UID set.
func modelUIDsForAuditType(auditType, resourceType string) (include []string, exclude []string) {
	if resourceType != "" {
		return []string{resourceType}, nil
	}
	switch auditType {
	case "host":
		return []string{"host"}, nil
	case "business":
		uids := make([]string, 0, len(businessModelUIDs))
		for uid := range businessModelUIDs {
			uids = append(uids, uid)
		}
		sort.Strings(uids)
		return uids, nil
	default:
		// "resource": show all models except host and business-tier ones
		exclude = []string{"host"}
		for uid := range businessModelUIDs {
			exclude = append(exclude, uid)
		}
		sort.Strings(exclude)
		return nil, exclude
	}
}

func convertRow(row types.AuditLogRow, auditType string) types.AuditLogEntry {
	// Extract business_id from resource configs (for hosts)
	var bizID int64
	if row.ResourceConfigs != nil {
		if v, ok := row.ResourceConfigs["business_id"]; ok {
			switch bv := v.(type) {
			case float64:
				bizID = int64(bv)
			case string:
				fmt.Sscanf(bv, "%d", &bizID)
			}
		}
	}

	var updateFields []string
	if len(row.BeforeData) > 0 && len(row.AfterData) > 0 {
		for k := range row.AfterData {
			if bv, exists := row.BeforeData[k]; !exists || fmt.Sprint(bv) != fmt.Sprint(row.AfterData[k]) {
				updateFields = append(updateFields, k)
			}
		}
		sort.Strings(updateFields)
	}

	resourceName := row.ResourceName
	if resourceName == "" {
		// Fall back to extracting name from data
		resourceName = extractName(row.AfterData)
		if resourceName == "" {
			resourceName = extractName(row.BeforeData)
		}
	}

	return types.AuditLogEntry{
		ID:           row.ID,
		AuditType:    auditType,
		User:         row.ChangedBy,
		ResourceType: row.ModelUID,
		Action:       row.ChangeType,
		OperateFrom:  "user",
		OperationDetail: types.AuditOperationDetail{
			Details: types.AuditOperationDetailData{
				PreData:      row.BeforeData,
				CurData:      row.AfterData,
				UpdateFields: updateFields,
			},
			BkObjID: row.ModelUID,
		},
		OperationTime: row.ChangedAt.Format("2006-01-02 15:04:05"),
		BkBizID:       bizID,
		BizName:       row.BizName,
		ResourceID:    row.ResourceID,
		ResourceName:  resourceName,
	}
}

func extractName(data map[string]interface{}) string {
	for _, key := range []string{"name", "hostname", "host_name", "primary_ip", "inner_ip"} {
		if v, ok := data[key]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}

// IsBusinessModel returns true for model UIDs classified as "business" audit type.
func IsBusinessModel(modelUID string) bool {
	return businessModelUIDs[strings.ToLower(modelUID)]
}
