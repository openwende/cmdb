package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authjwt "github.com/wend/cmdb-backend/internal/auth"
	authcore "github.com/wend/cmdb-backend/internal/core/auth"
	"github.com/wend/cmdb-backend/internal/types"
)

type AuthHandler struct {
	service    authcore.Service
	jwtManager *authjwt.JWTManager
}

func NewAuthHandler(service authcore.Service, jwtManager *authjwt.JWTManager) *AuthHandler {
	return &AuthHandler{service: service, jwtManager: jwtManager}
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req types.AuthLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.service.Login(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case authcore.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		case authcore.ErrUserDisabled:
			c.JSON(http.StatusForbidden, gin.H{"error": "user disabled"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) Me(c *gin.Context) {
	currentUser, ok := authjwt.GetCurrentUser(c)
	if !ok && h.jwtManager != nil {
		parsedUser, err := h.parseCurrentUserFromHeader(c.GetHeader("Authorization"))
		if err == nil {
			currentUser = parsedUser
			ok = true
		}
	}
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	profile, err := h.service.Me(c.Request.Context(), currentUser.UserID.String())
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, profile)
}

func (h *AuthHandler) parseCurrentUserFromHeader(header string) (*authjwt.CurrentUser, error) {
	authHeader := strings.TrimSpace(header)
	if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
		return nil, http.ErrNoCookie
	}

	tokenString := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	claims, err := h.jwtManager.ParseToken(tokenString)
	if err != nil {
		return nil, err
	}

	userID, err := uuid.Parse(claims.Subject)
	if err != nil {
		return nil, err
	}

	return &authjwt.CurrentUser{
		UserID:   userID,
		Username: claims.PreferredUsername,
		Roles:    claims.Roles,
	}, nil
}
