package auth

import (
	"context"
	"errors"

	authjwt "github.com/wend/cmdb-backend/internal/auth"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserDisabled       = errors.New("user disabled")
)

type Service interface {
	Login(ctx context.Context, req *types.AuthLoginRequest) (*types.AuthLoginResponse, error)
	Me(ctx context.Context, userID string) (*types.AuthUserProfile, error)
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
