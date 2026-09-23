package host_membership

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/auth"
	"github.com/wend/cmdb-backend/internal/types"
)

// resourceHistoryAuditRecorder 把主机归属变更写入 resource_histories（model_uid=host），
// 使"审计与分析 → 主机" tab 能查到主机流转（修 R3 审计零覆盖）。
//
// 与 dynamic_model.recordHistory 同构：after_data 落归属快照（business_id/module_id/IP），
// 供审计按业务过滤、按 IP/主机名搜索、并自包含展示。审计与归属变更同事务，保证 I5。
type resourceHistoryAuditRecorder struct{}

// NewResourceHistoryAuditRecorder 创建写 resource_histories 的审计记录器。
func NewResourceHistoryAuditRecorder() AuditRecorder { return resourceHistoryAuditRecorder{} }

func (resourceHistoryAuditRecorder) RecordHostMembershipChange(tx *gorm.DB, hostID uuid.UUID, _ []NodeRef, _ []NodeRef, source, by string) error {
	// 主机快照（display_id 作审计 resource_id，IP/名用于展示与搜索）
	var h struct {
		DisplayID uint64 `gorm:"column:display_id"`
		PrimaryIP string `gorm:"column:primary_ip"`
		HostName  string `gorm:"column:host_name"`
	}
	if err := tx.Table("hosts").Select("display_id, primary_ip, host_name").
		Where("id = ?", hostID).Scan(&h).Error; err != nil {
		return err
	}

	// 取变更后的归属（host_node_memberships 此刻已写入 after 状态）
	var rows []types.HostNodeMembership
	if err := tx.Where("host_id = ?", hostID).Find(&rows).Error; err != nil {
		return err
	}
	var bizID, moduleID uint64
	for _, r := range rows {
		if r.BusinessID != nil && *r.BusinessID != 0 {
			bizID = *r.BusinessID
		}
		if r.NodeKind == types.NodeKindBizModule {
			moduleID = r.NodeID
		}
	}

	after := map[string]any{
		"primary_ip": h.PrimaryIP,
		"host_name":  h.HostName,
		"source":     source,
	}
	if bizID != 0 {
		// 字符串存储，与 audit applyFilters 的 snapshot->>'business_id' 字符串比较一致
		after["business_id"] = strconv.FormatUint(bizID, 10)
	}
	if moduleID != 0 {
		after["module_id"] = moduleID
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}

	bizName := ""
	if bizID != 0 {
		tx.Table("businesses").Select("name").Where("id = ?", bizID).Scan(&bizName)
	}
	if by == "" {
		by = auth.SystemOperator
	}

	return tx.Create(&types.ResourceHistory{
		ResourceID:   h.DisplayID,
		ModelUID:     "host",
		ChangeType:   "update", // 归属变更视为主机的 update（审计 action 过滤可命中）
		AfterData:    datatypes.JSON(afterJSON),
		ChangedBy:    by,
		ChangedAt:    time.Now(),
		ResourceName: h.PrimaryIP,
		BizName:      bizName,
	}).Error
}
