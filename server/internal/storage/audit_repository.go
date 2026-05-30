package storage

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// AuditRepository 审计日志数据仓库接口
type AuditRepository interface {
	ListAuditLogs(ctx context.Context, params *types.AuditQueryParams) ([]types.AuditLogRow, int64, error)
}

type auditRepository struct {
	db *gorm.DB
}

// NewAuditRepository 创建审计日志仓库
func NewAuditRepository(db *gorm.DB) AuditRepository {
	return &auditRepository{db: db}
}

// ListAuditLogs 查询审计日志列表
func (r *auditRepository) ListAuditLogs(ctx context.Context, params *types.AuditQueryParams) ([]types.AuditLogRow, int64, error) {
	// 审计表自包含：展示字段直接取写入时落库的冗余列（resource_name/biz_name），
	// configs 取变更快照（after 优先，delete 取 before），无需 join 活表 resources/businesses。
	base := r.db.WithContext(ctx).Table("resource_histories rh").
		Select("rh.id, rh.resource_id, rh.model_uid, rh.change_type, rh.before_data, rh.after_data, rh.changed_by, rh.changed_at, rh.client_ip, COALESCE(rh.resource_name, '') AS resource_name, COALESCE((COALESCE(rh.after_data, rh.before_data))::text, '{}') AS resource_configs, COALESCE(rh.biz_name, '') AS biz_name")

	base = r.applyFilters(base, params)

	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	type rawRow struct {
		ID              uint64    `gorm:"column:id"`
		ResourceID      uint64    `gorm:"column:resource_id"`
		ModelUID        string    `gorm:"column:model_uid"`
		ChangeType      string    `gorm:"column:change_type"`
		BeforeData      []byte    `gorm:"column:before_data"`
		AfterData       []byte    `gorm:"column:after_data"`
		ChangedBy       string    `gorm:"column:changed_by"`
		ChangedAt       time.Time `gorm:"column:changed_at"`
		ClientIP        string    `gorm:"column:client_ip"`
		ResourceName    string    `gorm:"column:resource_name"`
		ResourceConfigs string    `gorm:"column:resource_configs"`
		BizName         string    `gorm:"column:biz_name"`
	}

	var rawRows []rawRow
	offset := (params.Page - 1) * params.PageSize
	if err := base.Order("rh.changed_at DESC").Offset(offset).Limit(params.PageSize).Scan(&rawRows).Error; err != nil {
		return nil, 0, err
	}

	rows := make([]types.AuditLogRow, 0, len(rawRows))
	for _, raw := range rawRows {
		var beforeData map[string]interface{}
		var afterData map[string]interface{}
		json.Unmarshal(raw.BeforeData, &beforeData)
		json.Unmarshal(raw.AfterData, &afterData)

		var resourceConfigs map[string]interface{}
		json.Unmarshal([]byte(raw.ResourceConfigs), &resourceConfigs)

		rows = append(rows, types.AuditLogRow{
			ID:              raw.ID,
			ResourceID:      raw.ResourceID,
			ModelUID:        raw.ModelUID,
			ChangeType:      raw.ChangeType,
			BeforeData:      beforeData,
			AfterData:       afterData,
			ChangedBy:       raw.ChangedBy,
			ChangedAt:       raw.ChangedAt,
			ClientIP:        raw.ClientIP,
			ResourceName:    raw.ResourceName,
			ResourceConfigs: resourceConfigs,
			BizName:         raw.BizName,
		})
	}

	return rows, total, nil
}

func (r *auditRepository) applyFilters(q *gorm.DB, p *types.AuditQueryParams) *gorm.DB {
	// Filter by model UIDs derived from audit_type
	if len(p.ModelUIDs) > 0 {
		q = q.Where("rh.model_uid IN ?", p.ModelUIDs)
	} else if len(p.ExcludeModelUIDs) > 0 {
		q = q.Where("rh.model_uid NOT IN ?", p.ExcludeModelUIDs)
	}

	// Filter by action (change_type)
	if len(p.Actions) > 0 {
		q = q.Where("rh.change_type IN ?", p.Actions)
	}

	// Time range
	if !p.StartTime.IsZero() {
		q = q.Where("rh.changed_at >= ?", p.StartTime)
	}
	if !p.EndTime.IsZero() {
		q = q.Where("rh.changed_at <= ?", p.EndTime)
	}

	// Account filter (changed_by)
	if p.Account != "" {
		keyword := "%" + strings.ToLower(p.Account) + "%"
		if p.AccountMatch == "exclude" {
			q = q.Where("LOWER(rh.changed_by) NOT LIKE ?", keyword)
		} else {
			q = q.Where("LOWER(rh.changed_by) LIKE ?", keyword)
		}
	}

	// 变更快照（after 优先，delete 取 before），用于按 configs 内字段过滤。
	const snapshot = "COALESCE(rh.after_data, rh.before_data)"

	// Host IP/name filter: 资源名走冗余列，primary_ip/host_name 走快照 configs
	if p.HostKeyword != "" {
		keyword := "%" + p.HostKeyword + "%"
		q = q.Where(fmt.Sprintf("(rh.resource_name LIKE ? OR %s->>'primary_ip' LIKE ? OR %s->>'host_name' LIKE ?)", snapshot, snapshot),
			keyword, keyword, keyword)
	}

	// Instance (resource name) filter: 走冗余列
	if p.InstanceKeyword != "" {
		keyword := "%" + p.InstanceKeyword + "%"
		q = q.Where("rh.resource_name LIKE ?", keyword)
	}

	// Business filter: 走快照 configs->>'business_id'（字符串比较，无类型转换）
	if p.BusinessID != 0 {
		bizIDStr := fmt.Sprint(p.BusinessID)
		q = q.Where(fmt.Sprintf("%s->>'business_id' = ?", snapshot), bizIDStr)
	}

	return q
}
