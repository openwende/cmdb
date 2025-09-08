package types

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// User represents a user in the system
type User struct {
	BaseModel
	Username    string      `json:"username" gorm:"size:100;uniqueIndex;not null" validate:"required,max=100,alphanum"`
	Email       string      `json:"email" gorm:"size:255;uniqueIndex;not null" validate:"required,email,max=255"`
	DisplayName string      `json:"display_name" gorm:"size:100;not null" validate:"required,max=100"`
	Avatar      string      `json:"avatar,omitempty" gorm:"size:500"`
	IsActive    bool        `json:"is_active" gorm:"default:true"`
	IsSystem    bool        `json:"is_system" gorm:"default:false"`
	LastLoginAt *time.Time  `json:"last_login_at,omitempty"`
	
	// Password is not returned in JSON, only used for authentication
	PasswordHash string `json:"-" gorm:"size:255"`
	
	// Relationships
	TenantMemberships []TenantMembership `json:"tenant_memberships,omitempty" gorm:"foreignKey:UserID"`
	UserRoles         []UserRole         `json:"user_roles,omitempty" gorm:"foreignKey:UserID"`
}

// Tenant represents a tenant in the multi-tenant system
type Tenant struct {
	BaseModel
	Name        string    `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string    `json:"identifier" gorm:"size:100;uniqueIndex;not null" validate:"required,max=100,alphanum"`
	Description string    `json:"description" gorm:"size:500"`
	IsActive    bool      `json:"is_active" gorm:"default:true"`
	
	// Relationships
	Memberships []TenantMembership `json:"memberships,omitempty" gorm:"foreignKey:TenantID"`
}

// TenantMembership represents a user's membership in a tenant
type TenantMembership struct {
	BaseModel
	UserID     uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	TenantID   uuid.UUID `json:"tenant_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	IsActive   bool      `json:"is_active" gorm:"default:true"`
	JoinedAt   time.Time `json:"joined_at" gorm:"not null"`
	
	// Relationships
	User   *User   `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Tenant *Tenant `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}


// Role represents a role in the RBAC system
type Role struct {
	BaseModel
	TenantID    *uuid.UUID `json:"tenant_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"` // nil for system roles
	Name        string     `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Identifier  string     `json:"identifier" gorm:"size:100;not null" validate:"required,max=100,alphanum"`
	Description string     `json:"description" gorm:"size:500"`
	IsBuiltIn   bool       `json:"is_built_in" gorm:"default:false"`
	IsSystem    bool       `json:"is_system" gorm:"default:false"` // System-wide role
	
	// Relationships
	Permissions []RolePermission `json:"permissions,omitempty" gorm:"foreignKey:RoleID"`
	UserRoles   []UserRole       `json:"user_roles,omitempty" gorm:"foreignKey:RoleID"`
}

// Permission represents a permission in the system
type Permission struct {
	BaseModel
	Resource    string `json:"resource" gorm:"size:100;not null" validate:"required,max=100"`
	Action      string `json:"action" gorm:"size:50;not null" validate:"required,max=50"`
	Description string `json:"description" gorm:"size:500"`
	IsBuiltIn   bool   `json:"is_built_in" gorm:"default:false"`
	
	// Relationships
	RolePermissions []RolePermission `json:"role_permissions,omitempty" gorm:"foreignKey:PermissionID"`
}

// RolePermission represents the association between roles and permissions
type RolePermission struct {
	BaseModel
	RoleID       uuid.UUID `json:"role_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	PermissionID uuid.UUID `json:"permission_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	
	// Optional constraints for fine-grained permissions
	BusinessID *uuid.UUID `json:"business_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	ModelID    *uuid.UUID `json:"model_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	
	// Relationships
	Role       *Role       `json:"role,omitempty" gorm:"foreignKey:RoleID"`
	Permission *Permission `json:"permission,omitempty" gorm:"foreignKey:PermissionID"`
}

// UserRole represents the association between users and roles
type UserRole struct {
	BaseModel
	UserID     uuid.UUID  `json:"user_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	RoleID     uuid.UUID  `json:"role_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	TenantID   uuid.UUID  `json:"tenant_id" gorm:"type:uuid;not null;index" swaggertype:"string" validate:"required"`
	
	// Optional constraints for scoped roles
	BusinessID *uuid.UUID `json:"business_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	ExpiresAt  *time.Time `json:"expires_at,omitempty"`
	
	// Relationships
	User   *User   `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Role   *Role   `json:"role,omitempty" gorm:"foreignKey:RoleID"`
	Tenant *Tenant `json:"tenant,omitempty" gorm:"foreignKey:TenantID"`
}

