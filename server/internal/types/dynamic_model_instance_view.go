package types

import "time"

// InstanceStateView 资源状态视图
type InstanceStateView struct {
	ResourceID    uint64                 `json:"resource_id"`
	LastCheckTime time.Time              `json:"last_check_time"`
	HealthStatus  int                    `json:"health_status"`
	Metrics       map[string]interface{} `json:"metrics,omitempty"`
	UpdatedAt     time.Time              `json:"updated_at"`
}

// DynamicModelInstanceView 资源实例详情视图
type DynamicModelInstanceView struct {
	ID        uint64                 `json:"id"`
	ModelUID  string                 `json:"model_uid"`
	Name      string                 `json:"name"`
	Configs   map[string]interface{} `json:"configs,omitempty"`
	State     *InstanceStateView     `json:"state,omitempty"`
	CreatedAt time.Time              `json:"created_at"`
	UpdatedAt time.Time              `json:"updated_at"`
}

// InstanceRelationEndpoint 关联两端实例摘要
type InstanceRelationEndpoint struct {
	ID       uint64 `json:"id"`
	ModelUID string `json:"model_uid"`
	Name     string `json:"name"`
}

// InstanceRelationView 实例关联视图
type InstanceRelationView struct {
	ID               uint64                   `json:"id"`
	AssociationUID   string                   `json:"association_uid"`
	AssociationName  string                   `json:"association_name"`
	AssociationLabel string                   `json:"association_label"`
	Direction        string                   `json:"direction"`
	Source           InstanceRelationEndpoint `json:"source"`
	Target           InstanceRelationEndpoint `json:"target"`
	Related          InstanceRelationEndpoint `json:"related"`
	Properties       map[string]interface{}   `json:"properties,omitempty"`
	CreatedAt        time.Time                `json:"created_at"`
}

// TopologyGraphNode 拓扑图节点
type TopologyGraphNode struct {
	ResourceID uint64                 `json:"resource_id"`
	ModelUID   string                 `json:"model_uid"`
	Name       string                 `json:"name"`
	Depth      int                    `json:"depth"`
	Path       string                 `json:"path"`
	IsRoot     bool                   `json:"is_root"`
	Configs    map[string]interface{} `json:"configs,omitempty"`
}

// TopologyGraphEdge 拓扑图边
type TopologyGraphEdge struct {
	ID              uint64                 `json:"id"`
	SourceID        uint64                 `json:"source_id"`
	TargetID        uint64                 `json:"target_id"`
	SourceModelUID  string                 `json:"source_model_uid"`
	TargetModelUID  string                 `json:"target_model_uid"`
	AssociationUID  string                 `json:"association_uid"`
	AssociationName string                 `json:"association_name"`
	Properties      map[string]interface{} `json:"properties,omitempty"`
}

// InstanceTopologyGraph 实例拓扑图
type InstanceTopologyGraph struct {
	Nodes []TopologyGraphNode `json:"nodes"`
	Edges []TopologyGraphEdge `json:"edges"`
}

// ResourceHistoryView 资源历史视图
type ResourceHistoryView struct {
	ID            uint64                 `json:"id"`
	ResourceID    uint64                 `json:"resource_id"`
	ModelUID      string                 `json:"model_uid"`
	ChangeType    string                 `json:"change_type"`
	BeforeData    map[string]interface{} `json:"before_data,omitempty"`
	AfterData     map[string]interface{} `json:"after_data,omitempty"`
	ChangedFields []string               `json:"changed_fields,omitempty"`
	ChangedBy     string                 `json:"changed_by"`
	ChangedAt     time.Time              `json:"changed_at"`
	ClientIP      string                 `json:"client_ip"`
	UserAgent     string                 `json:"user_agent"`
}
