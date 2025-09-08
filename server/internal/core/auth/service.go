package auth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"golang.org/x/crypto/bcrypt"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Service provides authentication and authorization functionality
type Service struct {
	repo      *Repository
	config    *AuthConfig
	jwtSecret []byte
}

// NewService creates a new auth service
func NewService(db *gorm.DB, config *AuthConfig) *Service {
	return &Service{
		repo:      NewRepository(db),
		config:    config,
		jwtSecret: []byte(config.JWTSecret),
	}
}

// Authentication operations

// Login authenticates a user and returns tokens
func (s *Service) Login(ctx context.Context, req *LoginRequest) (*LoginResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Get user by username
	user, err := s.repo.GetUserByUsername(ctx, req.Username)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeUnauthorized,
				Message: "Invalid username or password",
			}
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check if user is active
	if !user.IsActive {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "User account is disabled",
		}
	}

	// Check tenant if specified
	// Note: For now, we'll skip tenant validation since User doesn't have a direct TenantID field
	// This would be implemented with proper tenant membership checks in production
	_ = req.TenantID

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// Log failed login attempt
		s.logAuditEvent(ctx, user.ID.String(), user.Username, "login_failed", "authentication", nil, false, "Invalid password")
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "Invalid username or password",
		}
	}

	// Get user roles and permissions
	roles, err := s.repo.GetUserRoles(ctx, user.ID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	permissions, err := s.repo.GetUserPermissions(ctx, user.ID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Create session
	session, err := s.createUserSession(ctx, user, "")
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	// Generate tokens
	accessToken, err := s.generateAccessToken(user, roles, permissions, session.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	refreshToken, err := s.generateRefreshToken(user, session.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	// Update last login
	if err := s.repo.UpdateUserLastLogin(ctx, user.ID.String()); err != nil {
		// Log but don't fail
		fmt.Printf("Failed to update last login for user %s: %v\n", user.ID, err)
	}

	// Log successful login
	s.logAuditEvent(ctx, user.ID.String(), user.Username, "login_success", "authentication", nil, true, "")

	userInfo := UserInfo{
		ID:          user.ID.String(),
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		TenantID:    req.TenantID, // Use the tenant ID from request
		Roles:       roles,
		Permissions: permissions,
		IsActive:    user.IsActive,
		LastLoginAt: "", // Handle nil pointer safely
	}
	
	if user.LastLoginAt != nil {
		userInfo.LastLoginAt = user.LastLoginAt.Format(time.RFC3339)
	}

	return &LoginResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    time.Now().Add(s.config.AccessTokenExpiry),
		User:         userInfo,
	}, nil
}

// RefreshToken refreshes an access token using a refresh token
func (s *Service) RefreshToken(ctx context.Context, req *RefreshTokenRequest) (*LoginResponse, error) {
	// Parse and validate refresh token
	claims, err := s.parseToken(req.RefreshToken)
	if err != nil {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "Invalid refresh token",
		}
	}

	if claims.TokenType != "refresh" {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "Invalid token type",
		}
	}

	// Verify session is still active
	session, err := s.repo.GetUserSession(ctx, claims.SessionID)
	if err != nil {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "Session not found or expired",
		}
	}

	if !session.IsActive || session.IsSessionExpired() {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "Session expired",
		}
	}

	// Get user
	user, err := s.repo.GetUserByID(ctx, claims.UserID)
	if err != nil {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "User not found",
		}
	}

	if !user.IsActive {
		return nil, &types.AppError{
			Code:    types.ErrorCodeUnauthorized,
			Message: "User account is disabled",
		}
	}

	// Get fresh roles and permissions
	roles, err := s.repo.GetUserRoles(ctx, user.ID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	permissions, err := s.repo.GetUserPermissions(ctx, user.ID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	// Generate new access token
	accessToken, err := s.generateAccessToken(user, roles, permissions, session.SessionID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Update session last seen
	session.UpdateLastSeen()
	if err := s.repo.UpdateUserSession(ctx, session); err != nil {
		fmt.Printf("Failed to update session for user %s: %v\n", user.ID, err)
	}

	userInfo := UserInfo{
		ID:          user.ID.String(),
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		TenantID:    claims.TenantID, // Use the tenant ID from claims
		Roles:       roles,
		Permissions: permissions,
		IsActive:    user.IsActive,
		LastLoginAt: "", // Handle nil pointer safely
	}
	
	if user.LastLoginAt != nil {
		userInfo.LastLoginAt = user.LastLoginAt.Format(time.RFC3339)
	}

	return &LoginResponse{
		Token:        accessToken,
		RefreshToken: req.RefreshToken, // Return same refresh token
		ExpiresAt:    time.Now().Add(s.config.AccessTokenExpiry),
		User:         userInfo,
	}, nil
}

// Logout invalidates a user session
func (s *Service) Logout(ctx context.Context, sessionID string) error {
	session, err := s.repo.GetUserSession(ctx, sessionID)
	if err != nil {
		return nil // Session not found, consider it logged out
	}

	session.IsActive = false
	if err := s.repo.UpdateUserSession(ctx, session); err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}

	// Log logout event
	s.logAuditEvent(ctx, session.UserID, session.Username, "logout", "authentication", nil, true, "")

	return nil
}

// User management operations

// CreateUser creates a new user
func (s *Service) CreateUser(ctx context.Context, req *CreateUserRequest) (*types.User, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Check if username already exists
	if exists, err := s.repo.UserExistsByUsername(ctx, req.Username); err != nil {
		return nil, fmt.Errorf("failed to check username existence: %w", err)
	} else if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "Username already exists",
		}
	}

	// Check if email already exists
	if exists, err := s.repo.UserExistsByEmail(ctx, req.Email); err != nil {
		return nil, fmt.Errorf("failed to check email existence: %w", err)
	} else if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "Email already exists",
		}
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	user := &types.User{
		BaseModel: types.BaseModel{
			ID: uuid.New(),
		},
		Username:     req.Username,
		Email:        req.Email,
		PasswordHash: string(passwordHash),
		DisplayName:  req.DisplayName,
		IsActive:     true, // Default to active for new users
	}

	if err := s.repo.CreateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Assign roles if specified
	if len(req.RoleIDs) > 0 {
		if err := s.repo.AssignUserRoles(ctx, user.ID.String(), req.RoleIDs); err != nil {
			return nil, fmt.Errorf("failed to assign roles: %w", err)
		}
	}

	// Log user creation
	s.logAuditEvent(ctx, user.ID.String(), user.Username, "user_created", "user_management", map[string]interface{}{
		"created_user_id": user.ID.String(),
		"username":        user.Username,
		"email":           user.Email,
	}, true, "")

	return user, nil
}

