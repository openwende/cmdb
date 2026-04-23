package types

import (
	"time"

	"github.com/google/uuid"
)

const (
	AuthUserStatusActive   = "active"
	AuthUserStatusDisabled = "disabled"
	AuthRoleAdmin          = "admin"
	AuthRoleEditor         = "editor"
	AuthRoleViewer         = "viewer"
)

type AuthUser struct {
	ID           uuid.UUID  `json:"id" gorm:"type:uuid;primaryKey"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"-"`
	DisplayName  *string    `json:"display_name,omitempty"`
	Status       string     `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
}

func (AuthUser) TableName() string {
	return "auth_users"
}

type AuthUserRole struct {
	UserID     uuid.UUID `json:"user_id" gorm:"type:uuid;primaryKey"`
	Role       string    `json:"role" gorm:"primaryKey"`
	AssignedAt time.Time `json:"assigned_at"`
}

func (AuthUserRole) TableName() string {
	return "auth_user_roles"
}

type AuthLoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type AuthUserProfile struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	Roles       []string  `json:"roles"`
}

type AuthLoginResponse struct {
	AccessToken string          `json:"access_token"`
	TokenType   string          `json:"token_type"`
	ExpiresIn   int64           `json:"expires_in"`
	User        AuthUserProfile `json:"user"`
}
