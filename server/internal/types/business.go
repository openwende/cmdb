package types

import (
    "time"

    "github.com/google/uuid"
)

// Business 业务实体 - Aligned with the database schema
type Business struct {
    ID          uuid.UUID      `json:"id" db:"id"`
    CreatedAt   time.Time      `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time      `json:"updated_at" db:"updated_at"`
    DeletedAt   *time.Time     `json:"-" db:"deleted_at"` // Use pointer for nullable fields
    CreatedBy   *uuid.UUID     `json:"created_by" db:"created_by"`
    UpdatedBy   *uuid.UUID     `json:"updated_by" db:"updated_by"`
    TenantID    uuid.UUID      `json:"tenant_id" db:"tenant_id"`
    Name        string         `json:"name" db:"name"`
    Identifier  string         `json:"identifier" db:"identifier"`
    Description *string        `json:"description" db:"description"`
    Lifecycle   string         `json:"lifecycle" db:"lifecycle"`
    Timezone    string         `json:"timezone" db:"timezone"`
    Language    string         `json:"language" db:"language"`
    Maintainers []uuid.UUID    `json:"maintainers" db:"maintainers"`
    IsBuiltIn   bool           `json:"is_built_in" db:"is_built_in"`
}

// Table names for GORM AutoMigrate (SQLite mode)
func (Business) TableName() string           { return "businesses" }
func (BusinessSet) TableName() string        { return "business_sets" }
func (BusinessSetMember) TableName() string  { return "business_set_members" }
func (BusinessPersonnel) TableName() string  { return "business_personnel" }

// CreateBusinessRequest - Aligned with the database schema
type CreateBusinessRequest struct {
    Name        string   `json:"name" validate:"required"`
    Description *string  `json:"description"`
    Identifier  string   `json:"identifier"` // Optional, can be generated from name
    // Optional initial personnel identities by role (e.g., emails/usernames)
    Sres        []string `json:"sres"`
    Developers  []string `json:"developers"`
    Testers     []string `json:"testers"`
    Bizops      []string `json:"bizops"`
}

// UpdateBusinessRequest - For updating business information
type UpdateBusinessRequest struct {
    Name        *string         `json:"name"`
    Description *string         `json:"description"`
    Identifier  *string         `json:"identifier"`
    Lifecycle   *string         `json:"lifecycle"`
    Timezone    *string         `json:"timezone"`
    Language    *string         `json:"language"`
    Maintainers *[]uuid.UUID    `json:"maintainers"`
}

// BusinessPersonnel represents normalized personnel of a business
type BusinessPersonnel struct {
    ID         uuid.UUID `db:"id" json:"id"`
    CreatedAt  time.Time `db:"created_at" json:"created_at"`
    BusinessID uuid.UUID `db:"business_id" json:"business_id"`
    // Optional user reference (if you have users table); keep identity fallback for PoC
    UserID     *uuid.UUID `db:"user_id" json:"user_id,omitempty"`
    Identity   string     `db:"identity" json:"identity"` // email/username
    Role       string     `db:"role" json:"role"`         // sre|developer|tester|bizops|maintainer
}

// BusinessSet 业务集实体 - Aligned with the database schema
type BusinessSet struct {
	ID          uuid.UUID      `json:"id" db:"id"`
	CreatedAt   time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at" db:"updated_at"`
	DeletedAt   *time.Time     `json:"-" db:"deleted_at"`
	CreatedBy   *uuid.UUID     `json:"created_by" db:"created_by"`
	UpdatedBy   *uuid.UUID     `json:"updated_by" db:"updated_by"`
	TenantID    uuid.UUID      `json:"tenant_id" db:"tenant_id"`
	Name        string         `json:"name" db:"name"`
	Identifier  string         `json:"identifier" db:"identifier"`
	Description *string        `json:"description" db:"description"`
	Scope       *string        `json:"scope" db:"scope"` // JSONB in DB, handle as string for now
	Maintainers []uuid.UUID    `json:"maintainers" db:"maintainers"`
}

// CreateBusinessSetRequest - Aligned with the database schema
type CreateBusinessSetRequest struct {
	Name        string    `json:"name" validate:"required"`
	Description *string   `json:"description"`
	Identifier  string    `json:"identifier"`
	BusinessID  uuid.UUID `json:"business_id" validate:"required"` // To associate with a business
}

// BusinessSetMember is the link between a business and a business set
type BusinessSetMember struct {
	ID            uuid.UUID `db:"id"`
	CreatedAt     time.Time `db:"created_at"`
	BusinessSetID uuid.UUID `db:"business_set_id"`
	BusinessID    uuid.UUID `db:"business_id"`
}
