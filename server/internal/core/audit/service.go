package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Service provides audit logging functionality
type Service struct {
	repo   *Repository
	config *AuditConfig
}

// AuditConfig holds configuration for the audit service
type AuditConfig struct {
	Enabled              bool          `json:"enabled"`
	RetentionPeriod      time.Duration `json:"retention_period"`
	BatchSize            int           `json:"batch_size"`
	FlushInterval        time.Duration `json:"flush_interval"`
	EnableAsyncLogging   bool          `json:"enable_async_logging"`
	MaxQueueSize         int           `json:"max_queue_size"`
	EnableCompression    bool          `json:"enable_compression"`
	SensitiveFields      []string      `json:"sensitive_fields"`
	ExcludedActions      []string      `json:"excluded_actions"`
	ExcludedResources    []string      `json:"excluded_resources"`
}

// NewService creates a new audit service
func NewService(db *gorm.DB, config *AuditConfig) *Service {
	if config == nil {
		config = &AuditConfig{
			Enabled:            true,
			RetentionPeriod:    90 * 24 * time.Hour, // 90 days
			BatchSize:          100,
			FlushInterval:      5 * time.Second,
			EnableAsyncLogging: true,
			MaxQueueSize:       1000,
			EnableCompression:  false,
			SensitiveFields:    []string{"password", "token", "secret", "key"},
		}
	}
	
	service := &Service{
		repo:   NewRepository(db),
		config: config,
	}
	
	// Start async logging if enabled
	if config.EnableAsyncLogging {
		go service.startAsyncProcessor()
	}
	
	return service
}

