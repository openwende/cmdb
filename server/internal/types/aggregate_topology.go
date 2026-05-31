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

type AggregateTopologyHostCloudArea struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type AggregateTopologyHostModule struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
}

type AggregateTopologyHostSet struct {
	ID   uint64 `json:"id"`
	Name string `json:"name"`
}

type AggregateTopologyHostItem struct {
	HostID    string                          `json:"host_id"`
	DisplayID int64                           `json:"display_id"`
	InnerIPv4 string                          `json:"inner_ipv4"`
	InnerIPv6 string                          `json:"inner_ipv6"`
	CloudArea *AggregateTopologyHostCloudArea `json:"cloud_area,omitempty"`
	Module    *AggregateTopologyHostModule    `json:"module,omitempty"`
	Set       *AggregateTopologyHostSet       `json:"set,omitempty"`
	Status    string                          `json:"status"`
}

type AggregateTopologyPagination struct {
	Page      int   `json:"page"`
	PageSize  int   `json:"page_size"`
	Total     int64 `json:"total"`
	TotalPage int   `json:"total_page"`
}

type AggregateTopologyHostsResponse struct {
	Items      []AggregateTopologyHostItem `json:"items"`
	Pagination AggregateTopologyPagination `json:"pagination"`
}