// JWTClaims represents JWT claims for authentication
type JWTClaims struct {
	UserID      uuid.UUID   `json:"user_id"`
	Username    string      `json:"username"`
	Email       string      `json:"email"`
	DisplayName string      `json:"display_name"`
	TenantID    uuid.UUID   `json:"tenant_id"`
	TenantName  string      `json:"tenant_name"`
	Roles       []string    `json:"roles"`
	Permissions []string    `json:"permissions"`
	IsSystem    bool        `json:"is_system"`
	jwt.RegisteredClaims
}

// LoginRequest represents a login request
type LoginRequest struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
	TenantID string `json:"tenant_id,omitempty"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	User         UserInfo  `json:"user"`
}

// UserInfo represents user information returned in responses
type UserInfo struct {
	ID          uuid.UUID `json:"id"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	Avatar      string    `json:"avatar,omitempty"`
	TenantID    uuid.UUID `json:"tenant_id"`
	TenantName  string    `json:"tenant_name"`
	Roles       []string  `json:"roles"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"is_system"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=8"`
}

// CreateUserRequest represents a user creation request
type CreateUserRequest struct {
	Username    string `json:"username" validate:"required,max=100,alphanum"`
	Email       string `json:"email" validate:"required,email,max=255"`
	DisplayName string `json:"display_name" validate:"required,max=100"`
	Password    string `json:"password" validate:"required,min=8"`
	TenantID    string `json:"tenant_id" validate:"required,uuid"`
	Roles       []string `json:"roles,omitempty"`
}

// UpdateUserRequest represents a user update request
type UpdateUserRequest struct {
	Email       *string  `json:"email,omitempty" validate:"omitempty,email,max=255"`
	DisplayName *string  `json:"display_name,omitempty" validate:"omitempty,max=100"`
	Avatar      *string  `json:"avatar,omitempty" validate:"omitempty,max=500"`
	IsActive    *bool    `json:"is_active,omitempty"`
	Roles       []string `json:"roles,omitempty"`
}

// CreateRoleRequest represents a role creation request
type CreateRoleRequest struct {
	Name        string   `json:"name" validate:"required,max=100"`
	Identifier  string   `json:"identifier" validate:"required,max=100,alphanum"`
	Description string   `json:"description,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

// UpdateRoleRequest represents a role update request
type UpdateRoleRequest struct {
	Name        *string  `json:"name,omitempty" validate:"omitempty,max=100"`
	Description *string  `json:"description,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

// AuthContext represents the authentication context
type AuthContext struct {
	UserID      uuid.UUID
	Username    string
	TenantID    uuid.UUID
	TenantName  string
	Roles       []string
	Permissions []string
	IsSystem    bool
}

// HasPermission checks if the user has a specific permission
func (ac *AuthContext) HasPermission(resource, action string) bool {
	if ac.IsSystem {
		return true
	}
	
	for _, perm := range ac.Permissions {
		if perm == resource+":"+action || perm == "*:*" {
			return true
		}
	}
	return false
}

// HasRole checks if the user has a specific role
func (ac *AuthContext) HasRole(role string) bool {
	if ac.IsSystem {
		return true
	}
	
	for _, r := range ac.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// Built-in system roles
const (
	RoleSystemAdmin = "system_admin"
	RoleTenantAdmin = "tenant_admin"
	RoleBusinessAdmin = "business_admin"
	RoleBusinessOps = "business_ops"
	RoleBusinessViewer = "business_viewer"
	RoleGuest = "guest"
)

// Built-in permissions
const (
	PermissionModelCreate = "model:create"
	PermissionModelRead   = "model:read"
	PermissionModelUpdate = "model:update"
	PermissionModelDelete = "model:delete"
	
	PermissionInstanceCreate = "instance:create"
	PermissionInstanceRead   = "instance:read"
	PermissionInstanceUpdate = "instance:update"
	PermissionInstanceDelete = "instance:delete"
	
	PermissionBusinessCreate = "business:create"
	PermissionBusinessRead   = "business:read"
	PermissionBusinessUpdate = "business:update"
	PermissionBusinessDelete = "business:delete"
	
	PermissionTopologyCreate = "topology:create"
	PermissionTopologyRead   = "topology:read"
	PermissionTopologyUpdate = "topology:update"
	PermissionTopologyDelete = "topology:delete"
	
	PermissionUserCreate = "user:create"
	PermissionUserRead   = "user:read"
	PermissionUserUpdate = "user:update"
	PermissionUserDelete = "user:delete"
	
	PermissionAuditRead = "audit:read"
	
	PermissionAll = "*:*"
)

// TableNames for GORM
func (User) TableName() string            { return "users" }
func (Tenant) TableName() string          { return "tenants" }
func (TenantMembership) TableName() string { return "tenant_memberships" }
func (Role) TableName() string            { return "roles" }
func (Permission) TableName() string      { return "permissions" }
func (RolePermission) TableName() string  { return "role_permissions" }
func (UserRole) TableName() string        { return "user_roles" }