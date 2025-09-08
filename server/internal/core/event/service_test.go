package event

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"

	"github.com/wend/cmdb-backend/pkg/types"
)

func TestServiceCreation(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil, // plugin service
		logger,
	)

	assert.NotNil(t, service)
	assert.False(t, service.started)
}

func TestServiceStartStop(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	// Test start
	err = service.Start()
	assert.NoError(t, err)
	assert.True(t, service.started)

	// Test double start
	err = service.Start()
	assert.Error(t, err)

	// Test stop
	err = service.Stop()
	assert.NoError(t, err)
	assert.False(t, service.started)

	// Test double stop
	err = service.Stop()
	assert.NoError(t, err)
}

func TestPublishEvent(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	event := &Event{
		Type:        EventTypeModelCreated,
		Severity:    EventSeverityInfo,
		Title:       "Test Event",
		Description: "Test Description",
		TenantID:    "test-tenant",
		UserID:      "test-user",
	}

	err = service.PublishEvent(event)
	assert.NoError(t, err)

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Verify event was stored
	retrievedEvent, err := service.GetEvent(event.ID)
	assert.NoError(t, err)
	assert.Equal(t, event.Type, retrievedEvent.Type)
	assert.Equal(t, event.Title, retrievedEvent.Title)
}

func TestPublishModelEvent(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	metadata := types.JSON{
		"field_count": 5,
		"category":    "infrastructure",
	}

	err = service.PublishModelEvent(
		EventTypeModelCreated,
		"model-123",
		"Server Model",
		"user-456",
		"tenant-789",
		metadata,
	)
	assert.NoError(t, err)

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Verify event properties
	filter := &EventFilter{
		TenantID:     "tenant-789",
		ResourceType: "model",
	}
	events, err := service.GetEvents(filter)
	assert.NoError(t, err)
	assert.Len(t, events, 1)
	
	event := events[0]
	assert.Equal(t, EventTypeModelCreated, event.Type)
	assert.Equal(t, "model-123", event.ResourceID)
	assert.Equal(t, "user-456", event.UserID)
	assert.Equal(t, "tenant-789", event.TenantID)
	assert.Contains(t, event.Title, "Model")
	assert.Contains(t, event.Description, "Server Model")
	assert.Equal(t, metadata, event.Metadata)
}

func TestPublishInstanceEvent(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	metadata := types.JSON{
		"hostname": "web-server-01",
		"ip":       "192.168.1.100",
	}

	err = service.PublishInstanceEvent(
		EventTypeInstanceUpdated,
		"instance-123",
		"Server",
		"user-456",
		"tenant-789",
		metadata,
	)
	assert.NoError(t, err)

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Verify event properties
	filter := &EventFilter{
		TenantID:     "tenant-789",
		ResourceType: "instance",
	}
	events, err := service.GetEvents(filter)
	assert.NoError(t, err)
	assert.Len(t, events, 1)
	
	event := events[0]
	assert.Equal(t, EventTypeInstanceUpdated, event.Type)
	assert.Equal(t, "instance-123", event.ResourceID)
	assert.Contains(t, event.Description, "Server")
}

func TestPublishAuditEvent(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	source := &EventSource{
		Type:      "user",
		ID:        "user-456",
		Name:      "John Doe",
		IP:        "192.168.1.10",
		UserAgent: "Mozilla/5.0...",
	}

	metadata := types.JSON{
		"old_values": map[string]interface{}{"name": "old-name"},
		"new_values": map[string]interface{}{"name": "new-name"},
	}

	err = service.PublishAuditEvent(
		"update",
		"model",
		"model-123",
		"user-456",
		"tenant-789",
		source,
		metadata,
	)
	assert.NoError(t, err)

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Verify audit event
	filter := &EventFilter{
		Types:    []EventType{EventTypeAuditLog},
		TenantID: "tenant-789",
	}
	events, err := service.GetEvents(filter)
	assert.NoError(t, err)
	assert.Len(t, events, 1)
	
	event := events[0]
	assert.Equal(t, EventTypeAuditLog, event.Type)
	assert.Equal(t, "model-123", event.ResourceID)
	assert.Equal(t, "model", event.ResourceType)
	assert.Equal(t, source, event.Source)
	assert.Contains(t, event.Title, "Audit")
	assert.Contains(t, event.Tags, "audit")
	assert.Contains(t, event.Tags, "update")
	assert.Contains(t, event.Tags, "model")
}

