package query

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Repository provides data access for query operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new query repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// RawQueryResult represents the result of a raw SQL query
type RawQueryResult struct {
	Data       []map[string]interface{} `json:"data"`
	Aggregates map[string]interface{}   `json:"aggregates,omitempty"`
	Total      int64                    `json:"total"`
}

// ExecuteQuery executes a raw SQL query
func (r *Repository) ExecuteQuery(ctx context.Context, sql string, params []interface{}) (*RawQueryResult, error) {
	var rows []map[string]interface{}
	
	// Execute the query
	if err := r.db.WithContext(ctx).Raw(sql, params...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	
	return &RawQueryResult{
		Data:  rows,
		Total: int64(len(rows)),
	}, nil
}

// GetModel retrieves a model by ID
func (r *Repository) GetModel(ctx context.Context, modelID uuid.UUID) (*types.Model, error) {
	var model types.Model
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", modelID).
		First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

// Saved Queries operations

// CreateSavedQuery creates a new saved query
func (r *Repository) CreateSavedQuery(ctx context.Context, query *SavedQuery) error {
	return r.db.WithContext(ctx).Create(query).Error
}

// GetSavedQuery retrieves a saved query by ID
func (r *Repository) GetSavedQuery(ctx context.Context, queryID uuid.UUID) (*SavedQuery, error) {
	var query SavedQuery
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", queryID).
		First(&query).Error
	if err != nil {
		return nil, err
	}
	return &query, nil
}

// UpdateSavedQuery updates a saved query
func (r *Repository) UpdateSavedQuery(ctx context.Context, query *SavedQuery) error {
	return r.db.WithContext(ctx).Save(query).Error
}

// DeleteSavedQuery deletes a saved query
func (r *Repository) DeleteSavedQuery(ctx context.Context, queryID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&SavedQuery{}, "id = ?", queryID).Error
}

// ListSavedQueries lists saved queries with pagination
func (r *Repository) ListSavedQueries(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*SavedQuery, *types.Pagination, error) {
	var queries []*SavedQuery
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &queries, options)
	if err != nil {
		return nil, nil, err
	}
	return queries, pagination, nil
}

// Query Template operations

// CreateQueryTemplate creates a new query template
func (r *Repository) CreateQueryTemplate(ctx context.Context, template *QueryTemplate) error {
	return r.db.WithContext(ctx).Create(template).Error
}

// GetQueryTemplate retrieves a query template by ID
func (r *Repository) GetQueryTemplate(ctx context.Context, templateID uuid.UUID) (*QueryTemplate, error) {
	var template QueryTemplate
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", templateID).
		First(&template).Error
	if err != nil {
		return nil, err
	}
	return &template, nil
}

// UpdateQueryTemplate updates a query template
func (r *Repository) UpdateQueryTemplate(ctx context.Context, template *QueryTemplate) error {
	return r.db.WithContext(ctx).Save(template).Error
}

// DeleteQueryTemplate deletes a query template
func (r *Repository) DeleteQueryTemplate(ctx context.Context, templateID uuid.UUID) error {
	return r.db.WithContext(ctx).Delete(&QueryTemplate{}, "id = ?", templateID).Error
}

// ListQueryTemplates lists query templates with pagination
func (r *Repository) ListQueryTemplates(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*QueryTemplate, *types.Pagination, error) {
	var templates []*QueryTemplate
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &templates, options)
	if err != nil {
		return nil, nil, err
	}
	return templates, pagination, nil
}

// UpdateQueryUsage updates the usage statistics for a saved query
func (r *Repository) UpdateQueryUsage(ctx context.Context, queryID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&SavedQuery{}).
		Where("id = ?", queryID).
		Updates(map[string]interface{}{
			"run_count": gorm.Expr("run_count + 1"),
			"last_run":  gorm.Expr("NOW()"),
		}).Error
}

// UpdateTemplateUsage updates the usage statistics for a query template
func (r *Repository) UpdateTemplateUsage(ctx context.Context, templateID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Model(&QueryTemplate{}).
		Where("id = ?", templateID).
		Update("usage_count", gorm.Expr("usage_count + 1")).Error
}

// GetQueryStatistics retrieves query execution statistics
func (r *Repository) GetQueryStatistics(ctx context.Context, tenantID string) (*QueryStatistics, error) {
	var stats QueryStatistics
	
	// Count saved queries
	if err := r.db.WithContext(ctx).
		Model(&SavedQuery{}).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Count(&stats.TotalSavedQueries).Error; err != nil {
		return nil, err
	}
	
	// Count query templates
	if err := r.db.WithContext(ctx).
		Model(&QueryTemplate{}).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Count(&stats.TotalTemplates).Error; err != nil {
		return nil, err
	}
	
	// Get most used queries
	var topQueries []QueryUsageInfo
	if err := r.db.WithContext(ctx).
		Model(&SavedQuery{}).
		Select("id, name, run_count").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Order("run_count DESC").
		Limit(10).
		Scan(&topQueries).Error; err != nil {
		return nil, err
	}
	stats.MostUsedQueries = topQueries
	
	// Get most used templates
	var topTemplates []QueryUsageInfo
	if err := r.db.WithContext(ctx).
		Model(&QueryTemplate{}).
		Select("id, name, usage_count as run_count").
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Order("usage_count DESC").
		Limit(10).
		Scan(&topTemplates).Error; err != nil {
		return nil, err
	}
	stats.MostUsedTemplates = topTemplates
	
	return &stats, nil
}

