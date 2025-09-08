package types

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// AuditLog represents an audit log entry
type AuditLog struct {
	BaseModel
	TenantID      uuid.UUID       `json:"tenant_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	UserID        uuid.UUID       `json:"user_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	Action        AuditAction     `json:"action" gorm:"size:20;not null;index" validate:"required,oneof=create update delete read"`
	ResourceType  string          `json:"resource_type" gorm:"size:50;not null;index" validate:"required"`
	ResourceID    uuid.UUID       `json:"resource_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	ResourceName  string          `json:"resource_name" gorm:"size:200"`
	BusinessID    *uuid.UUID      `json:"business_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	ClientIP      string          `json:"client_ip" gorm:"size:45"`
	UserAgent     string          `json:"user_agent" gorm:"size:500"`
	RequestID     string          `json:"request_id" gorm:"size:100;index"`
	Changes       *AuditChanges   `json:"changes,omitempty" gorm:"type:jsonb"`
	Metadata      json.RawMessage `json:"metadata,omitempty" gorm:"type:jsonb"`
	Success       bool            `json:"success" gorm:"not null;index"`
	ErrorMessage  string          `json:"error_message,omitempty" gorm:"size:1000"`
}

// AuditChanges represents the changes made to a resource
type AuditChanges struct {
	Before map[string]interface{} `json:"before,omitempty"`
	After  map[string]interface{} `json:"after,omitempty"`
	Fields []string               `json:"fields,omitempty"` // List of changed fields
}

// Event represents a system event that can be pushed to external systems
type Event struct {
	BaseModel
	TenantID     uuid.UUID       `json:"tenant_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	Type         EventType       `json:"type" gorm:"size:50;not null;index" validate:"required"`
	Source       string          `json:"source" gorm:"size:100;not null" validate:"required"`
	ResourceType string          `json:"resource_type" gorm:"size:50;not null;index" validate:"required"`
	ResourceID   uuid.UUID       `json:"resource_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	BusinessID   *uuid.UUID      `json:"business_id,omitempty" gorm:"type:uuid;index" swaggertype:"string"`
	Payload      json.RawMessage `json:"payload" gorm:"type:jsonb;not null"`
	Status       EventStatus     `json:"status" gorm:"size:20;default:'pending';index" validate:"oneof=pending processing delivered failed"`
	RetryCount   int             `json:"retry_count" gorm:"default:0"`
	ProcessedAt  *time.Time      `json:"processed_at,omitempty"`
	ErrorMessage string          `json:"error_message,omitempty" gorm:"size:1000"`
}

// EventType represents the type of event
type EventType string

const (
	EventTypeCreate EventType = "create"
	EventTypeUpdate EventType = "update"
	EventTypeDelete EventType = "delete"
	EventTypeCustom EventType = "custom"
)

// EventStatus represents the status of an event
type EventStatus string

const (
	EventStatusPending    EventStatus = "pending"
	EventStatusProcessing EventStatus = "processing"
	EventStatusDelivered  EventStatus = "delivered"
	EventStatusFailed     EventStatus = "failed"
)

