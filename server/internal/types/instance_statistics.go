package types

// InstanceStatistics 实例按模型类型的聚合统计（R4：实例统计页分布图的真实数据源）。
// 复用 HostStatBucket（name + count）作为分桶。
type InstanceStatistics struct {
	ByModel []HostStatBucket `json:"by_model"`
}
