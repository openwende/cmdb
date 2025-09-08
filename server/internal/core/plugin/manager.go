package plugin

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// Manager manages the plugin system
type Manager struct {
	plugins     map[string]*PluginManifest
	instances   map[string]*PluginInstance
	hooks       map[string][]Hook
	loader      Loader
	registry    Registry
	executor    Executor
	monitor     Monitor
	mu          sync.RWMutex
	
	// Configuration
	config      *ManagerConfig
	pluginDir   string
	dataDir     string
	
	// Event handling
	eventChan   chan Event
	stopChan    chan struct{}
	
	// Security
	sandboxes   map[string]Sandbox
	
	// Monitoring
	stats       *ManagerStats
}

// ManagerConfig represents plugin manager configuration
type ManagerConfig struct {
	PluginDir       string        `json:"plugin_dir" yaml:"plugin_dir"`
	DataDir         string        `json:"data_dir" yaml:"data_dir"`
	MaxPlugins      int           `json:"max_plugins" yaml:"max_plugins"`
	LoadTimeout     time.Duration `json:"load_timeout" yaml:"load_timeout"`
	StartTimeout    time.Duration `json:"start_timeout" yaml:"start_timeout"`
	StopTimeout     time.Duration `json:"stop_timeout" yaml:"stop_timeout"`
	HealthInterval  time.Duration `json:"health_interval" yaml:"health_interval"`
	EnableSandbox   bool          `json:"enable_sandbox" yaml:"enable_sandbox"`
	AllowedTypes    []PluginType  `json:"allowed_types" yaml:"allowed_types"`
	TrustedSources  []string      `json:"trusted_sources" yaml:"trusted_sources"`
	SecurityPolicy  string        `json:"security_policy" yaml:"security_policy"`
}

// ManagerStats represents plugin manager statistics
type ManagerStats struct {
	TotalPlugins    int           `json:"total_plugins"`
	ActivePlugins   int           `json:"active_plugins"`
	FailedPlugins   int           `json:"failed_plugins"`
	TotalRequests   int64         `json:"total_requests"`
	TotalErrors     int64         `json:"total_errors"`
	AverageLatency  time.Duration `json:"average_latency"`
	LastUpdate      time.Time     `json:"last_update"`
}

