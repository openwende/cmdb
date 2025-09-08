package event

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// Bus implements an in-memory event bus with asynchronous processing
type Bus struct {
	handlers      map[EventType][]EventHandler
	mu            sync.RWMutex
	workerPool    chan struct{}
	eventQueue    chan *Event
	done          chan struct{}
	logger        *zap.Logger
	metrics       *EventMetrics
	metricsMu     sync.RWMutex
	started       bool
	startedMu     sync.RWMutex
}

// NewBus creates a new event bus
func NewBus(workerCount int, queueSize int, logger *zap.Logger) *Bus {
	return &Bus{
		handlers:   make(map[EventType][]EventHandler),
		workerPool: make(chan struct{}, workerCount),
		eventQueue: make(chan *Event, queueSize),
		done:       make(chan struct{}),
		logger:     logger,
		metrics: &EventMetrics{
			EventsByType:        make(map[string]int64),
			EventsBySeverity:    make(map[string]int64),
			NotificationsByType: make(map[string]int64),
			LastUpdated:         time.Now(),
		},
	}
}

// Start starts the event bus workers
func (b *Bus) Start() error {
	b.startedMu.Lock()
	defer b.startedMu.Unlock()

	if b.started {
		return fmt.Errorf("event bus already started")
	}

	// Start worker pool
	for i := 0; i < cap(b.workerPool); i++ {
		go b.worker()
	}

	b.started = true
	b.logger.Info("Event bus started", zap.Int("workers", cap(b.workerPool)))
	return nil
}

// Stop stops the event bus
func (b *Bus) Stop() error {
	b.startedMu.Lock()
	defer b.startedMu.Unlock()

	if !b.started {
		return nil
	}

	close(b.done)
	b.started = false
	b.logger.Info("Event bus stopped")
	return nil
}

// Publish publishes an event to the bus
func (b *Bus) Publish(event *Event) error {
	b.startedMu.RLock()
	started := b.started
	b.startedMu.RUnlock()

	if !started {
		return fmt.Errorf("event bus not started")
	}

	// Ensure event has required fields
	if event.ID == "" {
		event.ID = uuid.New().String()
	}
	if event.Timestamp.IsZero() {
		event.Timestamp = time.Now()
	}
	if event.CreatedAt.IsZero() {
		event.CreatedAt = time.Now()
	}
	event.UpdatedAt = time.Now()

	// Update metrics
	b.updateMetrics(event)

	// Send to queue (non-blocking)
	select {
	case b.eventQueue <- event:
		b.logger.Debug("Event published", 
			zap.String("id", event.ID),
			zap.String("type", string(event.Type)),
			zap.String("severity", string(event.Severity)))
		return nil
	default:
		b.logger.Error("Event queue full, dropping event",
			zap.String("id", event.ID),
			zap.String("type", string(event.Type)))
		return fmt.Errorf("event queue full")
	}
}

