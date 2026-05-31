package types

// HostStatBucket 主机统计分桶（维度取值 + 计数），供运营概览分布图使用。
type HostStatBucket struct {
	Name  string `json:"name"`
	Count int64  `json:"count"`
}

// HostStatistics 主机按维度的聚合统计（R4：运营概览主机分布图的真实数据源）。
type HostStatistics struct {
	ByOSType    []HostStatBucket `json:"by_os_type"`
	ByBusiness  []HostStatBucket `json:"by_business"`
	ByCloudArea []HostStatBucket `json:"by_cloud_area"`
}
