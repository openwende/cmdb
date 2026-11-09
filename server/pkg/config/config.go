package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/go-viper/mapstructure/v2"
	"github.com/spf13/viper"
)

const (
	// defaultJWTSecret lets local development start without configuration.
	// Release mode refuses it; see validate.
	defaultJWTSecret = "dev-secret-please-change-1234567890-abcdef"
	// exampleJWTSecret is the placeholder in config/config.example.yaml.
	exampleJWTSecret = "your-super-secret-jwt-key-at-least-32-characters-long"
)

// Config represents the application configuration
type Config struct {
	Server   ServerConfig   `yaml:"server" mapstructure:"server"`
	Database DatabaseConfig `yaml:"database" mapstructure:"database"`
	Auth     AuthConfig     `yaml:"auth" mapstructure:"auth"`
	Log      LogConfig      `yaml:"log" mapstructure:"log"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	Host         string        `yaml:"host" mapstructure:"host" env:"SERVER_HOST"`
	Port         int           `yaml:"port" mapstructure:"port" env:"SERVER_PORT"`
	Mode         string        `yaml:"mode" mapstructure:"mode" env:"SERVER_MODE"` // debug, release, test
	ReadTimeout  time.Duration `yaml:"read_timeout" mapstructure:"read_timeout" env:"SERVER_READ_TIMEOUT"`
	WriteTimeout time.Duration `yaml:"write_timeout" mapstructure:"write_timeout" env:"SERVER_WRITE_TIMEOUT"`
	IdleTimeout  time.Duration `yaml:"idle_timeout" mapstructure:"idle_timeout" env:"SERVER_IDLE_TIMEOUT"`
	CORS         CORSConfig    `yaml:"cors" mapstructure:"cors"`
}

// CORSConfig represents CORS configuration
type CORSConfig struct {
	Enabled          bool     `yaml:"enabled" env:"CORS_ENABLED"`
	AllowOrigins     []string `yaml:"allow_origins" env:"CORS_ALLOW_ORIGINS"`
	AllowMethods     []string `yaml:"allow_methods" env:"CORS_ALLOW_METHODS"`
	AllowHeaders     []string `yaml:"allow_headers" env:"CORS_ALLOW_HEADERS"`
	ExposeHeaders    []string `yaml:"expose_headers" env:"CORS_EXPOSE_HEADERS"`
	AllowCredentials bool     `yaml:"allow_credentials" env:"CORS_ALLOW_CREDENTIALS"`
	MaxAge           int      `yaml:"max_age" env:"CORS_MAX_AGE"`
}

// DatabaseConfig represents database configuration
// Only PostgreSQL is supported in this refactored version.
type DatabaseConfig struct {
	Host     string `yaml:"host" mapstructure:"host" env:"DB_HOST"`
	Port     int    `yaml:"port" mapstructure:"port" env:"DB_PORT"`
	User     string `yaml:"user" mapstructure:"user" env:"DB_USER"`
	Password string `yaml:"password" mapstructure:"password" env:"DB_PASSWORD"`
	Name     string `yaml:"name" mapstructure:"name" env:"DB_NAME"`
	SSLMode  string `yaml:"ssl_mode" mapstructure:"ssl_mode" env:"DB_SSL_MODE"`
	Timezone string `yaml:"timezone" mapstructure:"timezone" env:"DB_TIMEZONE"`

	// Connection pool settings
	MaxOpenConns    int           `yaml:"max_open_conns" mapstructure:"max_open_conns" env:"DB_MAX_OPEN_CONNS"`
	MaxIdleConns    int           `yaml:"max_idle_conns" mapstructure:"max_idle_conns" env:"DB_MAX_IDLE_CONNS"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime" mapstructure:"conn_max_lifetime" env:"DB_CONN_MAX_LIFETIME"`
	ConnMaxIdleTime time.Duration `yaml:"conn_max_idle_time" mapstructure:"conn_max_idle_time" env:"DB_CONN_MAX_IDLE_TIME"`

	// Migration settings
	MigrationsPath string `yaml:"migrations_path" mapstructure:"migrations_path" env:"DB_MIGRATIONS_PATH"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	JWT          JWTConfig       `yaml:"jwt" mapstructure:"jwt"`
	PasswordHash PasswordConfig  `yaml:"password" mapstructure:"password"`
	Session      SessionConfig   `yaml:"session" mapstructure:"session"`
	Bootstrap    BootstrapConfig `yaml:"bootstrap" mapstructure:"bootstrap"`
}

// BootstrapConfig controls which accounts are created on an empty database.
type BootstrapConfig struct {
	// AdminPassword is the initial admin password in release mode. When empty,
	// a random password is generated and logged once.
	AdminPassword string `yaml:"admin_password" mapstructure:"admin_password"`
	// SeedDemoUsers creates the demo accounts, whose passwords are in the source
	// code, in release mode. Only enable it for public demo sites.
	SeedDemoUsers bool `yaml:"seed_demo_users" mapstructure:"seed_demo_users"`
}

// JWTConfig represents JWT configuration
type JWTConfig struct {
	Secret              string        `yaml:"secret" mapstructure:"secret" env:"JWT_SECRET"`
	Issuer              string        `yaml:"issuer" mapstructure:"issuer" env:"JWT_ISSUER"`
	AccessTokenExpiry   time.Duration `yaml:"access_token_expiry" mapstructure:"access_token_expiry" env:"JWT_ACCESS_TOKEN_EXPIRY"`
	RefreshTokenExpiry  time.Duration `yaml:"refresh_token_expiry" mapstructure:"refresh_token_expiry" env:"JWT_REFRESH_TOKEN_EXPIRY"`
	RefreshTokenEnabled bool          `yaml:"refresh_token_enabled" mapstructure:"refresh_token_enabled" env:"JWT_REFRESH_TOKEN_ENABLED"`
}

// PasswordConfig represents password hashing configuration
type PasswordConfig struct {
	Algorithm string `yaml:"algorithm" mapstructure:"algorithm" env:"PASSWORD_ALGORITHM"` // bcrypt, argon2id
	Cost      int    `yaml:"cost" mapstructure:"cost" env:"PASSWORD_COST"`                // bcrypt cost or argon2id iterations
}

// SessionConfig represents session configuration
type SessionConfig struct {
	Timeout     time.Duration `yaml:"timeout" mapstructure:"timeout" env:"SESSION_TIMEOUT"`
	MaxSessions int           `yaml:"max_sessions" mapstructure:"max_sessions" env:"SESSION_MAX_SESSIONS"`
}

// LogConfig represents logging configuration
type LogConfig struct {
	Level      string `yaml:"level" env:"LOG_LEVEL"`   // debug, info, warn, error
	Format     string `yaml:"format" env:"LOG_FORMAT"` // json, text
	Output     string `yaml:"output" env:"LOG_OUTPUT"` // stdout, stderr, file
	Filename   string `yaml:"filename" env:"LOG_FILENAME"`
	MaxSize    int    `yaml:"max_size" env:"LOG_MAX_SIZE"` // MB
	MaxBackups int    `yaml:"max_backups" env:"LOG_MAX_BACKUPS"`
	MaxAge     int    `yaml:"max_age" env:"LOG_MAX_AGE"` // days
	Compress   bool   `yaml:"compress" env:"LOG_COMPRESS"`
}

// Load loads configuration from files and environment variables
func Load(configPath string) (*Config, error) {
	v := viper.New()

	// Set default values
	setDefaults(v)

	// Set config file path
	if configPath != "" {
		v.SetConfigFile(configPath)
	} else {
		v.SetConfigName("config")
		v.SetConfigType("yaml")
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
		v.AddConfigPath("/etc/cmdb")
	}

	// Read environment variables
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	// Read config file
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
	}

	// Unmarshal config
	var config Config
	if err := v.Unmarshal(&config, func(cfg *mapstructure.DecoderConfig) {
		cfg.DecodeHook = mapstructure.ComposeDecodeHookFunc(
			mapstructure.StringToTimeDurationHookFunc(),
		)
	}); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	// Validate config
	if err := validate(&config); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return &config, nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	// Server defaults
	v.SetDefault("server.host", "0.0.0.0")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.mode", "release")
	v.SetDefault("server.read_timeout", "10s")
	v.SetDefault("server.write_timeout", "10s")
	v.SetDefault("server.idle_timeout", "60s")

	// CORS defaults
	v.SetDefault("server.cors.enabled", true)
	v.SetDefault("server.cors.allow_origins", []string{"*"})
	v.SetDefault("server.cors.allow_methods", []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"})
	v.SetDefault("server.cors.allow_headers", []string{"*"})
	v.SetDefault("server.cors.allow_credentials", true)
	v.SetDefault("server.cors.max_age", 86400)

	// Database defaults
	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "cmdb")
	// Viper only reads environment variables for keys it knows about, so this
	// default is what makes DATABASE_PASSWORD work without a config file.
	v.SetDefault("database.password", "")
	v.SetDefault("database.name", "cmdb")
	v.SetDefault("database.ssl_mode", "disable")
	v.SetDefault("database.timezone", "UTC")
	v.SetDefault("database.max_open_conns", 100)
	v.SetDefault("database.max_idle_conns", 10)
	v.SetDefault("database.conn_max_lifetime", "1h")
	v.SetDefault("database.conn_max_idle_time", "15m")
	v.SetDefault("database.migrations_path", "./migrations")

	// Auth defaults
	v.SetDefault("auth.jwt.secret", defaultJWTSecret)
	v.SetDefault("auth.jwt.issuer", "wend-cmdb")
	v.SetDefault("auth.jwt.access_token_expiry", "24h")
	v.SetDefault("auth.jwt.refresh_token_expiry", "168h") // 7 days
	v.SetDefault("auth.jwt.refresh_token_enabled", true)
	v.SetDefault("auth.password.algorithm", "bcrypt")
	v.SetDefault("auth.password.cost", 12)
	v.SetDefault("auth.session.timeout", "24h")
	v.SetDefault("auth.session.max_sessions", 5)
	v.SetDefault("auth.bootstrap.admin_password", "")
	v.SetDefault("auth.bootstrap.seed_demo_users", false)

	// Log defaults
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")
	v.SetDefault("log.output", "stdout")
	v.SetDefault("log.max_size", 100)
	v.SetDefault("log.max_backups", 3)
	v.SetDefault("log.max_age", 7)
	v.SetDefault("log.compress", true)
}

// isPublishedJWTSecret reports whether secret is one of the values in this
// repository. Anyone can read them, so tokens signed with them can be forged.
func isPublishedJWTSecret(secret string) bool {
	return secret == defaultJWTSecret || secret == exampleJWTSecret
}

// validate validates the configuration
func validate(config *Config) error {
	// Validate server config
	if config.Server.Port <= 0 || config.Server.Port > 65535 {
		return fmt.Errorf("invalid server port: %d", config.Server.Port)
	}

	if config.Server.Mode != "debug" && config.Server.Mode != "release" && config.Server.Mode != "test" {
		return fmt.Errorf("invalid server mode: %s", config.Server.Mode)
	}

	// Validate database config
	if config.Database.Host == "" {
		return fmt.Errorf("database host is required")
	}

	if config.Database.User == "" {
		return fmt.Errorf("database user is required")
	}

	if config.Database.Name == "" {
		return fmt.Errorf("database name is required")
	}

	// Validate JWT config
	if config.Auth.JWT.Secret == "" {
		return fmt.Errorf("JWT secret is required")
	}

	if len(config.Auth.JWT.Secret) < 32 {
		return fmt.Errorf("JWT secret must be at least 32 characters")
	}

	if config.Server.Mode == "release" && isPublishedJWTSecret(config.Auth.JWT.Secret) {
		return fmt.Errorf("refusing to start in release mode with a JWT secret published in the source code: " +
			"set AUTH_JWT_SECRET to a random value of at least 32 characters (for example, the output of `openssl rand -hex 32`)")
	}

	if password := config.Auth.Bootstrap.AdminPassword; password != "" && len(password) < 12 {
		return fmt.Errorf("initial admin password must be at least 12 characters")
	}

	// Validate log config
	validLogLevels := map[string]bool{
		"debug": true, "info": true, "warn": true, "error": true,
	}
	if !validLogLevels[config.Log.Level] {
		return fmt.Errorf("invalid log level: %s", config.Log.Level)
	}

	validLogFormats := map[string]bool{
		"json": true, "text": true,
	}
	if !validLogFormats[config.Log.Format] {
		return fmt.Errorf("invalid log format: %s", config.Log.Format)
	}

	return nil
}

// GetDSN returns the database DSN string
func (c *DatabaseConfig) GetDSN() string {
	return fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s TimeZone=%s",
		c.Host, c.Port, c.User, c.Password, c.Name, c.SSLMode, c.Timezone)
}

// GetAddress returns the server address
func (c *ServerConfig) GetAddress() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.Server.Mode == "debug"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	return c.Server.Mode == "release"
}

// IsTest returns true if running in test mode
func (c *Config) IsTest() bool {
	return c.Server.Mode == "test"
}