// LogEntry represents an audit log entry to be logged
type LogEntry struct {
	TenantID      uuid.UUID              `json:"tenant_id"`
	UserID        uuid.UUID              `json:"user_id"`
	Action        types.AuditAction      `json:"action"`
	ResourceType  string                 `json:"resource_type"`
	ResourceID    uuid.UUID              `json:"resource_id"`
	ResourceName  string                 `json:"resource_name,omitempty"`
	BusinessID    *uuid.UUID             `json:"business_id,omitempty"`
	ClientIP      string                 `json:"client_ip,omitempty"`
	UserAgent     string                 `json:"user_agent,omitempty"`
	RequestID     string                 `json:"request_id,omitempty"`
	Changes       *types.AuditChanges    `json:"changes,omitempty"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
	Success       bool                   `json:"success"`
	ErrorMessage  string                 `json:"error_message,omitempty"`
	Timestamp     time.Time              `json:"timestamp"`
}

// Queue for async logging
var auditQueue = make(chan *LogEntry, 1000)

// Log logs an audit entry
func (s *Service) Log(ctx context.Context, entry *LogEntry) error {
	if !s.config.Enabled {
		return nil
	}
	
	// Check if action or resource should be excluded
	if s.shouldExclude(entry) {
		return nil
	}
	
	// Sanitize sensitive data
	s.sanitizeEntry(entry)
	
	// Set timestamp if not provided
	if entry.Timestamp.IsZero() {
		entry.Timestamp = time.Now()
	}
	
	if s.config.EnableAsyncLogging {
		// Send to async queue
		select {
		case auditQueue <- entry:
			return nil
		default:
			// Queue is full, log synchronously as fallback
			return s.logSync(ctx, entry)
		}
	}
	
	return s.logSync(ctx, entry)
}

// LogAction logs a specific action with minimal parameters
func (s *Service) LogAction(ctx context.Context, tenantID, userID uuid.UUID, action types.AuditAction, resourceType string, resourceID uuid.UUID, success bool) error {
	entry := &LogEntry{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Success:      success,
		Timestamp:    time.Now(),
	}
	
	return s.Log(ctx, entry)
}

// LogCreate logs a create action with before/after data
func (s *Service) LogCreate(ctx context.Context, tenantID, userID uuid.UUID, resourceType string, resourceID uuid.UUID, resourceName string, data map[string]interface{}) error {
	entry := &LogEntry{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       types.AuditActionCreate,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResourceName: resourceName,
		Changes: &types.AuditChanges{
			After:  data,
			Fields: getFieldNames(data),
		},
		Success:   true,
		Timestamp: time.Now(),
	}
	
	return s.Log(ctx, entry)
}

// LogUpdate logs an update action with before/after data
func (s *Service) LogUpdate(ctx context.Context, tenantID, userID uuid.UUID, resourceType string, resourceID uuid.UUID, resourceName string, before, after map[string]interface{}) error {
	changes := &types.AuditChanges{
		Before: before,
		After:  after,
		Fields: getChangedFields(before, after),
	}
	
	entry := &LogEntry{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       types.AuditActionUpdate,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResourceName: resourceName,
		Changes:      changes,
		Success:      true,
		Timestamp:    time.Now(),
	}
	
	return s.Log(ctx, entry)
}

// LogDelete logs a delete action
func (s *Service) LogDelete(ctx context.Context, tenantID, userID uuid.UUID, resourceType string, resourceID uuid.UUID, resourceName string, data map[string]interface{}) error {
	entry := &LogEntry{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       types.AuditActionDelete,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResourceName: resourceName,
		Changes: &types.AuditChanges{
			Before: data,
			Fields: getFieldNames(data),
		},
		Success:   true,
		Timestamp: time.Now(),
	}
	
	return s.Log(ctx, entry)
}

// LogAccess logs a read/access action
func (s *Service) LogAccess(ctx context.Context, tenantID, userID uuid.UUID, resourceType string, resourceID uuid.UUID, resourceName string) error {
	entry := &LogEntry{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       types.AuditActionRead,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResourceName: resourceName,
		Success:      true,
		Timestamp:    time.Now(),
	}
	
	return s.Log(ctx, entry)
}

// LogError logs a failed action
func (s *Service) LogError(ctx context.Context, tenantID, userID uuid.UUID, action types.AuditAction, resourceType string, resourceID uuid.UUID, errorMsg string) error {
	entry := &LogEntry{
		TenantID:     tenantID,
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Success:      false,
		ErrorMessage: errorMsg,
		Timestamp:    time.Now(),
	}
	
	return s.Log(ctx, entry)
}

// GetAuditLogs retrieves audit logs with filtering and pagination
func (s *Service) GetAuditLogs(ctx context.Context, filter *AuditFilter, options *types.QueryOptions) ([]*types.AuditLog, *types.Pagination, error) {
	return s.repo.GetAuditLogs(ctx, filter, options)
}

// GetAuditStatistics retrieves audit statistics
func (s *Service) GetAuditStatistics(ctx context.Context, tenantID uuid.UUID, timeRange *TimeRange) (*AuditStatistics, error) {
	return s.repo.GetAuditStatistics(ctx, tenantID, timeRange)
}

// GetResourceAuditTrail retrieves the complete audit trail for a specific resource
func (s *Service) GetResourceAuditTrail(ctx context.Context, tenantID uuid.UUID, resourceType string, resourceID uuid.UUID, options *types.QueryOptions) ([]*types.AuditLog, *types.Pagination, error) {
	filter := &AuditFilter{
		TenantID:     &tenantID,
		ResourceType: &resourceType,
		ResourceID:   &resourceID,
	}
	
	return s.repo.GetAuditLogs(ctx, filter, options)
}

// GetUserAuditActivity retrieves audit activity for a specific user
func (s *Service) GetUserAuditActivity(ctx context.Context, tenantID, userID uuid.UUID, timeRange *TimeRange, options *types.QueryOptions) ([]*types.AuditLog, *types.Pagination, error) {
	filter := &AuditFilter{
		TenantID: &tenantID,
		UserID:   &userID,
		DateFrom: timeRange.From,
		DateTo:   timeRange.To,
	}
	
	return s.repo.GetAuditLogs(ctx, filter, options)
}

// CleanupOldLogs removes audit logs older than the retention period
func (s *Service) CleanupOldLogs(ctx context.Context) error {
	if !s.config.Enabled {
		return nil
	}
	
	cutoffDate := time.Now().Add(-s.config.RetentionPeriod)
	return s.repo.DeleteOldLogs(ctx, cutoffDate)
}

// ExportAuditLogs exports audit logs to various formats
func (s *Service) ExportAuditLogs(ctx context.Context, filter *AuditFilter, format ExportFormat) ([]byte, error) {
	logs, _, err := s.repo.GetAuditLogs(ctx, filter, nil)
	if err != nil {
		return nil, err
	}
	
	switch format {
	case ExportFormatJSON:
		return json.Marshal(logs)
	case ExportFormatCSV:
		return s.exportToCSV(logs)
	default:
		return nil, fmt.Errorf("unsupported export format: %s", format)
	}
}

// Private methods

// logSync logs an entry synchronously
func (s *Service) logSync(ctx context.Context, entry *LogEntry) error {
	auditLog := s.convertToAuditLog(entry)
	return s.repo.CreateAuditLog(ctx, auditLog)
}

// convertToAuditLog converts a LogEntry to types.AuditLog
func (s *Service) convertToAuditLog(entry *LogEntry) *types.AuditLog {
	auditLog := &types.AuditLog{
		BaseModel: types.BaseModel{
			ID:        uuid.New(),
			CreatedAt: entry.Timestamp,
			CreatedBy: entry.UserID,
		},
		TenantID:     entry.TenantID,
		UserID:       entry.UserID,
		Action:       entry.Action,
		ResourceType: entry.ResourceType,
		ResourceID:   entry.ResourceID,
		ResourceName: entry.ResourceName,
		BusinessID:   entry.BusinessID,
		ClientIP:     entry.ClientIP,
		UserAgent:    entry.UserAgent,
		RequestID:    entry.RequestID,
		Changes:      entry.Changes,
		Success:      entry.Success,
		ErrorMessage: entry.ErrorMessage,
	}
	
	if entry.Metadata != nil {
		if metadataBytes, err := json.Marshal(entry.Metadata); err == nil {
			auditLog.Metadata = metadataBytes
		}
	}
	
	return auditLog
}

// shouldExclude checks if an entry should be excluded from logging
func (s *Service) shouldExclude(entry *LogEntry) bool {
	// Check excluded actions
	for _, excludedAction := range s.config.ExcludedActions {
		if string(entry.Action) == excludedAction {
			return true
		}
	}
	
	// Check excluded resources
	for _, excludedResource := range s.config.ExcludedResources {
		if entry.ResourceType == excludedResource {
			return true
		}
	}
	
	return false
}

// sanitizeEntry removes sensitive data from the entry
func (s *Service) sanitizeEntry(entry *LogEntry) {
	if entry.Changes != nil {
		entry.Changes.Before = s.sanitizeData(entry.Changes.Before)
		entry.Changes.After = s.sanitizeData(entry.Changes.After)
	}
	
	if entry.Metadata != nil {
		entry.Metadata = s.sanitizeData(entry.Metadata)
	}
}

// sanitizeData removes sensitive fields from data
func (s *Service) sanitizeData(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}
	
	sanitized := make(map[string]interface{})
	for key, value := range data {
		if s.isSensitiveField(key) {
			sanitized[key] = "[REDACTED]"
		} else {
			sanitized[key] = value
		}
	}
	
	return sanitized
}

// isSensitiveField checks if a field is considered sensitive
func (s *Service) isSensitiveField(fieldName string) bool {
	fieldLower := strings.ToLower(fieldName)
	for _, sensitiveField := range s.config.SensitiveFields {
		if strings.Contains(fieldLower, strings.ToLower(sensitiveField)) {
			return true
		}
	}
	return false
}

// startAsyncProcessor starts the async log processor
func (s *Service) startAsyncProcessor() {
	batch := make([]*LogEntry, 0, s.config.BatchSize)
	ticker := time.NewTicker(s.config.FlushInterval)
	defer ticker.Stop()
	
	for {
		select {
		case entry := <-auditQueue:
			batch = append(batch, entry)
			if len(batch) >= s.config.BatchSize {
				s.processBatch(batch)
				batch = batch[:0] // Reset slice
			}
			
		case <-ticker.C:
			if len(batch) > 0 {
				s.processBatch(batch)
				batch = batch[:0] // Reset slice
			}
		}
	}
}

// processBatch processes a batch of audit entries
func (s *Service) processBatch(entries []*LogEntry) {
	ctx := context.Background()
	
	auditLogs := make([]*types.AuditLog, len(entries))
	for i, entry := range entries {
		auditLogs[i] = s.convertToAuditLog(entry)
	}
	
	if err := s.repo.CreateAuditLogsBatch(ctx, auditLogs); err != nil {
		// Log error but don't fail - audit logging should not break the main flow
		fmt.Printf("Failed to create audit logs batch: %v\n", err)
	}
}

// exportToCSV exports audit logs to CSV format
func (s *Service) exportToCSV(logs []*types.AuditLog) ([]byte, error) {
	// This is a simplified CSV export implementation
	// In production, you would use a proper CSV library
	var csvData []string
	
	// Header
	csvData = append(csvData, "Timestamp,User ID,Action,Resource Type,Resource ID,Success,Error Message")
	
	// Data rows
	for _, log := range logs {
		row := fmt.Sprintf("%s,%s,%s,%s,%s,%t,%s",
			log.CreatedAt.Format(time.RFC3339),
			log.UserID.String(),
			log.Action,
			log.ResourceType,
			log.ResourceID.String(),
			log.Success,
			log.ErrorMessage,
		)
		csvData = append(csvData, row)
	}
	
	return []byte(strings.Join(csvData, "\n")), nil
}

// Utility functions

// getFieldNames extracts field names from a data map
func getFieldNames(data map[string]interface{}) []string {
	var fields []string
	for key := range data {
		fields = append(fields, key)
	}
	return fields
}

// getChangedFields compares before and after data and returns changed field names
func getChangedFields(before, after map[string]interface{}) []string {
	var changedFields []string
	
	// Check for changed fields in after
	for key, afterValue := range after {
		if beforeValue, exists := before[key]; !exists || beforeValue != afterValue {
			changedFields = append(changedFields, key)
		}
	}
	
	// Check for removed fields (in before but not in after)
	for key := range before {
		if _, exists := after[key]; !exists {
			changedFields = append(changedFields, key)
		}
	}
	
	return changedFields
}

// Helper types

// AuditFilter represents filters for audit log queries
type AuditFilter struct {
	TenantID      *uuid.UUID           `json:"tenant_id,omitempty"`
	UserID        *uuid.UUID           `json:"user_id,omitempty"`
	Actions       []types.AuditAction  `json:"actions,omitempty"`
	ResourceType  *string              `json:"resource_type,omitempty"`
	ResourceTypes []string             `json:"resource_types,omitempty"`
	ResourceID    *uuid.UUID           `json:"resource_id,omitempty"`
	BusinessID    *uuid.UUID           `json:"business_id,omitempty"`
	Success       *bool                `json:"success,omitempty"`
	DateFrom      *time.Time           `json:"date_from,omitempty"`
	DateTo        *time.Time           `json:"date_to,omitempty"`
	ClientIP      *string              `json:"client_ip,omitempty"`
	Search        *string              `json:"search,omitempty"`
}

// TimeRange represents a time range for filtering
type TimeRange struct {
	From *time.Time `json:"from,omitempty"`
	To   *time.Time `json:"to,omitempty"`
}

// AuditStatistics represents audit statistics
type AuditStatistics struct {
	TotalLogs         int64                           `json:"total_logs"`
	SuccessRate       float64                         `json:"success_rate"`
	ActionCounts      map[types.AuditAction]int64     `json:"action_counts"`
	ResourceCounts    map[string]int64                `json:"resource_counts"`
	UserActivityCount map[uuid.UUID]int64             `json:"user_activity_count"`
	DailyCounts       map[string]int64                `json:"daily_counts"`
	TopErrors         []ErrorStatistic                `json:"top_errors"`
}

// ErrorStatistic represents error statistics
type ErrorStatistic struct {
	ErrorMessage string `json:"error_message"`
	Count        int64  `json:"count"`
}

// ExportFormat represents supported export formats
type ExportFormat string

const (
	ExportFormatJSON ExportFormat = "json"
	ExportFormatCSV  ExportFormat = "csv"
)