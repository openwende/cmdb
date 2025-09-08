package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// Executor handles plugin execution and communication
type Executor interface {
	Start(ctx context.Context, instance *PluginInstance) error
	Stop(ctx context.Context, instance *PluginInstance) error
	Execute(ctx context.Context, instance *PluginInstance, operation string, params types.JSON) (interface{}, error)
	Health(ctx context.Context, instance *PluginInstance) error
	GetStatus(ctx context.Context, instance *PluginInstance) (PluginStatus, error)
}

type executor struct {
	config    *ManagerConfig
	processes map[string]*PluginProcess
	mu        sync.RWMutex
	httpClient *http.Client
}

// PluginProcess represents a running plugin process
type PluginProcess struct {
	ID       string
	PID      int
	Cmd      *exec.Cmd
	Address  string
	Port     int
	Started  time.Time
	LastPing time.Time
}

// PluginRequest represents a request to a plugin
type PluginRequest struct {
	Operation string     `json:"operation"`
	Params    types.JSON `json:"params,omitempty"`
	Context   types.JSON `json:"context,omitempty"`
	RequestID string     `json:"request_id"`
}

// PluginResponse represents a response from a plugin
type PluginResponse struct {
	Success   bool        `json:"success"`
	Data      interface{} `json:"data,omitempty"`
	Error     string      `json:"error,omitempty"`
	RequestID string      `json:"request_id"`
	Duration  int64       `json:"duration_ms"`
}

// NewExecutor creates a new plugin executor
func NewExecutor(config *ManagerConfig) Executor {
	return &executor{
		config:    config,
		processes: make(map[string]*PluginProcess),
		httpClient: &http.Client{
			Timeout: config.StartTimeout,
		},
	}
}

// Start starts a plugin instance
func (e *executor) Start(ctx context.Context, instance *PluginInstance) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	// Check if already running
	if _, exists := e.processes[instance.ID]; exists {
		return fmt.Errorf("plugin instance %s already running", instance.ID)
	}

	// Determine execution method based on plugin type
	manifest, err := e.getPluginManifest(instance.PluginID)
	if err != nil {
		return fmt.Errorf("failed to get plugin manifest: %w", err)
	}

	var process *PluginProcess

	switch {
	case manifest.Binary != "":
		// Execute as binary
		process, err = e.startBinaryPlugin(ctx, instance, manifest)
	case manifest.Entrypoint != "":
		// Execute as script
		process, err = e.startScriptPlugin(ctx, instance, manifest)
	default:
		return fmt.Errorf("no execution method specified for plugin %s", instance.PluginID)
	}

	if err != nil {
		return fmt.Errorf("failed to start plugin: %w", err)
	}

	e.processes[instance.ID] = process

	// Update instance information
	instance.PID = process.PID
	instance.Address = process.Address
	instance.Port = process.Port

	// Wait for plugin to be ready
	if err := e.waitForReady(ctx, instance); err != nil {
		e.stopProcess(process)
		delete(e.processes, instance.ID)
		return fmt.Errorf("plugin failed to become ready: %w", err)
	}

	return nil
}

// Stop stops a plugin instance
func (e *executor) Stop(ctx context.Context, instance *PluginInstance) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	process, exists := e.processes[instance.ID]
	if !exists {
		return fmt.Errorf("plugin instance %s not running", instance.ID)
	}

	if err := e.stopProcess(process); err != nil {
		return fmt.Errorf("failed to stop plugin process: %w", err)
	}

	delete(e.processes, instance.ID)

	// Clear instance information
	instance.PID = 0
	instance.Address = ""
	instance.Port = 0

	return nil
}

