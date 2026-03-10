package types

type AggregateTopologyPathNode struct {
	NodeID   string           `json:"node_id"`
	NodeType TopologyNodeType `json:"node_type"`
	Name     string           `json:"name"`
	ModelUID string           `json:"model_uid,omitempty"`
}

type AggregateTopologyNode struct {
	NodeID         string                      `json:"node_id,omitempty"`
	NodeType       TopologyNodeType            `json:"node_type,omitempty"`
	Name           string                      `json:"name,omitempty"`
	ModelUID       string                      `json:"model_uid"`
	Path           []AggregateTopologyPathNode `json:"path,omitempty"`
	Statistics     *TopologyStatistics         `json:"statistics,omitempty"`
	AllowedActions []string                    `json:"allowed_actions"`
	FormSchemaRef  string                      `json:"form_schema_ref,omitempty"`
	BindingSummary map[string]any              `json:"binding_summary,omitempty"`
}