// Subscribe adds an event handler for a specific event type
func (b *Bus) Subscribe(eventType EventType, handler EventHandler) error {
	if handler == nil {
		return fmt.Errorf("handler cannot be nil")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	handlers := b.handlers[eventType]
	handlers = append(handlers, handler)
	
	// Sort handlers by priority (higher priority first)
	sort.Slice(handlers, func(i, j int) bool {
		return handlers[i].Priority() > handlers[j].Priority()
	})
	
	b.handlers[eventType] = handlers

	b.logger.Debug("Handler subscribed",
		zap.String("event_type", string(eventType)),
		zap.Int("priority", handler.Priority()),
		zap.Int("total_handlers", len(handlers)))

	return nil
}

// Unsubscribe removes an event handler for a specific event type
func (b *Bus) Unsubscribe(eventType EventType, handler EventHandler) error {
	if handler == nil {
		return fmt.Errorf("handler cannot be nil")
	}

	b.mu.Lock()
	defer b.mu.Unlock()

	handlers := b.handlers[eventType]
	for i, h := range handlers {
		if h == handler {
			// Remove handler from slice
			handlers = append(handlers[:i], handlers[i+1:]...)
			b.handlers[eventType] = handlers
			
			b.logger.Debug("Handler unsubscribed",
				zap.String("event_type", string(eventType)),
				zap.Int("remaining_handlers", len(handlers)))
			
			return nil
		}
	}

	return fmt.Errorf("handler not found")
}

// GetHandlers returns all handlers for an event type
func (b *Bus) GetHandlers(eventType EventType) []EventHandler {
	b.mu.RLock()
	defer b.mu.RUnlock()

	handlers := b.handlers[eventType]
	result := make([]EventHandler, len(handlers))
	copy(result, handlers)
	return result
}

// GetMetrics returns current event metrics
func (b *Bus) GetMetrics() *EventMetrics {
	b.metricsMu.RLock()
	defer b.metricsMu.RUnlock()

	// Create a copy of metrics
	metrics := &EventMetrics{
		EventsPublished:     b.metrics.EventsPublished,
		EventsByType:        make(map[string]int64),
		EventsBySeverity:    make(map[string]int64),
		NotificationsSent:   b.metrics.NotificationsSent,
		NotificationsFailed: b.metrics.NotificationsFailed,
		NotificationsByType: make(map[string]int64),
		AverageLatency:      b.metrics.AverageLatency,
		LastUpdated:         b.metrics.LastUpdated,
	}

	for k, v := range b.metrics.EventsByType {
		metrics.EventsByType[k] = v
	}
	for k, v := range b.metrics.EventsBySeverity {
		metrics.EventsBySeverity[k] = v
	}
	for k, v := range b.metrics.NotificationsByType {
		metrics.NotificationsByType[k] = v
	}

	return metrics
}

// ResetMetrics resets all metrics
func (b *Bus) ResetMetrics() {
	b.metricsMu.Lock()
	defer b.metricsMu.Unlock()

	b.metrics = &EventMetrics{
		EventsByType:        make(map[string]int64),
		EventsBySeverity:    make(map[string]int64),
		NotificationsByType: make(map[string]int64),
		LastUpdated:         time.Now(),
	}
}

// worker processes events from the queue
func (b *Bus) worker() {
	for {
		select {
		case <-b.done:
			return
		case event := <-b.eventQueue:
			b.processEvent(event)
		}
	}
}

// processEvent processes a single event by calling all registered handlers
func (b *Bus) processEvent(event *Event) {
	start := time.Now()
	
	b.mu.RLock()
	handlers := b.handlers[event.Type]
	// Also check for wildcard handlers (if implemented)
	allHandlers := b.handlers["*"]
	b.mu.RUnlock()

	// Combine specific and wildcard handlers
	allHandlers = append(allHandlers, handlers...)

	if len(allHandlers) == 0 {
		b.logger.Debug("No handlers for event",
			zap.String("id", event.ID),
			zap.String("type", string(event.Type)))
		return
	}

	// Process handlers in parallel
	var wg sync.WaitGroup
	for _, handler := range allHandlers {
		if !handler.CanHandle(event.Type) {
			continue
		}

		wg.Add(1)
		go func(h EventHandler) {
			defer wg.Done()
			defer func() {
				if r := recover(); r != nil {
					b.logger.Error("Handler panicked",
						zap.String("event_id", event.ID),
						zap.String("event_type", string(event.Type)),
						zap.Any("panic", r))
				}
			}()

			if err := h.Handle(event); err != nil {
				b.logger.Error("Handler failed",
					zap.String("event_id", event.ID),
					zap.String("event_type", string(event.Type)),
					zap.Error(err))
			}
		}(handler)
	}

	wg.Wait()

	// Update latency metrics
	duration := time.Since(start)
	b.updateLatencyMetrics(duration)

	b.logger.Debug("Event processed",
		zap.String("id", event.ID),
		zap.String("type", string(event.Type)),
		zap.Duration("duration", duration),
		zap.Int("handlers", len(allHandlers)))
}

// updateMetrics updates event metrics
func (b *Bus) updateMetrics(event *Event) {
	b.metricsMu.Lock()
	defer b.metricsMu.Unlock()

	b.metrics.EventsPublished++
	b.metrics.EventsByType[string(event.Type)]++
	b.metrics.EventsBySeverity[string(event.Severity)]++
	b.metrics.LastUpdated = time.Now()
}

// updateLatencyMetrics updates latency metrics
func (b *Bus) updateLatencyMetrics(duration time.Duration) {
	b.metricsMu.Lock()
	defer b.metricsMu.Unlock()

	// Simple moving average (could be improved with proper statistical methods)
	if b.metrics.AverageLatency == 0 {
		b.metrics.AverageLatency = duration
	} else {
		b.metrics.AverageLatency = (b.metrics.AverageLatency + duration) / 2
	}
}

// PublishAndWait publishes an event and waits for all handlers to complete
func (b *Bus) PublishAndWait(ctx context.Context, event *Event) error {
	// Create a completion channel
	done := make(chan struct{})
	
	// Wrap event processing to signal completion
	originalProcessEvent := b.processEvent
	b.processEvent = func(e *Event) {
		if e.ID == event.ID {
			defer func() {
				close(done)
				b.processEvent = originalProcessEvent
			}()
		}
		originalProcessEvent(e)
	}

	// Publish the event
	if err := b.Publish(event); err != nil {
		return err
	}

	// Wait for completion or context cancellation
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// WildcardHandler is a special handler that receives all events
type WildcardHandler struct {
	handler  func(*Event) error
	priority int
}

// NewWildcardHandler creates a new wildcard handler
func NewWildcardHandler(handler func(*Event) error, priority int) *WildcardHandler {
	return &WildcardHandler{
		handler:  handler,
		priority: priority,
	}
}

// Handle implements EventHandler
func (h *WildcardHandler) Handle(event *Event) error {
	return h.handler(event)
}

// CanHandle implements EventHandler
func (h *WildcardHandler) CanHandle(eventType EventType) bool {
	return true // Wildcard handlers accept all events
}

// Priority implements EventHandler
func (h *WildcardHandler) Priority() int {
	return h.priority
}