package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	authjwt "github.com/openwende/cmdb/server/internal/auth"
	authcore "github.com/openwende/cmdb/server/internal/core/auth"
	"github.com/openwende/cmdb/server/internal/types"
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

func (h *AuthHandler) ListUsers(c *gin.Context) {
	resp, err := h.service.ListUsers(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *AuthHandler) CreateUser(c *gin.Context) {
	var req types.AuthCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.service.CreateUser(c.Request.Context(), &req)
	if err != nil {
		switch err {
		case authcore.ErrDuplicateUsername:
			c.JSON(http.StatusConflict, gin.H{"error": "duplicate username"})
		default:
			if strings.Contains(err.Error(), authcore.ErrInvalidRole.Error()) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (h *AuthHandler) UpdateUser(c *gin.Context) {
	currentUser, ok := authjwt.GetCurrentUser(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	var req types.AuthUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := h.service.UpdateUser(c.Request.Context(), currentUser.UserID.String(), c.Param("id"), &req)
	if err != nil {
		switch {
		case errors.Is(err, authcore.ErrCannotDemoteSelf):
			c.JSON(http.StatusBadRequest, gin.H{"error": "cannot revoke your own admin access"})
		case strings.Contains(err.Error(), authcore.ErrInvalidRole.Error()):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role"})
		case strings.Contains(err.Error(), authcore.ErrInvalidStatus.Error()):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, user)
}

func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req types.AuthResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ResetPassword(c.Request.Context(), c.Param("id"), &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
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
