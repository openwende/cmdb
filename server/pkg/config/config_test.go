package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

const randomTestSecret = "0123456789abcdef0123456789abcdef0123456789abcdef"

func TestLoadRejectsPublishedJWTSecretsInReleaseMode(t *testing.T) {
	tests := []struct {
		name    string
		mode    string
		secret  string
		wantErr bool
	}{
		{name: "release mode rejects the built-in default", mode: "release", wantErr: true},
		{name: "release mode rejects the example value", mode: "release", secret: exampleJWTSecret, wantErr: true},
		{name: "release mode accepts a private secret", mode: "release", secret: randomTestSecret},
		{name: "debug mode accepts the built-in default", mode: "debug"},
		{name: "test mode accepts the example value", mode: "test", secret: exampleJWTSecret},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Chdir(t.TempDir())
			t.Setenv("SERVER_MODE", tt.mode)
			if tt.secret != "" {
				t.Setenv("AUTH_JWT_SECRET", tt.secret)
			} else {
				unsetEnv(t, "AUTH_JWT_SECRET")
			}

			_, err := Load("")

			if tt.wantErr {
				require.ErrorContains(t, err, "AUTH_JWT_SECRET")
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestLoadRejectsExampleConfigFileInReleaseMode(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := "server:\n  mode: release\nauth:\n  jwt:\n    secret: " + exampleJWTSecret + "\n"
	require.NoError(t, os.WriteFile(path, []byte(content), 0o600))
	unsetEnv(t, "SERVER_MODE")
	unsetEnv(t, "AUTH_JWT_SECRET")

	_, err := Load(path)

	require.ErrorContains(t, err, "AUTH_JWT_SECRET")
}

func TestLoadReadsSecretsFromEnvironmentWithoutConfigFile(t *testing.T) {
	t.Chdir(t.TempDir())
	t.Setenv("SERVER_MODE", "release")
	t.Setenv("AUTH_JWT_SECRET", randomTestSecret)
	t.Setenv("DATABASE_PASSWORD", "from-environment")

	cfg, err := Load("")

	require.NoError(t, err)
	require.Equal(t, randomTestSecret, cfg.Auth.JWT.Secret)
	require.Equal(t, "from-environment", cfg.Database.Password)
}

// unsetEnv removes key for the duration of the test, restoring it afterwards.
func unsetEnv(t *testing.T, key string) {
	t.Helper()
	t.Setenv(key, "")
	require.NoError(t, os.Unsetenv(key))
}
