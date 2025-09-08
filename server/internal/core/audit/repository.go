package audit

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Repository provides data access for audit operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new audit repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateAuditLog creates a new audit log entry
func (r *Repository) CreateAuditLog(ctx context.Context, auditLog *types.AuditLog) error {
	return r.db.WithContext(ctx).Create(auditLog).Error
}

// CreateAuditLogsBatch creates multiple audit log entries in a batch
func (r *Repository) CreateAuditLogsBatch(ctx context.Context, auditLogs []*types.AuditLog) error {
	if len(auditLogs) == 0 {
		return nil
	}
	
	return r.db.WithContext(ctx).CreateInBatches(auditLogs, 100).Error
}

// GetAuditLogs retrieves audit logs with filtering and pagination
func (r *Repository) GetAuditLogs(ctx context.Context, filter *AuditFilter, options *types.QueryOptions) ([]*types.AuditLog, *types.Pagination, error) {
	var auditLogs []*types.AuditLog
	
	query := r.db.WithContext(ctx).
		Where("deleted_at IS NULL")
	
	// Apply filters
	if filter != nil {
		if filter.TenantID != nil {
			query = query.Where("tenant_id = ?", *filter.TenantID)
		}
		
		if filter.UserID != nil {
			query = query.Where("user_id = ?", *filter.UserID)
		}
		
		if len(filter.Actions) > 0 {
			query = query.Where("action IN ?", filter.Actions)
		}
		
		if filter.ResourceType != nil {
			query = query.Where("resource_type = ?", *filter.ResourceType)
		}
		
		if len(filter.ResourceTypes) > 0 {
			query = query.Where("resource_type IN ?", filter.ResourceTypes)
		}
		
		if filter.ResourceID != nil {
			query = query.Where("resource_id = ?", *filter.ResourceID)
		}
		
		if filter.BusinessID != nil {
			query = query.Where("business_id = ?", *filter.BusinessID)
		}
		
		if filter.Success != nil {
			query = query.Where("success = ?", *filter.Success)
		}
		
		if filter.DateFrom != nil {
			query = query.Where("created_at >= ?", *filter.DateFrom)
		}
		
		if filter.DateTo != nil {
			query = query.Where("created_at <= ?", *filter.DateTo)
		}
		
		if filter.ClientIP != nil {
			query = query.Where("client_ip = ?", *filter.ClientIP)
		}
		
		if filter.Search != nil {
			searchTerm := "%" + *filter.Search + "%"
			query = query.Where("resource_name ILIKE ? OR error_message ILIKE ? OR request_id ILIKE ?", 
				searchTerm, searchTerm, searchTerm)
		}
	}
	
	// Apply sorting
	if options != nil && len(options.Sort) > 0 {
		for _, sort := range options.Sort {
			order := "ASC"
			if sort.Order == "desc" {
				order = "DESC"
			}
			query = query.Order(sort.Field + " " + order)
		}
	} else {
		query = query.Order("created_at DESC")
	}
	
	var total int64
	if err := query.Model(&types.AuditLog{}).Count(&total).Error; err != nil {
		return nil, nil, err
	}
	
	// Apply pagination
	if options != nil && options.Pagination != nil {
		offset := options.Pagination.GetOffset()
		query = query.Offset(offset).Limit(options.Pagination.PageSize)
	}
	
	if err := query.Find(&auditLogs).Error; err != nil {
		return nil, nil, err
	}
	
	pagination := &types.Pagination{
		Page:     1,
		PageSize: 20,
		Total:    total,
	}
	if options != nil && options.Pagination != nil {
		pagination.Page = options.Pagination.Page
		pagination.PageSize = options.Pagination.PageSize
	}
	
	return auditLogs, pagination, nil
}

// GetAuditLogByID retrieves an audit log by ID
func (r *Repository) GetAuditLogByID(ctx context.Context, logID uuid.UUID) (*types.AuditLog, error) {
	var auditLog types.AuditLog
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", logID).
		First(&auditLog).Error
	if err != nil {
		return nil, err
	}
	return &auditLog, nil
}

