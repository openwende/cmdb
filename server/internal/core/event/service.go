package event

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	"github.com/wend/cmdb-backend/internal/core/plugin"
	"github.com/wend/cmdb-backend/pkg/types"
)

// Service provides event and notification functionality
type Service struct {
	eventBus            EventBus
	eventStore          EventStore
	notificationStore   NotificationStore
	notificationManager *NotificationManager
	websocketManager    WebSocketManager
	pluginService       *plugin.Service
	logger              *zap.Logger
	started             bool
}

// NewService creates a new event service
func NewService(
	eventBus EventBus,
	eventStore EventStore,
	notificationStore NotificationStore,
	notificationManager *NotificationManager,
	websocketManager WebSocketManager,
	pluginService *plugin.Service,
	logger *zap.Logger,
) *Service {
	service := &Service{
		eventBus:            eventBus,
		eventStore:          eventStore,
		notificationStore:   notificationStore,
		notificationManager: notificationManager,
		websocketManager:    websocketManager,
		pluginService:       pluginService,
		logger:              logger,
	}

	// Register built-in event handlers
	service.registerBuiltinHandlers()

	return service
}

// Start starts the event service
func (s *Service) Start() error {
	if s.started {
		return fmt.Errorf("event service already started")
	}

	// Start event bus
	if err := s.eventBus.Start(); err != nil {
		return fmt.Errorf("failed to start event bus: %w", err)
	}

	// Start notification manager
	if err := s.notificationManager.Start(); err != nil {
		return fmt.Errorf("failed to start notification manager: %w", err)
	}

	// Start WebSocket manager
	if err := s.websocketManager.Start(); err != nil {
		return fmt.Errorf("failed to start WebSocket manager: %w", err)
	}

	s.started = true
	s.logger.Info("Event service started")

	// Publish system startup event
	s.PublishSystemEvent(EventTypeSystemStartup, "System started", "CMDB system has started successfully", nil)

	return nil
}

// Stop stops the event service
func (s *Service) Stop() error {
	if !s.started {
		return nil
	}

	// Publish system shutdown event
	s.PublishSystemEvent(EventTypeSystemShutdown, "System stopping", "CMDB system is shutting down", nil)

	// Stop WebSocket manager
	if err := s.websocketManager.Stop(); err != nil {
		s.logger.Error("Failed to stop WebSocket manager", zap.Error(err))
	}

	// Stop notification manager
	if err := s.notificationManager.Stop(); err != nil {
		s.logger.Error("Failed to stop notification manager", zap.Error(err))
	}

	// Stop event bus
	if err := s.eventBus.Stop(); err != nil {
		s.logger.Error("Failed to stop event bus", zap.Error(err))
	}

	s.started = false
	s.logger.Info("Event service stopped")
	return nil
}

// PublishEvent publishes an event
func (s *Service) PublishEvent(event *Event) error {
	// Store event
	if err := s.eventStore.Store(event); err != nil {
		s.logger.Error("Failed to store event", zap.String("event_id", event.ID), zap.Error(err))
		// Don't return error here as we still want to publish the event
	}

	// Publish to event bus
	if err := s.eventBus.Publish(event); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}

	s.logger.Debug("Event published",
		zap.String("id", event.ID),
		zap.String("type", string(event.Type)),
		zap.String("severity", string(event.Severity)))

	return nil
}

