package plugin

import (
	"context"
	"fmt"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
)

// Service provides the main plugin service interface
type Service struct {
	manager *Manager
	config  *ManagerConfig
}

// NewService creates a new plugin service
func NewService(config *ManagerConfig) (*Service, error) {
	manager, err := NewManager(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create plugin manager: %w", err)
	}

	return &Service{
		manager: manager,
		config:  config,
	}, nil
}

// Start starts the plugin service
func (s *Service) Start(ctx context.Context) error {
	return s.manager.Start(ctx)
}

// Stop stops the plugin service
func (s *Service) Stop(ctx context.Context) error {
	return s.manager.Stop(ctx)
}

// Plugin Management Methods

// InstallPlugin installs a plugin from a package
func (s *Service) InstallPlugin(ctx context.Context, packagePath string, options *InstallOptions) (*PluginManifest, error) {
	return s.manager.Install(ctx, packagePath, options)
}

// UninstallPlugin uninstalls a plugin
func (s *Service) UninstallPlugin(ctx context.Context, pluginID string) error {
	return s.manager.Uninstall(ctx, pluginID)
}

// EnablePlugin enables a plugin
func (s *Service) EnablePlugin(ctx context.Context, pluginID string, config types.JSON) (*PluginInstance, error) {
	return s.manager.Enable(ctx, pluginID, config)
}

// DisablePlugin disables a plugin instance
func (s *Service) DisablePlugin(ctx context.Context, instanceID string) error {
	return s.manager.Disable(ctx, instanceID)
}

// GetPlugins returns all installed plugins
func (s *Service) GetPlugins(ctx context.Context) ([]*PluginManifest, error) {
	return s.manager.GetPlugins(), nil
}

// GetPlugin returns a specific plugin
func (s *Service) GetPlugin(ctx context.Context, pluginID string) (*PluginManifest, error) {
	plugin, exists := s.manager.GetPlugin(pluginID)
	if !exists {
		return nil, fmt.Errorf("plugin %s not found", pluginID)
	}
	return plugin, nil
}

// GetInstances returns all plugin instances
func (s *Service) GetInstances(ctx context.Context) ([]*PluginInstance, error) {
	return s.manager.GetInstances(), nil
}

// GetInstance returns a specific plugin instance
func (s *Service) GetInstance(ctx context.Context, instanceID string) (*PluginInstance, error) {
	instance, exists := s.manager.GetInstance(instanceID)
	if !exists {
		return nil, fmt.Errorf("instance %s not found", instanceID)
	}
	return instance, nil
}

// Plugin Execution Methods

// ExecutePlugin executes an operation on a plugin
func (s *Service) ExecutePlugin(ctx context.Context, pluginID string, operation string, params types.JSON) (interface{}, error) {
	return s.manager.Execute(ctx, pluginID, operation, params)
}

// ValidateField validates a field value using field plugins
func (s *Service) ValidateField(ctx context.Context, fieldType string, value interface{}, options types.JSON) error {
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeField {
			// Check if this plugin handles the field type
			if s.pluginHandlesFieldType(plugin, fieldType) {
				// Execute validation
				params := types.JSON{
					"value":   value,
					"options": options,
				}
				
				result, err := s.manager.Execute(ctx, plugin.ID, "validate_value", params)
				if err != nil {
					return fmt.Errorf("field validation failed: %w", err)
				}
				
				// Check if validation passed
				if valid, ok := result.(bool); ok && !valid {
					return fmt.Errorf("field value validation failed")
				}
			}
		}
	}
	
	return nil
}

// FormatField formats a field value using field plugins
func (s *Service) FormatField(ctx context.Context, fieldType string, value interface{}, options types.JSON) (interface{}, error) {
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeField {
			if s.pluginHandlesFieldType(plugin, fieldType) {
				params := types.JSON{
					"value":   value,
					"options": options,
				}
				
				return s.manager.Execute(ctx, plugin.ID, "format_value", params)
			}
		}
	}
	
	return value, nil // Return original value if no formatter found
}

