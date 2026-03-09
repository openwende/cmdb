package types

import (
	"time"

	"gorm.io/gorm"
)

type ModelUniqueRule struct {
	ID               uint64         `gorm:"primaryKey" json:"id"`
	ModelUID         string         `gorm:"index:idx_model_unique_rules_model;size:50;not null" json:"model_uid"`
	Name             string         `gorm:"size:100;not null" json:"name"`
	IsDefault        bool           `gorm:"default:false" json:"is_default"`
	IsAuxiliary      bool           `gorm:"default:false" json:"is_auxiliary"`
	Enabled          bool           `gorm:"default:true" json:"enabled"`
	IgnoreIfAllEmpty bool           `gorm:"default:true" json:"ignore_if_all_empty"`
	Description      string         `gorm:"size:500" json:"description"`
	CreatedBy        string         `gorm:"size:100" json:"created_by"`
	UpdatedBy        string         `gorm:"size:100" json:"updated_by"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (ModelUniqueRule) TableName() string {
	return "model_unique_rules"
}

type ModelUniqueRuleField struct {
	ID        uint64    `gorm:"primaryKey" json:"id"`
	RuleID    uint64    `gorm:"index:idx_model_unique_rule_fields_rule_sort;not null" json:"rule_id"`
	FieldUID  string    `gorm:"size:50;not null" json:"field_uid"`
	SortOrder int       `gorm:"default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

func (ModelUniqueRuleField) TableName() string {
	return "model_unique_rule_fields"
}

type UniqueRuleDetail struct {
	ID               uint64    `json:"id"`
	ModelUID         string    `json:"model_uid"`
	Name             string    `json:"name"`
	IsDefault        bool      `json:"is_default"`
	IsAuxiliary      bool      `json:"is_auxiliary"`
	Enabled          bool      `json:"enabled"`
	IgnoreIfAllEmpty bool      `json:"ignore_if_all_empty"`
	Description      string    `json:"description"`
	Fields           []string  `json:"fields"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

type UniqueRuleViolation struct {
	RuleID              uint64                 `json:"rule_id"`
	RuleName            string                 `json:"rule_name"`
	Fields              []string               `json:"fields"`
	ConflictResourceIDs []uint64               `json:"conflict_resource_ids"`
	ConflictValues      map[string]interface{} `json:"conflict_values,omitempty"`
}
