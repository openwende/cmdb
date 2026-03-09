package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

const (
	MainlineScopeNone     = "none"
	MainlineScopeBusiness = "business"
	MainlineScopeGlobal   = "global"
)

// MainlineInstance stores topology tree nodes while preserving the public node IDs
// used by the topology API. RefID points to the external business/set/module ID.
type MainlineInstance struct {
	ID         uint64         `json:"id" gorm:"primaryKey"`
	ModelName  string         `json:"model_name" gorm:"size:100;not null;index:idx_mainline_model_ref,priority:1"`
	BusinessID uuid.UUID      `json:"business_id" gorm:"type:uuid;not null;index"`
	ParentID   *uint64        `json:"parent_id,omitempty" gorm:"index"`
	RefID      string         `json:"ref_id" gorm:"size:100;not null;index:idx_mainline_model_ref,priority:2"`
	Name       string         `json:"name" gorm:"size:200;not null"`
	Path       string         `json:"path" gorm:"type:ltree;not null;index"`
	Level      int            `json:"level" gorm:"not null"`
	SortOrder  int            `json:"sort_order" gorm:"not null;default:0"`
	IsDefault  bool           `json:"is_default" gorm:"not null;default:false"`
	Extra      datatypes.JSON `json:"extra,omitempty" gorm:"type:jsonb"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

func (MainlineInstance) TableName() string {
	return "mainline_instances"
}