// NewManager creates a new plugin manager
func NewManager(config *ManagerConfig) (*Manager, error) {
	if config == nil {
		config = &ManagerConfig{
			PluginDir:      "./plugins",
			DataDir:        "./data/plugins",
			MaxPlugins:     100,
			LoadTimeout:    30 * time.Second,
			StartTimeout:   10 * time.Second,
			StopTimeout:    10 * time.Second,
			HealthInterval: 30 * time.Second,
			EnableSandbox:  true,
			AllowedTypes:   []PluginType{PluginTypeField, PluginTypeValidator, PluginTypeExporter},
		}
	}

	// Create directories
	if err := os.MkdirAll(config.PluginDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create plugin directory: %w", err)
	}
	if err := os.MkdirAll(config.DataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	manager := &Manager{
		plugins:   make(map[string]*PluginManifest),
		instances: make(map[string]*PluginInstance),
		hooks:     make(map[string][]Hook),
		sandboxes: make(map[string]Sandbox),
		config:    config,
		pluginDir: config.PluginDir,
		dataDir:   config.DataDir,
		eventChan: make(chan Event, 1000),
		stopChan:  make(chan struct{}),
		stats:     &ManagerStats{},
	}

	// Initialize components
	manager.loader = NewLoader(config)
	manager.registry = NewRegistry(config)
	manager.executor = NewExecutor(config)
	manager.monitor = NewMonitor(config)

	return manager, nil
}

// Start starts the plugin manager
func (m *Manager) Start(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Start event processing
	go m.processEvents()

	// Start monitoring
	go m.monitor.Start(ctx, m)

	// Load existing plugins
	if err := m.loadExistingPlugins(ctx); err != nil {
		return fmt.Errorf("failed to load existing plugins: %w", err)
	}

	// Start health checking
	go m.healthChecker(ctx)

	return nil
}

// Stop stops the plugin manager
func (m *Manager) Stop(ctx context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Signal stop
	close(m.stopChan)

	// Stop all instances
	for _, instance := range m.instances {
		if instance.Status == PluginStatusEnabled {
			if err := m.stopInstance(ctx, instance.ID); err != nil {
				// Log error but continue
				continue
			}
		}
	}

	// Stop monitoring
	if err := m.monitor.Stop(ctx); err != nil {
		return fmt.Errorf("failed to stop monitor: %w", err)
	}

	return nil
}

// Install installs a plugin from a package
func (m *Manager) Install(ctx context.Context, packagePath string, options *InstallOptions) (*PluginManifest, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Load and validate package
	manifest, err := m.loader.LoadPackage(ctx, packagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to load package: %w", err)
	}

	// Check if plugin already exists
	if _, exists := m.plugins[manifest.ID]; exists {
		if options != nil && options.Force {
			// Uninstall existing version
			if err := m.uninstallPlugin(ctx, manifest.ID); err != nil {
				return nil, fmt.Errorf("failed to uninstall existing plugin: %w", err)
			}
		} else {
			return nil, fmt.Errorf("plugin %s already installed", manifest.ID)
		}
	}

	// Validate plugin
	if err := m.validatePlugin(ctx, manifest); err != nil {
		return nil, fmt.Errorf("plugin validation failed: %w", err)
	}

	// Install plugin
	installPath := filepath.Join(m.pluginDir, manifest.ID)
	if err := m.loader.InstallPlugin(ctx, packagePath, installPath); err != nil {
		return nil, fmt.Errorf("failed to install plugin: %w", err)
	}

	// Update manifest with install path
	manifest.InstallPath = installPath
	manifest.CreatedAt = time.Now()
	manifest.UpdatedAt = time.Now()

	// Register plugin
	m.plugins[manifest.ID] = manifest

	// Save to registry
	if err := m.registry.Register(ctx, manifest); err != nil {
		return nil, fmt.Errorf("failed to register plugin: %w", err)
	}

	// Emit event
	m.emitEvent(Event{
		Type:      "plugin.installed",
		Source:    "plugin_manager",
		Data:      manifest,
		Timestamp: time.Now(),
	})

	m.updateStats()

	return manifest, nil
}

// Uninstall uninstalls a plugin
func (m *Manager) Uninstall(ctx context.Context, pluginID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.uninstallPlugin(ctx, pluginID)
}

// Enable enables a plugin
func (m *Manager) Enable(ctx context.Context, pluginID string, config types.JSON) (*PluginInstance, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	plugin, exists := m.plugins[pluginID]
	if !exists {
		return nil, fmt.Errorf("plugin %s not found", pluginID)
	}

	// Check if already enabled
	for _, instance := range m.instances {
		if instance.PluginID == pluginID && instance.Status == PluginStatusEnabled {
			return nil, fmt.Errorf("plugin %s already enabled", pluginID)
		}
	}

	// Create instance
	instance := &PluginInstance{
		ID:        fmt.Sprintf("%s-%d", pluginID, time.Now().Unix()),
		PluginID:  pluginID,
		Name:      plugin.Name,
		Status:    PluginStatusInstalled,
		Config:    config,
		Context:   make(map[string]interface{}),
		Stats:     &PluginStats{},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Start instance
	if err := m.startInstance(ctx, instance); err != nil {
		return nil, fmt.Errorf("failed to start plugin instance: %w", err)
	}

	m.instances[instance.ID] = instance

	// Emit event
	m.emitEvent(Event{
		Type:      "plugin.enabled",
		Source:    "plugin_manager",
		Data:      instance,
		Timestamp: time.Now(),
	})

	m.updateStats()

	return instance, nil
}

// Disable disables a plugin instance
func (m *Manager) Disable(ctx context.Context, instanceID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	instance, exists := m.instances[instanceID]
	if !exists {
		return fmt.Errorf("plugin instance %s not found", instanceID)
	}

	if err := m.stopInstance(ctx, instanceID); err != nil {
		return fmt.Errorf("failed to stop plugin instance: %w", err)
	}

	instance.Status = PluginStatusDisabled
	instance.UpdatedAt = time.Now()

	// Emit event
	m.emitEvent(Event{
		Type:      "plugin.disabled",
		Source:    "plugin_manager",
		Data:      instance,
		Timestamp: time.Now(),
	})

	m.updateStats()

	return nil
}

// Execute executes a plugin operation
func (m *Manager) Execute(ctx context.Context, pluginID string, operation string, params types.JSON) (interface{}, error) {
	m.mu.RLock()
	instance := m.findEnabledInstance(pluginID)
	m.mu.RUnlock()

	if instance == nil {
		return nil, fmt.Errorf("no enabled instance found for plugin %s", pluginID)
	}

	// Execute through executor
	result, err := m.executor.Execute(ctx, instance, operation, params)
	if err != nil {
		instance.Stats.ErrorCount++
		instance.Stats.LastError = &[]time.Time{time.Now()}[0]
		return nil, fmt.Errorf("plugin execution failed: %w", err)
	}

	// Update stats
	instance.Stats.RequestCount++
	instance.Stats.LastRequest = &[]time.Time{time.Now()}[0]
	instance.Stats.UpdatedAt = time.Now()

	return result, nil
}

// GetPlugins returns all installed plugins
func (m *Manager) GetPlugins() []*PluginManifest {
	m.mu.RLock()
	defer m.mu.RUnlock()

	plugins := make([]*PluginManifest, 0, len(m.plugins))
	for _, plugin := range m.plugins {
		plugins = append(plugins, plugin)
	}

	return plugins
}

// GetInstances returns all plugin instances
func (m *Manager) GetInstances() []*PluginInstance {
	m.mu.RLock()
	defer m.mu.RUnlock()

	instances := make([]*PluginInstance, 0, len(m.instances))
	for _, instance := range m.instances {
		instances = append(instances, instance)
	}

	return instances
}

// GetPlugin returns a specific plugin
func (m *Manager) GetPlugin(pluginID string) (*PluginManifest, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	plugin, exists := m.plugins[pluginID]
	return plugin, exists
}

// GetInstance returns a specific instance
func (m *Manager) GetInstance(instanceID string) (*PluginInstance, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	instance, exists := m.instances[instanceID]
	return instance, exists
}

// RegisterHook registers a hook handler
func (m *Manager) RegisterHook(hookName string, hook Hook) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.hooks[hookName] = append(m.hooks[hookName], hook)
}

// ExecuteHook executes all handlers for a hook
func (m *Manager) ExecuteHook(ctx context.Context, hookName string, data interface{}) error {
	m.mu.RLock()
	hooks := m.hooks[hookName]
	m.mu.RUnlock()

	for _, hook := range hooks {
		if err := hook.Execute(ctx, data); err != nil {
			return fmt.Errorf("hook %s execution failed: %w", hookName, err)
		}
	}

	return nil
}

// GetStats returns manager statistics
func (m *Manager) GetStats() *ManagerStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	// Create a copy to avoid race conditions
	stats := *m.stats
	return &stats
}

