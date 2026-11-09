package storage

import (
	"testing"

	"github.com/openwende/cmdb-server/internal/types"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAuthMigrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	return db
}

func TestMigrateRuntimeAuthSupportTablesCreatesDefaults(t *testing.T) {
	db := setupAuthMigrationTestDB(t)

	require.NoError(t, MigrateRuntimeAuthSupportTables(db))
	require.NoError(t, seedDefaultAuthUsers(db))
	require.True(t, db.Migrator().HasTable(&types.AuthUser{}))
	require.True(t, db.Migrator().HasTable(&types.AuthUserRole{}))

	expectedUsers := map[string]struct {
		displayName string
		role        string
	}{
		"admin": {
			displayName: "管理员",
			role:        types.AuthRoleAdmin,
		},
		"editor": {
			displayName: "编辑者",
			role:        types.AuthRoleEditor,
		},
		"viewer": {
			displayName: "只读用户",
			role:        types.AuthRoleViewer,
		},
	}

	for username, expected := range expectedUsers {
		var user types.AuthUser
		require.NoError(t, db.Where("username = ?", username).First(&user).Error)
		require.Equal(t, types.AuthUserStatusActive, user.Status)
		require.NotNil(t, user.DisplayName)
		require.Equal(t, expected.displayName, *user.DisplayName)

		var roles []types.AuthUserRole
		require.NoError(t, db.Where("user_id = ?", user.ID).Find(&roles).Error)
		require.Len(t, roles, 1)
		require.Equal(t, expected.role, roles[0].Role)
	}
}
