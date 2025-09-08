package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// Registry manages plugin registration and metadata storage
type Registry interface {
	Register(ctx context.Context, manifest *PluginManifest) error
	Unregister(ctx context.Context, pluginID string) error
	Get(ctx context.Context, pluginID string) (*PluginManifest, error)
	List(ctx context.Context) ([]*PluginManifest, error)
	Update(ctx context.Context, manifest *PluginManifest) error
	Search(ctx context.Context, query *SearchQuery) ([]*PluginManifest, error)
	GetByType(ctx context.Context, pluginType PluginType) ([]*PluginManifest, error)
	GetDependents(ctx context.Context, pluginID string) ([]*PluginManifest, error)
}

type registry struct {
	config   *ManagerConfig
	dataPath string
}

// SearchQuery represents a plugin search query
type SearchQuery struct {
	Query       string     `json:"query"`
	Type        PluginType `json:"type,omitempty"`
	Tags        []string   `json:"tags,omitempty"`
	Keywords    []string   `json:"keywords,omitempty"`
	Author      string     `json:"author,omitempty"`
	MinVersion  string     `json:"min_version,omitempty"`
	MaxVersion  string     `json:"max_version,omitempty"`
	Limit       int        `json:"limit,omitempty"`
	Offset      int        `json:"offset,omitempty"`
}

// NewRegistry creates a new plugin registry
func NewRegistry(config *ManagerConfig) Registry {
	dataPath := filepath.Join(config.DataDir, "registry")
	os.MkdirAll(dataPath, 0755)
	
	return &registry{
		config:   config,
		dataPath: dataPath,
	}
}

// Register registers a plugin in the registry
func (r *registry) Register(ctx context.Context, manifest *PluginManifest) error {
	// Create plugin directory
	pluginDir := filepath.Join(r.dataPath, manifest.ID)
	if err := os.MkdirAll(pluginDir, 0755); err != nil {
		return fmt.Errorf("failed to create plugin directory: %w", err)
	}
	
	// Save manifest
	manifestPath := filepath.Join(pluginDir, "manifest.json")
	data, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}
	
	if err := os.WriteFile(manifestPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write manifest file: %w", err)
	}
	
	// Save metadata
	metadata := &PluginMetadata{
		ID:           manifest.ID,
		RegisteredAt: time.Now(),
		UpdatedAt:    time.Now(),
		Status:       PluginStatusInstalled,
	}
	
	metadataPath := filepath.Join(pluginDir, "metadata.json")
	metaData, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}
	
	if err := os.WriteFile(metadataPath, metaData, 0644); err != nil {
		return fmt.Errorf("failed to write metadata file: %w", err)
	}
	
	return nil
}

// Unregister removes a plugin from the registry
func (r *registry) Unregister(ctx context.Context, pluginID string) error {
	pluginDir := filepath.Join(r.dataPath, pluginID)
	return os.RemoveAll(pluginDir)
}

// Get retrieves a plugin manifest by ID
func (r *registry) Get(ctx context.Context, pluginID string) (*PluginManifest, error) {
	manifestPath := filepath.Join(r.dataPath, pluginID, "manifest.json")
	
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("plugin %s not found", pluginID)
		}
		return nil, fmt.Errorf("failed to read manifest: %w", err)
	}
	
	var manifest PluginManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to unmarshal manifest: %w", err)
	}
	
	return &manifest, nil
}

// List returns all registered plugins
func (r *registry) List(ctx context.Context) ([]*PluginManifest, error) {
	entries, err := os.ReadDir(r.dataPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read registry directory: %w", err)
	}
	
	var manifests []*PluginManifest
	
	for _, entry := range entries {
		if entry.IsDir() {
			manifest, err := r.Get(ctx, entry.Name())
			if err != nil {
				// Log error but continue
				continue
			}
			manifests = append(manifests, manifest)
		}
	}
	
	return manifests, nil
}

