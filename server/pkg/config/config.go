package config

import (
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

// Config represents the application configuration
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	Auth     AuthConfig     `yaml:"auth"`
	Log      LogConfig      `yaml:"log"`
	Plugins  PluginsConfig  `yaml:"plugins"`
	Events   EventsConfig   `yaml:"events"`
}

// ServerConfig represents server configuration
type ServerConfig struct {
	Host         string        `yaml:"host" env:"SERVER_HOST"`
	Port         int           `yaml:"port" env:"SERVER_PORT"`
	Mode         string        `yaml:"mode" env:"SERVER_MODE"` // debug, release, test
	ReadTimeout  time.Duration `yaml:"read_timeout" env:"SERVER_READ_TIMEOUT"`
	WriteTimeout time.Duration `yaml:"write_timeout" env:"SERVER_WRITE_TIMEOUT"`
	IdleTimeout  time.Duration `yaml:"idle_timeout" env:"SERVER_IDLE_TIMEOUT"`
	CORS         CORSConfig    `yaml:"cors"`
	TLS          TLSConfig     `yaml:"tls"`
}

// CORSConfig represents CORS configuration
type CORSConfig struct {
	Enabled        bool     `yaml:"enabled" env:"CORS_ENABLED"`
	AllowOrigins   []string `yaml:"allow_origins" env:"CORS_ALLOW_ORIGINS"`
	AllowMethods   []string `yaml:"allow_methods" env:"CORS_ALLOW_METHODS"`
	AllowHeaders   []string `yaml:"allow_headers" env:"CORS_ALLOW_HEADERS"`
	ExposeHeaders  []string `yaml:"expose_headers" env:"CORS_EXPOSE_HEADERS"`
	AllowCredentials bool   `yaml:"allow_credentials" env:"CORS_ALLOW_CREDENTIALS"`
	MaxAge         int      `yaml:"max_age" env:"CORS_MAX_AGE"`
}

// TLSConfig represents TLS configuration
type TLSConfig struct {
	Enabled  bool   `yaml:"enabled" env:"TLS_ENABLED"`
	CertFile string `yaml:"cert_file" env:"TLS_CERT_FILE"`
	KeyFile  string `yaml:"key_file" env:"TLS_KEY_FILE"`
}

// DatabaseConfig represents database configuration
type DatabaseConfig struct {
    Driver   string `yaml:"driver" env:"DB_DRIVER"` // postgres | sqlite
    Host     string `yaml:"host" env:"DB_HOST"`
    Port     int    `yaml:"port" env:"DB_PORT"`
    User     string `yaml:"user" env:"DB_USER"`
    Password string `yaml:"password" env:"DB_PASSWORD"`
    Name     string `yaml:"name" env:"DB_NAME"`
    SSLMode  string `yaml:"ssl_mode" env:"DB_SSL_MODE"`
    Timezone string `yaml:"timezone" env:"DB_TIMEZONE"`
	
	// Connection pool settings
	MaxOpenConns    int           `yaml:"max_open_conns" env:"DB_MAX_OPEN_CONNS"`
	MaxIdleConns    int           `yaml:"max_idle_conns" env:"DB_MAX_IDLE_CONNS"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime" env:"DB_CONN_MAX_LIFETIME"`
	ConnMaxIdleTime time.Duration `yaml:"conn_max_idle_time" env:"DB_CONN_MAX_IDLE_TIME"`
	
	// Migration settings
	MigrationsPath string `yaml:"migrations_path" env:"DB_MIGRATIONS_PATH"`
	AutoMigrate    bool   `yaml:"auto_migrate" env:"DB_AUTO_MIGRATE"`
}

// RedisConfig represents Redis configuration
type RedisConfig struct {
	Enabled    bool          `yaml:"enabled" env:"REDIS_ENABLED"`
	Host       string        `yaml:"host" env:"REDIS_HOST"`
	Port       int           `yaml:"port" env:"REDIS_PORT"`
	Password   string        `yaml:"password" env:"REDIS_PASSWORD"`
	DB         int           `yaml:"db" env:"REDIS_DB"`
	PoolSize   int           `yaml:"pool_size" env:"REDIS_POOL_SIZE"`
	MinIdleConns int         `yaml:"min_idle_conns" env:"REDIS_MIN_IDLE_CONNS"`
	MaxRetries int           `yaml:"max_retries" env:"REDIS_MAX_RETRIES"`
	DialTimeout time.Duration `yaml:"dial_timeout" env:"REDIS_DIAL_TIMEOUT"`
	ReadTimeout time.Duration `yaml:"read_timeout" env:"REDIS_READ_TIMEOUT"`
	WriteTimeout time.Duration `yaml:"write_timeout" env:"REDIS_WRITE_TIMEOUT"`
	IdleTimeout time.Duration `yaml:"idle_timeout" env:"REDIS_IDLE_TIMEOUT"`
}

