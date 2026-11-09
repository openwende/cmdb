package host

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/auth"
	"github.com/openwende/cmdb-server/internal/types"
)

// AuditRecorder 主机配置变更（创建 / 修改配置 / 删除）的审计落点。
// 归属变更（分配/转移/回收）不经此处，由 host_membership 统一落审计。
type AuditRecorder interface {
	// RecordHostChange 记录一次主机变更。create 时 before 为 nil，delete 时 after 为 nil。
	RecordHostChange(ctx context.Context, changeType string, before, after *types.Host)
}

// Option 主机服务可选项。
type Option func(*Service)

// WithAuditRecorder 注入主机配置变更审计记录器；不注入时不落审计（如单测）。
func WithAuditRecorder(r AuditRecorder) Option {
	return func(s *Service) { s.audit = r }
}

// recordChange 在注入了审计记录器时落一条主机变更审计。
func (s *Service) recordChange(ctx context.Context, changeType string, before, after *types.Host) {
	if s.audit != nil {
		s.audit.RecordHostChange(ctx, changeType, before, after)
	}
}

type resourceHistoryAuditRecorder struct {
	db *gorm.DB
}

// NewResourceHistoryAuditRecorder 创建写 resource_histories（model_uid=host）的主机配置审计记录器。
//
// 与 auditlog.Record 一致为 best-effort：审计写失败只吞错，不回滚已成功的主操作。
// before_data / after_data 落配置快照（自定义字段按 custom_fields.<名称> 展开），审计页据此
// 逐字段比对出变更项；快照同时带 primary_ip / host_name / business_id，供审计按 IP 搜索、按业务过滤。
func NewResourceHistoryAuditRecorder(db *gorm.DB) AuditRecorder {
	return resourceHistoryAuditRecorder{db: db}
}

func (r resourceHistoryAuditRecorder) RecordHostChange(ctx context.Context, changeType string, before, after *types.Host) {
	if r.db == nil {
		return
	}
	subject := after
	if subject == nil {
		subject = before
	}
	if subject == nil {
		return
	}

	beforeSnap, afterSnap := configSnapshot(before), configSnapshot(after)
	if changeType == "update" && reflect.DeepEqual(beforeSnap, afterSnap) {
		return // 未改动任何配置项，不落空审计
	}

	bizID, bizName := r.currentBusiness(ctx, subject)
	if bizID != 0 {
		for _, snap := range []map[string]any{beforeSnap, afterSnap} {
			if snap != nil {
				// 字符串存储，与审计 applyFilters 的 snapshot->>'business_id' 字符串比较一致
				snap["business_id"] = strconv.FormatUint(bizID, 10)
			}
		}
	}

	_ = r.db.WithContext(ctx).Create(&types.ResourceHistory{
		ResourceID:   uint64(subject.DisplayID),
		ModelUID:     "host",
		ChangeType:   changeType,
		BeforeData:   toJSON(beforeSnap),
		AfterData:    toJSON(afterSnap),
		ChangedBy:    auth.OperatorFromContext(ctx),
		ChangedAt:    time.Now(),
		ResourceName: subject.PrimaryIP,
		BizName:      bizName,
	}).Error
}

// currentBusiness 取主机当前所属业务（业务模块归属中的第一个），资源池主机返回 0。
func (r resourceHistoryAuditRecorder) currentBusiness(ctx context.Context, h *types.Host) (uint64, string) {
	var bizID uint64
	r.db.WithContext(ctx).Table("host_node_memberships").Select("business_id").
		Where("host_id = ? AND node_kind = ? AND business_id IS NOT NULL", h.ID, types.NodeKindBizModule).
		Order("business_id").Limit(1).Scan(&bizID)
	if bizID == 0 {
		return 0, ""
	}
	var bizName string
	r.db.WithContext(ctx).Table("businesses").Select("name").Where("id = ?", bizID).Scan(&bizName)
	return bizID, bizName
}

// configSnapshot 主机可配置项快照；h 为 nil 时返回 nil。
func configSnapshot(h *types.Host) map[string]any {
	if h == nil {
		return nil
	}
	snap := map[string]any{
		"host_name":    h.HostName,
		"primary_ip":   h.PrimaryIP,
		"ip_addresses": []string(h.IPAddresses),
		"status":       h.Status,
	}
	if h.CloudAreaID != nil {
		snap["cloud_area_id"] = h.CloudAreaID.String()
	}
	if h.CPU != nil {
		snap["cpu"] = *h.CPU
	}
	if h.Memory != nil {
		snap["memory"] = *h.Memory
	}
	if h.DiskSize != nil {
		snap["disk_size"] = *h.DiskSize
	}
	if h.OSType != nil {
		snap["os_type"] = *h.OSType
	}
	if h.OSVersion != nil {
		snap["os_version"] = *h.OSVersion
	}
	for k, v := range h.CustomFields {
		snap[fmt.Sprintf("custom_fields.%s", k)] = v
	}
	return snap
}

func toJSON(m map[string]any) datatypes.JSON {
	if m == nil {
		return nil
	}
	b, err := json.Marshal(m)
	if err != nil {
		return nil
	}
	return datatypes.JSON(b)
}