// ValidateModel validates a model using validator plugins
func (s *Service) ValidateModel(ctx context.Context, model interface{}) ([]ValidationError, error) {
	var allErrors []ValidationError
	
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeValidator {
			params := types.JSON{
				"model": model,
			}
			
			result, err := s.manager.Execute(ctx, plugin.ID, "validate_model", params)
			if err != nil {
				return nil, fmt.Errorf("model validation failed: %w", err)
			}
			
			// Parse validation errors
			if errors, ok := result.([]interface{}); ok {
				for _, errorData := range errors {
					if errorMap, ok := errorData.(map[string]interface{}); ok {
						validationError := ValidationError{
							Field:   getString(errorMap, "field"),
							Code:    getString(errorMap, "code"),
							Message: getString(errorMap, "message"),
							Value:   errorMap["value"],
						}
						allErrors = append(allErrors, validationError)
					}
				}
			}
		}
	}
	
	return allErrors, nil
}

// ValidateInstance validates an instance using validator plugins
func (s *Service) ValidateInstance(ctx context.Context, instance interface{}) ([]ValidationError, error) {
	var allErrors []ValidationError
	
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeValidator {
			params := types.JSON{
				"instance": instance,
			}
			
			result, err := s.manager.Execute(ctx, plugin.ID, "validate_instance", params)
			if err != nil {
				return nil, fmt.Errorf("instance validation failed: %w", err)
			}
			
			// Parse validation errors
			if errors, ok := result.([]interface{}); ok {
				for _, errorData := range errors {
					if errorMap, ok := errorData.(map[string]interface{}); ok {
						validationError := ValidationError{
							Field:   getString(errorMap, "field"),
							Code:    getString(errorMap, "code"),
							Message: getString(errorMap, "message"),
							Value:   errorMap["value"],
						}
						allErrors = append(allErrors, validationError)
					}
				}
			}
		}
	}
	
	return allErrors, nil
}

// ExportData exports data using exporter plugins
func (s *Service) ExportData(ctx context.Context, exporterID string, data interface{}, format string, options types.JSON) ([]byte, error) {
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeExporter && plugin.ID == exporterID {
			params := types.JSON{
				"data":    data,
				"format":  format,
				"options": options,
			}
			
			result, err := s.manager.Execute(ctx, plugin.ID, "export", params)
			if err != nil {
				return nil, fmt.Errorf("export failed: %w", err)
			}
			
			if exportedData, ok := result.([]byte); ok {
				return exportedData, nil
			}
			
			return nil, fmt.Errorf("invalid export result type")
		}
	}
	
	return nil, fmt.Errorf("exporter plugin %s not found", exporterID)
}

// ImportData imports data using importer plugins
func (s *Service) ImportData(ctx context.Context, importerID string, data []byte, format string, options types.JSON) ([]interface{}, error) {
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeImporter && plugin.ID == importerID {
			params := types.JSON{
				"data":    data,
				"format":  format,
				"options": options,
			}
			
			result, err := s.manager.Execute(ctx, plugin.ID, "import", params)
			if err != nil {
				return nil, fmt.Errorf("import failed: %w", err)
			}
			
			if importedData, ok := result.([]interface{}); ok {
				return importedData, nil
			}
			
			return nil, fmt.Errorf("invalid import result type")
		}
	}
	
	return nil, fmt.Errorf("importer plugin %s not found", importerID)
}

// ProcessData processes data using processor plugins
func (s *Service) ProcessData(ctx context.Context, processorID string, data interface{}, rules types.JSON) (interface{}, error) {
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeProcessor && plugin.ID == processorID {
			params := types.JSON{
				"data":  data,
				"rules": rules,
			}
			
			return s.manager.Execute(ctx, plugin.ID, "process", params)
		}
	}
	
	return nil, fmt.Errorf("processor plugin %s not found", processorID)
}

// SendNotification sends a notification using notifier plugins
func (s *Service) SendNotification(ctx context.Context, notifierID string, notification Notification) error {
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeNotifier && plugin.ID == notifierID {
			params := types.JSON{
				"notification": notification,
			}
			
			_, err := s.manager.Execute(ctx, plugin.ID, "send", params)
			return err
		}
	}
	
	return fmt.Errorf("notifier plugin %s not found", notifierID)
}