// Execute executes an operation on a plugin instance
func (e *executor) Execute(ctx context.Context, instance *PluginInstance, operation string, params types.JSON) (interface{}, error) {
	e.mu.RLock()
	process, exists := e.processes[instance.ID]
	e.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("plugin instance %s not running", instance.ID)
	}

	// Create request
	request := &PluginRequest{
		Operation: operation,
		Params:    params,
		Context:   e.buildContext(ctx, instance),
		RequestID: generateRequestID(),
	}

	// Send request to plugin
	response, err := e.sendRequest(ctx, process, request)
	if err != nil {
		return nil, fmt.Errorf("failed to send request to plugin: %w", err)
	}

	if !response.Success {
		return nil, fmt.Errorf("plugin operation failed: %s", response.Error)
	}

	return response.Data, nil
}

// Health checks the health of a plugin instance
func (e *executor) Health(ctx context.Context, instance *PluginInstance) error {
	e.mu.RLock()
	process, exists := e.processes[instance.ID]
	e.mu.RUnlock()

	if !exists {
		return fmt.Errorf("plugin instance %s not running", instance.ID)
	}

	// Send health check request
	request := &PluginRequest{
		Operation: "health",
		RequestID: generateRequestID(),
	}

	response, err := e.sendRequest(ctx, process, request)
	if err != nil {
		return fmt.Errorf("health check failed: %w", err)
	}

	if !response.Success {
		return fmt.Errorf("plugin reported unhealthy: %s", response.Error)
	}

	// Update last ping time
	e.mu.Lock()
	process.LastPing = time.Now()
	e.mu.Unlock()

	return nil
}

// GetStatus returns the current status of a plugin instance
func (e *executor) GetStatus(ctx context.Context, instance *PluginInstance) (PluginStatus, error) {
	e.mu.RLock()
	process, exists := e.processes[instance.ID]
	e.mu.RUnlock()

	if !exists {
		return PluginStatusDisabled, nil
	}

	// Check if process is still running
	if !e.isProcessRunning(process) {
		// Clean up dead process
		e.mu.Lock()
		delete(e.processes, instance.ID)
		e.mu.Unlock()
		return PluginStatusError, nil
	}

	// Check if plugin is responsive
	if err := e.Health(ctx, instance); err != nil {
		return PluginStatusError, nil
	}

	return PluginStatusEnabled, nil
}

// Private methods

func (e *executor) getPluginManifest(pluginID string) (*PluginManifest, error) {
	// This should be injected or passed in a real implementation
	// For now, we'll load it from the plugin directory
	manifestPath := filepath.Join(e.config.PluginDir, pluginID, "plugin.yaml")
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		manifestPath = filepath.Join(e.config.PluginDir, pluginID, "plugin.json")
	}

	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read manifest: %w", err)
	}

	var manifest PluginManifest
	if strings.HasSuffix(manifestPath, ".json") {
		err = json.Unmarshal(data, &manifest)
	} else {
		// Would use yaml.Unmarshal in real implementation
		err = json.Unmarshal(data, &manifest)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to parse manifest: %w", err)
	}

	return &manifest, nil
}

func (e *executor) startBinaryPlugin(ctx context.Context, instance *PluginInstance, manifest *PluginManifest) (*PluginProcess, error) {
	binaryPath := filepath.Join(manifest.InstallPath, manifest.Binary)

	// Check if binary exists and is executable
	if _, err := os.Stat(binaryPath); err != nil {
		return nil, fmt.Errorf("plugin binary not found: %s", binaryPath)
	}

	// Assign a port for the plugin
	port, err := e.getFreePort()
	if err != nil {
		return nil, fmt.Errorf("failed to allocate port: %w", err)
	}

	// Prepare environment
	env := os.Environ()
	env = append(env, fmt.Sprintf("CMDB_PLUGIN_PORT=%d", port))
	env = append(env, fmt.Sprintf("CMDB_PLUGIN_ID=%s", instance.ID))
	env = append(env, fmt.Sprintf("CMDB_DATA_DIR=%s", filepath.Join(e.config.DataDir, instance.ID)))

	// Add plugin configuration
	if instance.Config != nil {
		configData, _ := json.Marshal(instance.Config)
		env = append(env, fmt.Sprintf("CMDB_PLUGIN_CONFIG=%s", string(configData)))
	}

	// Create command
	cmd := exec.CommandContext(ctx, binaryPath)
	cmd.Env = env
	cmd.Dir = manifest.InstallPath

	// Set up logging
	logDir := filepath.Join(e.config.DataDir, instance.ID, "logs")
	os.MkdirAll(logDir, 0755)

	logFile, err := os.OpenFile(filepath.Join(logDir, "plugin.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to create log file: %w", err)
	}

	cmd.Stdout = logFile
	cmd.Stderr = logFile

	// Start the process
	if err := cmd.Start(); err != nil {
		logFile.Close()
		return nil, fmt.Errorf("failed to start plugin process: %w", err)
	}

	process := &PluginProcess{
		ID:      instance.ID,
		PID:     cmd.Process.Pid,
		Cmd:     cmd,
		Address: fmt.Sprintf("http://localhost:%d", port),
		Port:    port,
		Started: time.Now(),
	}

	// Monitor process in background
	go e.monitorProcess(process, logFile)

	return process, nil
}