func TestEventFiltering(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	// Publish multiple events
	events := []struct {
		eventType    EventType
		severity     EventSeverity
		tenantID     string
		resourceType string
		tags         []string
	}{
		{EventTypeModelCreated, EventSeverityInfo, "tenant-1", "model", []string{"create", "model"}},
		{EventTypeModelUpdated, EventSeverityWarning, "tenant-1", "model", []string{"update", "model"}},
		{EventTypeInstanceCreated, EventSeverityInfo, "tenant-2", "instance", []string{"create", "instance"}},
		{EventTypeSystemError, EventSeverityError, "tenant-1", "system", []string{"error", "system"}},
	}

	for i, evt := range events {
		event := &Event{
			Type:         evt.eventType,
			Severity:     evt.severity,
			Title:        "Test Event",
			TenantID:     evt.tenantID,
			ResourceType: evt.resourceType,
			Tags:         evt.tags,
		}
		err := service.PublishEvent(event)
		require.NoError(t, err, "Failed to publish event %d", i)
	}

	time.Sleep(100 * time.Millisecond)

	tests := []struct {
		name           string
		filter         *EventFilter
		expectedCount  int
		expectedTypes  []EventType
	}{
		{
			name:          "Filter by tenant",
			filter:        &EventFilter{TenantID: "tenant-1"},
			expectedCount: 3,
		},
		{
			name:          "Filter by event types",
			filter:        &EventFilter{Types: []EventType{EventTypeModelCreated, EventTypeModelUpdated}},
			expectedCount: 2,
			expectedTypes: []EventType{EventTypeModelCreated, EventTypeModelUpdated},
		},
		{
			name:          "Filter by severity",
			filter:        &EventFilter{Severities: []EventSeverity{EventSeverityError}},
			expectedCount: 1,
			expectedTypes: []EventType{EventTypeSystemError},
		},
		{
			name:          "Filter by resource type",
			filter:        &EventFilter{ResourceType: "model"},
			expectedCount: 2,
		},
		{
			name:          "Filter by tags",
			filter:        &EventFilter{Tags: []string{"create"}},
			expectedCount: 2,
		},
		{
			name:          "Combined filters",
			filter:        &EventFilter{TenantID: "tenant-1", ResourceType: "model"},
			expectedCount: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results, err := service.GetEvents(tt.filter)
			assert.NoError(t, err)
			assert.Len(t, results, tt.expectedCount)

			if len(tt.expectedTypes) > 0 {
				resultTypes := make([]EventType, len(results))
				for i, event := range results {
					resultTypes[i] = event.Type
				}
				for _, expectedType := range tt.expectedTypes {
					assert.Contains(t, resultTypes, expectedType)
				}
			}
		})
	}
}

func TestEventSubscription(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	handler := NewTestEventHandler(100)

	// Test subscription
	err = service.Subscribe(EventTypeModelCreated, handler)
	assert.NoError(t, err)

	// Publish event
	event := &Event{
		Type:        EventTypeModelCreated,
		Title:       "Test Event",
		Description: "Test Description",
	}

	err = service.PublishEvent(event)
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	// Check handler received event
	handledEvents := handler.GetHandledEvents()
	assert.Len(t, handledEvents, 1)

	// Test unsubscription
	err = service.Unsubscribe(EventTypeModelCreated, handler)
	assert.NoError(t, err)

	// Publish another event
	event2 := &Event{
		Type:        EventTypeModelCreated,
		Title:       "Test Event 2",
		Description: "Test Description 2",
	}

	err = service.PublishEvent(event2)
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	// Handler should not receive the second event
	handledEvents = handler.GetHandledEvents()
	assert.Len(t, handledEvents, 1)
}

func TestEventCleanup(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	// Publish events with different timestamps
	now := time.Now()
	oldEvent := &Event{
		Type:      EventTypeModelCreated,
		Title:     "Old Event",
		Timestamp: now.Add(-48 * time.Hour),
	}

	newEvent := &Event{
		Type:      EventTypeModelUpdated,
		Title:     "New Event",
		Timestamp: now,
	}

	err = service.PublishEvent(oldEvent)
	require.NoError(t, err)
	
	err = service.PublishEvent(newEvent)
	require.NoError(t, err)

	time.Sleep(100 * time.Millisecond)

	// Verify both events exist
	events, err := service.GetEvents(&EventFilter{})
	assert.NoError(t, err)
	assert.Len(t, events, 2)

	// Cleanup events older than 24 hours
	cleanupTime := now.Add(-24 * time.Hour)
	err = service.CleanupEvents(cleanupTime)
	assert.NoError(t, err)

	// Verify only new event remains
	events, err = service.GetEvents(&EventFilter{})
	assert.NoError(t, err)
	assert.Len(t, events, 1)
	assert.Equal(t, "New Event", events[0].Title)
}

func TestGetMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)
	
	eventBus := NewBus(2, 10, logger)
	eventStore, err := NewFileEventStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationStore, err := NewFileNotificationStore(t.TempDir(), logger)
	require.NoError(t, err)
	
	notificationManager := NewNotificationManager(notificationStore, logger)
	websocketManager := NewWebSocketManager(logger)

	service := NewService(
		eventBus,
		eventStore,
		notificationStore,
		notificationManager,
		websocketManager,
		nil,
		logger,
	)

	require.NoError(t, service.Start())
	defer service.Stop()

	// Initial metrics
	metrics := service.GetMetrics()
	assert.NotNil(t, metrics)
	assert.Equal(t, int64(0), metrics.EventsPublished)

	// Publish some events
	for i := 0; i < 5; i++ {
		event := &Event{
			Type:  EventTypeModelCreated,
			Title: "Test Event",
		}
		err := service.PublishEvent(event)
		require.NoError(t, err)
	}

	time.Sleep(100 * time.Millisecond)

	// Check updated metrics
	metrics = service.GetMetrics()
	assert.Equal(t, int64(5), metrics.EventsPublished)
}