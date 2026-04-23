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
	ListUsers(ctx context.Context) ([]types.AuthUser, error)
	ListRolesByUserID(ctx context.Context, userID uuid.UUID) ([]string, error)
	GetPrimaryRoleByUserID(ctx context.Context, userID uuid.UUID) (string, error)
	CreateUser(ctx context.Context, user *types.AuthUser, role string) error
	UpdateUser(ctx context.Context, userID uuid.UUID, updates map[string]any, role string) error
	UpdatePasswordHash(ctx context.Context, userID uuid.UUID, passwordHash string, updatedAt time.Time) error
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

func (r *authRepository) ListUsers(ctx context.Context) ([]types.AuthUser, error) {
	var users []types.AuthUser
	if err := r.db.WithContext(ctx).
		Table("auth_users").
		Order("created_at ASC").
		Find(&users).Error; err != nil {
		return nil, fmt.Errorf("list users: %w", err)
	}
	return users, nil
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

func (r *authRepository) GetPrimaryRoleByUserID(ctx context.Context, userID uuid.UUID) (string, error) {
	roles, err := r.ListRolesByUserID(ctx, userID)
	if err != nil {
		return "", err
	}
	if len(roles) == 0 {
		return "", fmt.Errorf("user role not found")
	}
	return roles[0], nil
}

func (r *authRepository) CreateUser(ctx context.Context, user *types.AuthUser, role string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(user).Error; err != nil {
			return fmt.Errorf("create user: %w", err)
		}
		userRole := types.AuthUserRole{
			UserID:     user.ID,
			Role:       role,
			AssignedAt: user.CreatedAt,
		}
		if err := tx.Create(&userRole).Error; err != nil {
			return fmt.Errorf("create user role: %w", err)
		}
		return nil
	})
}

func (r *authRepository) UpdateUser(ctx context.Context, userID uuid.UUID, updates map[string]any, role string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if len(updates) > 0 {
			if err := tx.Table("auth_users").Where("id = ?", userID).Updates(updates).Error; err != nil {
				return fmt.Errorf("update user: %w", err)
			}
		}

		if err := tx.Table("auth_user_roles").Where("user_id = ?", userID).Delete(&types.AuthUserRole{}).Error; err != nil {
			return fmt.Errorf("delete existing roles: %w", err)
		}

		userRole := types.AuthUserRole{
			UserID:     userID,
			Role:       role,
			AssignedAt: time.Now().UTC(),
		}
		if err := tx.Create(&userRole).Error; err != nil {
			return fmt.Errorf("replace user role: %w", err)
		}
		return nil
	})
}

func (r *authRepository) UpdatePasswordHash(ctx context.Context, userID uuid.UUID, passwordHash string, updatedAt time.Time) error {
	if err := r.db.WithContext(ctx).Table("auth_users").Where("id = ?", userID).Updates(map[string]any{
		"password_hash": passwordHash,
		"updated_at":    updatedAt,
	}).Error; err != nil {
		return fmt.Errorf("update password hash: %w", err)
	}
	return nil
}

func (r *authRepository) UpdateLastLogin(ctx context.Context, userID uuid.UUID, at time.Time) error {
	return r.db.WithContext(ctx).Table("auth_users").Where("id = ?", userID).Update("last_login_at", at).Error
}
