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
	authn "github.com/openwende/cmdb-server/internal/auth"
	authcore "github.com/openwende/cmdb-server/internal/core/auth"
	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/internal/types"
	"github.com/openwende/cmdb-server/pkg/config"
	"github.com/stretchr/testify/require"
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
	require.NoError(t, storage.SeedAuthUsers(db))
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

func TestAuthListUsersAdminOnly(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	router := gin.New()
	adminAPI := router.Group("/api/v1/auth/users")
	adminAPI.Use(middleware.RequireAdmin())
	adminAPI.GET("", handler.ListUsers)

	adminToken, err := middleware.Manager().IssueToken(uuid.New(), "admin", []string{"admin"})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/users", nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusOK, recorder.Code)

	var resp types.AuthListUsersResponse
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &resp))
	require.GreaterOrEqual(t, resp.Total, 3)
}

func TestAuthListUsersRejectsViewer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	router := gin.New()
	adminAPI := router.Group("/api/v1/auth/users")
	adminAPI.Use(middleware.RequireAdmin())
	adminAPI.GET("", handler.ListUsers)

	viewerToken, err := middleware.Manager().IssueToken(uuid.New(), "viewer", []string{"viewer"})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/users", nil)
	req.Header.Set("Authorization", "Bearer "+viewerToken)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}

func TestAuthCreateUpdateAndResetPassword(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	router := gin.New()
	adminAPI := router.Group("/api/v1/auth/users")
	adminAPI.Use(middleware.RequireAdmin())
	adminAPI.POST("", handler.CreateUser)
	adminAPI.PUT("/:id", handler.UpdateUser)
	adminAPI.PUT("/:id/password", handler.ResetPassword)

	adminID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	adminToken, err := middleware.Manager().IssueToken(adminID, "admin", []string{"admin"})
	require.NoError(t, err)

	createBody, err := json.Marshal(types.AuthCreateUserRequest{
		Username:    "alice",
		DisplayName: "Alice",
		Password:    "alice123456",
		Role:        types.AuthRoleEditor,
	})
	require.NoError(t, err)

	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/users", bytes.NewReader(createBody))
	createReq.Header.Set("Authorization", "Bearer "+adminToken)
	createReq.Header.Set("Content-Type", "application/json")
	createRecorder := httptest.NewRecorder()
	router.ServeHTTP(createRecorder, createReq)

	require.Equal(t, http.StatusCreated, createRecorder.Code)

	var createdUser types.AuthManagedUser
	require.NoError(t, json.Unmarshal(createRecorder.Body.Bytes(), &createdUser))
	require.Equal(t, "alice", createdUser.Username)
	require.Equal(t, types.AuthRoleEditor, createdUser.Role)

	updateBody, err := json.Marshal(types.AuthUpdateUserRequest{
		DisplayName: "Alice Ops",
		Status:      types.AuthUserStatusDisabled,
		Role:        types.AuthRoleViewer,
	})
	require.NoError(t, err)

	updateReq := httptest.NewRequest(http.MethodPut, "/api/v1/auth/users/"+createdUser.ID.String(), bytes.NewReader(updateBody))
	updateReq.Header.Set("Authorization", "Bearer "+adminToken)
	updateReq.Header.Set("Content-Type", "application/json")
	updateRecorder := httptest.NewRecorder()
	router.ServeHTTP(updateRecorder, updateReq)

	require.Equal(t, http.StatusOK, updateRecorder.Code)

	var updatedUser types.AuthManagedUser
	require.NoError(t, json.Unmarshal(updateRecorder.Body.Bytes(), &updatedUser))
	require.Equal(t, "Alice Ops", updatedUser.DisplayName)
	require.Equal(t, types.AuthUserStatusDisabled, updatedUser.Status)
	require.Equal(t, types.AuthRoleViewer, updatedUser.Role)

	resetBody, err := json.Marshal(types.AuthResetPasswordRequest{
		Password: "alice654321",
	})
	require.NoError(t, err)

	resetReq := httptest.NewRequest(http.MethodPut, "/api/v1/auth/users/"+createdUser.ID.String()+"/password", bytes.NewReader(resetBody))
	resetReq.Header.Set("Authorization", "Bearer "+adminToken)
	resetReq.Header.Set("Content-Type", "application/json")
	resetRecorder := httptest.NewRecorder()
	router.ServeHTTP(resetRecorder, resetReq)

	require.Equal(t, http.StatusOK, resetRecorder.Code)
}

func TestAuthUpdateUserRejectsSelfDemotion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	handler, middleware := newTestAuthStack(t)

	router := gin.New()
	adminAPI := router.Group("/api/v1/auth/users")
	adminAPI.Use(middleware.RequireAdmin())
	adminAPI.PUT("/:id", handler.UpdateUser)

	adminID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	adminToken, err := middleware.Manager().IssueToken(adminID, "admin", []string{"admin"})
	require.NoError(t, err)

	body, err := json.Marshal(types.AuthUpdateUserRequest{
		DisplayName: "管理员",
		Status:      types.AuthUserStatusDisabled,
		Role:        types.AuthRoleViewer,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/auth/users/"+adminID.String(), bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminToken)
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
}
