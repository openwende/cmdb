package types

type CreateMainlineModelRequest struct {
	UID            string  `json:"uid" binding:"required"`
	DisplayName    string  `json:"display_name" binding:"required"`
	Classification string  `json:"classification"`
	Icon           string  `json:"icon"`
	Description    string  `json:"description"`
	Scope          string  `json:"scope" binding:"omitempty,oneof=none business global"`
	Level          *int    `json:"level,omitempty"`
	ParentModelUID *string `json:"parent_model_uid,omitempty"`
}

type UpdateMainlineModelRequest struct {
	DisplayName    *string `json:"display_name,omitempty"`
	Classification *string `json:"classification,omitempty"`
	Icon           *string `json:"icon,omitempty"`
	Description    *string `json:"description,omitempty"`
	Scope          *string `json:"scope,omitempty" binding:"omitempty,oneof=none business global"`
	Level          *int    `json:"level,omitempty"`
	ParentModelUID *string `json:"parent_model_uid,omitempty"`
}

type MainlineModelResponse struct {
	UID               string  `json:"uid"`
	DisplayName       string  `json:"display_name"`
	Classification    string  `json:"classification"`
	Icon              string  `json:"icon"`
	Description       string  `json:"description"`
	Scope             string  `json:"scope"`
	Level             *int    `json:"level,omitempty"`
	ParentModelUID    *string `json:"parent_model_uid,omitempty"`
	IsBuiltin         bool    `json:"is_builtin"`
	IsTopologyBuiltin bool    `json:"is_topology_builtin"`
}

type CreateMainlineNodeRequest struct {
	BusinessID     uint64                 `json:"business_id" binding:"required"`
	ModelUID       string                 `json:"model_uid" binding:"required"`
	ParentModelUID *string                `json:"parent_model_uid,omitempty"`
	ParentRefID    *string                `json:"parent_ref_id,omitempty"`
	Name           string                 `json:"name" binding:"required"`
	SortOrder      int                    `json:"sort_order"`
	Properties     map[string]interface{} `json:"properties,omitempty"`
}

type UpdateMainlineNodeRequest struct {
	Name       *string                `json:"name,omitempty"`
	SortOrder  *int                   `json:"sort_order,omitempty"`
	Properties map[string]interface{} `json:"properties,omitempty"`
}

type MoveMainlineNodeRequest struct {
	TargetParentModelUID string `json:"target_parent_model_uid" binding:"required"`
	TargetParentRefID    string `json:"target_parent_ref_id" binding:"required"`
}

type TopologySettingsResponse struct {
	MaxTopologyLevel int    `json:"max_topology_level"`
	IdleSetName      string `json:"idle_set_name"`
	IdleModuleName   string `json:"idle_module_name"`
}
