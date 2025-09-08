package plugin

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap/zaptest"

	"github.com/wend/cmdb-backend/pkg/types"
)

func TestManagerCreation(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)
	assert.NotNil(t, manager)
	assert.Equal(t, dataPath, manager.dataPath)
}

func TestManagerStartStop(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Test start
	err = manager.Start()
	assert.NoError(t, err)

	// Test stop
	err = manager.Stop()
	assert.NoError(t, err)
}

func createTestPluginManifest(t *testing.T, pluginID string) *PluginManifest {
	return &PluginManifest{
		ID:          pluginID,
		Name:        "Test Plugin",
		Version:     "1.0.0",
		Description: "Test plugin for unit tests",
		Author:      "Test Author",
		Type:        PluginTypeField,
		Config: PluginConfig{
			Schema: types.JSON{
				"type": "object",
				"properties": map[string]interface{}{
					"enabled": map[string]interface{}{
						"type":    "boolean",
						"default": true,
					},
				},
			},
			Default: types.JSON{
				"enabled": true,
			},
			Required: []string{"enabled"},
		},
		Permissions: []string{"field:validate"},
		Resources: &ResourceLimits{
			Memory:  "64MB",
			CPU:     "0.1",
			Disk:    "10MB",
			Timeout: "30s",
		},
		Hooks:      []string{"validate_value"},
		Entrypoint: "main.py",
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
}

func createTestPluginDirectory(t *testing.T, dataPath, pluginID string) string {
	pluginDir := filepath.Join(dataPath, "plugins", pluginID)
	err := os.MkdirAll(pluginDir, 0755)
	require.NoError(t, err)

	// Create manifest file
	manifest := createTestPluginManifest(t, pluginID)
	err = writeManifestToFile(manifest, filepath.Join(pluginDir, "plugin.yaml"))
	require.NoError(t, err)

	// Create main script
	scriptContent := `#!/usr/bin/env python3
print("Test plugin script")
`
	err = os.WriteFile(filepath.Join(pluginDir, "main.py"), []byte(scriptContent), 0755)
	require.NoError(t, err)

	return pluginDir
}

func TestGetPlugin(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create test plugin
	pluginID := "test-plugin"
	createTestPluginDirectory(t, dataPath, pluginID)

	// Register plugin
	manifest := createTestPluginManifest(t, pluginID)
	manifest.InstallPath = filepath.Join(dataPath, "plugins", pluginID)
	err = manager.registry.Register(context.Background(), manifest)
	require.NoError(t, err)

	// Test get plugin
	plugin, err := manager.GetPlugin(pluginID)
	assert.NoError(t, err)
	assert.NotNil(t, plugin)
	assert.Equal(t, pluginID, plugin.ID)
	assert.Equal(t, "Test Plugin", plugin.Name)

	// Test get non-existent plugin
	_, err = manager.GetPlugin("non-existent")
	assert.Error(t, err)
}

func TestListPlugins(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Initially empty
	plugins := manager.ListPlugins()
	assert.Len(t, plugins, 0)

	// Create test plugins
	pluginIDs := []string{"plugin-1", "plugin-2", "plugin-3"}
	for _, pluginID := range pluginIDs {
		createTestPluginDirectory(t, dataPath, pluginID)
		manifest := createTestPluginManifest(t, pluginID)
		manifest.InstallPath = filepath.Join(dataPath, "plugins", pluginID)
		err = manager.registry.Register(context.Background(), manifest)
		require.NoError(t, err)
	}

	// List plugins
	plugins = manager.ListPlugins()
	assert.Len(t, plugins, 3)

	// Check plugin IDs
	foundIDs := make([]string, len(plugins))
	for i, plugin := range plugins {
		foundIDs[i] = plugin.ID
	}
	for _, expectedID := range pluginIDs {
		assert.Contains(t, foundIDs, expectedID)
	}
}

func TestSearchPlugins(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create test plugins with different types
	plugins := []struct {
		id   string
		name string
		typ  PluginType
		tags []string
	}{
		{"email-plugin", "Email Validator", PluginTypeField, []string{"email", "validation"}},
		{"csv-plugin", "CSV Exporter", PluginTypeExporter, []string{"csv", "export"}},
		{"slack-plugin", "Slack Notifier", PluginTypeNotifier, []string{"slack", "notification"}},
	}

	for _, p := range plugins {
		createTestPluginDirectory(t, dataPath, p.id)
		manifest := createTestPluginManifest(t, p.id)
		manifest.Name = p.name
		manifest.Type = p.typ
		manifest.Tags = p.tags
		manifest.InstallPath = filepath.Join(dataPath, "plugins", p.id)
		err = manager.registry.Register(context.Background(), manifest)
		require.NoError(t, err)
	}

	tests := []struct {
		name     string
		query    string
		expected []string
	}{
		{
			name:     "Search by name",
			query:    "Email",
			expected: []string{"email-plugin"},
		},
		{
			name:     "Search by tag",
			query:    "csv",
			expected: []string{"csv-plugin"},
		},
		{
			name:     "Search by type",
			query:    "notifier",
			expected: []string{"slack-plugin"},
		},
		{
			name:     "Case insensitive search",
			query:    "SLACK",
			expected: []string{"slack-plugin"},
		},
		{
			name:     "No matches",
			query:    "nonexistent",
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			results := manager.SearchPlugins(tt.query)
			assert.Len(t, results, len(tt.expected))

			resultIDs := make([]string, len(results))
			for i, plugin := range results {
				resultIDs[i] = plugin.ID
			}

			for _, expectedID := range tt.expected {
				assert.Contains(t, resultIDs, expectedID)
			}
		})
	}
}

