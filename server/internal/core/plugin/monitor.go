package plugin

import (
	"context"
	"sync"
	"time"
)

// Monitor provides monitoring and health checking for plugins
type Monitor interface {
	Start(ctx context.Context, manager *Manager) error
	Stop(ctx context.Context) error
	RegisterPlugin(pluginID string, instance *PluginInstance) error
	UnregisterPlugin(pluginID string) error
	GetMetrics(pluginID string) (*PluginMetrics, error)
	GetAllMetrics() map[string]*PluginMetrics
	SetAlertThresholds(pluginID string, thresholds *AlertThresholds) error
}

type monitor struct {
	config     *ManagerConfig
	metrics    map[string]*PluginMetrics
	thresholds map[string]*AlertThresholds
	alerts     chan *Alert
	stopChan   chan struct{}
	mu         sync.RWMutex
	
	// Health checking
	healthTicker *time.Ticker
	
	// Metrics collection
	metricsTicker *time.Ticker
}

// PluginMetrics represents metrics for a plugin
type PluginMetrics struct {
	PluginID       string                 `json:"plugin_id"`
	InstanceID     string                 `json:"instance_id"`
	Status         PluginStatus           `json:"status"`
	Uptime         time.Duration          `json:"uptime"`
	RequestCount   int64                  `json:"request_count"`
	ErrorCount     int64                  `json:"error_count"`
	SuccessRate    float64                `json:"success_rate"`
	AverageLatency time.Duration          `json:"average_latency"`
	ResourceUsage  *ResourceUsage         `json:"resource_usage"`
	LastUpdated    time.Time              `json:"last_updated"`
	
	// Performance metrics
	Throughput     float64                `json:"throughput_rps"`
	P95Latency     time.Duration          `json:"p95_latency"`
	P99Latency     time.Duration          `json:"p99_latency"`
	
	// Error tracking
	RecentErrors   []ErrorInfo            `json:"recent_errors"`
	ErrorsByType   map[string]int64       `json:"errors_by_type"`
	
	// Custom metrics
	CustomMetrics  map[string]interface{} `json:"custom_metrics"`
}

// ErrorInfo represents error information
type ErrorInfo struct {
	Timestamp time.Time `json:"timestamp"`
	Message   string    `json:"message"`
	Type      string    `json:"type"`
	Code      string    `json:"code"`
	Context   string    `json:"context"`
}

// AlertThresholds defines alert thresholds for a plugin
type AlertThresholds struct {
	MaxErrorRate     float64       `json:"max_error_rate"`
	MaxLatency       time.Duration `json:"max_latency"`
	MaxMemoryUsage   int64         `json:"max_memory_usage"`
	MaxCPUUsage      float64       `json:"max_cpu_usage"`
	MaxResponseTime  time.Duration `json:"max_response_time"`
	MinSuccessRate   float64       `json:"min_success_rate"`
	MaxRestarts      int           `json:"max_restarts"`
	HealthCheckTimeout time.Duration `json:"health_check_timeout"`
}

// Alert represents a monitoring alert
type Alert struct {
	ID          string                 `json:"id"`
	PluginID    string                 `json:"plugin_id"`
	InstanceID  string                 `json:"instance_id"`
	Type        AlertType              `json:"type"`
	Severity    AlertSeverity          `json:"severity"`
	Message     string                 `json:"message"`
	Details     map[string]interface{} `json:"details"`
	Timestamp   time.Time              `json:"timestamp"`
	Resolved    bool                   `json:"resolved"`
	ResolvedAt  *time.Time             `json:"resolved_at,omitempty"`
}

// AlertType represents the type of alert
type AlertType string

const (
	AlertTypeHealth       AlertType = "health"
	AlertTypePerformance  AlertType = "performance"
	AlertTypeResource     AlertType = "resource"
	AlertTypeError        AlertType = "error"
	AlertTypeSecurity     AlertType = "security"
)

// AlertSeverity represents the severity of an alert
type AlertSeverity string

const (
	AlertSeverityLow      AlertSeverity = "low"
	AlertSeverityMedium   AlertSeverity = "medium"
	AlertSeverityHigh     AlertSeverity = "high"
	AlertSeverityCritical AlertSeverity = "critical"
)

