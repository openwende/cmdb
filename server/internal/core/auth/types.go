package auth

import (
	"fmt"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// LoginRequest represents a login request
type LoginRequest struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Password string `json:"password" validate:"required,min=6,max=100"`
	TenantID string `json:"tenant_id,omitempty" validate:"omitempty,uuid"`
}

// LoginResponse represents a login response
type LoginResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresAt    time.Time `json:"expires_at"`
	User         UserInfo  `json:"user"`
}

// RefreshTokenRequest represents a refresh token request
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

// UserInfo represents user information
type UserInfo struct {
	ID          string   `json:"id"`
	Username    string   `json:"username"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	TenantID    string   `json:"tenant_id"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	IsActive    bool     `json:"is_active"`
	LastLoginAt string   `json:"last_login_at,omitempty"`
}

// CreateUserRequest represents a request to create a user
type CreateUserRequest struct {
	Username    string   `json:"username" validate:"required,min=3,max=50,alphanum"`
	Email       string   `json:"email" validate:"required,email,max=100"`
	Password    string   `json:"password" validate:"required,min=6,max=100"`
	DisplayName string   `json:"display_name" validate:"required,max=100"`
	TenantID    string   `json:"tenant_id" validate:"required,uuid"`
	RoleIDs     []string `json:"role_ids,omitempty" validate:"dive,uuid"`
	IsActive    bool     `json:"is_active"`
}

// UpdateUserRequest represents a request to update a user
type UpdateUserRequest struct {
	Email       *string  `json:"email,omitempty" validate:"omitempty,email,max=100"`
	DisplayName *string  `json:"display_name,omitempty" validate:"omitempty,max=100"`
	RoleIDs     []string `json:"role_ids,omitempty" validate:"dive,uuid"`
	IsActive    *bool    `json:"is_active,omitempty"`
}

// ChangePasswordRequest represents a password change request
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" validate:"required"`
	NewPassword     string `json:"new_password" validate:"required,min=6,max=100"`
}

// ResetPasswordRequest represents a password reset request
type ResetPasswordRequest struct {
	Email string `json:"email" validate:"required,email"`
}

// CreateRoleRequest represents a request to create a role
type CreateRoleRequest struct {
	Name          string   `json:"name" validate:"required,min=2,max=50"`
	Description   string   `json:"description,omitempty" validate:"max=500"`
	TenantID      string   `json:"tenant_id" validate:"required,uuid"`
	PermissionIDs []string `json:"permission_ids,omitempty" validate:"dive,uuid"`
	IsBuiltIn     bool     `json:"is_built_in,omitempty"`
}

// UpdateRoleRequest represents a request to update a role
type UpdateRoleRequest struct {
	Name          *string  `json:"name,omitempty" validate:"omitempty,min=2,max=50"`
	Description   *string  `json:"description,omitempty" validate:"omitempty,max=500"`
	PermissionIDs []string `json:"permission_ids,omitempty" validate:"dive,uuid"`
}

// RoleInfo represents role information
type RoleInfo struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Description string           `json:"description"`
	TenantID    string           `json:"tenant_id"`
	Permissions []PermissionInfo `json:"permissions,omitempty"`
	UserCount   int64            `json:"user_count"`
	IsBuiltIn   bool             `json:"is_built_in"`
	CreatedAt   string           `json:"created_at"`
}

// PermissionInfo represents permission information
type PermissionInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Resource    string `json:"resource"`
	Action      string `json:"action"`
	Description string `json:"description"`
	IsBuiltIn   bool   `json:"is_built_in"`
}

// AssignRoleRequest represents a request to assign roles to a user
type AssignRoleRequest struct {
	UserID  string   `json:"user_id" validate:"required,uuid"`
	RoleIDs []string `json:"role_ids" validate:"required,min=1,dive,uuid"`
}

// PermissionCheckRequest represents a permission check request
type PermissionCheckRequest struct {
	UserID   string `json:"user_id" validate:"required,uuid"`
	Resource string `json:"resource" validate:"required"`
	Action   string `json:"action" validate:"required"`
	Context  map[string]interface{} `json:"context,omitempty"`
}

// PermissionCheckResponse represents a permission check response
type PermissionCheckResponse struct {
	Allowed bool   `json:"allowed"`
	Reason  string `json:"reason,omitempty"`
}