// GetUser retrieves a user by ID
func (s *Service) GetUser(ctx context.Context, tenantID, userID string) (*UserInfo, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "User not found",
			}
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check tenant access
	// Note: For now, we'll skip tenant validation since User doesn't have a direct TenantID field
	// This would be implemented with proper tenant membership checks in production
	_ = tenantID

	// Get roles and permissions
	roles, err := s.repo.GetUserRoles(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user roles: %w", err)
	}

	permissions, err := s.repo.GetUserPermissions(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get user permissions: %w", err)
	}

	userInfo := &UserInfo{
		ID:          user.ID.String(),
		Username:    user.Username,
		Email:       user.Email,
		DisplayName: user.DisplayName,
		TenantID:    tenantID, // Use the tenant ID from parameter
		Roles:       roles,
		Permissions: permissions,
		IsActive:    user.IsActive,
		LastLoginAt: "", // Handle nil pointer safely
	}
	
	if user.LastLoginAt != nil {
		userInfo.LastLoginAt = user.LastLoginAt.Format(time.RFC3339)
	}

	return userInfo, nil
}

// UpdateUser updates a user
func (s *Service) UpdateUser(ctx context.Context, tenantID, userID string, req *UpdateUserRequest) (*types.User, error) {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "User not found",
			}
		}
		return nil, fmt.Errorf("failed to get user: %w", err)
	}

	// Check tenant access
	// Note: For now, we'll skip tenant validation since User doesn't have a direct TenantID field
	// This would be implemented with proper tenant membership checks in production
	_ = tenantID

	// Update fields
	if req.Email != nil {
		// Check if new email already exists
		if *req.Email != user.Email {
			if exists, err := s.repo.UserExistsByEmail(ctx, *req.Email); err != nil {
				return nil, fmt.Errorf("failed to check email existence: %w", err)
			} else if exists {
				return nil, &types.AppError{
					Code:    types.ErrorCodeAlreadyExists,
					Message: "Email already exists",
				}
			}
		}
		user.Email = *req.Email
	}

	if req.DisplayName != nil {
		user.DisplayName = *req.DisplayName
	}

	if req.IsActive != nil {
		user.IsActive = *req.IsActive
	}

	// Update roles if specified
	if req.RoleIDs != nil {
		if err := s.repo.UpdateUserRoles(ctx, userID, req.RoleIDs); err != nil {
			return nil, fmt.Errorf("failed to update roles: %w", err)
		}
	}

	if err := s.repo.UpdateUser(ctx, user); err != nil {
		return nil, fmt.Errorf("failed to update user: %w", err)
	}

	// Log user update
	s.logAuditEvent(ctx, user.ID.String(), user.Username, "user_updated", "user_management", map[string]interface{}{
		"updated_user_id": user.ID.String(),
		"changes":         req,
	}, true, "")

	return user, nil
}