// Update updates a plugin manifest
func (r *registry) Update(ctx context.Context, manifest *PluginManifest) error {
	// Check if plugin exists
	if _, err := r.Get(ctx, manifest.ID); err != nil {
		return fmt.Errorf("plugin not found: %w", err)
	}
	
	// Update timestamps
	manifest.UpdatedAt = time.Now()
	
	// Save updated manifest
	return r.Register(ctx, manifest)
}

// Search searches for plugins based on query criteria
func (r *registry) Search(ctx context.Context, query *SearchQuery) ([]*PluginManifest, error) {
	allPlugins, err := r.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list plugins: %w", err)
	}
	
	var results []*PluginManifest
	
	for _, plugin := range allPlugins {
		if r.matchesQuery(plugin, query) {
			results = append(results, plugin)
		}
	}
	
	// Apply pagination
	if query.Offset > 0 {
		if query.Offset >= len(results) {
			return []*PluginManifest{}, nil
		}
		results = results[query.Offset:]
	}
	
	if query.Limit > 0 && query.Limit < len(results) {
		results = results[:query.Limit]
	}
	
	return results, nil
}

// GetByType returns all plugins of a specific type
func (r *registry) GetByType(ctx context.Context, pluginType PluginType) ([]*PluginManifest, error) {
	query := &SearchQuery{
		Type: pluginType,
	}
	return r.Search(ctx, query)
}

// GetDependents returns plugins that depend on the specified plugin
func (r *registry) GetDependents(ctx context.Context, pluginID string) ([]*PluginManifest, error) {
	allPlugins, err := r.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list plugins: %w", err)
	}
	
	var dependents []*PluginManifest
	
	for _, plugin := range allPlugins {
		for dep := range plugin.Dependencies {
			if dep == pluginID {
				dependents = append(dependents, plugin)
				break
			}
		}
	}
	
	return dependents, nil
}

// Private methods

func (r *registry) matchesQuery(plugin *PluginManifest, query *SearchQuery) bool {
	// Check type filter
	if query.Type != "" && plugin.Type != query.Type {
		return false
	}
	
	// Check author filter
	if query.Author != "" && plugin.Author != query.Author {
		return false
	}
	
	// Check version filters
	if query.MinVersion != "" {
		if !r.versionGTE(plugin.Version, query.MinVersion) {
			return false
		}
	}
	
	if query.MaxVersion != "" {
		if !r.versionLTE(plugin.Version, query.MaxVersion) {
			return false
		}
	}
	
	// Check tags filter
	if len(query.Tags) > 0 {
		if !r.containsAnyTags(plugin.Tags, query.Tags) {
			return false
		}
	}
	
	// Check keywords filter
	if len(query.Keywords) > 0 {
		if !r.containsAnyKeywords(plugin.Keywords, query.Keywords) {
			return false
		}
	}
	
	// Check text query
	if query.Query != "" {
		if !r.matchesTextQuery(plugin, query.Query) {
			return false
		}
	}
	
	return true
}

func (r *registry) containsAnyTags(pluginTags, queryTags []string) bool {
	for _, queryTag := range queryTags {
		for _, pluginTag := range pluginTags {
			if pluginTag == queryTag {
				return true
			}
		}
	}
	return false
}

func (r *registry) containsAnyKeywords(pluginKeywords, queryKeywords []string) bool {
	for _, queryKeyword := range queryKeywords {
		for _, pluginKeyword := range pluginKeywords {
			if pluginKeyword == queryKeyword {
				return true
			}
		}
	}
	return false
}

func (r *registry) matchesTextQuery(plugin *PluginManifest, query string) bool {
	// Simple text matching in name, description, and keywords
	query = toLower(query)
	
	if contains(toLower(plugin.Name), query) {
		return true
	}
	
	if contains(toLower(plugin.Description), query) {
		return true
	}
	
	for _, keyword := range plugin.Keywords {
		if contains(toLower(keyword), query) {
			return true
		}
	}
	
	for _, tag := range plugin.Tags {
		if contains(toLower(tag), query) {
			return true
		}
	}
	
	return false
}

func (r *registry) versionGTE(version, minVersion string) bool {
	// Simplified version comparison
	return r.compareVersions(version, minVersion) >= 0
}