// Hook Management Methods

// RegisterHook registers a hook handler
func (s *Service) RegisterHook(hookName string, hook Hook) {
	s.manager.RegisterHook(hookName, hook)
}

// ExecuteHook executes all handlers for a hook
func (s *Service) ExecuteHook(ctx context.Context, hookName string, data interface{}) error {
	return s.manager.ExecuteHook(ctx, hookName, data)
}

// Monitoring Methods

// GetPluginMetrics returns metrics for all plugins
func (s *Service) GetPluginMetrics(ctx context.Context) (map[string]*PluginMetrics, error) {
	return s.manager.monitor.GetAllMetrics(), nil
}

// GetPluginMetric returns metrics for a specific plugin instance
func (s *Service) GetPluginMetric(ctx context.Context, instanceID string) (*PluginMetrics, error) {
	return s.manager.monitor.GetMetrics(instanceID)
}

// SetAlertThresholds sets alert thresholds for a plugin instance
func (s *Service) SetAlertThresholds(ctx context.Context, instanceID string, thresholds *AlertThresholds) error {
	return s.manager.monitor.SetAlertThresholds(instanceID, thresholds)
}

// GetManagerStats returns plugin manager statistics
func (s *Service) GetManagerStats(ctx context.Context) (*ManagerStats, error) {
	return s.manager.GetStats(), nil
}

// Configuration Methods

// UpdatePluginConfig updates the configuration of a plugin instance
func (s *Service) UpdatePluginConfig(ctx context.Context, instanceID string, config types.JSON) error {
	instance, exists := s.manager.GetInstance(instanceID)
	if !exists {
		return fmt.Errorf("instance %s not found", instanceID)
	}
	
	// Update instance configuration
	instance.Config = config
	instance.UpdatedAt = time.Now()
	
	// If the plugin is running, reconfigure it
	if instance.Status == PluginStatusEnabled {
		params := types.JSON{
			"config": config,
		}
		
		_, err := s.manager.Execute(ctx, instance.PluginID, "configure", params)
		if err != nil {
			return fmt.Errorf("failed to reconfigure plugin: %w", err)
		}
	}
	
	return nil
}

// GetPluginConfig returns the current configuration of a plugin instance
func (s *Service) GetPluginConfig(ctx context.Context, instanceID string) (types.JSON, error) {
	instance, exists := s.manager.GetInstance(instanceID)
	if !exists {
		return nil, fmt.Errorf("instance %s not found", instanceID)
	}
	
	return instance.Config, nil
}

// Search and Discovery Methods

// SearchPlugins searches for plugins based on criteria
func (s *Service) SearchPlugins(ctx context.Context, query *SearchQuery) ([]*PluginManifest, error) {
	return s.manager.registry.Search(ctx, query)
}

// GetPluginsByType returns all plugins of a specific type
func (s *Service) GetPluginsByType(ctx context.Context, pluginType PluginType) ([]*PluginManifest, error) {
	return s.manager.registry.GetByType(ctx, pluginType)
}

// GetSupportedFieldTypes returns all supported field types from field plugins
func (s *Service) GetSupportedFieldTypes(ctx context.Context) ([]string, error) {
	var fieldTypes []string
	
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeField {
			// Get supported field types from plugin metadata
			if fieldTypesData, exists := plugin.Config.Properties["supported_types"]; exists {
				if types, ok := fieldTypesData.([]interface{}); ok {
					for _, t := range types {
						if typeStr, ok := t.(string); ok {
							fieldTypes = append(fieldTypes, typeStr)
						}
					}
				}
			}
		}
	}
	
	return fieldTypes, nil
}

