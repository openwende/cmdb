package auditlog

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/openwende/cmdb-server/internal/auth"
)

func setupAuditTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	require.NoError(t, db.Exec(`CREATE TABLE resource_histories (id INTEGER PRIMARY KEY AUTOINCREMENT, resource_id INTEGER, model_uid TEXT, change_type TEXT, before_data TEXT, after_data TEXT, changed_by TEXT, changed_at DATETIME, client_ip TEXT, user_agent TEXT, resource_name TEXT, biz_name TEXT)`).Error)
	return db
}

func TestRecordUsesOperatorFromContext(t *testing.T) {
	db := setupAuditTestDB(t)

	Record(auth.WithOperator(context.Background(), "admin"), db, "module", "create", 11, 1000, "db", "biz-x")
	Record(context.Background(), db, "module", "delete", 12, 1000, "cache", "biz-x")

	var rows []struct {
		ResourceID uint64
		ChangedBy  string
	}
	require.NoError(t, db.Table("resource_histories").Select("resource_id, changed_by").Order("resource_id").Scan(&rows).Error)
	require.Len(t, rows, 2)
	require.Equal(t, "admin", rows[0].ChangedBy)
	require.Equal(t, auth.SystemOperator, rows[1].ChangedBy, "无请求级用户时降级为 system")
}