func (e *executor) startScriptPlugin(ctx context.Context, instance *PluginInstance, manifest *PluginManifest) (*PluginProcess, error) {
	scriptPath := filepath.Join(manifest.InstallPath, manifest.Entrypoint)

	// Check if script exists
	if _, err := os.Stat(scriptPath); err != nil {
		return nil, fmt.Errorf("plugin script not found: %s", scriptPath)
	}

	// Determine interpreter
	interpreter := e.getInterpreter(scriptPath)
	if interpreter == "" {
		return nil, fmt.Errorf("unable to determine interpreter for script: %s", scriptPath)
	}

	// Assign a port for the plugin
	port, err := e.getFreePort()
	if err != nil {
		return nil, fmt.Errorf("failed to allocate port: %w", err)
	}

	// Prepare environment
	env := os.Environ()
	env = append(env, fmt.Sprintf("CMDB_PLUGIN_PORT=%d", port))
	env = append(env, fmt.Sprintf("CMDB_PLUGIN_ID=%s", instance.ID))
	env = append(env, fmt.Sprintf("CMDB_DATA_DIR=%s", filepath.Join(e.config.DataDir, instance.ID)))

	if instance.Config != nil {
		configData, _ := json.Marshal(instance.Config)
		env = append(env, fmt.Sprintf("CMDB_PLUGIN_CONFIG=%s", string(configData)))
	}

	// Create command
	cmd := exec.CommandContext(ctx, interpreter, scriptPath)
	cmd.Env = env
	cmd.Dir = manifest.InstallPath

	// Set up logging
	logDir := filepath.Join(e.config.DataDir, instance.ID, "logs")
	os.MkdirAll(logDir, 0755)

	logFile, err := os.OpenFile(filepath.Join(logDir, "plugin.log"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, fmt.Errorf("failed to create log file: %w", err)
	}

	cmd.Stdout = logFile
	cmd.Stderr = logFile

	// Start the process
	if err := cmd.Start(); err != nil {
		logFile.Close()
		return nil, fmt.Errorf("failed to start plugin process: %w", err)
	}

	process := &PluginProcess{
		ID:      instance.ID,
		PID:     cmd.Process.Pid,
		Cmd:     cmd,
		Address: fmt.Sprintf("http://localhost:%d", port),
		Port:    port,
		Started: time.Now(),
	}

	// Monitor process in background
	go e.monitorProcess(process, logFile)

	return process, nil
}

func (e *executor) getInterpreter(scriptPath string) string {
	ext := strings.ToLower(filepath.Ext(scriptPath))
	
	switch ext {
	case ".py":
		return "python3"
	case ".js":
		return "node"
	case ".sh":
		return "bash"
	case ".rb":
		return "ruby"
	case ".pl":
		return "perl"
	default:
		// Try to read shebang
		if shebang, err := e.readShebang(scriptPath); err == nil && shebang != "" {
			return shebang
		}
		return ""
	}
}

func (e *executor) readShebang(scriptPath string) (string, error) {
	file, err := os.Open(scriptPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// Read first line
	buffer := make([]byte, 256)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	line := string(buffer[:n])
	if strings.HasPrefix(line, "#!") {
		// Extract interpreter from shebang
		shebang := strings.TrimSpace(line[2:])
		parts := strings.Fields(shebang)
		if len(parts) > 0 {
			return filepath.Base(parts[0]), nil
		}
	}

	return "", nil
}

func (e *executor) getFreePort() (int, error) {
	// Simple port allocation - in production, use a proper port allocator
	for port := 8000; port < 9000; port++ {
		if e.isPortFree(port) {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no free ports available")
}

func (e *executor) isPortFree(port int) bool {
	// Simple port check - in production, use net.Listen
	return true // Simplified for now
}

func (e *executor) waitForReady(ctx context.Context, instance *PluginInstance) error {
	deadline := time.Now().Add(e.config.StartTimeout)
	
	for time.Now().Before(deadline) {
		if err := e.Health(ctx, instance); err == nil {
			return nil
		}
		
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Second):
			// Continue trying
		}
	}
	
	return fmt.Errorf("plugin did not become ready within timeout")
}

func (e *executor) sendRequest(ctx context.Context, process *PluginProcess, request *PluginRequest) (*PluginResponse, error) {
	// Serialize request
	data, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize request: %w", err)
	}

	// Create HTTP request
	url := fmt.Sprintf("%s/api/execute", process.Address)
	req, err := http.NewRequestWithContext(ctx, "POST", url, strings.NewReader(string(data)))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send HTTP request: %w", err)
	}
	defer resp.Body.Close()

	// Read response
	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Parse response
	var pluginResp PluginResponse
	if err := json.Unmarshal(respData, &pluginResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &pluginResp, nil
}

func (e *executor) stopProcess(process *PluginProcess) error {
	if process.Cmd != nil && process.Cmd.Process != nil {
		// Try graceful shutdown first
		if err := process.Cmd.Process.Signal(os.Interrupt); err == nil {
			// Wait for graceful shutdown
			done := make(chan error, 1)
			go func() {
				done <- process.Cmd.Wait()
			}()

			select {
			case <-done:
				return nil
			case <-time.After(e.config.StopTimeout):
				// Force kill
				return process.Cmd.Process.Kill()
			}
		}

		// Force kill if graceful shutdown failed
		return process.Cmd.Process.Kill()
	}

	return nil
}

func (e *executor) isProcessRunning(process *PluginProcess) bool {
	if process.Cmd == nil || process.Cmd.Process == nil {
		return false
	}

	// Check if process still exists
	err := process.Cmd.Process.Signal(os.Signal(0))
	return err == nil
}

func (e *executor) monitorProcess(process *PluginProcess, logFile *os.File) {
	defer logFile.Close()

	// Wait for process to exit
	if process.Cmd != nil {
		process.Cmd.Wait()
	}

	// Clean up
	e.mu.Lock()
	delete(e.processes, process.ID)
	e.mu.Unlock()
}

func (e *executor) buildContext(ctx context.Context, instance *PluginInstance) types.JSON {
	context := make(map[string]interface{})

	// Add tenant ID if available
	if tenantID := ctx.Value(ContextKeyTenantID); tenantID != nil {
		context["tenant_id"] = tenantID
	}

	// Add user ID if available
	if userID := ctx.Value(ContextKeyUserID); userID != nil {
		context["user_id"] = userID
	}

	// Add session ID if available
	if sessionID := ctx.Value(ContextKeySession); sessionID != nil {
		context["session_id"] = sessionID
	}

	// Add trace ID if available
	if traceID := ctx.Value(ContextKeyTrace); traceID != nil {
		context["trace_id"] = traceID
	}

	// Add instance context
	for k, v := range instance.Context {
		context[k] = v
	}

	return types.JSON(context)
}

func generateRequestID() string {
	// Simple request ID generation - use proper UUID in production
	return fmt.Sprintf("req_%d", time.Now().UnixNano())
}