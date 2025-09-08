package event

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"
)

// TestEventHandler implements EventHandler for testing
type TestEventHandler struct {
	handledEvents []*Event
	mu            sync.Mutex
	priority      int
	canHandle     func(EventType) bool
}

func NewTestEventHandler(priority int) *TestEventHandler {
	return &TestEventHandler{
		handledEvents: make([]*Event, 0),
		priority:      priority,
		canHandle: func(EventType) bool {
			return true
		},
	}
}

func (h *TestEventHandler) Handle(event *Event) error {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.handledEvents = append(h.handledEvents, event)
	return nil
}

func (h *TestEventHandler) CanHandle(eventType EventType) bool {
	if h.canHandle != nil {
		return h.canHandle(eventType)
	}
	return true
}

func (h *TestEventHandler) Priority() int {
	return h.priority
}

func (h *TestEventHandler) GetHandledEvents() []*Event {
	h.mu.Lock()
	defer h.mu.Unlock()
	events := make([]*Event, len(h.handledEvents))
	copy(events, h.handledEvents)
	return events
}

func (h *TestEventHandler) Reset() {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.handledEvents = h.handledEvents[:0]
}

func TestBusCreation(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(5, 100, logger)

	assert.NotNil(t, bus)
	assert.Equal(t, 5, cap(bus.workerPool))
	assert.Equal(t, 100, cap(bus.eventQueue))
}

func TestBusStartStop(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)

	// Test start
	err := bus.Start()
	assert.NoError(t, err)
	assert.True(t, bus.started)

	// Test double start
	err = bus.Start()
	assert.Error(t, err)

	// Test stop
	err = bus.Stop()
	assert.NoError(t, err)
	assert.False(t, bus.started)

	// Test double stop
	err = bus.Stop()
	assert.NoError(t, err)
}

func TestEventPublishing(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	handler := NewTestEventHandler(100)
	err := bus.Subscribe(EventTypeModelCreated, handler)
	require.NoError(t, err)

	// Create and publish event
	event := &Event{
		Type:        EventTypeModelCreated,
		Severity:    EventSeverityInfo,
		Title:       "Test Event",
		Description: "Test Description",
		TenantID:    "test-tenant",
	}

	err = bus.Publish(event)
	require.NoError(t, err)

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Check that event was handled
	handledEvents := handler.GetHandledEvents()
	assert.Len(t, handledEvents, 1)
	assert.Equal(t, event.Type, handledEvents[0].Type)
	assert.Equal(t, event.Title, handledEvents[0].Title)
	assert.NotEmpty(t, handledEvents[0].ID)
}

func TestEventSubscription(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)

	handler1 := NewTestEventHandler(100)
	handler2 := NewTestEventHandler(50)

	// Test subscription
	err := bus.Subscribe(EventTypeModelCreated, handler1)
	assert.NoError(t, err)

	err = bus.Subscribe(EventTypeModelCreated, handler2)
	assert.NoError(t, err)

	// Check handlers are registered
	handlers := bus.GetHandlers(EventTypeModelCreated)
	assert.Len(t, handlers, 2)

	// Check priority order (higher priority first)
	assert.Equal(t, 100, handlers[0].Priority())
	assert.Equal(t, 50, handlers[1].Priority())
}

func TestEventUnsubscription(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)

	handler := NewTestEventHandler(100)

	// Subscribe
	err := bus.Subscribe(EventTypeModelCreated, handler)
	require.NoError(t, err)

	handlers := bus.GetHandlers(EventTypeModelCreated)
	assert.Len(t, handlers, 1)

	// Unsubscribe
	err = bus.Unsubscribe(EventTypeModelCreated, handler)
	assert.NoError(t, err)

	handlers = bus.GetHandlers(EventTypeModelCreated)
	assert.Len(t, handlers, 0)

	// Test unsubscribing non-existent handler
	err = bus.Unsubscribe(EventTypeModelCreated, handler)
	assert.Error(t, err)
}

func TestWildcardHandler(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	var handledEvents []*Event
	var mu sync.Mutex

	wildcardHandler := NewWildcardHandler(func(event *Event) error {
		mu.Lock()
		defer mu.Unlock()
		handledEvents = append(handledEvents, event)
		return nil
	}, 200)

	err := bus.Subscribe("*", wildcardHandler)
	require.NoError(t, err)

	// Publish different event types
	events := []*Event{
		{Type: EventTypeModelCreated, Title: "Model Event"},
		{Type: EventTypeInstanceUpdated, Title: "Instance Event"},
		{Type: EventTypeSystemError, Title: "System Event"},
	}

	for _, event := range events {
		err := bus.Publish(event)
		require.NoError(t, err)
	}

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Check all events were handled
	mu.Lock()
	assert.Len(t, handledEvents, 3)
	mu.Unlock()
}

func TestEventMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	// Initial metrics
	metrics := bus.GetMetrics()
	assert.Equal(t, int64(0), metrics.EventsPublished)

	// Publish some events
	events := []*Event{
		{Type: EventTypeModelCreated, Severity: EventSeverityInfo},
		{Type: EventTypeModelUpdated, Severity: EventSeverityWarning},
		{Type: EventTypeModelDeleted, Severity: EventSeverityError},
	}

	for _, event := range events {
		err := bus.Publish(event)
		require.NoError(t, err)
	}

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Check metrics
	metrics = bus.GetMetrics()
	assert.Equal(t, int64(3), metrics.EventsPublished)
	assert.Equal(t, int64(1), metrics.EventsByType[string(EventTypeModelCreated)])
	assert.Equal(t, int64(1), metrics.EventsByType[string(EventTypeModelUpdated)])
	assert.Equal(t, int64(1), metrics.EventsByType[string(EventTypeModelDeleted)])
	assert.Equal(t, int64(1), metrics.EventsBySeverity[string(EventSeverityInfo)])
	assert.Equal(t, int64(1), metrics.EventsBySeverity[string(EventSeverityWarning)])
	assert.Equal(t, int64(1), metrics.EventsBySeverity[string(EventSeverityError)])
}

func TestEventQueueFull(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(0, 1, logger) // Very small queue
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	// Fill the queue
	event1 := &Event{Type: EventTypeModelCreated}
	err := bus.Publish(event1)
	assert.NoError(t, err)

	// Try to publish another event (should fail due to full queue)
	event2 := &Event{Type: EventTypeModelUpdated}
	err = bus.Publish(event2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "queue full")
}

func TestPublishAndWait(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	handler := NewTestEventHandler(100)
	err := bus.Subscribe(EventTypeModelCreated, handler)
	require.NoError(t, err)

	event := &Event{
		Type:        EventTypeModelCreated,
		Title:       "Test Event",
		Description: "Test Description",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Publish and wait
	err = bus.PublishAndWait(ctx, event)
	assert.NoError(t, err)

	// Check that event was handled
	handledEvents := handler.GetHandledEvents()
	assert.Len(t, handledEvents, 1)
}

func TestPublishAndWaitTimeout(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(0, 10, logger) // No workers
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	event := &Event{Type: EventTypeModelCreated}

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	// Should timeout since no workers are processing
	err := bus.PublishAndWait(ctx, event)
	assert.Error(t, err)
	assert.Equal(t, context.DeadlineExceeded, err)
}

func TestHandlerPanic(t *testing.T) {
	logger := zaptest.NewLogger(t)
	bus := NewBus(2, 10, logger)
	
	require.NoError(t, bus.Start())
	defer bus.Stop()

	// Handler that panics
	panicHandler := NewTestEventHandler(100)
	panicHandler.canHandle = func(EventType) bool {
		panic("test panic")
	}

	normalHandler := NewTestEventHandler(50)

	err := bus.Subscribe(EventTypeModelCreated, panicHandler)
	require.NoError(t, err)
	
	err = bus.Subscribe(EventTypeModelCreated, normalHandler)
	require.NoError(t, err)

	event := &Event{Type: EventTypeModelCreated}
	err = bus.Publish(event)
	require.NoError(t, err)

	// Wait for processing
	time.Sleep(100 * time.Millisecond)

	// Normal handler should still work despite panic in other handler
	handledEvents := normalHandler.GetHandledEvents()
	assert.Len(t, handledEvents, 1)
}

func BenchmarkEventPublishing(b *testing.B) {
	logger := zaptest.NewLogger(b)
	bus := NewBus(10, 1000, logger)
	
	bus.Start()
	defer bus.Stop()

	handler := NewTestEventHandler(100)
	bus.Subscribe(EventTypeModelCreated, handler)

	event := &Event{
		Type:        EventTypeModelCreated,
		Severity:    EventSeverityInfo,
		Title:       "Benchmark Event",
		Description: "Benchmark Description",
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			bus.Publish(event)
		}
	})
}

func BenchmarkEventProcessing(b *testing.B) {
	logger := zaptest.NewLogger(b)
	bus := NewBus(10, 10000, logger)
	
	bus.Start()
	defer bus.Stop()

	// Add multiple handlers
	for i := 0; i < 5; i++ {
		handler := NewTestEventHandler(100 - i)
		bus.Subscribe(EventTypeModelCreated, handler)
	}

	events := make([]*Event, b.N)
	for i := 0; i < b.N; i++ {
		events[i] = &Event{
			Type:        EventTypeModelCreated,
			Severity:    EventSeverityInfo,
			Title:       "Benchmark Event",
			Description: "Benchmark Description",
		}
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		bus.Publish(events[i])
	}

	// Wait for all events to be processed
	time.Sleep(1 * time.Second)
}