// NewMonitor creates a new plugin monitor
func NewMonitor(config *ManagerConfig) Monitor {
	return &monitor{
		config:        config,
		metrics:       make(map[string]*PluginMetrics),
		thresholds:    make(map[string]*AlertThresholds),
		alerts:        make(chan *Alert, 1000),
		stopChan:      make(chan struct{}),
		healthTicker:  time.NewTicker(config.HealthInterval),
		metricsTicker: time.NewTicker(30 * time.Second), // Collect metrics every 30s
	}
}

// Start starts the monitoring system
func (m *monitor) Start(ctx context.Context, manager *Manager) error {
	// Start health checking goroutine
	go m.healthCheckLoop(ctx, manager)
	
	// Start metrics collection goroutine
	go m.metricsCollectionLoop(ctx, manager)
	
	// Start alert processing goroutine
	go m.alertProcessingLoop(ctx)
	
	return nil
}

// Stop stops the monitoring system
func (m *monitor) Stop(ctx context.Context) error {
	close(m.stopChan)
	
	if m.healthTicker != nil {
		m.healthTicker.Stop()
	}
	
	if m.metricsTicker != nil {
		m.metricsTicker.Stop()
	}
	
	return nil
}

// RegisterPlugin registers a plugin for monitoring
func (m *monitor) RegisterPlugin(pluginID string, instance *PluginInstance) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	metrics := &PluginMetrics{
		PluginID:       pluginID,
		InstanceID:     instance.ID,
		Status:         instance.Status,
		RequestCount:   0,
		ErrorCount:     0,
		SuccessRate:    100.0,
		RecentErrors:   make([]ErrorInfo, 0),
		ErrorsByType:   make(map[string]int64),
		CustomMetrics:  make(map[string]interface{}),
		LastUpdated:    time.Now(),
	}
	
	m.metrics[instance.ID] = metrics
	
	// Set default thresholds if not already set
	if _, exists := m.thresholds[instance.ID]; !exists {
		m.thresholds[instance.ID] = &AlertThresholds{
			MaxErrorRate:       10.0, // 10%
			MaxLatency:         5 * time.Second,
			MaxMemoryUsage:     512 * 1024 * 1024, // 512MB
			MaxCPUUsage:        80.0, // 80%
			MaxResponseTime:    3 * time.Second,
			MinSuccessRate:     95.0, // 95%
			MaxRestarts:        5,
			HealthCheckTimeout: 10 * time.Second,
		}
	}
	
	return nil
}

// UnregisterPlugin unregisters a plugin from monitoring
func (m *monitor) UnregisterPlugin(pluginID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	// Find and remove metrics for all instances of this plugin
	for instanceID, metrics := range m.metrics {
		if metrics.PluginID == pluginID {
			delete(m.metrics, instanceID)
			delete(m.thresholds, instanceID)
		}
	}
	
	return nil
}

// GetMetrics returns metrics for a specific plugin instance
func (m *monitor) GetMetrics(instanceID string) (*PluginMetrics, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	metrics, exists := m.metrics[instanceID]
	if !exists {
		return nil, fmt.Errorf("metrics not found for instance %s", instanceID)
	}
	
	// Return a copy to avoid race conditions
	metricsCopy := *metrics
	return &metricsCopy, nil
}

// GetAllMetrics returns metrics for all monitored plugins
func (m *monitor) GetAllMetrics() map[string]*PluginMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	result := make(map[string]*PluginMetrics)
	for instanceID, metrics := range m.metrics {
		metricsCopy := *metrics
		result[instanceID] = &metricsCopy
	}
	
	return result
}

// SetAlertThresholds sets alert thresholds for a plugin instance
func (m *monitor) SetAlertThresholds(instanceID string, thresholds *AlertThresholds) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	
	m.thresholds[instanceID] = thresholds
	return nil
}

// Private methods