// Private methods

func (m *Manager) loadExistingPlugins(ctx context.Context) error {
	plugins, err := m.registry.List(ctx)
	if err != nil {
		return fmt.Errorf("failed to list plugins from registry: %w", err)
	}

	for _, plugin := range plugins {
		m.plugins[plugin.ID] = plugin
	}

	return nil
}

func (m *Manager) uninstallPlugin(ctx context.Context, pluginID string) error {
	plugin, exists := m.plugins[pluginID]
	if !exists {
		return fmt.Errorf("plugin %s not found", pluginID)
	}

	// Stop all instances
	for _, instance := range m.instances {
		if instance.PluginID == pluginID {
			if err := m.stopInstance(ctx, instance.ID); err != nil {
				return fmt.Errorf("failed to stop instance %s: %w", instance.ID, err)
			}
			delete(m.instances, instance.ID)
		}
	}

	// Remove from filesystem
	if err := os.RemoveAll(plugin.InstallPath); err != nil {
		return fmt.Errorf("failed to remove plugin files: %w", err)
	}

	// Unregister from registry
	if err := m.registry.Unregister(ctx, pluginID); err != nil {
		return fmt.Errorf("failed to unregister plugin: %w", err)
	}

	delete(m.plugins, pluginID)

	// Emit event
	m.emitEvent(Event{
		Type:      "plugin.uninstalled",
		Source:    "plugin_manager",
		Data:      plugin,
		Timestamp: time.Now(),
	})

	return nil
}

func (m *Manager) startInstance(ctx context.Context, instance *PluginInstance) error {
	plugin := m.plugins[instance.PluginID]

	// Create sandbox if enabled
	if m.config.EnableSandbox {
		sandbox, err := NewSandbox(plugin, instance)
		if err != nil {
			return fmt.Errorf("failed to create sandbox: %w", err)
		}
		m.sandboxes[instance.ID] = sandbox
	}

	// Start plugin
	if err := m.executor.Start(ctx, instance); err != nil {
		return fmt.Errorf("failed to start plugin: %w", err)
	}

	instance.Status = PluginStatusEnabled
	instance.StartedAt = &[]time.Time{time.Now()}[0]
	instance.UpdatedAt = time.Now()

	return nil
}

func (m *Manager) stopInstance(ctx context.Context, instanceID string) error {
	instance := m.instances[instanceID]

	// Stop plugin
	if err := m.executor.Stop(ctx, instance); err != nil {
		return fmt.Errorf("failed to stop plugin: %w", err)
	}

	// Clean up sandbox
	if sandbox, exists := m.sandboxes[instanceID]; exists {
		if err := sandbox.Destroy(); err != nil {
			// Log error but continue
		}
		delete(m.sandboxes, instanceID)
	}

	instance.Status = PluginStatusDisabled
	instance.StoppedAt = &[]time.Time{time.Now()}[0]
	instance.UpdatedAt = time.Now()

	return nil
}