// DeleteUser deletes a user
func (s *Service) DeleteUser(ctx context.Context, tenantID, userID string) error {
	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "User not found",
			}
		}
		return fmt.Errorf("failed to get user: %w", err)
	}

	// Check tenant access
	// Note: For now, we'll skip tenant validation since User doesn't have a direct TenantID field
	// This would be implemented with proper tenant membership checks in production
	_ = tenantID

	// Invalidate all user sessions
	if err := s.repo.InvalidateUserSessions(ctx, userID); err != nil {
		return fmt.Errorf("failed to invalidate user sessions: %w", err)
	}

	if err := s.repo.DeleteUser(ctx, userID); err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	// Log user deletion
	s.logAuditEvent(ctx, userID, user.Username, "user_deleted", "user_management", map[string]interface{}{
		"deleted_user_id": userID,
		"username":        user.Username,
	}, true, "")

	return nil
}

// Role management operations

// CreateRole creates a new role
func (s *Service) CreateRole(ctx context.Context, req *CreateRoleRequest) (*types.Role, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Check if role name already exists in tenant
	if exists, err := s.repo.RoleExistsByName(ctx, req.TenantID, req.Name); err != nil {
		return nil, fmt.Errorf("failed to check role existence: %w", err)
	} else if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "Role with this name already exists",
		}
	}

	tenantUUID := uuid.MustParse(req.TenantID)
	role := &types.Role{
		BaseModel: types.BaseModel{
			ID: uuid.New(),
		},
		TenantID:    &tenantUUID,
		Name:        req.Name,
		Identifier:  req.Name, // Use name as identifier for now
		Description: req.Description,
		IsBuiltIn:   false, // Default to false for user-created roles
	}

	if err := s.repo.CreateRole(ctx, role); err != nil {
		return nil, fmt.Errorf("failed to create role: %w", err)
	}

	// Assign permissions if specified
	if len(req.PermissionIDs) > 0 {
		if err := s.repo.AssignRolePermissions(ctx, role.ID.String(), req.PermissionIDs); err != nil {
			return nil, fmt.Errorf("failed to assign permissions: %w", err)
		}
	}

	// Log role creation
	s.logAuditEvent(ctx, "", "", "role_created", "role_management", map[string]interface{}{
		"role_id":   role.ID.String(),
		"role_name": role.Name,
	}, true, "")

	return role, nil
}

// CheckPermission checks if a user has a specific permission
func (s *Service) CheckPermission(ctx context.Context, req *PermissionCheckRequest) (*PermissionCheckResponse, error) {
	hasPermission, err := s.repo.UserHasPermission(ctx, req.UserID, req.Resource, req.Action)
	if err != nil {
		return nil, fmt.Errorf("failed to check permission: %w", err)
	}

	response := &PermissionCheckResponse{
		Allowed: hasPermission,
	}

	if !hasPermission {
		response.Reason = "Insufficient permissions"
	}

	return response, nil
}

// Helper methods

// generateAccessToken generates a JWT access token
func (s *Service) generateAccessToken(user *types.User, roles, permissions []string, sessionID string) (string, error) {
	now := time.Now()
	claims := &TokenClaims{
		UserID:      user.ID.String(),
		Username:    user.Username,
		TenantID:    "", // Use empty for now, should be passed as parameter
		Roles:       roles,
		Permissions: permissions,
		SessionID:   sessionID,
		TokenType:   "access",
		IssuedAt:    now.Unix(),
		ExpiresAt:   now.Add(s.config.AccessTokenExpiry).Unix(),
		NotBefore:   now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":     claims.UserID,
		"username":    claims.Username,
		"tenant_id":   claims.TenantID,
		"roles":       claims.Roles,
		"permissions": claims.Permissions,
		"session_id":  claims.SessionID,
		"token_type":  claims.TokenType,
		"iat":         claims.IssuedAt,
		"exp":         claims.ExpiresAt,
		"nbf":         claims.NotBefore,
	})

	return token.SignedString(s.jwtSecret)
}