// EventSubscription represents a subscription to certain types of events
type EventSubscription struct {
	TenantModel
	Name         string               `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description  string               `json:"description" gorm:"size:500"`
	IsActive     bool                 `json:"is_active" gorm:"default:true"`
	EventTypes   []EventType          `json:"event_types" gorm:"type:text[];not null" swaggertype:"array,string"`
	ResourceTypes []string            `json:"resource_types" gorm:"type:text[];not null" swaggertype:"array,string"`
	BusinessIDs  []uuid.UUID          `json:"business_ids,omitempty" gorm:"type:uuid[]" swaggertype:"array,string"`
	Endpoint     EventEndpoint        `json:"endpoint" gorm:"type:jsonb;not null"`
	Filters      []EventFilter        `json:"filters,omitempty" gorm:"type:jsonb"`
	RetryPolicy  EventRetryPolicy     `json:"retry_policy" gorm:"type:jsonb"`
	LastDelivery *time.Time           `json:"last_delivery,omitempty"`
	DeliveryCount int64               `json:"delivery_count" gorm:"default:0"`
	FailureCount int64                `json:"failure_count" gorm:"default:0"`
}

// EventEndpoint represents an endpoint configuration for event delivery
type EventEndpoint struct {
	Type    string                 `json:"type" validate:"required,oneof=http webhook kafka redis"`
	Config  map[string]interface{} `json:"config" validate:"required"`
	Headers map[string]string      `json:"headers,omitempty"`
	Auth    *EndpointAuth          `json:"auth,omitempty"`
}

// EndpointAuth represents authentication configuration for endpoints
type EndpointAuth struct {
	Type   string                 `json:"type" validate:"required,oneof=none basic bearer token api_key"`
	Config map[string]interface{} `json:"config"`
}

// EventFilter represents a filter for event subscriptions
type EventFilter struct {
	Field    string      `json:"field" validate:"required"`
	Operator string      `json:"operator" validate:"required,oneof=eq ne in not_in like not_like"`
	Value    interface{} `json:"value" validate:"required"`
}

// EventRetryPolicy represents retry policy for failed event deliveries
type EventRetryPolicy struct {
	MaxRetries      int           `json:"max_retries" validate:"min=0,max=10"`
	InitialDelay    time.Duration `json:"initial_delay"`
	MaxDelay        time.Duration `json:"max_delay"`
	BackoffFactor   float64       `json:"backoff_factor" validate:"min=1.0,max=10.0"`
	DeadLetterQueue bool          `json:"dead_letter_queue"`
}

// EventDelivery represents a delivery attempt for an event
type EventDelivery struct {
	BaseModel
	EventID         uuid.UUID   `json:"event_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	SubscriptionID  uuid.UUID   `json:"subscription_id" gorm:"type:uuid;not null;index" swaggertype:"string"`
	Status          EventStatus `json:"status" gorm:"size:20;not null;index" validate:"required,oneof=pending processing delivered failed"`
	AttemptNumber   int         `json:"attempt_number" gorm:"not null"`
	ResponseCode    *int        `json:"response_code,omitempty"`
	ResponseBody    string      `json:"response_body,omitempty" gorm:"type:text"`
	ErrorMessage    string      `json:"error_message,omitempty" gorm:"size:1000"`
	DeliveredAt     *time.Time  `json:"delivered_at,omitempty"`
	NextRetryAt     *time.Time  `json:"next_retry_at,omitempty"`
	
	// Relationships
	Event        *Event             `json:"event,omitempty" gorm:"foreignKey:EventID"`
	Subscription *EventSubscription `json:"subscription,omitempty" gorm:"foreignKey:SubscriptionID"`
}

// AuditFilter represents filters for audit log queries
type AuditFilter struct {
	TenantID     *uuid.UUID    `json:"tenant_id,omitempty"`
	UserID       *uuid.UUID    `json:"user_id,omitempty"`
	Actions      []AuditAction `json:"actions,omitempty"`
	ResourceTypes []string     `json:"resource_types,omitempty"`
	ResourceID   *uuid.UUID    `json:"resource_id,omitempty"`
	BusinessID   *uuid.UUID    `json:"business_id,omitempty"`
	Success      *bool         `json:"success,omitempty"`
	DateFrom     *time.Time    `json:"date_from,omitempty"`
	DateTo       *time.Time    `json:"date_to,omitempty"`
}

// CreateAuditLog creates a new audit log entry
func CreateAuditLog(tenantID, userID, resourceID uuid.UUID, action AuditAction, resourceType, resourceName string) *AuditLog {
	return &AuditLog{
		BaseModel: BaseModel{
			ID:        uuid.New(),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			CreatedBy: userID,
		},
		TenantID:     tenantID,
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResourceName: resourceName,
		Success:      true,
	}
}

// WithBusinessID adds business ID to audit log
func (al *AuditLog) WithBusinessID(businessID uuid.UUID) *AuditLog {
	al.BusinessID = &businessID
	return al
}

// WithChanges adds changes to audit log
func (al *AuditLog) WithChanges(before, after map[string]interface{}) *AuditLog {
	if before != nil || after != nil {
		changes := &AuditChanges{
			Before: before,
			After:  after,
		}
		
		// Calculate changed fields
		if before != nil && after != nil {
			var changedFields []string
			for key, value := range after {
				if beforeValue, exists := before[key]; !exists || beforeValue != value {
					changedFields = append(changedFields, key)
				}
			}
			changes.Fields = changedFields
		}
		
		al.Changes = changes
	}
	return al
}

// WithError marks audit log as failed with error message
func (al *AuditLog) WithError(err error) *AuditLog {
	al.Success = false
	if err != nil {
		al.ErrorMessage = err.Error()
	}
	return al
}

// WithMetadata adds metadata to audit log
func (al *AuditLog) WithMetadata(metadata interface{}) *AuditLog {
	if metadata != nil {
		if data, err := json.Marshal(metadata); err == nil {
			al.Metadata = data
		}
	}
	return al
}

// WithRequest adds request information to audit log
func (al *AuditLog) WithRequest(clientIP, userAgent, requestID string) *AuditLog {
	al.ClientIP = clientIP
	al.UserAgent = userAgent
	al.RequestID = requestID
	return al
}

// TableNames for GORM
func (AuditLog) TableName() string         { return "audit_logs" }
func (Event) TableName() string            { return "events" }
func (EventSubscription) TableName() string { return "event_subscriptions" }
func (EventDelivery) TableName() string    { return "event_deliveries" }