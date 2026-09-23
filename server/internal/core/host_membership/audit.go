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

func (resourceHistoryAuditRecorder) RecordHostMembershipChange(tx *gorm.DB, hostID uuid.UUID, before []NodeRef, _ []NodeRef, source, by string) error {
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
	afterNodes := make([]NodeRef, 0, len(rows))
	for _, r := range rows {
		afterNodes = append(afterNodes, NodeRef{Kind: r.NodeKind, ID: r.NodeID})
	}

	// before_data / after_data 同构（归属位置快照），审计页据此比对出"从哪转到哪"
	beforeSnap, _, err := placementSnapshot(tx, h.PrimaryIP, h.HostName, before)
	if err != nil {
		return err
	}
	after, bizName, err := placementSnapshot(tx, h.PrimaryIP, h.HostName, afterNodes)
	if err != nil {
		return err
	}
	after["source"] = source

	beforeJSON, err := json.Marshal(beforeSnap)
	if err != nil {
		return err
	}
	afterJSON, err := json.Marshal(after)
	if err != nil {
		return err
	}
	if by == "" {
		by = auth.SystemOperator
	}

	return tx.Create(&types.ResourceHistory{
		ResourceID:   h.DisplayID,
		ModelUID:     "host",
		ChangeType:   "update", // 归属变更视为主机的 update（审计 action 过滤可命中）
		BeforeData:   datatypes.JSON(beforeJSON),
		AfterData:    datatypes.JSON(afterJSON),
		ChangedBy:    by,
		ChangedAt:    time.Now(),
		ResourceName: h.PrimaryIP,
		BizName:      bizName,
	}).Error
}

// placementSnapshot 主机归属位置快照：所属业务、业务模块（ID 与名称，写入当时的快照）、资源池目录。
// 返回快照与业务名；业务取所属模块中最小的业务 ID（主机多属时通常同一业务）。
func placementSnapshot(tx *gorm.DB, primaryIP, hostName string, nodes []NodeRef) (map[string]any, string, error) {
	snap := map[string]any{
		"primary_ip": primaryIP,
		"host_name":  hostName,
	}
	var moduleIDs []uint64
	for _, n := range nodes {
		switch n.Kind {
		case types.NodeKindBizModule:
			moduleIDs = append(moduleIDs, n.ID)
		case types.NodeKindPoolDirectory:
			snap["directory_id"] = n.ID
		}
	}
	if len(moduleIDs) == 0 {
		return snap, "", nil
	}

	var modules []struct {
		ID         uint64
		Name       string
		BusinessID uint64
	}
	if err := tx.Table("modules").Select("id, name, business_id").
		Where("id IN ?", moduleIDs).Order("id").Scan(&modules).Error; err != nil {
		return nil, "", err
	}
	ids := make([]uint64, 0, len(modules))
	names := make([]string, 0, len(modules))
	var bizID uint64
	for _, m := range modules {
		ids = append(ids, m.ID)
		names = append(names, m.Name)
		if bizID == 0 || (m.BusinessID != 0 && m.BusinessID < bizID) {
			bizID = m.BusinessID
		}
	}
	snap["module_ids"] = ids
	snap["module_names"] = names
	if len(ids) > 0 {
		snap["module_id"] = ids[len(ids)-1]
	}

	bizName := ""
	if bizID != 0 {
		// 字符串存储，与 audit applyFilters 的 snapshot->>'business_id' 字符串比较一致
		snap["business_id"] = strconv.FormatUint(bizID, 10)
		tx.Table("businesses").Select("name").Where("id = ?", bizID).Scan(&bizName)
		snap["business_name"] = bizName
	}
	return snap, bizName, nil
}
