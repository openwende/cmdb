package types

type AggregateResourcePoolHost struct {
	HostID         string         `json:"host_id"`
	DirectoryID    uint64         `json:"directory_id,omitempty"`
	BusinessID     string         `json:"business_id,omitempty"`
	TopologyNodeID string         `json:"topology_node_id,omitempty"`
	LifecycleState string         `json:"lifecycle_state"`
	AllowedActions []string       `json:"allowed_actions,omitempty"`
	BindingSummary map[string]any `json:"binding_summary,omitempty"`
}
