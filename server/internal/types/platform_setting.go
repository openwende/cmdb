package types

import (
	"time"

	"gorm.io/datatypes"
)

// PlatformSetting stores platform-level configuration values.
type PlatformSetting struct {
	Key         string         `json:"key" gorm:"primaryKey;size:100"`
	Value       datatypes.JSON `json:"value" gorm:"type:jsonb;not null"`
	Description string         `json:"description" gorm:"size:500"`
	UpdatedBy   string         `json:"updated_by" gorm:"size:100"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

func (PlatformSetting) TableName() string {
	return "platform_settings"
}