// PublishModelEvent publishes a model-related event
func (s *Service) PublishModelEvent(eventType EventType, modelID, modelName string, userID, tenantID string, metadata types.JSON) error {
	event := &Event{
		Type:         eventType,
		Severity:     EventSeverityInfo,
		Title:        fmt.Sprintf("Model %s", getActionFromEventType(eventType)),
		Description:  fmt.Sprintf("Model '%s' was %s", modelName, getActionFromEventType(eventType)),
		UserID:       userID,
		TenantID:     tenantID,
		ResourceID:   modelID,
		ResourceType: "model",
		Metadata:     metadata,
		Tags:         []string{"model", string(eventType)},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// PublishInstanceEvent publishes an instance-related event
func (s *Service) PublishInstanceEvent(eventType EventType, instanceID, modelName string, userID, tenantID string, metadata types.JSON) error {
	event := &Event{
		Type:         eventType,
		Severity:     EventSeverityInfo,
		Title:        fmt.Sprintf("Instance %s", getActionFromEventType(eventType)),
		Description:  fmt.Sprintf("Instance of model '%s' was %s", modelName, getActionFromEventType(eventType)),
		UserID:       userID,
		TenantID:     tenantID,
		ResourceID:   instanceID,
		ResourceType: "instance",
		Metadata:     metadata,
		Tags:         []string{"instance", string(eventType)},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// PublishRelationshipEvent publishes a relationship-related event
func (s *Service) PublishRelationshipEvent(eventType EventType, relationshipID, relationshipType string, userID, tenantID string, metadata types.JSON) error {
	event := &Event{
		Type:         eventType,
		Severity:     EventSeverityInfo,
		Title:        fmt.Sprintf("Relationship %s", getActionFromEventType(eventType)),
		Description:  fmt.Sprintf("Relationship of type '%s' was %s", relationshipType, getActionFromEventType(eventType)),
		UserID:       userID,
		TenantID:     tenantID,
		ResourceID:   relationshipID,
		ResourceType: "relationship",
		Metadata:     metadata,
		Tags:         []string{"relationship", string(eventType)},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// PublishUserEvent publishes a user-related event
func (s *Service) PublishUserEvent(eventType EventType, userID, userName, tenantID string, source *EventSource, metadata types.JSON) error {
	event := &Event{
		Type:         eventType,
		Severity:     EventSeverityInfo,
		Title:        fmt.Sprintf("User %s", getActionFromEventType(eventType)),
		Description:  fmt.Sprintf("User '%s' %s", userName, getActionFromEventType(eventType)),
		UserID:       userID,
		TenantID:     tenantID,
		ResourceID:   userID,
		ResourceType: "user",
		Source:       source,
		Metadata:     metadata,
		Tags:         []string{"user", string(eventType)},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// PublishSystemEvent publishes a system-related event
func (s *Service) PublishSystemEvent(eventType EventType, title, description string, metadata types.JSON) error {
	event := &Event{
		Type:         eventType,
		Severity:     EventSeverityInfo,
		Title:        title,
		Description:  description,
		ResourceType: "system",
		Metadata:     metadata,
		Tags:         []string{"system", string(eventType)},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// PublishPluginEvent publishes a plugin-related event
func (s *Service) PublishPluginEvent(eventType EventType, pluginID, pluginName, userID, tenantID string, metadata types.JSON) error {
	severity := EventSeverityInfo
	if eventType == EventTypePluginError {
		severity = EventSeverityError
	}

	event := &Event{
		Type:         eventType,
		Severity:     severity,
		Title:        fmt.Sprintf("Plugin %s", getActionFromEventType(eventType)),
		Description:  fmt.Sprintf("Plugin '%s' was %s", pluginName, getActionFromEventType(eventType)),
		UserID:       userID,
		TenantID:     tenantID,
		ResourceID:   pluginID,
		ResourceType: "plugin",
		Metadata:     metadata,
		Tags:         []string{"plugin", string(eventType)},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// PublishAuditEvent publishes an audit log event
func (s *Service) PublishAuditEvent(action, resource, resourceID, userID, tenantID string, source *EventSource, metadata types.JSON) error {
	event := &Event{
		Type:         EventTypeAuditLog,
		Severity:     EventSeverityInfo,
		Title:        fmt.Sprintf("Audit: %s %s", action, resource),
		Description:  fmt.Sprintf("User performed action '%s' on %s '%s'", action, resource, resourceID),
		UserID:       userID,
		TenantID:     tenantID,
		ResourceID:   resourceID,
		ResourceType: resource,
		Source:       source,
		Metadata:     metadata,
		Tags:         []string{"audit", action, resource},
		Timestamp:    time.Now(),
	}

	return s.PublishEvent(event)
}

// Subscribe registers an event handler for specific event types
func (s *Service) Subscribe(eventType EventType, handler EventHandler) error {
	return s.eventBus.Subscribe(eventType, handler)
}

// Unsubscribe removes an event handler
func (s *Service) Unsubscribe(eventType EventType, handler EventHandler) error {
	return s.eventBus.Unsubscribe(eventType, handler)
}

// GetEvents retrieves events based on filter criteria
func (s *Service) GetEvents(filter *EventFilter) ([]*Event, error) {
	return s.eventStore.List(filter)
}

// GetEvent retrieves a specific event by ID
func (s *Service) GetEvent(eventID string) (*Event, error) {
	return s.eventStore.Get(eventID)
}

// DeleteEvent deletes an event
func (s *Service) DeleteEvent(eventID string) error {
	return s.eventStore.Delete(eventID)
}

// CleanupEvents removes old events
func (s *Service) CleanupEvents(before time.Time) error {
	return s.eventStore.Cleanup(before)
}

// AddNotificationChannel adds a notification channel
func (s *Service) AddNotificationChannel(channel *NotificationChannel) error {
	return s.notificationManager.AddChannel(channel)
}

// RemoveNotificationChannel removes a notification channel
func (s *Service) RemoveNotificationChannel(channelID string) error {
	return s.notificationManager.RemoveChannel(channelID)
}

// GetNotificationChannels returns all notification channels
func (s *Service) GetNotificationChannels() []*NotificationChannel {
	return s.notificationManager.GetChannels()
}

// GetNotifications retrieves notifications based on filter criteria
func (s *Service) GetNotifications(filter *NotificationFilter) ([]*Notification, error) {
	return s.notificationStore.List(filter)
}

// GetNotification retrieves a specific notification by ID
func (s *Service) GetNotification(notificationID string) (*Notification, error) {
	return s.notificationStore.Get(notificationID)
}

// UpdateNotificationStatus updates the status of a notification
func (s *Service) UpdateNotificationStatus(notificationID string, status NotificationStatus, metadata types.JSON) error {
	return s.notificationStore.UpdateStatus(notificationID, status, metadata)
}

// GetWebSocketManager returns the WebSocket manager
func (s *Service) GetWebSocketManager() WebSocketManager {
	return s.websocketManager
}

// GetMetrics returns event bus metrics
func (s *Service) GetMetrics() *EventMetrics {
	if bus, ok := s.eventBus.(*Bus); ok {
		return bus.GetMetrics()
	}
	return &EventMetrics{}
}

// registerBuiltinHandlers registers built-in event handlers
func (s *Service) registerBuiltinHandlers() {
	// Register notification handler
	notificationHandler := &NotificationHandler{
		notificationManager: s.notificationManager,
		logger:              s.logger,
	}
	s.eventBus.Subscribe("*", notificationHandler)

	// Register WebSocket handler
	websocketHandler := &WebSocketHandler{
		websocketManager: s.websocketManager,
		logger:           s.logger,
	}
	s.eventBus.Subscribe("*", websocketHandler)

	// Register plugin event handler (if plugin service is available)
	if s.pluginService != nil {
		pluginHandler := &PluginEventHandler{
			pluginService: s.pluginService,
			logger:        s.logger,
		}
		s.eventBus.Subscribe("*", pluginHandler)
	}
}

// getActionFromEventType extracts action verb from event type
func getActionFromEventType(eventType EventType) string {
	switch eventType {
	case EventTypeModelCreated, EventTypeInstanceCreated, EventTypeRelationshipCreated:
		return "created"
	case EventTypeModelUpdated, EventTypeInstanceUpdated, EventTypeRelationshipUpdated:
		return "updated"
	case EventTypeModelDeleted, EventTypeInstanceDeleted, EventTypeRelationshipDeleted:
		return "deleted"
	case EventTypePluginInstalled:
		return "installed"
	case EventTypePluginEnabled:
		return "enabled"
	case EventTypePluginDisabled:
		return "disabled"
	case EventTypeUserLogin:
		return "logged in"
	case EventTypeUserLogout:
		return "logged out"
	default:
		return "processed"
	}
}

// NotificationHandler handles events by sending notifications
type NotificationHandler struct {
	notificationManager *NotificationManager
	logger              *zap.Logger
}

// Handle implements EventHandler
func (nh *NotificationHandler) Handle(event *Event) error {
	return nh.notificationManager.ProcessEvent(event)
}

// CanHandle implements EventHandler
func (nh *NotificationHandler) CanHandle(eventType EventType) bool {
	return true // Handle all events
}

// Priority implements EventHandler
func (nh *NotificationHandler) Priority() int {
	return 100 // High priority
}

// WebSocketHandler handles events by broadcasting to WebSocket connections
type WebSocketHandler struct {
	websocketManager WebSocketManager
	logger           *zap.Logger
}

// Handle implements EventHandler
func (wh *WebSocketHandler) Handle(event *Event) error {
	// Only broadcast certain event types to avoid spam
	broadcastTypes := map[EventType]bool{
		EventTypeInstanceCreated:      true,
		EventTypeInstanceUpdated:      true,
		EventTypeInstanceDeleted:      true,
		EventTypeModelCreated:         true,
		EventTypeModelUpdated:         true,
		EventTypeModelDeleted:         true,
		EventTypeRelationshipCreated:  true,
		EventTypeRelationshipUpdated:  true,
		EventTypeRelationshipDeleted:  true,
		EventTypeSystemError:          true,
		EventTypePluginError:          true,
	}

	if !broadcastTypes[event.Type] {
		return nil
	}

	// Broadcast to relevant users
	if event.UserID != "" {
		if err := wh.websocketManager.SendToUser(event.UserID, event); err != nil {
			wh.logger.Debug("Failed to send event to user via WebSocket",
				zap.String("user_id", event.UserID),
				zap.String("event_id", event.ID),
				zap.Error(err))
		}
	} else {
		// Broadcast to all connections (filtered by tenant)
		if err := wh.websocketManager.Broadcast(event); err != nil {
			wh.logger.Debug("Failed to broadcast event via WebSocket",
				zap.String("event_id", event.ID),
				zap.Error(err))
		}
	}

	return nil
}

// CanHandle implements EventHandler
func (wh *WebSocketHandler) CanHandle(eventType EventType) bool {
	return true
}

// Priority implements EventHandler
func (wh *WebSocketHandler) Priority() int {
	return 90 // High priority
}

// PluginEventHandler handles events by notifying relevant plugins
type PluginEventHandler struct {
	pluginService *plugin.Service
	logger        *zap.Logger
}

// Handle implements EventHandler
func (peh *PluginEventHandler) Handle(event *Event) error {
	// Notify relevant notifier plugins
	plugins := peh.pluginService.GetPluginsByType(plugin.PluginTypeNotifier)
	
	for _, pluginInfo := range plugins {
		if !pluginInfo.Enabled {
			continue
		}

		// Execute notification plugin
		params := map[string]interface{}{
			"event": event,
		}

		_, err := peh.pluginService.ExecutePlugin(context.Background(), pluginInfo.ID, "notify", params)
		if err != nil {
			peh.logger.Error("Failed to execute notifier plugin",
				zap.String("plugin_id", pluginInfo.ID),
				zap.String("event_id", event.ID),
				zap.Error(err))
		}
	}

	return nil
}

// CanHandle implements EventHandler
func (peh *PluginEventHandler) CanHandle(eventType EventType) bool {
	return true
}

// Priority implements EventHandler
func (peh *PluginEventHandler) Priority() int {
	return 80 // Medium priority
}