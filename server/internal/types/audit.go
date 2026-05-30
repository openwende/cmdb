package types

import "time"

// AuditQueryParams 审计日志查询参数
type AuditQueryParams struct {
	ModelUIDs       []string  // 模型 UID 白名单（空表示不过滤或配合 ExcludeModelUIDs 使用）
	ExcludeModelUIDs []string // 模型 UID 黑名单（用于 resource 类型，排除 host 和 business 模型）
	Actions         []string  // 变更类型：create, update, delete
	StartTime       time.Time // 开始时间
	EndTime         time.Time // 结束时间
	Account         string    // 操作账号关键字
	AccountMatch    string    // include | exclude
	HostKeyword     string    // 主机 IP 或名称关键字
	InstanceKeyword string    // 实例名称关键字
	BusinessID      int64     // 业务 ID（0 表示不过滤）
	Page            int
	PageSize        int
}

// AuditLogRow 审计日志原始行（从数据库查询）
type AuditLogRow struct {
	ID              uint64
	ResourceID      uint64
	ModelUID        string
	ChangeType      string
	BeforeData      map[string]interface{}
	AfterData       map[string]interface{}
	ChangedBy       string
	ChangedAt       time.Time
	ClientIP        string
	ResourceName    string
	ResourceConfigs map[string]interface{}
	BizName         string
}

// AuditLogEntry 审计日志条目（API 响应格式，兼容前端期望的结构）
type AuditLogEntry struct {
	ID              uint64               `json:"id"`
	AuditType       string               `json:"audit_type"`
	User            string               `json:"user"`
	ResourceType    string               `json:"resource_type"`
	Action          string               `json:"action"`
	OperateFrom     string               `json:"operate_from"`
	OperationDetail AuditOperationDetail `json:"operation_detail"`
	OperationTime   string               `json:"operation_time"`
	BkBizID         int64                `json:"bk_biz_id"`
	BizName         string               `json:"biz_name"`
	ResourceID      uint64               `json:"resource_id"`
	ResourceName    string               `json:"resource_name"`
}

// AuditOperationDetail 操作详情
type AuditOperationDetail struct {
	Details AuditOperationDetailData `json:"details"`
	BkObjID string                   `json:"bk_obj_id"`
}

// AuditOperationDetailData 操作前后数据
type AuditOperationDetailData struct {
	PreData      map[string]interface{} `json:"pre_data"`
	CurData      map[string]interface{} `json:"cur_data"`
	UpdateFields []string               `json:"update_fields"`
}
