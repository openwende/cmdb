package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/types"
)

const currentUserContextKey = "auth.currentUser"

type CurrentUser struct {
	UserID   uuid.UUID
	Username string
	Roles    []string
}

type Middleware struct {
	manager *JWTManager
}

func NewMiddleware(manager *JWTManager) *Middleware {
	return &Middleware{manager: manager}
}

func (m *Middleware) Manager() *JWTManager {
	return m.manager
}

func GetCurrentUser(c *gin.Context) (*CurrentUser, bool) {
	value, ok := c.Get(currentUserContextKey)
	if !ok {
		return nil, false
	}
	user, ok := value.(*CurrentUser)
	return user, ok
}

// setCurrentUser 记录已认证用户：gin 上下文供 handler 读取，请求 context 携带操作人
// 供 service 层审计读取（见 OperatorFromContext）。
func setCurrentUser(c *gin.Context, user *CurrentUser) {
	c.Set(currentUserContextKey, user)
	operator := user.Username
	if operator == "" {
		operator = user.UserID.String()
	}
	c.Request = c.Request.WithContext(WithOperator(c.Request.Context(), operator))
}

func (m *Middleware) OptionalAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := m.authenticate(c)
		if err == nil && user != nil {
			setCurrentUser(c, user)
		}
		c.Next()
	}
}

func (m *Middleware) RequireAuthenticated() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, err := m.authenticate(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		setCurrentUser(c, user)
		c.Next()
	}
}

func (m *Middleware) RequireWriter() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetCurrentUser(c)
		if !ok {
			var err error
			user, err = m.authenticate(c)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				return
			}
			setCurrentUser(c, user)
		}

		if !hasRole(user.Roles, types.AuthRoleAdmin, types.AuthRoleEditor) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func (m *Middleware) RequireAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		user, ok := GetCurrentUser(c)
		if !ok {
			var err error
			user, err = m.authenticate(c)
			if err != nil {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
				return
			}
			setCurrentUser(c, user)
		}

		if !hasRole(user.Roles, types.AuthRoleAdmin) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
			return
		}
		c.Next()
	}
}

func (m *Middleware) ProtectAPI() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method == http.MethodOptions {
			c.Next()
			return
		}

		path := c.Request.URL.Path
		if path == "/health" || !strings.HasPrefix(path, "/api/") {
			c.Next()
			return
		}
		if path == "/api/v1/auth/login" {
			c.Next()
			return
		}

		user, err := m.authenticate(c)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}
		setCurrentUser(c, user)

		if path == "/api/v1/auth/me" {
			c.Next()
			return
		}

		switch c.Request.Method {
		case http.MethodGet, http.MethodHead:
			c.Next()
			return
		default:
			if !hasRole(user.Roles, types.AuthRoleAdmin, types.AuthRoleEditor) {
				c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "forbidden"})
				return
			}
			c.Next()
		}
	}
}

func (m *Middleware) authenticate(c *gin.Context) (*CurrentUser, error) {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, http.ErrNoCookie
	}

	tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	claims, err := m.manager.ParseToken(tokenString)
	if err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, err
	}

	return &CurrentUser{
		UserID:   userID,
		Username: claims.PreferredUsername,
		Roles:    claims.Roles,
	}, nil
}

func hasRole(roles []string, expected ...string) bool {
	roleSet := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		roleSet[role] = struct{}{}
	}
	for _, role := range expected {
		if _, ok := roleSet[role]; ok {
			return true
		}
	}
	return false
}