// GetAuditStatistics retrieves audit statistics
func (r *Repository) GetAuditStatistics(ctx context.Context, tenantID uuid.UUID, timeRange *TimeRange) (*AuditStatistics, error) {
	var stats AuditStatistics
	
	query := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)
	
	// Apply time range filter
	if timeRange != nil {
		if timeRange.From != nil {
			query = query.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			query = query.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	// Get total logs count
	if err := query.Count(&stats.TotalLogs).Error; err != nil {
		return nil, err
	}
	
	// Get success rate
	var successCount int64
	if err := query.Where("success = true").Count(&successCount).Error; err != nil {
		return nil, err
	}
	
	if stats.TotalLogs > 0 {
		stats.SuccessRate = float64(successCount) / float64(stats.TotalLogs) * 100
	}
	
	// Get action counts
	var actionCounts []struct {
		Action types.AuditAction `json:"action"`
		Count  int64             `json:"count"`
	}
	
	actionQuery := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Select("action, COUNT(*) as count").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("action")
	
	if timeRange != nil {
		if timeRange.From != nil {
			actionQuery = actionQuery.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			actionQuery = actionQuery.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	if err := actionQuery.Scan(&actionCounts).Error; err != nil {
		return nil, err
	}
	
	stats.ActionCounts = make(map[types.AuditAction]int64)
	for _, count := range actionCounts {
		stats.ActionCounts[count.Action] = count.Count
	}
	
	// Get resource counts
	var resourceCounts []struct {
		ResourceType string `json:"resource_type"`
		Count        int64  `json:"count"`
	}
	
	resourceQuery := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Select("resource_type, COUNT(*) as count").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("resource_type")
	
	if timeRange != nil {
		if timeRange.From != nil {
			resourceQuery = resourceQuery.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			resourceQuery = resourceQuery.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	if err := resourceQuery.Scan(&resourceCounts).Error; err != nil {
		return nil, err
	}
	
	stats.ResourceCounts = make(map[string]int64)
	for _, count := range resourceCounts {
		stats.ResourceCounts[count.ResourceType] = count.Count
	}
	
	// Get user activity counts
	var userCounts []struct {
		UserID uuid.UUID `json:"user_id"`
		Count  int64     `json:"count"`
	}
	
	userQuery := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Select("user_id, COUNT(*) as count").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("user_id").
		Order("count DESC").
		Limit(20)
	
	if timeRange != nil {
		if timeRange.From != nil {
			userQuery = userQuery.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			userQuery = userQuery.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	if err := userQuery.Scan(&userCounts).Error; err != nil {
		return nil, err
	}
	
	stats.UserActivityCount = make(map[uuid.UUID]int64)
	for _, count := range userCounts {
		stats.UserActivityCount[count.UserID] = count.Count
	}
	
	// Get daily counts
	dailyQuery := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Select("DATE(created_at) as date, COUNT(*) as count").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Group("DATE(created_at)").
		Order("date DESC").
		Limit(30)
	
	if timeRange != nil {
		if timeRange.From != nil {
			dailyQuery = dailyQuery.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			dailyQuery = dailyQuery.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	var dailyCounts []struct {
		Date  string `json:"date"`
		Count int64  `json:"count"`
	}
	
	if err := dailyQuery.Scan(&dailyCounts).Error; err != nil {
		return nil, err
	}
	
	stats.DailyCounts = make(map[string]int64)
	for _, count := range dailyCounts {
		stats.DailyCounts[count.Date] = count.Count
	}
	
	// Get top errors
	var topErrors []ErrorStatistic
	errorQuery := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Select("error_message, COUNT(*) as count").
		Where("tenant_id = ? AND deleted_at IS NULL AND success = false AND error_message != ''", tenantID).
		Group("error_message").
		Order("count DESC").
		Limit(10)
	
	if timeRange != nil {
		if timeRange.From != nil {
			errorQuery = errorQuery.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			errorQuery = errorQuery.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	if err := errorQuery.Scan(&topErrors).Error; err != nil {
		return nil, err
	}
	
	stats.TopErrors = topErrors
	
	return &stats, nil
}

// DeleteOldLogs deletes audit logs older than the specified date
func (r *Repository) DeleteOldLogs(ctx context.Context, cutoffDate time.Time) error {
	return r.db.WithContext(ctx).
		Where("created_at < ?", cutoffDate).
		Delete(&types.AuditLog{}).Error
}

// GetResourceAuditSummary gets a summary of audit activities for a specific resource
func (r *Repository) GetResourceAuditSummary(ctx context.Context, tenantID uuid.UUID, resourceType string, resourceID uuid.UUID) (*ResourceAuditSummary, error) {
	var summary ResourceAuditSummary
	summary.ResourceType = resourceType
	summary.ResourceID = resourceID
	
	query := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Where("tenant_id = ? AND resource_type = ? AND resource_id = ? AND deleted_at IS NULL", 
			tenantID, resourceType, resourceID)
	
	// Get total count
	if err := query.Count(&summary.TotalActivities).Error; err != nil {
		return nil, err
	}
	
	// Get last activity
	var lastLog types.AuditLog
	if err := query.Order("created_at DESC").First(&lastLog).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	} else {
		summary.LastActivity = &lastLog.CreatedAt
		summary.LastUser = &lastLog.UserID
	}
	
	// Get first activity
	var firstLog types.AuditLog
	if err := query.Order("created_at ASC").First(&firstLog).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	} else {
		summary.CreatedAt = &firstLog.CreatedAt
		summary.CreatedBy = &firstLog.UserID
	}
	
	// Get action counts
	var actionCounts []struct {
		Action types.AuditAction `json:"action"`
		Count  int64             `json:"count"`
	}
	
	if err := query.
		Select("action, COUNT(*) as count").
		Group("action").
		Scan(&actionCounts).Error; err != nil {
		return nil, err
	}
	
	summary.ActionCounts = make(map[types.AuditAction]int64)
	for _, count := range actionCounts {
		summary.ActionCounts[count.Action] = count.Count
	}
	
	// Get unique users
	var userCount int64
	if err := query.
		Select("DISTINCT user_id").
		Count(&userCount).Error; err != nil {
		return nil, err
	}
	summary.UniqueUsers = userCount
	
	return &summary, nil
}

// GetUserAuditSummary gets a summary of audit activities for a specific user
func (r *Repository) GetUserAuditSummary(ctx context.Context, tenantID, userID uuid.UUID, timeRange *TimeRange) (*UserAuditSummary, error) {
	var summary UserAuditSummary
	summary.UserID = userID
	
	query := r.db.WithContext(ctx).
		Model(&types.AuditLog{}).
		Where("tenant_id = ? AND user_id = ? AND deleted_at IS NULL", tenantID, userID)
	
	// Apply time range
	if timeRange != nil {
		if timeRange.From != nil {
			query = query.Where("created_at >= ?", *timeRange.From)
		}
		if timeRange.To != nil {
			query = query.Where("created_at <= ?", *timeRange.To)
		}
	}
	
	// Get total activities
	if err := query.Count(&summary.TotalActivities).Error; err != nil {
		return nil, err
	}
	
	// Get last activity
	var lastLog types.AuditLog
	if err := query.Order("created_at DESC").First(&lastLog).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return nil, err
		}
	} else {
		summary.LastActivity = &lastLog.CreatedAt
	}
	
	// Get resource counts
	var resourceCounts []struct {
		ResourceType string `json:"resource_type"`
		Count        int64  `json:"count"`
	}
	
	if err := query.
		Select("resource_type, COUNT(*) as count").
		Group("resource_type").
		Scan(&resourceCounts).Error; err != nil {
		return nil, err
	}
	
	summary.ResourceCounts = make(map[string]int64)
	for _, count := range resourceCounts {
		summary.ResourceCounts[count.ResourceType] = count.Count
	}
	
	// Get success/failure counts
	var successCount, failureCount int64
	if err := query.Where("success = true").Count(&successCount).Error; err != nil {
		return nil, err
	}
	if err := query.Where("success = false").Count(&failureCount).Error; err != nil {
		return nil, err
	}
	
	summary.SuccessCount = successCount
	summary.FailureCount = failureCount
	
	return &summary, nil
}

// SearchAuditLogs performs a full-text search on audit logs
func (r *Repository) SearchAuditLogs(ctx context.Context, tenantID uuid.UUID, searchTerm string, options *types.QueryOptions) ([]*types.AuditLog, *types.Pagination, error) {
	filter := &AuditFilter{
		TenantID: &tenantID,
		Search:   &searchTerm,
	}
	
	return r.GetAuditLogs(ctx, filter, options)
}

// Helper types

// ResourceAuditSummary represents audit summary for a specific resource
type ResourceAuditSummary struct {
	ResourceType     string                          `json:"resource_type"`
	ResourceID       uuid.UUID                       `json:"resource_id"`
	TotalActivities  int64                           `json:"total_activities"`
	ActionCounts     map[types.AuditAction]int64     `json:"action_counts"`
	UniqueUsers      int64                           `json:"unique_users"`
	CreatedAt        *time.Time                      `json:"created_at,omitempty"`
	CreatedBy        *uuid.UUID                      `json:"created_by,omitempty"`
	LastActivity     *time.Time                      `json:"last_activity,omitempty"`
	LastUser         *uuid.UUID                      `json:"last_user,omitempty"`
}

// UserAuditSummary represents audit summary for a specific user
type UserAuditSummary struct {
	UserID          uuid.UUID          `json:"user_id"`
	TotalActivities int64              `json:"total_activities"`
	ResourceCounts  map[string]int64   `json:"resource_counts"`
	SuccessCount    int64              `json:"success_count"`
	FailureCount    int64              `json:"failure_count"`
	LastActivity    *time.Time         `json:"last_activity,omitempty"`
}