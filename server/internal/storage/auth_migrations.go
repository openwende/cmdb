package storage

import (
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/types"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func MigrateRuntimeAuthSupportTables(db *gorm.DB) error {
	for _, stmt := range runtimeAuthDDL(db.Dialector.Name()) {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}

	// seed 已收敛到 storage.SeedBuiltins(canonical 建表后由 main.go 无条件调用)
	return nil
}

func runtimeAuthDDL(dialect string) []string {
	if dialect == "sqlite" {
		return []string{
			`CREATE TABLE IF NOT EXISTS auth_users (
				id TEXT PRIMARY KEY,
				username TEXT NOT NULL UNIQUE,
				password_hash TEXT NOT NULL,
				display_name TEXT,
				status TEXT NOT NULL DEFAULT 'active',
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				last_login_at DATETIME
			)`,
			`CREATE TABLE IF NOT EXISTS auth_user_roles (
				user_id TEXT NOT NULL,
				role TEXT NOT NULL,
				assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (user_id, role)
			)`,
			`CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user_id ON auth_user_roles (user_id)`,
			`CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role ON auth_user_roles (role)`,
		}
	}

	return []string{
		`CREATE TABLE IF NOT EXISTS auth_users (
			id UUID PRIMARY KEY,
			username VARCHAR(64) NOT NULL UNIQUE,
			password_hash VARCHAR(255) NOT NULL,
			display_name VARCHAR(128),
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			last_login_at TIMESTAMPTZ
		)`,
		`CREATE TABLE IF NOT EXISTS auth_user_roles (
			user_id UUID NOT NULL,
			role VARCHAR(32) NOT NULL,
			assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (user_id, role)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_auth_user_roles_user_id ON auth_user_roles (user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_auth_user_roles_role ON auth_user_roles (role)`,
	}
}

func seedDefaultAuthUsers(db *gorm.DB) error {
	now := time.Now().UTC()
	defaultUsers := []struct {
		Username    string
		DisplayName string
		Password    string
		Role        string
	}{
		{
			Username:    "admin",
			DisplayName: "管理员",
			Password:    "admin123456",
			Role:        types.AuthRoleAdmin,
		},
		{
			Username:    "editor",
			DisplayName: "编辑者",
			Password:    "editor123456",
			Role:        types.AuthRoleEditor,
		},
		{
			Username:    "viewer",
			DisplayName: "只读用户",
			Password:    "viewer123456",
			Role:        types.AuthRoleViewer,
		},
	}

	for _, seededUser := range defaultUsers {
		var user types.AuthUser
		err := db.Table("auth_users").Where("username = ?", seededUser.Username).Take(&user).Error
		if err != nil {
			if err != gorm.ErrRecordNotFound {
				return err
			}

			passwordHash, hashErr := bcrypt.GenerateFromPassword([]byte(seededUser.Password), 12)
			if hashErr != nil {
				return hashErr
			}

			displayName := seededUser.DisplayName
			user = types.AuthUser{
				ID:           uuid.New(),
				Username:     seededUser.Username,
				PasswordHash: string(passwordHash),
				DisplayName:  &displayName,
				Status:       types.AuthUserStatusActive,
				CreatedAt:    now,
				UpdatedAt:    now,
			}

			if createErr := db.Create(&user).Error; createErr != nil {
				return createErr
			}
		} else {
			displayName := seededUser.DisplayName
			if updateErr := db.Table("auth_users").
				Where("id = ?", user.ID).
				Updates(map[string]any{
					"display_name": displayName,
					"status":       types.AuthUserStatusActive,
					"updated_at":   now,
				}).Error; updateErr != nil {
				return updateErr
			}
			user.DisplayName = &displayName
			user.Status = types.AuthUserStatusActive
		}

		var roleCount int64
		if err := db.Table("auth_user_roles").
			Where("user_id = ? AND role = ?", user.ID, seededUser.Role).
			Count(&roleCount).Error; err != nil {
			return err
		}
		if roleCount == 0 {
			role := types.AuthUserRole{
				UserID:     user.ID,
				Role:       seededUser.Role,
				AssignedAt: now,
			}
			if err := db.Create(&role).Error; err != nil {
				return err
			}
		}
	}

	return nil
}