func (r *registry) versionLTE(version, maxVersion string) bool {
	// Simplified version comparison
	return r.compareVersions(version, maxVersion) <= 0
}

func (r *registry) compareVersions(v1, v2 string) int {
	// Simplified semantic version comparison
	// In a real implementation, you'd use a proper semver library
	
	if v1 == v2 {
		return 0
	}
	
	if v1 < v2 {
		return -1
	}
	
	return 1
}

// PluginMetadata represents additional plugin metadata
type PluginMetadata struct {
	ID           string       `json:"id"`
	RegisteredAt time.Time    `json:"registered_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
	Status       PluginStatus `json:"status"`
	Usage        *UsageStats  `json:"usage,omitempty"`
}

// UsageStats represents plugin usage statistics
type UsageStats struct {
	InstallCount    int64     `json:"install_count"`
	EnableCount     int64     `json:"enable_count"`
	LastUsed        time.Time `json:"last_used"`
	TotalRequests   int64     `json:"total_requests"`
	TotalErrors     int64     `json:"total_errors"`
	AverageLatency  int64     `json:"average_latency_ms"`
}

// Helper functions

func toLower(s string) string {
	return string([]rune(s)) // Simplified - use proper Unicode handling in production
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && 
		   (len(substr) == 0 || findSubstring(s, substr) >= 0)
}

func findSubstring(s, substr string) int {
	// Simplified substring search
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

// RegistryStore represents a persistent storage interface for the registry
type RegistryStore interface {
	Save(ctx context.Context, key string, value interface{}) error
	Load(ctx context.Context, key string, value interface{}) error
	Delete(ctx context.Context, key string) error
	List(ctx context.Context, prefix string) ([]string, error)
	Exists(ctx context.Context, key string) (bool, error)
}

// FileRegistryStore implements RegistryStore using file system
type FileRegistryStore struct {
	basePath string
}

// NewFileRegistryStore creates a new file-based registry store
func NewFileRegistryStore(basePath string) (*FileRegistryStore, error) {
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create registry directory: %w", err)
	}
	
	return &FileRegistryStore{
		basePath: basePath,
	}, nil
}

// Save saves a value to the store
func (s *FileRegistryStore) Save(ctx context.Context, key string, value interface{}) error {
	path := filepath.Join(s.basePath, key+".json")
	
	// Create parent directories
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("failed to create parent directories: %w", err)
	}
	
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}
	
	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}
	
	return nil
}

// Load loads a value from the store
func (s *FileRegistryStore) Load(ctx context.Context, key string, value interface{}) error {
	path := filepath.Join(s.basePath, key+".json")
	
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("key %s not found", key)
		}
		return fmt.Errorf("failed to read file: %w", err)
	}
	
	if err := json.Unmarshal(data, value); err != nil {
		return fmt.Errorf("failed to unmarshal value: %w", err)
	}
	
	return nil
}

// Delete deletes a value from the store
func (s *FileRegistryStore) Delete(ctx context.Context, key string) error {
	path := filepath.Join(s.basePath, key+".json")
	
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	
	return nil
}

// List lists all keys with the given prefix
func (s *FileRegistryStore) List(ctx context.Context, prefix string) ([]string, error) {
	var keys []string
	
	err := filepath.Walk(s.basePath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if !info.IsDir() && filepath.Ext(path) == ".json" {
			relPath, err := filepath.Rel(s.basePath, path)
			if err != nil {
				return err
			}
			
			key := relPath[:len(relPath)-5] // Remove .json extension
			
			if prefix == "" || filepath.HasPrefix(key, prefix) {
				keys = append(keys, key)
			}
		}
		
		return nil
	})
	
	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}
	
	return keys, nil
}

// Exists checks if a key exists in the store
func (s *FileRegistryStore) Exists(ctx context.Context, key string) (bool, error) {
	path := filepath.Join(s.basePath, key+".json")
	
	_, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return false, nil
		}
		return false, fmt.Errorf("failed to check file existence: %w", err)
	}
	
	return true, nil
}