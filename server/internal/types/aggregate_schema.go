package types

type AggregateSchemaContract struct {
	ModelUID        string           `json:"model_uid"`
	Scene           string           `json:"scene,omitempty"`
	Fields          []ModelFormField `json:"fields"`
	FieldCategories []string         `json:"field_categories,omitempty"`
	Capabilities    []string         `json:"capabilities,omitempty"`
}
