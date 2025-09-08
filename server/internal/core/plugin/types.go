package plugin

import (
	"context"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// PluginType represents the type of plugin
type PluginType string

const (
	PluginTypeField      PluginType = "field"       // 字段类型插件
	PluginTypeValidator  PluginType = "validator"   // 验证器插件
	PluginTypeConnector  PluginType = "connector"   // 连接器插件
	PluginTypeProcessor  PluginType = "processor"   // 数据处理插件
	PluginTypeExporter   PluginType = "exporter"    // 导出器插件
	PluginTypeImporter   PluginType = "importer"    // 导入器插件
	PluginTypeNotifier   PluginType = "notifier"    // 通知器插件
	PluginTypeExtension  PluginType = "extension"   // 扩展插件
)

// PluginStatus represents the status of a plugin
type PluginStatus string

const (
	PluginStatusInstalled PluginStatus = "installed"
	PluginStatusEnabled   PluginStatus = "enabled"
	PluginStatusDisabled  PluginStatus = "disabled"
	PluginStatusError     PluginStatus = "error"
)

// PluginManifest represents plugin metadata
type PluginManifest struct {
	ID          string            `json:"id" yaml:"id"`
	Name        string            `json:"name" yaml:"name"`
	Version     string            `json:"version" yaml:"version"`
	Description string            `json:"description" yaml:"description"`
	Author      string            `json:"author" yaml:"author"`
	Homepage    string            `json:"homepage" yaml:"homepage"`
	License     string            `json:"license" yaml:"license"`
	Type        PluginType        `json:"type" yaml:"type"`
	Tags        []string          `json:"tags" yaml:"tags"`
	Keywords    []string          `json:"keywords" yaml:"keywords"`
	
	// Dependencies
	Dependencies map[string]string `json:"dependencies" yaml:"dependencies"`
	MinVersion   string            `json:"min_version" yaml:"min_version"`
	MaxVersion   string            `json:"max_version" yaml:"max_version"`
	
	// Configuration
	Config       *PluginConfig     `json:"config,omitempty" yaml:"config,omitempty"`
	Permissions  []string          `json:"permissions" yaml:"permissions"`
	Resources    *PluginResources  `json:"resources,omitempty" yaml:"resources,omitempty"`
	
	// Hooks and events
	Hooks        []string          `json:"hooks" yaml:"hooks"`
	Events       []string          `json:"events" yaml:"events"`
	
	// Installation
	InstallPath  string            `json:"install_path" yaml:"install_path"`
	Binary       string            `json:"binary" yaml:"binary"`
	Entrypoint   string            `json:"entrypoint" yaml:"entrypoint"`
	
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// PluginConfig represents plugin configuration schema
type PluginConfig struct {
	Schema     types.JSON `json:"schema"`
	Default    types.JSON `json:"default"`
	Required   []string   `json:"required"`
	Properties types.JSON `json:"properties"`
}

// PluginResources represents plugin resource limits
type PluginResources struct {
	Memory    string `json:"memory" yaml:"memory"`
	CPU       string `json:"cpu" yaml:"cpu"`
	Disk      string `json:"disk" yaml:"disk"`
	Network   bool   `json:"network" yaml:"network"`
	Timeout   string `json:"timeout" yaml:"timeout"`
}

// PluginInstance represents a running plugin instance
type PluginInstance struct {
	ID         string                 `json:"id"`
	PluginID   string                 `json:"plugin_id"`
	TenantID   string                 `json:"tenant_id"`
	Name       string                 `json:"name"`
	Status     PluginStatus           `json:"status"`
	Config     types.JSON             `json:"config"`
	Context    map[string]interface{} `json:"context"`
	
	// Runtime information
	PID        int                    `json:"pid,omitempty"`
	Port       int                    `json:"port,omitempty"`
	Address    string                 `json:"address,omitempty"`
	StartedAt  *time.Time             `json:"started_at,omitempty"`
	StoppedAt  *time.Time             `json:"stopped_at,omitempty"`
	
	// Statistics
	Stats      *PluginStats           `json:"stats,omitempty"`
	
	CreatedAt  time.Time              `json:"created_at"`
	UpdatedAt  time.Time              `json:"updated_at"`
}

// PluginStats represents plugin runtime statistics
type PluginStats struct {
	Uptime        time.Duration `json:"uptime"`
	RequestCount  int64         `json:"request_count"`
	ErrorCount    int64         `json:"error_count"`
	LastRequest   *time.Time    `json:"last_request,omitempty"`
	LastError     *time.Time    `json:"last_error,omitempty"`
	MemoryUsage   int64         `json:"memory_usage"`
	CPUUsage      float64       `json:"cpu_usage"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// Plugin represents the core plugin interface
type Plugin interface {
	// Metadata
	ID() string
	Name() string
	Version() string
	Type() PluginType
	
	// Lifecycle
	Initialize(ctx context.Context, config types.JSON) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	Health(ctx context.Context) error
	
	// Configuration
	Configure(ctx context.Context, config types.JSON) error
	GetConfig() types.JSON
	Validate(config types.JSON) error
}

// FieldPlugin represents a field type plugin
type FieldPlugin interface {
	Plugin
	
	// Field operations
	ValidateValue(ctx context.Context, value interface{}, options types.JSON) error
	FormatValue(ctx context.Context, value interface{}, options types.JSON) (interface{}, error)
	ParseValue(ctx context.Context, input string, options types.JSON) (interface{}, error)
	GetDefaultValue(ctx context.Context, options types.JSON) interface{}
	
	// Field metadata
	GetFieldSchema() types.JSON
	GetSupportedOperators() []string
}

// ValidatorPlugin represents a validation plugin
type ValidatorPlugin interface {
	Plugin
	
	// Validation operations
	ValidateModel(ctx context.Context, model interface{}) []ValidationError
	ValidateInstance(ctx context.Context, instance interface{}) []ValidationError
	ValidateField(ctx context.Context, field interface{}, value interface{}) []ValidationError
	
	// Validation configuration
	GetValidationRules() []ValidationRule
}

// ConnectorPlugin represents a data connector plugin
type ConnectorPlugin interface {
	Plugin
	
	// Connection operations
	Connect(ctx context.Context) error
	Disconnect(ctx context.Context) error
	Test(ctx context.Context) error
	
	// Data operations
	Fetch(ctx context.Context, query interface{}) ([]interface{}, error)
	Push(ctx context.Context, data []interface{}) error
	Sync(ctx context.Context, options types.JSON) error
	
	// Metadata
	GetSchema() types.JSON
	GetCapabilities() []string
}

// ProcessorPlugin represents a data processing plugin
type ProcessorPlugin interface {
	Plugin
	
	// Processing operations
	Process(ctx context.Context, input interface{}) (interface{}, error)
	ProcessBatch(ctx context.Context, inputs []interface{}) ([]interface{}, error)
	Transform(ctx context.Context, data interface{}, rules types.JSON) (interface{}, error)
	
	// Processing metadata
	GetSupportedFormats() []string
	GetProcessingSteps() []ProcessingStep
}

// ExporterPlugin represents an export plugin
type ExporterPlugin interface {
	Plugin
	
	// Export operations
	Export(ctx context.Context, data interface{}, format string, options types.JSON) ([]byte, error)
	ExportStream(ctx context.Context, data <-chan interface{}, format string, options types.JSON) (<-chan []byte, error)
	
	// Export metadata
	GetSupportedFormats() []string
	GetFormatOptions(format string) types.JSON
}

// ImporterPlugin represents an import plugin
type ImporterPlugin interface {
	Plugin
	
	// Import operations
	Import(ctx context.Context, data []byte, format string, options types.JSON) ([]interface{}, error)
	ImportStream(ctx context.Context, data <-chan []byte, format string, options types.JSON) (<-chan interface{}, error)
	
	// Import metadata
	GetSupportedFormats() []string
	GetFormatSchema(format string) types.JSON
}

// NotifierPlugin represents a notification plugin
type NotifierPlugin interface {
	Plugin
	
	// Notification operations
	Send(ctx context.Context, notification Notification) error
	SendBatch(ctx context.Context, notifications []Notification) error
	
	// Channel management
	CreateChannel(ctx context.Context, channel NotificationChannel) error
	UpdateChannel(ctx context.Context, channelID string, channel NotificationChannel) error
	DeleteChannel(ctx context.Context, channelID string) error
	
	// Notification metadata
	GetSupportedTypes() []string
	GetChannelSchema() types.JSON
}

// ExtensionPlugin represents a general extension plugin
type ExtensionPlugin interface {
	Plugin
	
	// Extension operations
	Execute(ctx context.Context, operation string, params types.JSON) (interface{}, error)
	GetOperations() []PluginOperation
	
	// Hook handling
	HandleHook(ctx context.Context, hook string, data interface{}) error
	GetHooks() []string
}

// Hook represents a plugin hook
type Hook interface {
	Name() string
	Execute(ctx context.Context, data interface{}) error
	Priority() int
}

// Event represents a plugin event
type Event struct {
	Type      string                 `json:"type"`
	Source    string                 `json:"source"`
	Target    string                 `json:"target,omitempty"`
	Data      interface{}            `json:"data"`
	Metadata  map[string]interface{} `json:"metadata"`
	Timestamp time.Time              `json:"timestamp"`
}

// ValidationError represents a validation error
type ValidationError struct {
	Field   string `json:"field"`
	Code    string `json:"code"`
	Message string `json:"message"`
	Value   interface{} `json:"value,omitempty"`
}

// ValidationRule represents a validation rule
type ValidationRule struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Type        string     `json:"type"`
	Parameters  types.JSON `json:"parameters"`
	Severity    string     `json:"severity"`
}

// ProcessingStep represents a processing step
type ProcessingStep struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Input       types.JSON `json:"input"`
	Output      types.JSON `json:"output"`
	Options     types.JSON `json:"options"`
}

// PluginOperation represents an operation exposed by a plugin
type PluginOperation struct {
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Method      string     `json:"method"`
	Path        string     `json:"path"`
	Input       types.JSON `json:"input"`
	Output      types.JSON `json:"output"`
	Parameters  types.JSON `json:"parameters"`
}

// Notification represents a notification message
type Notification struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Title       string                 `json:"title"`
	Message     string                 `json:"message"`
	Recipients  []string               `json:"recipients"`
	Channels    []string               `json:"channels"`
	Priority    string                 `json:"priority"`
	Data        map[string]interface{} `json:"data"`
	Metadata    map[string]interface{} `json:"metadata"`
	ScheduledAt *time.Time             `json:"scheduled_at,omitempty"`
	ExpiresAt   *time.Time             `json:"expires_at,omitempty"`
}

// NotificationChannel represents a notification channel
type NotificationChannel struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Type        string     `json:"type"`
	Config      types.JSON `json:"config"`
	IsEnabled   bool       `json:"is_enabled"`
	Description string     `json:"description"`
}

// PluginError represents a plugin-specific error
type PluginError struct {
	PluginID  string `json:"plugin_id"`
	Code      string `json:"code"`
	Message   string `json:"message"`
	Details   string `json:"details,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

func (e *PluginError) Error() string {
	return e.Message
}

// Context keys for plugin context
type contextKey string

const (
	ContextKeyTenantID contextKey = "tenant_id"
	ContextKeyUserID   contextKey = "user_id"
	ContextKeySession  contextKey = "session_id"
	ContextKeyTrace    contextKey = "trace_id"
)