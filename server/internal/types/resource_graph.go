package types

import (
	"time"

	"gorm.io/gorm"
)

type IdentityRules struct {
	ExternalKeys [][]string `json:"external_keys,omitempty"`
	UniqueKeys   [][]string `json:"unique_keys,omitempty"`
}

type ResourceTypeV2 struct {
	ID            string         `json:"id,omitempty" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	Name          string         `json:"name" gorm:"uniqueIndex;size:100;not null"`
	DisplayName   string         `json:"display_name" gorm:"size:200;not null"`
	Category      string         `json:"category" gorm:"size:50;not null"`
	Icon          string         `json:"icon,omitempty" gorm:"size:50"`
	Schema        map[string]any `json:"schema,omitempty" gorm:"type:jsonb;serializer:json"`
	IdentityRules IdentityRules  `json:"identity_rules,omitempty" gorm:"type:jsonb;serializer:json"`
	Builtin       bool           `json:"builtin" gorm:"not null;default:false"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

type ResourceV2 struct {
	ID          string         `json:"id,omitempty" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
	TypeName    string         `json:"type_name" gorm:"index;size:100;not null"`
	Name        string         `json:"name,omitempty" gorm:"size:500"`
	Spec        map[string]any `json:"spec,omitempty" gorm:"type:jsonb;serializer:json"`
	Status      map[string]any `json:"status,omitempty" gorm:"type:jsonb;serializer:json"`
	Labels      map[string]any `json:"labels,omitempty" gorm:"type:jsonb;serializer:json"`
	Source      string         `json:"source,omitempty" gorm:"size:50;not null;default:'manual'"`
	SourceID    *string        `json:"source_id,omitempty" gorm:"size:500"`
	IdentityKey *string        `json:"identity_key,omitempty" gorm:"size:1000;index"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `json:"deleted_at,omitempty" gorm:"index"`
}

type EdgeV2 struct {
	ID        uint64         `json:"id,omitempty" gorm:"primaryKey"`
	FromID    string         `json:"from_id" gorm:"index;type:uuid;not null"`
	ToID      string         `json:"to_id" gorm:"index;type:uuid;not null"`
	RelType   string         `json:"rel_type" gorm:"size:100;index;not null"`
	Data      map[string]any `json:"data,omitempty" gorm:"type:jsonb;serializer:json"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type EventV2 struct {
	ID         uint64         `json:"id,omitempty" gorm:"primaryKey"`
	EventType  string         `json:"event_type" gorm:"size:100;index;not null"`
	ResourceID *string        `json:"resource_id,omitempty" gorm:"type:uuid;index"`
	Payload    map[string]any `json:"payload,omitempty" gorm:"type:jsonb;serializer:json"`
	Producer   string         `json:"producer,omitempty" gorm:"size:100"`
	OccurredAt time.Time      `json:"occurred_at" gorm:"index;not null"`
	CreatedAt  time.Time      `json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
}

func (ResourceTypeV2) TableName() string {
	return "resource_types_v2"
}

func (ResourceV2) TableName() string {
	return "resources_v2"
}

func (EdgeV2) TableName() string {
	return "edges_v2"
}

func (EventV2) TableName() string {
	return "events_v2"
}
