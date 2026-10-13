package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// /hosts/display/:display_id 和 /hosts/:id（及 /hosts/:id/processes 等）共存：注册不 panic，且各自命中自己的处理器。
func TestHostRoutes_DisplayIDRouteCoexistsWithUUIDRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)

	router := gin.New()
	require.NotPanics(t, func() {
		RegisterHostRoutes(router, db)
		RegisterTopologyRoutes(router, db)
		RegisterProcessRoutes(router, db)
		RegisterResourcePoolRoutes(router, db)
	})

	get := func(path string) map[string]interface{} {
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, path, nil))
		require.Equal(t, http.StatusBadRequest, rec.Code, path)
		var body map[string]interface{}
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		return body
	}
	// 展示 ID 路由：apperrors 格式
	require.Equal(t, "INVALID_INPUT", get("/api/v1/hosts/display/abc")["error"])
	// UUID 路由仍由原处理器处理
	require.Equal(t, "invalid host id", get("/api/v1/hosts/abc")["error"])
}