// UserSession represents an active user session
type UserSession struct {
	SessionID   string                 `json:"session_id"`
	UserID      string                 `json:"user_id"`
	Username    string                 `json:"username"`
	TenantID    string                 `json:"tenant_id"`
	IPAddress   string                 `json:"ip_address"`
	UserAgent   string                 `json:"user_agent"`
	CreatedAt   time.Time              `json:"created_at"`
	LastSeen    time.Time              `json:"last_seen"`
	ExpiresAt   time.Time              `json:"expires_at"`
	IsActive    bool                   `json:"is_active"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// AuditLogEntry represents an audit log entry
type AuditLogEntry struct {
	ID        string                 `json:"id"`
	UserID    string                 `json:"user_id"`
	Username  string                 `json:"username"`
	TenantID  string                 `json:"tenant_id"`
	Action    string                 `json:"action"`
	Resource  string                 `json:"resource"`
	Details   map[string]interface{} `json:"details,omitempty"`
	IPAddress string                 `json:"ip_address"`
	UserAgent string                 `json:"user_agent"`
	Success   bool                   `json:"success"`
	Error     string                 `json:"error,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// TokenClaims represents JWT token claims
type TokenClaims struct {
	UserID      string   `json:"user_id"`
	Username    string   `json:"username"`
	TenantID    string   `json:"tenant_id"`
	Roles       []string `json:"roles"`
	Permissions []string `json:"permissions"`
	SessionID   string   `json:"session_id"`
	TokenType   string   `json:"token_type"` // "access" or "refresh"
	IssuedAt    int64    `json:"iat"`
	ExpiresAt   int64    `json:"exp"`
	NotBefore   int64    `json:"nbf"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	JWTSecret           string        `json:"jwt_secret"`
	AccessTokenExpiry   time.Duration `json:"access_token_expiry"`
	RefreshTokenExpiry  time.Duration `json:"refresh_token_expiry"`
	SessionTimeout      time.Duration `json:"session_timeout"`
	MaxLoginAttempts    int           `json:"max_login_attempts"`
	LockoutDuration     time.Duration `json:"lockout_duration"`
	PasswordMinLength   int           `json:"password_min_length"`
	PasswordRequireSpecial bool       `json:"password_require_special"`
	EnableAuditLog      bool          `json:"enable_audit_log"`
	EnableRateLimiting  bool          `json:"enable_rate_limiting"`
}

// UserListRequest represents a request to list users
type UserListRequest struct {
	TenantID   string            `json:"tenant_id,omitempty"`
	RoleID     string            `json:"role_id,omitempty"`
	IsActive   *bool             `json:"is_active,omitempty"`
	Search     string            `json:"search,omitempty"`
	Pagination *types.Pagination `json:"pagination,omitempty"`
	Sort       []types.Sort      `json:"sort,omitempty"`
}

// RoleListRequest represents a request to list roles
type RoleListRequest struct {
	TenantID   string            `json:"tenant_id,omitempty"`
	Search     string            `json:"search,omitempty"`
	Pagination *types.Pagination `json:"pagination,omitempty"`
	Sort       []types.Sort      `json:"sort,omitempty"`
}


// AuthStats represents authentication statistics
type AuthStats struct {
	TotalUsers      int64            `json:"total_users"`
	ActiveUsers     int64            `json:"active_users"`
	TotalRoles      int64            `json:"total_roles"`
	TotalSessions   int64            `json:"total_sessions"`
	LoginAttempts   int64            `json:"login_attempts_today"`
	FailedLogins    int64            `json:"failed_logins_today"`
	UsersByTenant   map[string]int64 `json:"users_by_tenant"`
	UsersByRole     map[string]int64 `json:"users_by_role"`
	RecentLogins    []UserSession    `json:"recent_logins"`
}

// SecurityPolicy represents security policy settings
type SecurityPolicy struct {
	ID                     string        `json:"id"`
	TenantID               string        `json:"tenant_id"`
	PasswordMinLength      int           `json:"password_min_length"`
	PasswordRequireUpper   bool          `json:"password_require_upper"`
	PasswordRequireLower   bool          `json:"password_require_lower"`
	PasswordRequireNumber  bool          `json:"password_require_number"`
	PasswordRequireSpecial bool          `json:"password_require_special"`
	PasswordExpireDays     int           `json:"password_expire_days"`
	MaxLoginAttempts       int           `json:"max_login_attempts"`
	LockoutDuration        time.Duration `json:"lockout_duration"`
	SessionTimeout         time.Duration `json:"session_timeout"`
	RequireMFA             bool          `json:"require_mfa"`
	IPWhitelist            []string      `json:"ip_whitelist,omitempty"`
	IPBlacklist            []string      `json:"ip_blacklist,omitempty"`
	EnableAuditLog         bool          `json:"enable_audit_log"`
	CreatedAt              time.Time     `json:"created_at"`
	UpdatedAt              time.Time     `json:"updated_at"`
}

// MFASetupRequest represents a multi-factor authentication setup request
type MFASetupRequest struct {
	Method string `json:"method" validate:"required,oneof=totp sms email"`
	Phone  string `json:"phone,omitempty" validate:"omitempty,phone"`
	Email  string `json:"email,omitempty" validate:"omitempty,email"`
}

// MFAVerifyRequest represents a multi-factor authentication verification request
type MFAVerifyRequest struct {
	Code   string `json:"code" validate:"required,len=6,numeric"`
	Method string `json:"method" validate:"required,oneof=totp sms email"`
}

// APIKeyRequest represents a request to create an API key
type APIKeyRequest struct {
	Name        string    `json:"name" validate:"required,max=100"`
	Description string    `json:"description,omitempty" validate:"max=500"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	Scopes      []string  `json:"scopes,omitempty"`
}

// APIKeyInfo represents API key information
type APIKeyInfo struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Key         string    `json:"key,omitempty"` // Only returned on creation
	UserID      string    `json:"user_id"`
	TenantID    string    `json:"tenant_id"`
	Scopes      []string  `json:"scopes"`
	IsActive    bool      `json:"is_active"`
	LastUsed    time.Time `json:"last_used,omitempty"`
	ExpiresAt   time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// Validation methods

// Validate validates the LoginRequest
func (req *LoginRequest) Validate() error {
	if req.Username == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Username is required",
		}
	}

	if req.Password == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Password is required",
		}
	}

	if len(req.Username) < 3 || len(req.Username) > 50 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Username must be between 3 and 50 characters",
		}
	}

	if len(req.Password) < 6 || len(req.Password) > 100 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Password must be between 6 and 100 characters",
		}
	}

	return nil
}

