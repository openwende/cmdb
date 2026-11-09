package auth

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/openwende/cmdb-server/pkg/config"
)

type Claims struct {
	Roles             []string `json:"roles"`
	PreferredUsername string   `json:"preferred_username"`
	jwt.RegisteredClaims
}

type JWTManager struct {
	secret            []byte
	issuer            string
	accessTokenExpiry time.Duration
}

func NewJWTManager(cfg config.JWTConfig) *JWTManager {
	return &JWTManager{
		secret:            []byte(cfg.Secret),
		issuer:            cfg.Issuer,
		accessTokenExpiry: cfg.AccessTokenExpiry,
	}
}

func (m *JWTManager) IssueToken(userID uuid.UUID, username string, roles []string) (string, error) {
	now := time.Now().UTC()
	expiresAt := now.Add(m.accessTokenExpiry)
	claims := &Claims{
		Roles:             roles,
		PreferredUsername: username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID.String(),
			Issuer:    m.issuer,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expiresAt),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *JWTManager) ParseToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", token.Method.Alg())
		}
		return m.secret, nil
	}, jwt.WithIssuer(m.issuer))
	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func (m *JWTManager) ExpiresInSeconds() int64 {
	return int64(m.accessTokenExpiry.Seconds())
}