// generateRefreshToken generates a JWT refresh token
func (s *Service) generateRefreshToken(user *types.User, sessionID string) (string, error) {
	now := time.Now()
	claims := &TokenClaims{
		UserID:    user.ID.String(),
		Username:  user.Username,
		TenantID:  "", // Use empty for now, should be passed as parameter
		SessionID: sessionID,
		TokenType: "refresh",
		IssuedAt:  now.Unix(),
		ExpiresAt: now.Add(s.config.RefreshTokenExpiry).Unix(),
		NotBefore: now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    claims.UserID,
		"username":   claims.Username,
		"tenant_id":  claims.TenantID,
		"session_id": claims.SessionID,
		"token_type": claims.TokenType,
		"iat":        claims.IssuedAt,
		"exp":        claims.ExpiresAt,
		"nbf":        claims.NotBefore,
	})

	return token.SignedString(s.jwtSecret)
}

// ValidateJWT validates a JWT token and returns the user ID
func (s *Service) ValidateJWT(tokenString string) (uuid.UUID, error) {
	claims, err := s.parseToken(tokenString)
	if err != nil {
		return uuid.Nil, err
	}
	
	// Check if access token
	if claims.TokenType != "access" {
		return uuid.Nil, fmt.Errorf("invalid token type")
	}
	
	userID, err := uuid.Parse(claims.UserID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid user ID in token")
	}
	
	return userID, nil
}

// GetUserByID returns a user by UUID
func (s *Service) GetUserByID(ctx context.Context, userID uuid.UUID) (*types.User, error) {
	return s.repo.GetUserByID(ctx, userID.String())
}

// parseToken parses and validates a JWT token
func (s *Service) parseToken(tokenString string) (*TokenClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	tokenClaims := &TokenClaims{
		UserID:    getString(claims, "user_id"),
		Username:  getString(claims, "username"),
		TenantID:  getString(claims, "tenant_id"),
		SessionID: getString(claims, "session_id"),
		TokenType: getString(claims, "token_type"),
		IssuedAt:  getInt64(claims, "iat"),
		ExpiresAt: getInt64(claims, "exp"),
		NotBefore: getInt64(claims, "nbf"),
	}

	if roles, ok := claims["roles"].([]interface{}); ok {
		for _, role := range roles {
			if roleStr, ok := role.(string); ok {
				tokenClaims.Roles = append(tokenClaims.Roles, roleStr)
			}
		}
	}

	if permissions, ok := claims["permissions"].([]interface{}); ok {
		for _, permission := range permissions {
			if permStr, ok := permission.(string); ok {
				tokenClaims.Permissions = append(tokenClaims.Permissions, permStr)
			}
		}
	}

	return tokenClaims, nil
}

// createUserSession creates a new user session
func (s *Service) createUserSession(ctx context.Context, user *types.User, ipAddress string) (*UserSession, error) {
	sessionID, err := generateSessionID()
	if err != nil {
		return nil, fmt.Errorf("failed to generate session ID: %w", err)
	}

	session := &UserSession{
		SessionID: sessionID,
		UserID:    user.ID.String(),
		Username:  user.Username,
		TenantID:  "", // Use empty for now, should be passed as parameter
		IPAddress: ipAddress,
		CreatedAt: time.Now(),
		LastSeen:  time.Now(),
		ExpiresAt: time.Now().Add(s.config.SessionTimeout),
		IsActive:  true,
	}

	if err := s.repo.CreateUserSession(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	return session, nil
}

// logAuditEvent logs an audit event
func (s *Service) logAuditEvent(ctx context.Context, userID, username, action, resource string, details map[string]interface{}, success bool, errorMsg string) {
	if !s.config.EnableAuditLog {
		return
	}

	entry := &AuditLogEntry{
		ID:        uuid.New().String(),
		UserID:    userID,
		Username:  username,
		Action:    action,
		Resource:  resource,
		Details:   details,
		Success:   success,
		Error:     errorMsg,
		Timestamp: time.Now(),
	}

	// This is async to avoid blocking the main operation
	go func() {
		if err := s.repo.CreateAuditLogEntry(ctx, entry); err != nil {
			fmt.Printf("Failed to create audit log entry: %v\n", err)
		}
	}()
}

// Utility functions

func generateSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func getString(claims jwt.MapClaims, key string) string {
	if val, ok := claims[key].(string); ok {
		return val
	}
	return ""
}

func getInt64(claims jwt.MapClaims, key string) int64 {
	if val, ok := claims[key].(float64); ok {
		return int64(val)
	}
	return 0
}