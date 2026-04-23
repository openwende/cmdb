package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	authn "github.com/wend/cmdb-backend/internal/auth"
	authcore "github.com/wend/cmdb-backend/internal/core/auth"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/config"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupAuthHandlerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	require.NoError(t, storage.MigrateRuntimeAuthSupportTables(db))
	return db
}

func newTestAuthStack(t *testing.T) (*AuthHandler, *authn.Middleware) {
	t.Helper()

	db := setupAuthHandlerTestDB(t)
	repo := storage.NewAuthRepository(db)
	manager := authn.NewJWTManager(config.JWTConfig{
		Secret:            "test-secret-please-change-1234567890",
		Issuer:            "test-suite",
		AccessTokenExpiry: time.Hour,
	})
	service := authcore.NewService(repo, manager)
	return NewAuthHandler(service, manager), authn.NewMiddleware(manager)
}

func TestAuthLoginSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, _ := newTestAuthStack(t)

	router := gin.New()
	router.POST("/api/v1/auth/login", handler.Login)

	body, err := json.Marshal(types.AuthLoginRequest{
		Username: "admin",
		Password: "admin123456",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)

	var resp types.AuthLoginResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
	require.NotEmpty(t, resp.AccessToken)
	require.Equal(t, "Bearer", resp.TokenType)
	require.Equal(t, "admin", resp.User.Username)
	require.Contains(t, resp.User.Roles, "admin")
}

func TestAuthMeSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	router := gin.New()
	router.POST("/api/v1/auth/login", handler.Login)
	protected := router.Group("/api/v1")
	protected.Use(middleware.RequireAuthenticated())
	protected.GET("/auth/me", handler.Me)

	loginBody, err := json.Marshal(types.AuthLoginRequest{
		Username: "admin",
		Password: "admin123456",
	})
	require.NoError(t, err)

	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, loginReq)
	require.Equal(t, http.StatusOK, loginRecorder.Code)

	var loginResp types.AuthLoginResponse
	require.NoError(t, json.Unmarshal(loginRecorder.Body.Bytes(), &loginResp))

	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginResp.AccessToken)
	meRecorder := httptest.NewRecorder()
	router.ServeHTTP(meRecorder, meReq)

	require.Equal(t, http.StatusOK, meRecorder.Code)

	var user types.AuthUserProfile
	require.NoError(t, json.Unmarshal(meRecorder.Body.Bytes(), &user))
	require.Equal(t, "admin", user.Username)
	require.Contains(t, user.Roles, "admin")
}

func TestAuthLoginRejectsInvalidPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, _ := newTestAuthStack(t)

	router := gin.New()
	router.POST("/api/v1/auth/login", handler.Login)

	body, err := json.Marshal(types.AuthLoginRequest{
		Username: "admin",
		Password: "wrong-password",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestAuthMeRejectsMissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	router := gin.New()
	protected := router.Group("/api/v1")
	protected.Use(middleware.RequireAuthenticated())
	protected.GET("/auth/me", handler.Me)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
}

func TestAuthMeReturnsViewerProfile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	viewerToken, err := middleware.Manager().IssueToken(uuid.New(), "viewer", []string{"viewer"})
	require.NoError(t, err)

	router := gin.New()
	protected := router.Group("/api/v1")
	protected.Use(middleware.RequireAuthenticated())
	protected.GET("/auth/me", handler.Me)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusNotFound, recorder.Code)
}