// Validate validates the CreateUserRequest
func (req *CreateUserRequest) Validate() error {
	if req.Username == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Username is required",
		}
	}

	if req.Email == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Email is required",
		}
	}

	if req.Password == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Password is required",
		}
	}

	if req.DisplayName == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Display name is required",
		}
	}

	if req.TenantID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Tenant ID is required",
		}
	}

	// Validate username format (alphanumeric only)
	for _, char := range req.Username {
		if !((char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z') || (char >= '0' && char <= '9') || char == '_' || char == '-') {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Username can only contain letters, numbers, underscores, and hyphens",
			}
		}
	}

	return nil
}

// Validate validates the CreateRoleRequest
func (req *CreateRoleRequest) Validate() error {
	if req.Name == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Role name is required",
		}
	}

	if req.TenantID == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Tenant ID is required",
		}
	}

	if len(req.Name) < 2 || len(req.Name) > 50 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Role name must be between 2 and 50 characters",
		}
	}

	return nil
}

// HasPermission checks if the user has a specific permission
func (user *UserInfo) HasPermission(permission string) bool {
	for _, p := range user.Permissions {
		if p == permission {
			return true
		}
	}
	return false
}

// HasRole checks if the user has a specific role
func (user *UserInfo) HasRole(role string) bool {
	for _, r := range user.Roles {
		if r == role {
			return true
		}
	}
	return false
}

// IsExpired checks if the token is expired
func (claims *TokenClaims) IsExpired() bool {
	return time.Now().Unix() > claims.ExpiresAt
}

// IsValid checks if the token is valid (not expired and not before valid time)
func (claims *TokenClaims) IsValid() bool {
	now := time.Now().Unix()
	return now >= claims.NotBefore && now < claims.ExpiresAt
}

// GetExpirationTime returns the expiration time
func (claims *TokenClaims) GetExpirationTime() time.Time {
	return time.Unix(claims.ExpiresAt, 0)
}

// IsSessionExpired checks if the session is expired
func (session *UserSession) IsSessionExpired() bool {
	return time.Now().After(session.ExpiresAt)
}

// UpdateLastSeen updates the last seen timestamp
func (session *UserSession) UpdateLastSeen() {
	session.LastSeen = time.Now()
}

// ValidatePassword validates password against security policy
func (policy *SecurityPolicy) ValidatePassword(password string) error {
	if len(password) < policy.PasswordMinLength {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Password must be at least %d characters long", policy.PasswordMinLength),
		}
	}

	if policy.PasswordRequireUpper {
		hasUpper := false
		for _, char := range password {
			if char >= 'A' && char <= 'Z' {
				hasUpper = true
				break
			}
		}
		if !hasUpper {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Password must contain at least one uppercase letter",
			}
		}
	}

	if policy.PasswordRequireLower {
		hasLower := false
		for _, char := range password {
			if char >= 'a' && char <= 'z' {
				hasLower = true
				break
			}
		}
		if !hasLower {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Password must contain at least one lowercase letter",
			}
		}
	}

	if policy.PasswordRequireNumber {
		hasNumber := false
		for _, char := range password {
			if char >= '0' && char <= '9' {
				hasNumber = true
				break
			}
		}
		if !hasNumber {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Password must contain at least one number",
			}
		}
	}

	if policy.PasswordRequireSpecial {
		specialChars := "!@#$%^&*()_+-=[]{}|;:,.<>?"
		hasSpecial := false
		for _, char := range password {
			for _, special := range specialChars {
				if char == special {
					hasSpecial = true
					break
				}
			}
			if hasSpecial {
				break
			}
		}
		if !hasSpecial {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "Password must contain at least one special character",
			}
		}
	}

	return nil
}