func (m *Manager) validatePlugin(ctx context.Context, manifest *PluginManifest) error {
	// Check plugin type is allowed
	allowed := false
	for _, allowedType := range m.config.AllowedTypes {
		if manifest.Type == allowedType {
			allowed = true
			break
		}
	}
	if !allowed {
		return fmt.Errorf("plugin type %s not allowed", manifest.Type)
	}

	// Check dependencies
	for dep, version := range manifest.Dependencies {
		if !m.checkDependency(dep, version) {
			return fmt.Errorf("dependency %s:%s not satisfied", dep, version)
		}
	}

	// Additional validation based on plugin type
	switch manifest.Type {
	case PluginTypeField:
		return m.validateFieldPlugin(ctx, manifest)
	case PluginTypeValidator:
		return m.validateValidatorPlugin(ctx, manifest)
	// Add more cases as needed
	}

	return nil
}

func (m *Manager) validateFieldPlugin(ctx context.Context, manifest *PluginManifest) error {
	// Field plugins must have specific hooks
	requiredHooks := []string{"validate_value", "format_value"}
	for _, required := range requiredHooks {
		found := false
		for _, hook := range manifest.Hooks {
			if hook == required {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("field plugin missing required hook: %s", required)
		}
	}
	return nil
}

func (m *Manager) validateValidatorPlugin(ctx context.Context, manifest *PluginManifest) error {
	// Validator plugins must have validation hooks
	requiredHooks := []string{"validate_model", "validate_instance"}
	hasAny := false
	for _, required := range requiredHooks {
		for _, hook := range manifest.Hooks {
			if hook == required {
				hasAny = true
				break
			}
		}
	}
	if !hasAny {
		return fmt.Errorf("validator plugin must have at least one validation hook")
	}
	return nil
}

func (m *Manager) checkDependency(name, version string) bool {
	// Check if dependency is satisfied
	// This could check system packages, other plugins, etc.
	return true // Simplified for now
}

func (m *Manager) findEnabledInstance(pluginID string) *PluginInstance {
	for _, instance := range m.instances {
		if instance.PluginID == pluginID && instance.Status == PluginStatusEnabled {
			return instance
		}
	}
	return nil
}

func (m *Manager) processEvents() {
	for {
		select {
		case event := <-m.eventChan:
			// Process event (could send to monitoring, logging, etc.)
			m.handleEvent(event)
		case <-m.stopChan:
			return
		}
	}
}

func (m *Manager) handleEvent(event Event) {
	// Handle different event types
	switch event.Type {
	case "plugin.installed":
		// Handle plugin installation
	case "plugin.enabled":
		// Handle plugin enabling
	case "plugin.disabled":
		// Handle plugin disabling
	case "plugin.error":
		// Handle plugin errors
	}
}

func (m *Manager) emitEvent(event Event) {
	select {
	case m.eventChan <- event:
	default:
		// Channel full, drop event (or handle differently)
	}
}

func (m *Manager) healthChecker(ctx context.Context) {
	ticker := time.NewTicker(m.config.HealthInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			m.checkInstanceHealth(ctx)
		case <-ctx.Done():
			return
		case <-m.stopChan:
			return
		}
	}
}

func (m *Manager) checkInstanceHealth(ctx context.Context) {
	m.mu.RLock()
	instances := make([]*PluginInstance, 0, len(m.instances))
	for _, instance := range m.instances {
		if instance.Status == PluginStatusEnabled {
			instances = append(instances, instance)
		}
	}
	m.mu.RUnlock()

	for _, instance := range instances {
		if err := m.executor.Health(ctx, instance); err != nil {
			// Mark instance as unhealthy
			m.mu.Lock()
			instance.Status = PluginStatusError
			instance.UpdatedAt = time.Now()
			m.mu.Unlock()

			// Emit error event
			m.emitEvent(Event{
				Type:      "plugin.error",
				Source:    "plugin_manager",
				Data:      map[string]interface{}{"instance": instance, "error": err.Error()},
				Timestamp: time.Now(),
			})
		}
	}
}

func (m *Manager) updateStats() {
	m.stats.TotalPlugins = len(m.plugins)
	m.stats.ActivePlugins = 0
	m.stats.FailedPlugins = 0

	for _, instance := range m.instances {
		switch instance.Status {
		case PluginStatusEnabled:
			m.stats.ActivePlugins++
		case PluginStatusError:
			m.stats.FailedPlugins++
		}
	}

	m.stats.LastUpdate = time.Now()
}

// InstallOptions represents plugin installation options
type InstallOptions struct {
	Force       bool       `json:"force"`
	Config      types.JSON `json:"config,omitempty"`
	AutoEnable  bool       `json:"auto_enable"`
	Permissions []string   `json:"permissions,omitempty"`
}