func (m *monitor) healthCheckLoop(ctx context.Context, manager *Manager) {
	for {
		select {
		case <-m.healthTicker.C:
			m.performHealthChecks(ctx, manager)
		case <-m.stopChan:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (m *monitor) metricsCollectionLoop(ctx context.Context, manager *Manager) {
	for {
		select {
		case <-m.metricsTicker.C:
			m.collectMetrics(ctx, manager)
		case <-m.stopChan:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (m *monitor) alertProcessingLoop(ctx context.Context) {
	for {
		select {
		case alert := <-m.alerts:
			m.processAlert(ctx, alert)
		case <-m.stopChan:
			return
		case <-ctx.Done():
			return
		}
	}
}

func (m *monitor) performHealthChecks(ctx context.Context, manager *Manager) {
	instances := manager.GetInstances()
	
	for _, instance := range instances {
		if instance.Status == PluginStatusEnabled {
			m.checkInstanceHealth(ctx, manager, instance)
		}
	}
}

func (m *monitor) checkInstanceHealth(ctx context.Context, manager *Manager, instance *PluginInstance) {
	// Create timeout context
	thresholds := m.getThresholds(instance.ID)
	healthCtx, cancel := context.WithTimeout(ctx, thresholds.HealthCheckTimeout)
	defer cancel()
	
	// Perform health check
	start := time.Now()
	err := manager.executor.Health(healthCtx, instance)
	duration := time.Since(start)
	
	m.mu.Lock()
	metrics := m.metrics[instance.ID]
	if metrics == nil {
		m.mu.Unlock()
		return
	}
	
	if err != nil {
		// Health check failed
		metrics.ErrorCount++
		m.addError(metrics, ErrorInfo{
			Timestamp: time.Now(),
			Message:   err.Error(),
			Type:      "health_check",
			Code:      "HEALTH_CHECK_FAILED",
			Context:   "health_check",
		})
		
		// Generate alert
		alert := &Alert{
			ID:         generateAlertID(),
			PluginID:   instance.PluginID,
			InstanceID: instance.ID,
			Type:       AlertTypeHealth,
			Severity:   AlertSeverityHigh,
			Message:    fmt.Sprintf("Health check failed: %s", err.Error()),
			Details: map[string]interface{}{
				"error":    err.Error(),
				"duration": duration,
			},
			Timestamp: time.Now(),
		}
		
		select {
		case m.alerts <- alert:
		default:
			// Alert channel full
		}
	} else {
		// Health check succeeded
		m.updateSuccessMetrics(metrics, duration)
	}
	
	metrics.LastUpdated = time.Now()
	m.mu.Unlock()
	
	// Check thresholds
	m.checkThresholds(instance.ID, metrics, thresholds)
}

func (m *monitor) collectMetrics(ctx context.Context, manager *Manager) {
	instances := manager.GetInstances()
	
	for _, instance := range instances {
		if instance.Status == PluginStatusEnabled {
			m.collectInstanceMetrics(ctx, manager, instance)
		}
	}
}

func (m *monitor) collectInstanceMetrics(ctx context.Context, manager *Manager, instance *PluginInstance) {
	m.mu.Lock()
	metrics := m.metrics[instance.ID]
	if metrics == nil {
		m.mu.Unlock()
		return
	}
	
	// Update basic metrics from instance stats
	if instance.Stats != nil {
		metrics.RequestCount = instance.Stats.RequestCount
		metrics.ErrorCount = instance.Stats.ErrorCount
		metrics.Uptime = instance.Stats.Uptime
		
		// Calculate success rate
		if metrics.RequestCount > 0 {
			metrics.SuccessRate = float64(metrics.RequestCount-metrics.ErrorCount) / float64(metrics.RequestCount) * 100.0
		}
		
		// Calculate throughput (requests per second)
		if metrics.Uptime.Seconds() > 0 {
			metrics.Throughput = float64(metrics.RequestCount) / metrics.Uptime.Seconds()
		}
	}
	
	// Update status
	metrics.Status = instance.Status
	metrics.LastUpdated = time.Now()
	
	m.mu.Unlock()
	
	// Collect resource usage if sandbox is available
	if sandbox, exists := manager.sandboxes[instance.ID]; exists {
		if usage, err := sandbox.Monitor(); err == nil {
			m.mu.Lock()
			metrics.ResourceUsage = usage
			m.mu.Unlock()
		}
	}
}

func (m *monitor) checkThresholds(instanceID string, metrics *PluginMetrics, thresholds *AlertThresholds) {
	// Check error rate threshold
	if metrics.SuccessRate < thresholds.MinSuccessRate {
		alert := &Alert{
			ID:         generateAlertID(),
			PluginID:   metrics.PluginID,
			InstanceID: instanceID,
			Type:       AlertTypePerformance,
			Severity:   AlertSeverityMedium,
			Message:    fmt.Sprintf("Success rate below threshold: %.2f%% < %.2f%%", metrics.SuccessRate, thresholds.MinSuccessRate),
			Details: map[string]interface{}{
				"success_rate": metrics.SuccessRate,
				"threshold":    thresholds.MinSuccessRate,
			},
			Timestamp: time.Now(),
		}
		
		select {
		case m.alerts <- alert:
		default:
		}
	}
	
	// Check resource usage thresholds
	if metrics.ResourceUsage != nil {
		if metrics.ResourceUsage.Memory > thresholds.MaxMemoryUsage {
			alert := &Alert{
				ID:         generateAlertID(),
				PluginID:   metrics.PluginID,
				InstanceID: instanceID,
				Type:       AlertTypeResource,
				Severity:   AlertSeverityHigh,
				Message:    fmt.Sprintf("Memory usage exceeded threshold: %d bytes > %d bytes", metrics.ResourceUsage.Memory, thresholds.MaxMemoryUsage),
				Details: map[string]interface{}{
					"memory_usage": metrics.ResourceUsage.Memory,
					"threshold":    thresholds.MaxMemoryUsage,
				},
				Timestamp: time.Now(),
			}
			
			select {
			case m.alerts <- alert:
			default:
			}
		}
		
		if metrics.ResourceUsage.CPU > thresholds.MaxCPUUsage {
			alert := &Alert{
				ID:         generateAlertID(),
				PluginID:   metrics.PluginID,
				InstanceID: instanceID,
				Type:       AlertTypeResource,
				Severity:   AlertSeverityMedium,
				Message:    fmt.Sprintf("CPU usage exceeded threshold: %.2f%% > %.2f%%", metrics.ResourceUsage.CPU, thresholds.MaxCPUUsage),
				Details: map[string]interface{}{
					"cpu_usage": metrics.ResourceUsage.CPU,
					"threshold": thresholds.MaxCPUUsage,
				},
				Timestamp: time.Now(),
			}
			
			select {
			case m.alerts <- alert:
			default:
			}
		}
	}
}

func (m *monitor) processAlert(ctx context.Context, alert *Alert) {
	// Process the alert (send notifications, log, etc.)
	// This could integrate with notification systems, logging, etc.
	
	// For now, just log the alert
	m.logAlert(alert)
}

func (m *monitor) logAlert(alert *Alert) {
	// Log alert to system logs
	// In production, this would integrate with proper logging systems
}

func (m *monitor) getThresholds(instanceID string) *AlertThresholds {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	if thresholds, exists := m.thresholds[instanceID]; exists {
		return thresholds
	}
	
	// Return default thresholds
	return &AlertThresholds{
		MaxErrorRate:       10.0,
		MaxLatency:         5 * time.Second,
		MaxMemoryUsage:     512 * 1024 * 1024,
		MaxCPUUsage:        80.0,
		MaxResponseTime:    3 * time.Second,
		MinSuccessRate:     95.0,
		MaxRestarts:        5,
		HealthCheckTimeout: 10 * time.Second,
	}
}

func (m *monitor) updateSuccessMetrics(metrics *PluginMetrics, duration time.Duration) {
	metrics.RequestCount++
	
	// Update average latency (simple moving average)
	if metrics.AverageLatency == 0 {
		metrics.AverageLatency = duration
	} else {
		// Simple exponential moving average
		alpha := 0.1
		metrics.AverageLatency = time.Duration(float64(metrics.AverageLatency)*(1-alpha) + float64(duration)*alpha)
	}
	
	// Calculate success rate
	if metrics.RequestCount > 0 {
		metrics.SuccessRate = float64(metrics.RequestCount-metrics.ErrorCount) / float64(metrics.RequestCount) * 100.0
	}
}

func (m *monitor) addError(metrics *PluginMetrics, errorInfo ErrorInfo) {
	// Add to recent errors (keep last 10)
	metrics.RecentErrors = append(metrics.RecentErrors, errorInfo)
	if len(metrics.RecentErrors) > 10 {
		metrics.RecentErrors = metrics.RecentErrors[1:]
	}
	
	// Update errors by type
	metrics.ErrorsByType[errorInfo.Type]++
}

func generateAlertID() string {
	// Generate unique alert ID
	return fmt.Sprintf("alert_%d", time.Now().UnixNano())
}