package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	authjwt "github.com/openwende/cmdb/server/internal/auth"
	"github.com/openwende/cmdb/server/internal/storage"
	"github.com/openwende/cmdb/server/internal/types"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserDisabled       = errors.New("user disabled")
	ErrInvalidRole        = errors.New("invalid role")
	ErrInvalidStatus      = errors.New("invalid status")
	ErrDuplicateUsername  = errors.New("duplicate username")
	ErrCannotDemoteSelf   = errors.New("cannot revoke your own admin access")
)

type Service interface {
	Login(ctx context.Context, req *types.AuthLoginRequest) (*types.AuthLoginResponse, error)
	Me(ctx context.Context, userID string) (*types.AuthUserProfile, error)
	ListUsers(ctx context.Context) (*types.AuthListUsersResponse, error)
	CreateUser(ctx context.Context, req *types.AuthCreateUserRequest) (*types.AuthManagedUser, error)
	UpdateUser(ctx context.Context, actorUserID string, userID string, req *types.AuthUpdateUserRequest) (*types.AuthManagedUser, error)
	ResetPassword(ctx context.Context, userID string, req *types.AuthResetPasswordRequest) error
}

type service struct {
	repo       storage.AuthRepository
	jwtManager *authjwt.JWTManager
}

func NewService(repo storage.AuthRepository, jwtManager *authjwt.JWTManager) Service {
	return &service{repo: repo, jwtManager: jwtManager}
}

func (s *service) Login(ctx context.Context, req *types.AuthLoginRequest) (*types.AuthLoginResponse, error) {
	user, err := s.repo.FindUserByUsername(ctx, req.Username)
	if err != nil {
		return nil, ErrInvalidCredentials
	}
	if user.Status != types.AuthUserStatusActive {
		return nil, ErrUserDisabled
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	roles, err := s.repo.ListRolesByUserID(ctx, user.ID)
	if err != nil {
		return nil, err
	}

	token, err := s.jwtManager.IssueToken(user.ID, user.Username, roles)
	if err != nil {
		return nil, err
	}

	_ = s.repo.UpdateLastLogin(ctx, user.ID, nowUTC())

	return &types.AuthLoginResponse{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresIn:   s.jwtManager.ExpiresInSeconds(),
		User:        toAuthUserProfile(user, roles),
	}, nil
}

func (s *service) Me(ctx context.Context, userID string) (*types.AuthUserProfile, error) {
	parsedID, err := parseUUID(userID)
	if err != nil {
		return nil, err
	}

	user, err := s.repo.GetUserByID(ctx, parsedID)
	if err != nil {
		return nil, err
	}
	roles, err := s.repo.ListRolesByUserID(ctx, parsedID)
	if err != nil {
		return nil, err
	}
	profile := toAuthUserProfile(user, roles)
	return &profile, nil
}

func (s *service) ListUsers(ctx context.Context) (*types.AuthListUsersResponse, error) {
	users, err := s.repo.ListUsers(ctx)
	if err != nil {
		return nil, err
	}

	items := make([]types.AuthManagedUser, 0, len(users))
	for _, user := range users {
		role, roleErr := s.repo.GetPrimaryRoleByUserID(ctx, user.ID)
		if roleErr != nil {
			return nil, roleErr
		}
		items = append(items, toManagedUser(&user, role))
	}

	return &types.AuthListUsersResponse{
		Items: items,
		Total: len(items),
	}, nil
}

func (s *service) CreateUser(ctx context.Context, req *types.AuthCreateUserRequest) (*types.AuthManagedUser, error) {
	role, err := normalizeRole(req.Role)
	if err != nil {
		return nil, err
	}

	username := strings.TrimSpace(req.Username)
	displayName := strings.TrimSpace(req.DisplayName)
	password := strings.TrimSpace(req.Password)

	if _, err := s.repo.FindUserByUsername(ctx, username); err == nil {
		return nil, ErrDuplicateUsername
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, err
	}

	now := nowUTC()
	user := &types.AuthUser{
		ID:           uuid.New(),
		Username:     username,
		PasswordHash: string(passwordHash),
		DisplayName:  &displayName,
		Status:       types.AuthUserStatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.repo.CreateUser(ctx, user, role); err != nil {
		if strings.Contains(err.Error(), "UNIQUE") || strings.Contains(strings.ToLower(err.Error()), "duplicate") {
			return nil, ErrDuplicateUsername
		}
		return nil, err
	}

	managedUser := toManagedUser(user, role)
	return &managedUser, nil
}

func (s *service) UpdateUser(ctx context.Context, actorUserID string, userID string, req *types.AuthUpdateUserRequest) (*types.AuthManagedUser, error) {
	parsedUserID, err := parseUUID(userID)
	if err != nil {
		return nil, err
	}
	parsedActorID, err := parseUUID(actorUserID)
	if err != nil {
		return nil, err
	}

	role, err := normalizeRole(req.Role)
	if err != nil {
		return nil, err
	}
	status, err := normalizeStatus(req.Status)
	if err != nil {
		return nil, err
	}

	if parsedUserID == parsedActorID && (role != types.AuthRoleAdmin || status != types.AuthUserStatusActive) {
		return nil, ErrCannotDemoteSelf
	}

	displayName := strings.TrimSpace(req.DisplayName)
	updates := map[string]any{
		"display_name": displayName,
		"status":       status,
		"updated_at":   nowUTC(),
	}
	if err := s.repo.UpdateUser(ctx, parsedUserID, updates, role); err != nil {
		return nil, err
	}

	user, err := s.repo.GetUserByID(ctx, parsedUserID)
	if err != nil {
		return nil, err
	}

	managedUser := toManagedUser(user, role)
	return &managedUser, nil
}

func (s *service) ResetPassword(ctx context.Context, userID string, req *types.AuthResetPasswordRequest) error {
	parsedUserID, err := parseUUID(userID)
	if err != nil {
		return err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(strings.TrimSpace(req.Password)), 12)
	if err != nil {
		return err
	}

	return s.repo.UpdatePasswordHash(ctx, parsedUserID, string(passwordHash), nowUTC())
}

func toAuthUserProfile(user *types.AuthUser, roles []string) types.AuthUserProfile {
	displayName := user.Username
	if user.DisplayName != nil && *user.DisplayName != "" {
		displayName = *user.DisplayName
	}
	return types.AuthUserProfile{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: displayName,
		Roles:       roles,
	}
}

func toManagedUser(user *types.AuthUser, role string) types.AuthManagedUser {
	displayName := user.Username
	if user.DisplayName != nil && *user.DisplayName != "" {
		displayName = *user.DisplayName
	}
	return types.AuthManagedUser{
		ID:          user.ID,
		Username:    user.Username,
		DisplayName: displayName,
		Status:      user.Status,
		Role:        role,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
		LastLoginAt: user.LastLoginAt,
	}
}

func normalizeRole(role string) (string, error) {
	value := strings.TrimSpace(role)
	switch value {
	case types.AuthRoleAdmin, types.AuthRoleEditor, types.AuthRoleViewer:
		return value, nil
	default:
		return "", fmt.Errorf("%w: %s", ErrInvalidRole, role)
	}
}

func normalizeStatus(status string) (string, error) {
	value := strings.TrimSpace(status)
	switch value {
	case types.AuthUserStatusActive, types.AuthUserStatusDisabled:
		return value, nil
	default:
		return "", fmt.Errorf("%w: %s", ErrInvalidStatus, status)
	}
}
