package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type DynamicGroup struct {
	ID                uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
	BusinessID        uuid.UUID      `gorm:"type:uuid;index;not null" json:"business_id"`
	Name              string         `gorm:"size:100;not null" json:"name"`
	TargetModelUID    string         `gorm:"size:50;not null" json:"target_model_uid"`
	Condition         datatypes.JSON `gorm:"type:jsonb;not null" json:"condition"`
	VariableCondition datatypes.JSON `gorm:"type:jsonb;not null" json:"variable_condition"`
	LastPreviewCount  int            `gorm:"default:0" json:"last_preview_count"`
	Description       string         `gorm:"size:500" json:"description"`
	CreatedBy         string         `gorm:"size:100" json:"created_by"`
	UpdatedBy         string         `gorm:"size:100" json:"updated_by"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

func (DynamicGroup) TableName() string {
	return "dynamic_groups"
}

type DynamicGroupCondition struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
}

type DynamicGroupConditionGroup struct {
	ObjectID      string                  `json:"bk_obj_id"`
	Condition     []DynamicGroupCondition `json:"condition"`
	TimeCondition *DynamicGroupTimeFilter `json:"time_condition,omitempty"`
}

type DynamicGroupTimeFilter struct {
	Oper  string                       `json:"oper"`
	Rules []DynamicGroupTimeFilterRule `json:"rules"`
}

type DynamicGroupTimeFilterRule struct {
	Field string `json:"field"`
	Start string `json:"start"`
	End   string `json:"end"`
}

type DynamicGroupDetail struct {
	ID               uuid.UUID           `json:"id"`
	BusinessID       uuid.UUID           `json:"business_id"`
	BKObjID          string              `json:"bk_obj_id"`
	TargetModelUID   string              `json:"target_model_uid"`
	Name             string              `json:"name"`
	Info             DynamicGroupRuleSet `json:"info"`
	Description      string              `json:"description,omitempty"`
	CreateUser       string              `json:"create_user"`
	ModifyUser       string              `json:"modify_user"`
	CreateTime       time.Time           `json:"create_time"`
	LastTime         time.Time           `json:"last_time"`
	LastPreviewCount int                 `json:"last_preview_count"`
}

type DynamicGroupRuleSet struct {
	Condition         []DynamicGroupConditionGroup `json:"condition"`
	VariableCondition []DynamicGroupConditionGroup `json:"variable_condition"`
}

type DynamicGroupProperty struct {
	ID                  int64  `json:"id"`
	BKObjID             string `json:"bk_obj_id"`
	BKPropertyID        string `json:"bk_property_id"`
	BKPropertyName      string `json:"bk_property_name"`
	BKPropertyType      string `json:"bk_property_type"`
	BKPropertyGroup     string `json:"bk_property_group"`
	BKPropertyGroupName string `json:"bk_property_group_name"`
	Option              string `json:"option,omitempty"`
	Placeholder         string `json:"placeholder,omitempty"`
	Description         string `json:"description,omitempty"`
	Editable            bool   `json:"editable"`
	IsPre               bool   `json:"ispre"`
	IsRequired          bool   `json:"isrequired"`
	IsReadOnly          bool   `json:"isreadonly"`
	IsOnly              bool   `json:"isonly"`
	BKIsSystem          bool   `json:"bk_issystem"`
	BKIsAPI             bool   `json:"bk_isapi"`
}

type DynamicGroupObjectMainline struct {
	BKObjID           string `json:"bk_obj_id"`
	BKObjName         string `json:"bk_obj_name"`
	BKSupplierAccount string `json:"bk_supplier_account"`
	BKNextObj         string `json:"bk_next_obj"`
	BKNextName        string `json:"bk_next_name"`
	BKPreObjID        string `json:"bk_pre_obj_id"`
	BKPreObjName      string `json:"bk_pre_obj_name"`
}

type DynamicGroupPreviewHost struct {
	ID            string `json:"id"`
	InternalIPv4  string `json:"internalIPv4"`
	Region        string `json:"region"`
	CloudVendor   string `json:"cloudVendor"`
	CloudVendorID string `json:"cloudVendorID"`
	CloudBusiness string `json:"cloudBusiness"`
	CreateTime    string `json:"createTime"`
	Creator       string `json:"creator"`
}