// AuthConfig represents authentication configuration
type AuthConfig struct {
	JWT          JWTConfig    `yaml:"jwt"`
	PasswordHash PasswordConfig `yaml:"password"`
	Session      SessionConfig `yaml:"session"`
}

// JWTConfig represents JWT configuration
type JWTConfig struct {
	Secret              string        `yaml:"secret" env:"JWT_SECRET"`
	Issuer              string        `yaml:"issuer" env:"JWT_ISSUER"`
	AccessTokenExpiry   time.Duration `yaml:"access_token_expiry" env:"JWT_ACCESS_TOKEN_EXPIRY"`
	RefreshTokenExpiry  time.Duration `yaml:"refresh_token_expiry" env:"JWT_REFRESH_TOKEN_EXPIRY"`
	RefreshTokenEnabled bool          `yaml:"refresh_token_enabled" env:"JWT_REFRESH_TOKEN_ENABLED"`
}

// PasswordConfig represents password hashing configuration
type PasswordConfig struct {
	Algorithm string `yaml:"algorithm" env:"PASSWORD_ALGORITHM"` // bcrypt, argon2id
	Cost      int    `yaml:"cost" env:"PASSWORD_COST"`           // bcrypt cost or argon2id iterations
}

// SessionConfig represents session configuration
type SessionConfig struct {
	Timeout    time.Duration `yaml:"timeout" env:"SESSION_TIMEOUT"`
	MaxSessions int          `yaml:"max_sessions" env:"SESSION_MAX_SESSIONS"`
}

// LogConfig represents logging configuration
type LogConfig struct {
	Level      string `yaml:"level" env:"LOG_LEVEL"`           // debug, info, warn, error
	Format     string `yaml:"format" env:"LOG_FORMAT"`         // json, text
	Output     string `yaml:"output" env:"LOG_OUTPUT"`         // stdout, stderr, file
	Filename   string `yaml:"filename" env:"LOG_FILENAME"`
	MaxSize    int    `yaml:"max_size" env:"LOG_MAX_SIZE"`     // MB
	MaxBackups int    `yaml:"max_backups" env:"LOG_MAX_BACKUPS"`
	MaxAge     int    `yaml:"max_age" env:"LOG_MAX_AGE"`       // days
	Compress   bool   `yaml:"compress" env:"LOG_COMPRESS"`
}

// PluginsConfig represents plugins configuration
type PluginsConfig struct {
	Enabled bool              `yaml:"enabled" env:"PLUGINS_ENABLED"`
	Dir     string            `yaml:"dir" env:"PLUGINS_DIR"`
	Timeout time.Duration     `yaml:"timeout" env:"PLUGINS_TIMEOUT"`
	Plugins map[string]PluginConfig `yaml:"plugins"`
}

// PluginConfig represents individual plugin configuration
type PluginConfig struct {
	Enabled    bool                   `yaml:"enabled"`
	Path       string                 `yaml:"path"`
	Args       []string               `yaml:"args"`
	Env        map[string]string      `yaml:"env"`
	Config     map[string]interface{} `yaml:"config"`
	HealthCheck HealthCheckConfig     `yaml:"health_check"`
}

// HealthCheckConfig represents plugin health check configuration
type HealthCheckConfig struct {
	Enabled  bool          `yaml:"enabled"`
	Interval time.Duration `yaml:"interval"`
	Timeout  time.Duration `yaml:"timeout"`
	Retries  int           `yaml:"retries"`
}

// EventsConfig represents events configuration
type EventsConfig struct {
	Enabled        bool               `yaml:"enabled" env:"EVENTS_ENABLED"`
	QueueSize      int                `yaml:"queue_size" env:"EVENTS_QUEUE_SIZE"`
	Workers        int                `yaml:"workers" env:"EVENTS_WORKERS"`
	RetryAttempts  int                `yaml:"retry_attempts" env:"EVENTS_RETRY_ATTEMPTS"`
	RetryDelay     time.Duration      `yaml:"retry_delay" env:"EVENTS_RETRY_DELAY"`
	BatchSize      int                `yaml:"batch_size" env:"EVENTS_BATCH_SIZE"`
	BatchTimeout   time.Duration      `yaml:"batch_timeout" env:"EVENTS_BATCH_TIMEOUT"`
	DeadLetterQueue bool              `yaml:"dead_letter_queue" env:"EVENTS_DEAD_LETTER_QUEUE"`
	Brokers        map[string]BrokerConfig `yaml:"brokers"`
}

