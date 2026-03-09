package types

const (
	ResourceStatusPooled    = "pooled"
	ResourceStatusAllocated = "allocated"
	ResourceStatusUnknown   = "unknown"
)

type ResourcePoolLifecycleItem struct {
	HostID         string `json:"host_id"`
	ResourceStatus string `json:"resource_status"`
	DirectoryID    uint64 `json:"directory_id,omitempty"`
	BusinessID     string `json:"business_id,omitempty"`
	ModuleID       uint64 `json:"module_id,omitempty"`
	Message        string `json:"message,omitempty"`
}

type ResourcePoolLifecycleResult struct {
	Total          int                         `json:"total"`
	Successful     int                         `json:"successful"`
	Failed         int                         `json:"failed"`
	SucceededItems []ResourcePoolLifecycleItem `json:"succeeded_items,omitempty"`
	FailedItems    []ResourcePoolLifecycleItem `json:"failed_items,omitempty"`
}

type ResourcePoolHostLifecycle struct {
	HostID         string   `json:"host_id"`
	ResourceStatus string   `json:"resource_status"`
	DirectoryID    uint64   `json:"directory_id,omitempty"`
	BusinessIDs    []string `json:"business_ids,omitempty"`
	ModuleIDs      []uint64 `json:"module_ids,omitempty"`
	AllowedActions []string `json:"allowed_actions,omitempty"`
}