// GetSupportedExportFormats returns all supported export formats
func (s *Service) GetSupportedExportFormats(ctx context.Context) (map[string][]string, error) {
	formats := make(map[string][]string)
	
	plugins := s.manager.GetPlugins()
	
	for _, plugin := range plugins {
		if plugin.Type == PluginTypeExporter {
			// Get supported formats from plugin
			params := types.JSON{}
			
			result, err := s.manager.Execute(ctx, plugin.ID, "get_supported_formats", params)
			if err == nil {
				if formatList, ok := result.([]interface{}); ok {
					var pluginFormats []string
					for _, format := range formatList {
						if formatStr, ok := format.(string); ok {
							pluginFormats = append(pluginFormats, formatStr)
						}
					}
					formats[plugin.ID] = pluginFormats
				}
			}
		}
	}
	
	return formats, nil
}

// Private helper methods

func (s *Service) pluginHandlesFieldType(plugin *PluginManifest, fieldType string) bool {
	// Check if plugin configuration specifies supported field types
	if plugin.Config != nil && plugin.Config.Properties != nil {
		if supportedTypes, exists := plugin.Config.Properties["supported_types"]; exists {
			if types, ok := supportedTypes.([]interface{}); ok {
				for _, t := range types {
					if typeStr, ok := t.(string); ok && typeStr == fieldType {
						return true
					}
				}
			}
		}
	}
	
	// If no specific types configured, assume it handles all types
	return true
}

func getString(data map[string]interface{}, key string) string {
	if val, ok := data[key].(string); ok {
		return val
	}
	return ""
}

// Additional utility types and functions

// PluginTypeInfo provides information about plugin types
type PluginTypeInfo struct {
	Type        PluginType `json:"type"`
	Name        string     `json:"name"`
	Description string     `json:"description"`
	Operations  []string   `json:"operations"`
	Examples    []string   `json:"examples"`
}

// GetPluginTypeInfo returns information about all plugin types
func (s *Service) GetPluginTypeInfo() []PluginTypeInfo {
	return []PluginTypeInfo{
		{
			Type:        PluginTypeField,
			Name:        "Field Type Plugin",
			Description: "Provides custom field types with validation, formatting, and parsing",
			Operations:  []string{"validate_value", "format_value", "parse_value", "get_default_value"},
			Examples:    []string{"IP address validator", "Phone number formatter", "Date range picker"},
		},
		{
			Type:        PluginTypeValidator,
			Name:        "Validator Plugin",
			Description: "Provides custom validation logic for models and instances",
			Operations:  []string{"validate_model", "validate_instance", "validate_field"},
			Examples:    []string{"Business rule validator", "Cross-field validator", "External API validator"},
		},
		{
			Type:        PluginTypeConnector,
			Name:        "Connector Plugin",
			Description: "Connects to external systems for data synchronization",
			Operations:  []string{"connect", "disconnect", "fetch", "push", "sync"},
			Examples:    []string{"LDAP connector", "Database connector", "REST API connector"},
		},
		{
			Type:        PluginTypeProcessor,
			Name:        "Processor Plugin",
			Description: "Processes and transforms data",
			Operations:  []string{"process", "transform", "process_batch"},
			Examples:    []string{"Data mapper", "ETL processor", "Text analyzer"},
		},
		{
			Type:        PluginTypeExporter,
			Name:        "Exporter Plugin",
			Description: "Exports data to various formats",
			Operations:  []string{"export", "export_stream", "get_supported_formats"},
			Examples:    []string{"Excel exporter", "PDF generator", "XML exporter"},
		},
		{
			Type:        PluginTypeImporter,
			Name:        "Importer Plugin",
			Description: "Imports data from various sources",
			Operations:  []string{"import", "import_stream", "get_supported_formats"},
			Examples:    []string{"CSV importer", "JSON importer", "Excel importer"},
		},
		{
			Type:        PluginTypeNotifier,
			Name:        "Notifier Plugin",
			Description: "Sends notifications through various channels",
			Operations:  []string{"send", "send_batch", "create_channel"},
			Examples:    []string{"Email notifier", "Slack notifier", "SMS notifier"},
		},
		{
			Type:        PluginTypeExtension,
			Name:        "Extension Plugin",
			Description: "Provides general purpose extensions",
			Operations:  []string{"execute"},
			Examples:    []string{"Custom dashboard", "Report generator", "Workflow engine"},
		},
	}
}