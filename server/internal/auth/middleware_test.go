package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/openwende/cmdb/server/pkg/config"
	"github.com/stretchr/testify/require"
)

func TestProtectAPIRejectsViewerWriteRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	manager := NewJWTManager(config.JWTConfig{
		Secret:            "test-secret-please-change-1234567890",
		Issuer:            "test-suite",
		AccessTokenExpiry: time.Hour,
	})
	middleware := NewMiddleware(manager)

	viewerToken, err := manager.IssueToken(uuid.New(), "viewer", []string{"viewer"})
	require.NoError(t, err)

	router := gin.New()
	router.Use(middleware.ProtectAPI())
	router.POST("/api/v1/businesses", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})
	router.GET("/api/v1/businesses", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	writeReq := httptest.NewRequest(http.MethodPost, "/api/v1/businesses", nil)
	writeReq.Header.Set("Authorization", "Bearer "+viewerToken)
	writeRecorder := httptest.NewRecorder()
	router.ServeHTTP(writeRecorder, writeReq)
	require.Equal(t, http.StatusForbidden, writeRecorder.Code)

	readReq := httptest.NewRequest(http.MethodGet, "/api/v1/businesses", nil)
	readReq.Header.Set("Authorization", "Bearer "+viewerToken)
	readRecorder := httptest.NewRecorder()
	router.ServeHTTP(readRecorder, readReq)
	require.Equal(t, http.StatusOK, readRecorder.Code)
}

func TestProtectAPIAcceptsEditorWriteRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	manager := NewJWTManager(config.JWTConfig{
		Secret:            "test-secret-please-change-1234567890",
		Issuer:            "test-suite",
		AccessTokenExpiry: time.Hour,
	})
	middleware := NewMiddleware(manager)

	editorToken, err := manager.IssueToken(uuid.New(), "editor", []string{"editor"})
	require.NoError(t, err)

	router := gin.New()
	router.Use(middleware.ProtectAPI())
	router.POST("/api/v1/businesses", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"ok": true})
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/businesses", nil)
	req.Header.Set("Authorization", "Bearer "+editorToken)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	require.Equal(t, http.StatusCreated, recorder.Code)
}

// 认证后请求 context 携带操作人，service 层审计据此写 changed_by（而非写死 "system"）。
func TestProtectAPIPutsOperatorIntoRequestContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	manager := NewJWTManager(config.JWTConfig{
		Secret:            "test-secret-please-change-1234567890",
		Issuer:            "test-suite",
		AccessTokenExpiry: time.Hour,
	})
	middleware := NewMiddleware(manager)

	editorToken, err := manager.IssueToken(uuid.New(), "editor", []string{"editor"})
	require.NoError(t, err)

	var operator string
	router := gin.New()
	router.Use(middleware.ProtectAPI())
	router.POST("/api/v1/hosts/transfer", func(c *gin.Context) {
		operator = OperatorFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/hosts/transfer", nil)
	req.Header.Set("Authorization", "Bearer "+editorToken)
	router.ServeHTTP(httptest.NewRecorder(), req)
	require.Equal(t, "editor", operator)
}

func TestOperatorFromContextFallsBackToSystem(t *testing.T) {
	require.Equal(t, SystemOperator, OperatorFromContext(context.Background()))
	require.Equal(t, SystemOperator, OperatorFromContext(WithOperator(context.Background(), "")))
	require.Equal(t, "alice", OperatorFromContext(WithOperator(context.Background(), "alice")))
}