func TestEnableDisablePlugin(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create test plugin
	pluginID := "test-plugin"
	createTestPluginDirectory(t, dataPath, pluginID)
	manifest := createTestPluginManifest(t, pluginID)
	manifest.InstallPath = filepath.Join(dataPath, "plugins", pluginID)
	err = manager.registry.Register(context.Background(), manifest)
	require.NoError(t, err)

	// Initially disabled
	plugin, err := manager.GetPlugin(pluginID)
	require.NoError(t, err)
	assert.False(t, plugin.Enabled)

	// Enable plugin
	config := types.JSON{"enabled": true}
	err = manager.EnablePlugin(context.Background(), pluginID, config)
	assert.NoError(t, err)

	// Check enabled state
	plugin, err = manager.GetPlugin(pluginID)
	require.NoError(t, err)
	assert.True(t, plugin.Enabled)

	// Disable plugin
	err = manager.DisablePlugin(context.Background(), pluginID)
	assert.NoError(t, err)

	// Check disabled state
	plugin, err = manager.GetPlugin(pluginID)
	require.NoError(t, err)
	assert.False(t, plugin.Enabled)
}

func TestUninstallPlugin(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create test plugin
	pluginID := "test-plugin"
	pluginDir := createTestPluginDirectory(t, dataPath, pluginID)
	manifest := createTestPluginManifest(t, pluginID)
	manifest.InstallPath = pluginDir
	err = manager.registry.Register(context.Background(), manifest)
	require.NoError(t, err)

	// Verify plugin exists
	plugin, err := manager.GetPlugin(pluginID)
	require.NoError(t, err)
	assert.NotNil(t, plugin)

	// Verify directory exists
	_, err = os.Stat(pluginDir)
	assert.NoError(t, err)

	// Uninstall plugin
	err = manager.UninstallPlugin(context.Background(), pluginID)
	assert.NoError(t, err)

	// Verify plugin is removed
	_, err = manager.GetPlugin(pluginID)
	assert.Error(t, err)

	// Verify directory is removed
	_, err = os.Stat(pluginDir)
	assert.True(t, os.IsNotExist(err))
}

func TestGetPluginsByType(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create plugins of different types
	plugins := []struct {
		id  string
		typ PluginType
	}{
		{"field-1", PluginTypeField},
		{"field-2", PluginTypeField},
		{"exporter-1", PluginTypeExporter},
		{"notifier-1", PluginTypeNotifier},
	}

	for _, p := range plugins {
		createTestPluginDirectory(t, dataPath, p.id)
		manifest := createTestPluginManifest(t, p.id)
		manifest.Type = p.typ
		manifest.InstallPath = filepath.Join(dataPath, "plugins", p.id)
		err = manager.registry.Register(context.Background(), manifest)
		require.NoError(t, err)
	}

	// Test getting plugins by type
	fieldPlugins := manager.GetPluginsByType(PluginTypeField)
	assert.Len(t, fieldPlugins, 2)

	exporterPlugins := manager.GetPluginsByType(PluginTypeExporter)
	assert.Len(t, exporterPlugins, 1)

	notifierPlugins := manager.GetPluginsByType(PluginTypeNotifier)
	assert.Len(t, notifierPlugins, 1)

	// Test non-existent type
	validatorPlugins := manager.GetPluginsByType(PluginTypeValidator)
	assert.Len(t, validatorPlugins, 0)
}

