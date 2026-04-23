package storage

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/gorm"
)

type AuthRepository interface {
	FindUserByUsername(ctx context.Context, username string) (*types.AuthUser, error)
	GetUserByID(ctx context.Context, userID uuid.UUID) (*types.AuthUser, error)
	ListRolesByUserID(ctx context.Context, userID uuid.UUID) ([]string, error)
	UpdateLastLogin(ctx context.Context, userID uuid.UUID, at time.Time) error
}

type authRepository struct {
	db *gorm.DB
}

func NewAuthRepository(db *gorm.DB) AuthRepository {
	return &authRepository{db: db}
}

func (r *authRepository) FindUserByUsername(ctx context.Context, username string) (*types.AuthUser, error) {
	var user types.AuthUser
	err := r.db.WithContext(ctx).Table("auth_users").Where("username = ?", username).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("find user by username: %w", err)
	}
	return &user, nil
}

func (r *authRepository) GetUserByID(ctx context.Context, userID uuid.UUID) (*types.AuthUser, error) {
	var user types.AuthUser
	err := r.db.WithContext(ctx).Table("auth_users").Where("id = ?", userID).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, fmt.Errorf("user not found")
	}
	if err != nil {
		return nil, fmt.Errorf("get user by id: %w", err)
	}
	return &user, nil
}

func (r *authRepository) ListRolesByUserID(ctx context.Context, userID uuid.UUID) ([]string, error) {
	var rows []types.AuthUserRole
	if err := r.db.WithContext(ctx).
		Table("auth_user_roles").
		Where("user_id = ?", userID).
		Order("role ASC").
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("list roles by user id: %w", err)
	}

	roles := make([]string, 0, len(rows))
	for _, row := range rows {
		roles = append(roles, row.Role)
	}
	return roles, nil
}

func (r *authRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID, at time.Time) error {
	return r.db.WithContext(ctx).Table("auth_users").Where("id = ?", userID).Update("last_login_at", at).Error
}
