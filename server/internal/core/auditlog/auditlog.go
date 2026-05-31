// Package auditlog 提供主机以外（业务 / 集群 / 模块等业务层结构）的资源变更写
// resource_histories 的统一入口，与 host_membership 的审计录制器同构。
//
// 使"审计与分析 → 业务" tab（model_uid ∈ {biz, business, set, module}）能查到业务/拓扑
// 结构的 create/update/delete（修 R3：审计对核心写操作零覆盖的剩余缺口）。
package auditlog

import (
	"encoding/json"
	"strconv"
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// Record 尽力写一条 resource_histories（best-effort：审计写失败只吞错、绝不回滚或阻断
// 已成功的主操作）。应在主操作成功提交后调用。
//
// changedBy 暂统一为 "system"——与现有主机归属审计的行为一致（请求级操作人尚未透传到
// service 层）；后续接入操作人上下文后改为真实用户即可。
func Record(db *gorm.DB, modelUID, changeType string, resourceID, businessID uint64, resourceName, bizName string) {
	if db == nil {
		return // 无 DB（如单测注入 nil）时跳过，审计不阻断主流程
	}
	after := map[string]any{}
	if businessID != 0 {
		// 字符串存储，与审计 applyFilters 的 snapshot->>'business_id' 字符串比较一致
		after["business_id"] = strconv.FormatUint(businessID, 10)
	}
	if resourceName != "" {
		after["name"] = resourceName
	}

	var afterJSON datatypes.JSON
	if b, err := json.Marshal(after); err == nil {
		afterJSON = datatypes.JSON(b)
	}

	_ = db.Create(&types.ResourceHistory{
		ResourceID:   resourceID,
		ModelUID:     modelUID,
		ChangeType:   changeType,
		AfterData:    afterJSON,
		ChangedBy:    "system",
		ChangedAt:    time.Now(),
		ResourceName: resourceName,
		BizName:      bizName,
	}).Error
}
