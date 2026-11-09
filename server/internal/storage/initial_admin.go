package storage

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/openwende/cmdb-server/internal/types"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// InitialAdminUsername is the account EnsureInitialAdmin creates.
const InitialAdminUsername = "admin"

// EnsureInitialAdmin creates the first administrator when no accounts exist.
// A database with any account is left untouched, so restarting never restores
// an account or password that an administrator has changed or disabled.
//
// When password is empty a random one is generated and returned so the caller
// can show it once. The return value is empty otherwise.
func EnsureInitialAdmin(db *gorm.DB, password string) (generatedPassword string, err error) {
	var userCount int64
	if err := db.Table("auth_users").Count(&userCount).Error; err != nil {
		return "", fmt.Errorf("count auth users: %w", err)
	}
	if userCount > 0 {
		return "", nil
	}

	if password == "" {
		randomBytes := make([]byte, 16)
		if _, err := rand.Read(randomBytes); err != nil {
			return "", fmt.Errorf("generate initial admin password: %w", err)
		}
		password = hex.EncodeToString(randomBytes)
		generatedPassword = password
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return "", fmt.Errorf("hash initial admin password: %w", err)
	}

	now := time.Now().UTC()
	user := types.AuthUser{
		ID:           uuid.New(),
		Username:     InitialAdminUsername,
		PasswordHash: string(passwordHash),
		Status:       types.AuthUserStatusActive,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	err = db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		return tx.Create(&types.AuthUserRole{
			UserID:     user.ID,
			Role:       types.AuthRoleAdmin,
			AssignedAt: now,
		}).Error
	})
	if err != nil {
		return "", fmt.Errorf("create initial admin: %w", err)
	}
	return generatedPassword, nil
}
