package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/openwende/cmdb/server/internal/core/service_category"
)

func setupServiceCategoryHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, db.Exec(`
		CREATE TABLE service_categories (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			business_id BIGINT,
			name TEXT NOT NULL,
			parent_id BIGINT,
			root_id BIGINT NOT NULL,
			is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME
		)
	`).Error)

	return db
}

func TestListServiceCategories(t *testing.T) {
	db := setupServiceCategoryHandlerTestDB(t)
	bizID := uint64(1001)

	require.NoError(t, db.Exec(`
		INSERT INTO service_categories (id, business_id, name, parent_id, root_id, is_builtin, sort_order, created_at, updated_at)
		VALUES
			(1, NULL, 'Default', NULL, 1, TRUE, 0, ?, ?),
			(2, NULL, 'Default', 1, 1, TRUE, 0, ?, ?),
			(10, ?, 'Database', NULL, 10, FALSE, 10, ?, ?),
			(11, ?, 'MySQL', 10, 10, FALSE, 20, ?, ?)
	`, time.Now(), time.Now(), time.Now(), time.Now(), bizID, time.Now(), time.Now(), bizID, time.Now(), time.Now()).Error)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	handler := NewServiceCategoryHandler(service_category.NewService(db))
	router.GET("/api/v1/service-categories", handler.ListCategories)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/service-categories?business_id="+fmt.Sprintf("%d", bizID), nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)

	var body struct {
		Code int `json:"code"`
		Data []struct {
			ID uint64 `json:"id"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	require.Equal(t, 0, body.Code)
	require.Len(t, body.Data, 4)
}
