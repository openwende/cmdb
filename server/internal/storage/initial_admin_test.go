package storage

import (
	"testing"

	"github.com/openwende/cmdb-server/internal/types"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func TestEnsureInitialAdminUsesConfiguredPassword(t *testing.T) {
	db := setupAuthMigrationTestDB(t)
	require.NoError(t, MigrateRuntimeAuthSupportTables(db))

	generated, err := EnsureInitialAdmin(db, "a-configured-password")

	require.NoError(t, err)
	require.Empty(t, generated)

	var user types.AuthUser
	require.NoError(t, db.Where("username = ?", InitialAdminUsername).First(&user).Error)
	require.Equal(t, types.AuthUserStatusActive, user.Status)
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("a-configured-password")))

	var roles []types.AuthUserRole
	require.NoError(t, db.Where("user_id = ?", user.ID).Find(&roles).Error)
	require.Len(t, roles, 1)
	require.Equal(t, types.AuthRoleAdmin, roles[0].Role)
}

func TestEnsureInitialAdminGeneratesPasswordWhenNoneConfigured(t *testing.T) {
	db := setupAuthMigrationTestDB(t)
	require.NoError(t, MigrateRuntimeAuthSupportTables(db))

	generated, err := EnsureInitialAdmin(db, "")

	require.NoError(t, err)
	require.Len(t, generated, 32)

	var user types.AuthUser
	require.NoError(t, db.Where("username = ?", InitialAdminUsername).First(&user).Error)
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(generated)))
}

func TestEnsureInitialAdminLeavesExistingAccountsUntouched(t *testing.T) {
	db := setupAuthMigrationTestDB(t)
	require.NoError(t, MigrateRuntimeAuthSupportTables(db))
	_, err := EnsureInitialAdmin(db, "the-first-password")
	require.NoError(t, err)
	require.NoError(t, db.Table("auth_users").
		Where("username = ?", InitialAdminUsername).
		Update("status", "disabled").Error)

	generated, err := EnsureInitialAdmin(db, "another-password")

	require.NoError(t, err)
	require.Empty(t, generated)

	var users []types.AuthUser
	require.NoError(t, db.Find(&users).Error)
	require.Len(t, users, 1)
	require.Equal(t, "disabled", string(users[0].Status))
	require.NoError(t, bcrypt.CompareHashAndPassword([]byte(users[0].PasswordHash), []byte("the-first-password")))
}
