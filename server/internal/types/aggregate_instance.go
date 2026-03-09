package types

type AggregateInstanceModelSummary struct {
	ModelUID    string `json:"model_uid"`
	DisplayName string `json:"display_name,omitempty"`
	Icon        string `json:"icon,omitempty"`
}

type AggregateInstanceView struct {
	InstanceKey     string                        `json:"instance_key"`
	Model           AggregateInstanceModelSummary `json:"model,omitempty"`
	Properties      map[string]any                `json:"properties,omitempty"`
	BindingContext  map[string]any                `json:"binding_context,omitempty"`
	RelationSummary map[string]any                `json:"relation_summary,omitempty"`
	HistorySummary  map[string]any                `json:"history_summary,omitempty"`
	AllowedActions  []string                      `json:"allowed_actions,omitempty"`
}
