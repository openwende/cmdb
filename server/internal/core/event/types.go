package event

import (
	"encoding/json"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// EventType represents the type of event
type EventType string

const (
	// Model events
	EventTypeModelCreated EventType = "model.created"
	EventTypeModelUpdated EventType = "model.updated"
	EventTypeModelDeleted EventType = "model.deleted"

	// Instance events
	EventTypeInstanceCreated EventType = "instance.created"
	EventTypeInstanceUpdated EventType = "instance.updated"
	EventTypeInstanceDeleted EventType = "instance.deleted"

	// Relationship events
	EventTypeRelationshipCreated EventType = "relationship.created"
	EventTypeRelationshipUpdated EventType = "relationship.updated"
	EventTypeRelationshipDeleted EventType = "relationship.deleted"

	// System events
	EventTypeSystemStartup  EventType = "system.startup"
	EventTypeSystemShutdown EventType = "system.shutdown"
	EventTypeSystemError    EventType = "system.error"

	// Plugin events
	EventTypePluginInstalled EventType = "plugin.installed"
	EventTypePluginEnabled   EventType = "plugin.enabled"
	EventTypePluginDisabled  EventType = "plugin.disabled"
	EventTypePluginError     EventType = "plugin.error"

	// User events
	EventTypeUserLogin  EventType = "user.login"
	EventTypeUserLogout EventType = "user.logout"
	EventTypeUserAction EventType = "user.action"

	// Audit events
	EventTypeAuditLog EventType = "audit.log"
)

// EventSeverity represents the severity level of an event
type EventSeverity string

const (
	EventSeverityInfo     EventSeverity = "info"
	EventSeverityWarning  EventSeverity = "warning"
	EventSeverityError    EventSeverity = "error"
	EventSeverityCritical EventSeverity = "critical"
)

// EventSource identifies where the event originated
type EventSource struct {
	Type       string `json:"type"`        // system, user, plugin
	ID         string `json:"id"`          // user ID, plugin ID, etc.
	Name       string `json:"name"`        // display name
	IP         string `json:"ip"`          // source IP address
	UserAgent  string `json:"user_agent"`  // user agent string
	SessionID  string `json:"session_id"`  // session identifier
}

// Event represents a system event
type Event struct {
	ID          string         `json:"id"`
	Type        EventType      `json:"type"`
	Severity    EventSeverity  `json:"severity"`
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Source      *EventSource   `json:"source"`
	Timestamp   time.Time      `json:"timestamp"`
	TenantID    string         `json:"tenant_id"`
	UserID      string         `json:"user_id"`
	ResourceID  string         `json:"resource_id"`
	ResourceType string        `json:"resource_type"`
	Metadata    types.JSON     `json:"metadata"`
	Tags        []string       `json:"tags"`
	
	// Notification tracking
	NotificationsSent map[string]time.Time `json:"notifications_sent,omitempty"`
	
	// System fields
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// NotificationType represents different notification delivery methods
type NotificationType string

const (
	NotificationTypeEmail     NotificationType = "email"
	NotificationTypeSMS       NotificationType = "sms"
	NotificationTypeWebhook   NotificationType = "webhook"
	NotificationTypeSlack     NotificationType = "slack"
	NotificationTypeDingTalk  NotificationType = "dingtalk"
	NotificationTypeWechat    NotificationType = "wechat"
	NotificationTypePush      NotificationType = "push"
	NotificationTypeWebSocket NotificationType = "websocket"
)

// NotificationStatus represents the status of a notification
type NotificationStatus string

const (
	NotificationStatusPending   NotificationStatus = "pending"
	NotificationStatusSending   NotificationStatus = "sending"
	NotificationStatusSent      NotificationStatus = "sent"
	NotificationStatusDelivered NotificationStatus = "delivered"
	NotificationStatusFailed    NotificationStatus = "failed"
	NotificationStatusRetrying  NotificationStatus = "retrying"
)

// NotificationChannel represents a notification channel configuration
type NotificationChannel struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Type        NotificationType       `json:"type"`
	Enabled     bool                   `json:"enabled"`
	Config      types.JSON             `json:"config"`
	Recipients  []string               `json:"recipients"`
	EventTypes  []EventType            `json:"event_types"`
	Severities  []EventSeverity        `json:"severities"`
	Conditions  []NotificationCondition `json:"conditions"`
	RateLimit   *RateLimitConfig       `json:"rate_limit"`
	TenantID    string                 `json:"tenant_id"`
	PluginID    string                 `json:"plugin_id,omitempty"`
	CreatedAt   time.Time              `json:"created_at"`
	UpdatedAt   time.Time              `json:"updated_at"`
}

// NotificationCondition represents a condition for sending notifications
type NotificationCondition struct {
	Field    string      `json:"field"`     // e.g., "source.type", "metadata.priority"
	Operator string      `json:"operator"`  // eq, ne, in, not_in, contains, regex
	Value    interface{} `json:"value"`
}

// RateLimitConfig represents rate limiting configuration
type RateLimitConfig struct {
	MaxCount int           `json:"max_count"` // maximum number of notifications
	Duration time.Duration `json:"duration"`  // time window
	Enabled  bool          `json:"enabled"`
}

// Notification represents a notification to be sent
type Notification struct {
	ID          string             `json:"id"`
	EventID     string             `json:"event_id"`
	ChannelID   string             `json:"channel_id"`
	Type        NotificationType   `json:"type"`
	Status      NotificationStatus `json:"status"`
	Recipients  []string           `json:"recipients"`
	Subject     string             `json:"subject"`
	Content     string             `json:"content"`
	Template    string             `json:"template"`
	Variables   types.JSON         `json:"variables"`
	Metadata    types.JSON         `json:"metadata"`
	RetryCount  int                `json:"retry_count"`
	MaxRetries  int                `json:"max_retries"`
	LastError   string             `json:"last_error,omitempty"`
	SentAt      *time.Time         `json:"sent_at"`
	DeliveredAt *time.Time         `json:"delivered_at"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
}

// EventFilter represents criteria for filtering events
type EventFilter struct {
	Types        []EventType       `json:"types"`
	Severities   []EventSeverity   `json:"severities"`
	Sources      []string          `json:"sources"`
	TenantID     string            `json:"tenant_id"`
	UserID       string            `json:"user_id"`
	ResourceType string            `json:"resource_type"`
	ResourceID   string            `json:"resource_id"`
	StartTime    *time.Time        `json:"start_time"`
	EndTime      *time.Time        `json:"end_time"`
	Tags         []string          `json:"tags"`
	Metadata     map[string]string `json:"metadata"`
}

// EventHandler defines the interface for handling events
type EventHandler interface {
	Handle(event *Event) error
	CanHandle(eventType EventType) bool
	Priority() int
}

// EventStore defines the interface for storing events
type EventStore interface {
	Store(event *Event) error
	Get(id string) (*Event, error)
	List(filter *EventFilter) ([]*Event, error)
	Delete(id string) error
	Cleanup(before time.Time) error
}

// NotificationStore defines the interface for storing notifications
type NotificationStore interface {
	Store(notification *Notification) error
	Get(id string) (*Notification, error)
	GetByEventID(eventID string) ([]*Notification, error)
	List(filter *NotificationFilter) ([]*Notification, error)
	UpdateStatus(id string, status NotificationStatus, metadata types.JSON) error
	Delete(id string) error
	Cleanup(before time.Time) error
}

// NotificationFilter represents criteria for filtering notifications
type NotificationFilter struct {
	EventID     string               `json:"event_id"`
	ChannelID   string               `json:"channel_id"`
	Type        NotificationType     `json:"type"`
	Status      []NotificationStatus `json:"status"`
	Recipients  []string             `json:"recipients"`
	StartTime   *time.Time           `json:"start_time"`
	EndTime     *time.Time           `json:"end_time"`
}

// EventBus defines the interface for event publishing and subscribing
type EventBus interface {
	Publish(event *Event) error
	Subscribe(eventType EventType, handler EventHandler) error
	Unsubscribe(eventType EventType, handler EventHandler) error
	Start() error
	Stop() error
}

// NotificationDeliverer defines the interface for delivering notifications
type NotificationDeliverer interface {
	Deliver(notification *Notification) error
	GetType() NotificationType
	ValidateConfig(config types.JSON) error
}

// WebSocketManager manages WebSocket connections for real-time notifications
type WebSocketManager interface {
	AddConnection(userID, sessionID string, conn interface{}) error
	RemoveConnection(sessionID string) error
	Broadcast(event *Event) error
	SendToUser(userID string, event *Event) error
	SendToSession(sessionID string, event *Event) error
	GetConnections(userID string) []interface{}
}

// EventMetrics represents metrics for events and notifications
type EventMetrics struct {
	EventsPublished     int64            `json:"events_published"`
	EventsByType        map[string]int64 `json:"events_by_type"`
	EventsBySeverity    map[string]int64 `json:"events_by_severity"`
	NotificationsSent   int64            `json:"notifications_sent"`
	NotificationsFailed int64            `json:"notifications_failed"`
	NotificationsByType map[string]int64 `json:"notifications_by_type"`
	AverageLatency      time.Duration    `json:"average_latency"`
	LastUpdated         time.Time        `json:"last_updated"`
}

// EventTemplate represents a template for generating events
type EventTemplate struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Type        EventType     `json:"type"`
	Severity    EventSeverity `json:"severity"`
	Title       string        `json:"title"`
	Description string        `json:"description"`
	Tags        []string      `json:"tags"`
	Metadata    types.JSON    `json:"metadata"`
	TenantID    string        `json:"tenant_id"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// NotificationTemplate represents a template for notifications
type NotificationTemplate struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Type        NotificationType `json:"type"`
	Subject     string           `json:"subject"`
	Content     string           `json:"content"`
	Variables   []string         `json:"variables"`
	Language    string           `json:"language"`
	TenantID    string           `json:"tenant_id"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}