package types

type AggregateRelationCapabilities struct {
	ModelUID         string           `json:"model_uid,omitempty"`
	InstanceKey      string           `json:"instance_key,omitempty"`
	AllowedActions   []string         `json:"allowed_actions,omitempty"`
	Constraints      map[string]any   `json:"constraints,omitempty"`
	CandidateTargets []map[string]any `json:"candidate_targets,omitempty"`
	ConflictDetails  []map[string]any `json:"conflict_details,omitempty"`
	ImpactSummary    map[string]any   `json:"impact_summary,omitempty"`
}