func TestValidateConfig(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create test plugin
	pluginID := "test-plugin"
	createTestPluginDirectory(t, dataPath, pluginID)
	manifest := createTestPluginManifest(t, pluginID)
	manifest.InstallPath = filepath.Join(dataPath, "plugins", pluginID)
	err = manager.registry.Register(context.Background(), manifest)
	require.NoError(t, err)

	tests := []struct {
		name        string
		config      types.JSON
		expectValid bool
	}{
		{
			name:        "Valid config",
			config:      types.JSON{"enabled": true},
			expectValid: true,
		},
		{
			name:        "Valid config with default",
			config:      types.JSON{},
			expectValid: true,
		},
		{
			name:        "Invalid config - wrong type",
			config:      types.JSON{"enabled": "not-boolean"},
			expectValid: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := manager.ValidateConfig(pluginID, tt.config)
			if tt.expectValid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}

func TestPluginDependencies(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create plugin with dependencies
	pluginID := "dependent-plugin"
	createTestPluginDirectory(t, dataPath, pluginID)
	manifest := createTestPluginManifest(t, pluginID)
	manifest.Dependencies = PluginDependencies{
		CMDB: ">=1.0.0",
		Plugins: map[string]string{
			"base-plugin": ">=1.0.0",
		},
	}
	manifest.InstallPath = filepath.Join(dataPath, "plugins", pluginID)

	// Test dependency validation during registration
	err = manager.registry.Register(context.Background(), manifest)
	require.NoError(t, err)

	// Plugin should be registered but validation might warn about missing dependencies
	plugin, err := manager.GetPlugin(pluginID)
	assert.NoError(t, err)
	assert.NotNil(t, plugin)
}

func TestPluginMetrics(t *testing.T) {
	logger := zaptest.NewLogger(t)
	dataPath := t.TempDir()

	manager, err := NewManager(dataPath, logger)
	require.NoError(t, err)

	// Create and register multiple plugins
	for i := 0; i < 5; i++ {
		pluginID := fmt.Sprintf("plugin-%d", i)
		createTestPluginDirectory(t, dataPath, pluginID)
		manifest := createTestPluginManifest(t, pluginID)
		manifest.InstallPath = filepath.Join(dataPath, "plugins", pluginID)
		err = manager.registry.Register(context.Background(), manifest)
		require.NoError(t, err)
	}

	// Enable some plugins
	for i := 0; i < 3; i++ {
		pluginID := fmt.Sprintf("plugin-%d", i)
		err = manager.EnablePlugin(context.Background(), pluginID, types.JSON{"enabled": true})
		require.NoError(t, err)
	}

	// Get metrics
	metrics := manager.GetMetrics()
	assert.Equal(t, 5, metrics.TotalPlugins)
	assert.Equal(t, 3, metrics.EnabledPlugins)
	assert.Equal(t, 2, metrics.DisabledPlugins)
	assert.Equal(t, 0, metrics.RunningInstances)
	assert.NotEmpty(t, metrics.ByType)
	assert.Equal(t, 5, metrics.ByType[string(PluginTypeField)])
}

// Helper function to write manifest to file (simplified)
func writeManifestToFile(manifest *PluginManifest, filePath string) error {
	// In a real implementation, this would serialize the manifest to YAML/JSON
	// For testing, we'll create a minimal file
	content := fmt.Sprintf(`id: "%s"
name: "%s"
version: "%s"
type: "%s"
entrypoint: "%s"
`, manifest.ID, manifest.Name, manifest.Version, manifest.Type, manifest.Entrypoint)

	return os.WriteFile(filePath, []byte(content), 0644)
}