// BrokerConfig represents message broker configuration
type BrokerConfig struct {
	Type    string                 `yaml:"type"` // memory, redis, kafka, nats
	Enabled bool                   `yaml:"enabled"`
	Config  map[string]interface{} `yaml:"config"`
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
	if err := v.Unmarshal(&config); err != nil {
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
	
	// TLS defaults
	v.SetDefault("server.tls.enabled", false)
	
    // Database defaults
    v.SetDefault("database.driver", "postgres")
    v.SetDefault("database.host", "localhost")
    v.SetDefault("database.port", 5432)
    v.SetDefault("database.user", "cmdb")
    v.SetDefault("database.name", "cmdb")
    v.SetDefault("database.ssl_mode", "disable")
	v.SetDefault("database.timezone", "UTC")
	v.SetDefault("database.max_open_conns", 100)
	v.SetDefault("database.max_idle_conns", 10)
	v.SetDefault("database.conn_max_lifetime", "1h")
	v.SetDefault("database.conn_max_idle_time", "15m")
	v.SetDefault("database.migrations_path", "./migrations")
	v.SetDefault("database.auto_migrate", false)
	
	// Redis defaults
	v.SetDefault("redis.enabled", false)
	v.SetDefault("redis.host", "localhost")
	v.SetDefault("redis.port", 6379)
	v.SetDefault("redis.db", 0)
	v.SetDefault("redis.pool_size", 10)
	v.SetDefault("redis.min_idle_conns", 2)
	v.SetDefault("redis.max_retries", 3)
	v.SetDefault("redis.dial_timeout", "5s")
	v.SetDefault("redis.read_timeout", "3s")
	v.SetDefault("redis.write_timeout", "3s")
	v.SetDefault("redis.idle_timeout", "5m")
	
	// Auth defaults
	v.SetDefault("auth.jwt.secret", "dev-secret-please-change-1234567890-abcdef")
	v.SetDefault("auth.jwt.issuer", "wend-cmdb")
	v.SetDefault("auth.jwt.access_token_expiry", "24h")
	v.SetDefault("auth.jwt.refresh_token_expiry", "168h") // 7 days
	v.SetDefault("auth.jwt.refresh_token_enabled", true)
	v.SetDefault("auth.password.algorithm", "bcrypt")
	v.SetDefault("auth.password.cost", 12)
	v.SetDefault("auth.session.timeout", "24h")
	v.SetDefault("auth.session.max_sessions", 5)
	
	// Log defaults
	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")
	v.SetDefault("log.output", "stdout")
	v.SetDefault("log.max_size", 100)
	v.SetDefault("log.max_backups", 3)
	v.SetDefault("log.max_age", 7)
	v.SetDefault("log.compress", true)
	
	// Plugins defaults
	v.SetDefault("plugins.enabled", false)
	v.SetDefault("plugins.dir", "./plugins")
	v.SetDefault("plugins.timeout", "30s")
	
	// Events defaults
	v.SetDefault("events.enabled", true)
	v.SetDefault("events.queue_size", 1000)
	v.SetDefault("events.workers", 4)
	v.SetDefault("events.retry_attempts", 3)
	v.SetDefault("events.retry_delay", "5s")
	v.SetDefault("events.batch_size", 10)
	v.SetDefault("events.batch_timeout", "5s")
	v.SetDefault("events.dead_letter_queue", true)
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

// GetSQLiteDSN builds a SQLite DSN from config. Uses Name as file path when driver=sqlite.
func (c *DatabaseConfig) GetSQLiteDSN() string {
    path := c.Name
    if path == "" {
        path = "./data/cmdb.db"
    }
    // shared cache, WAL, foreign keys on
    return fmt.Sprintf("file:%s?cache=shared&_journal_mode=WAL&_foreign_keys=on", path)
}

// GetAddress returns the server address
func (c *ServerConfig) GetAddress() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

// GetRedisAddress returns the Redis address
func (c *RedisConfig) GetAddress() string {
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
