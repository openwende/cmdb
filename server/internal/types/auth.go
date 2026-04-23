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

type AuthManagedUser struct {
	ID          uuid.UUID  `json:"id"`
	Username    string     `json:"username"`
	DisplayName string     `json:"display_name"`
	Status      string     `json:"status"`
	Role        string     `json:"role"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
}

type AuthListUsersResponse struct {
	Items []AuthManagedUser `json:"items"`
	Total int               `json:"total"`
}

type AuthCreateUserRequest struct {
	Username    string `json:"username" binding:"required,min=3,max=64"`
	DisplayName string `json:"display_name" binding:"required,min=1,max=128"`
	Password    string `json:"password" binding:"required,min=8,max=128"`
	Role        string `json:"role" binding:"required"`
}

type AuthUpdateUserRequest struct {
	DisplayName string `json:"display_name" binding:"required,min=1,max=128"`
	Status      string `json:"status" binding:"required"`
	Role        string `json:"role" binding:"required"`
}

type AuthResetPasswordRequest struct {
	Password string `json:"password" binding:"required,min=8,max=128"`
}