// SearchSavedQueries searches saved queries by name or description
func (r *Repository) SearchSavedQueries(ctx context.Context, tenantID, searchTerm string, options *types.QueryOptions) ([]*SavedQuery, *types.Pagination, error) {
	var queries []*SavedQuery
	
	query := r.db.WithContext(ctx).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID).
		Where("name ILIKE ? OR description ILIKE ?", "%"+searchTerm+"%", "%"+searchTerm+"%")
	
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
		query = query.Order("name ASC")
	}
	
	var total int64
	if err := query.Model(&SavedQuery{}).Count(&total).Error; err != nil {
		return nil, nil, err
	}
	
	// Apply pagination
	if options != nil && options.Pagination != nil {
		offset := options.Pagination.GetOffset()
		query = query.Offset(offset).Limit(options.Pagination.PageSize)
	}
	
	if err := query.Find(&queries).Error; err != nil {
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
	
	return queries, pagination, nil
}

// GetSavedQueriesByCategory retrieves saved queries by category
func (r *Repository) GetSavedQueriesByCategory(ctx context.Context, tenantID, category string, options *types.QueryOptions) ([]*SavedQuery, *types.Pagination, error) {
	var queries []*SavedQuery
	
	query := r.db.WithContext(ctx).
		Where("tenant_id = ? AND category = ? AND deleted_at IS NULL", tenantID, category)
	
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
		query = query.Order("name ASC")
	}
	
	var total int64
	if err := query.Model(&SavedQuery{}).Count(&total).Error; err != nil {
		return nil, nil, err
	}
	
	// Apply pagination
	if options != nil && options.Pagination != nil {
		offset := options.Pagination.GetOffset()
		query = query.Offset(offset).Limit(options.Pagination.PageSize)
	}
	
	if err := query.Find(&queries).Error; err != nil {
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
	
	return queries, pagination, nil
}

// QueryStatistics represents query execution statistics
type QueryStatistics struct {
	TotalSavedQueries  int64              `json:"total_saved_queries"`
	TotalTemplates     int64              `json:"total_templates"`
	MostUsedQueries    []QueryUsageInfo   `json:"most_used_queries"`
	MostUsedTemplates  []QueryUsageInfo   `json:"most_used_templates"`
}

// QueryUsageInfo represents usage information for queries and templates
type QueryUsageInfo struct {
	ID       uuid.UUID `json:"id"`
	Name     string    `json:"name"`
	RunCount int64     `json:"run_count"`
}

// ExplainQuery explains the execution plan for a query
func (r *Repository) ExplainQuery(ctx context.Context, sql string, params []interface{}) (map[string]interface{}, error) {
	var result []map[string]interface{}
	
	explainSQL := fmt.Sprintf("EXPLAIN (FORMAT JSON) %s", sql)
	if err := r.db.WithContext(ctx).Raw(explainSQL, params...).Scan(&result).Error; err != nil {
		return nil, err
	}
	
	if len(result) > 0 {
		return result[0], nil
	}
	
	return nil, fmt.Errorf("no execution plan returned")
}

// AnalyzeQuery analyzes a query for performance optimization suggestions
func (r *Repository) AnalyzeQuery(ctx context.Context, sql string, params []interface{}) (*QueryAnalysis, error) {
	// Get execution plan
	plan, err := r.ExplainQuery(ctx, sql, params)
	if err != nil {
		return nil, err
	}
	
	analysis := &QueryAnalysis{
		ExecutionPlan: plan,
		Suggestions:   []string{},
		Performance:   "unknown",
	}
	
	// Analyze the plan and provide suggestions
	// This is a simplified implementation
	if planData, ok := plan["Plan"].(map[string]interface{}); ok {
		if cost, ok := planData["Total_Cost"].(float64); ok {
			if cost > 1000 {
				analysis.Performance = "slow"
				analysis.Suggestions = append(analysis.Suggestions, "Consider adding indexes to improve performance")
			} else if cost > 100 {
				analysis.Performance = "medium"
				analysis.Suggestions = append(analysis.Suggestions, "Query performance is acceptable but could be optimized")
			} else {
				analysis.Performance = "fast"
			}
		}
		
		if nodeType, ok := planData["Node_Type"].(string); ok {
			if nodeType == "Seq Scan" {
				analysis.Suggestions = append(analysis.Suggestions, "Sequential scan detected - consider adding appropriate indexes")
			}
		}
	}
	
	return analysis, nil
}

// QueryAnalysis represents the analysis result of a query
type QueryAnalysis struct {
	ExecutionPlan map[string]interface{} `json:"execution_plan"`
	Suggestions   []string               `json:"suggestions"`
	Performance   string                 `json:"performance"` // fast, medium, slow
	EstimatedCost float64                `json:"estimated_cost"`
}