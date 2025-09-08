package query

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Service provides dynamic query and grouping functionality
type Service struct {
	repo   *Repository
	config *QueryConfig
}

// QueryConfig holds configuration for the query service
type QueryConfig struct {
	MaxConditions    int           `json:"max_conditions"`
	MaxJoins         int           `json:"max_joins"`
	MaxGroups        int           `json:"max_groups"`
	MaxResults       int           `json:"max_results"`
	DefaultCacheTTL  time.Duration `json:"default_cache_ttl"`
	EnableExplain    bool          `json:"enable_explain"`
	EnableProfiling  bool          `json:"enable_profiling"`
}

// NewService creates a new query service
func NewService(db *gorm.DB, config *QueryConfig) *Service {
	if config == nil {
		config = &QueryConfig{
			MaxConditions:   50,
			MaxJoins:        10,
			MaxGroups:       20,
			MaxResults:      10000,
			DefaultCacheTTL: 5 * time.Minute,
			EnableExplain:   true,
			EnableProfiling: false,
		}
	}
	
	return &Service{
		repo:   NewRepository(db),
		config: config,
	}
}

// ExecuteQuery executes a dynamic query
func (s *Service) ExecuteQuery(ctx context.Context, req *QueryRequest) (*QueryResult, error) {
	startTime := time.Now()
	
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, err
	}
	
	// Get the query builder
	queryBuilder, err := s.resolveQueryBuilder(ctx, req)
	if err != nil {
		return nil, err
	}
	
	// Validate query complexity
	if err := s.validateQueryComplexity(queryBuilder); err != nil {
		return nil, err
	}
	
	// Build SQL query
	sqlQuery, params, err := s.buildSQL(ctx, queryBuilder)
	if err != nil {
		return nil, err
	}
	
	// If explain only, return query info
	if req.ExplainOnly {
		return &QueryResult{
			ExecutionTime: time.Since(startTime),
			QueryInfo: QueryInfo{
				SQL:        sqlQuery,
				Parameters: params,
			},
		}, nil
	}
	
	// Execute query
	result, err := s.repo.ExecuteQuery(ctx, sqlQuery, params)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	
	// Process results
	queryResult := &QueryResult{
		Data:          result.Data,
		Aggregates:    result.Aggregates,
		ExecutionTime: time.Since(startTime),
		QueryInfo: QueryInfo{
			SQL:        sqlQuery,
			Parameters: params,
		},
	}
	
	// Apply grouping if specified
	if queryBuilder.Grouping != nil {
		queryResult.Groups = s.processGrouping(result.Data, queryBuilder.Grouping)
	}
	
	// Apply pagination
	if queryBuilder.Pagination != nil {
		queryResult.Pagination = queryBuilder.Pagination
	}
	
	return queryResult, nil
}

// resolveQueryBuilder resolves the query builder from the request
func (s *Service) resolveQueryBuilder(ctx context.Context, req *QueryRequest) (*QueryBuilder, error) {
	if req.Query != nil {
		return req.Query, nil
	}
	
	if req.SavedQueryID != nil {
		savedQuery, err := s.repo.GetSavedQuery(ctx, *req.SavedQueryID)
		if err != nil {
			return nil, fmt.Errorf("failed to get saved query: %w", err)
		}
		return &savedQuery.Query, nil
	}
	
	if req.TemplateID != nil {
		template, err := s.repo.GetQueryTemplate(ctx, *req.TemplateID)
		if err != nil {
			return nil, fmt.Errorf("failed to get query template: %w", err)
		}
		
		// Apply parameters to template
		return s.applyTemplateParameters(template.Template, template.Parameters, req.Parameters)
	}
	
	return nil, &types.AppError{
		Code:    types.ErrorCodeValidationFailed,
		Message: "No query source provided",
	}
}

// validateQueryComplexity validates that the query is not too complex
func (s *Service) validateQueryComplexity(qb *QueryBuilder) error {
	if len(qb.Conditions) > s.config.MaxConditions {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Too many conditions, maximum is %d", s.config.MaxConditions),
		}
	}
	
	if len(qb.Joins) > s.config.MaxJoins {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Too many joins, maximum is %d", s.config.MaxJoins),
		}
	}
	
	if qb.Grouping != nil && len(qb.Grouping.Fields) > s.config.MaxGroups {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Too many group by fields, maximum is %d", s.config.MaxGroups),
		}
	}
	
	if qb.Pagination != nil && qb.Pagination.PageSize > s.config.MaxResults {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Page size too large, maximum is %d", s.config.MaxResults),
		}
	}
	
	return nil
}

// buildSQL builds the SQL query from a query builder
func (s *Service) buildSQL(ctx context.Context, qb *QueryBuilder) (string, []interface{}, error) {
	var sqlParts []string
	var params []interface{}
	
	// Get model information
	model, err := s.repo.GetModel(ctx, qb.ModelID)
	if err != nil {
		return "", nil, fmt.Errorf("failed to get model: %w", err)
	}
	
	// Build SELECT clause
	selectClause, selectParams, err := s.buildSelectClause(qb, model)
	if err != nil {
		return "", nil, err
	}
	sqlParts = append(sqlParts, selectClause)
	params = append(params, selectParams...)
	
	// Build FROM clause
	fromClause := fmt.Sprintf("FROM %s AS main", model.TableName())
	sqlParts = append(sqlParts, fromClause)
	
	// Build JOIN clauses
	if len(qb.Joins) > 0 {
		joinClause, joinParams, err := s.buildJoinClause(ctx, qb.Joins)
		if err != nil {
			return "", nil, err
		}
		sqlParts = append(sqlParts, joinClause)
		params = append(params, joinParams...)
	}
	
	// Build WHERE clause
	if len(qb.Conditions) > 0 {
		whereClause, whereParams, err := s.buildWhereClause(qb.Conditions)
		if err != nil {
			return "", nil, err
		}
		sqlParts = append(sqlParts, "WHERE "+whereClause)
		params = append(params, whereParams...)
	}
	
	// Build GROUP BY clause
	if qb.Grouping != nil {
		groupClause, groupParams, err := s.buildGroupByClause(qb.Grouping)
		if err != nil {
			return "", nil, err
		}
		sqlParts = append(sqlParts, groupClause)
		params = append(params, groupParams...)
	}
	
	// Build ORDER BY clause
	if len(qb.Sorting) > 0 {
		orderClause := s.buildOrderByClause(qb.Sorting)
		sqlParts = append(sqlParts, orderClause)
	}
	
	// Build LIMIT clause
	if qb.Pagination != nil {
		limitClause, limitParams := s.buildLimitClause(qb.Pagination)
		sqlParts = append(sqlParts, limitClause)
		params = append(params, limitParams...)
	}
	
	sql := strings.Join(sqlParts, " ")
	return sql, params, nil
}

// buildSelectClause builds the SELECT clause
func (s *Service) buildSelectClause(qb *QueryBuilder, model *types.Model) (string, []interface{}, error) {
	var selectParts []string
	var params []interface{}
	
	// Add basic fields
	selectParts = append(selectParts, "main.*")
	
	// Add aggregates
	for _, agg := range qb.Aggregates {
		aggClause, aggParams, err := s.buildAggregateClause(agg)
		if err != nil {
			return "", nil, err
		}
		selectParts = append(selectParts, aggClause)
		params = append(params, aggParams...)
	}
	
	selectClause := "SELECT " + strings.Join(selectParts, ", ")
	return selectClause, params, nil
}

// buildJoinClause builds JOIN clauses
func (s *Service) buildJoinClause(ctx context.Context, joins []Join) (string, []interface{}, error) {
	var joinParts []string
	var params []interface{}
	
	for _, join := range joins {
		// Get joined model
		joinModel, err := s.repo.GetModel(ctx, join.ModelID)
		if err != nil {
			return "", nil, fmt.Errorf("failed to get join model: %w", err)
		}
		
		alias := join.Alias
		if alias == "" {
			alias = joinModel.TableName()
		}
		
		joinType := string(join.JoinType)
		if joinType == "" {
			joinType = "INNER"
		}
		
		// Build ON conditions
		var onParts []string
		for _, condition := range join.OnConditions {
			operator := string(condition.Operator)
			if operator == "" {
				operator = "="
			}
			onParts = append(onParts, fmt.Sprintf("main.%s %s %s.%s", 
				condition.LeftField, operator, alias, condition.RightField))
		}
		
		joinClause := fmt.Sprintf("%s JOIN %s AS %s ON %s",
			joinType, joinModel.TableName(), alias, strings.Join(onParts, " AND "))
		
		joinParts = append(joinParts, joinClause)
	}
	
	return strings.Join(joinParts, " "), params, nil
}

// buildWhereClause builds WHERE clause
func (s *Service) buildWhereClause(conditions []Condition) (string, []interface{}, error) {
	var whereParts []string
	var params []interface{}
	
	for i, condition := range conditions {
		conditionClause, conditionParams, err := s.buildConditionClause(condition)
		if err != nil {
			return "", nil, err
		}
		
		if i > 0 {
			logicalOp := condition.LogicalOp
			if logicalOp == "" {
				logicalOp = LogicalAnd
			}
			whereParts = append(whereParts, string(logicalOp))
		}
		
		whereParts = append(whereParts, conditionClause)
		params = append(params, conditionParams...)
	}
	
	return strings.Join(whereParts, " "), params, nil
}

// buildConditionClause builds a single condition clause
func (s *Service) buildConditionClause(condition Condition) (string, []interface{}, error) {
	field := fmt.Sprintf("main.%s", condition.Field)
	
	switch condition.Operator {
	case OpEquals:
		return fmt.Sprintf("%s = ?", field), []interface{}{condition.Value}, nil
	case OpNotEquals:
		return fmt.Sprintf("%s != ?", field), []interface{}{condition.Value}, nil
	case OpGreaterThan:
		return fmt.Sprintf("%s > ?", field), []interface{}{condition.Value}, nil
	case OpGreaterThanEqual:
		return fmt.Sprintf("%s >= ?", field), []interface{}{condition.Value}, nil
	case OpLessThan:
		return fmt.Sprintf("%s < ?", field), []interface{}{condition.Value}, nil
	case OpLessThanEqual:
		return fmt.Sprintf("%s <= ?", field), []interface{}{condition.Value}, nil
	case OpLike:
		return fmt.Sprintf("%s LIKE ?", field), []interface{}{condition.Value}, nil
	case OpNotLike:
		return fmt.Sprintf("%s NOT LIKE ?", field), []interface{}{condition.Value}, nil
	case OpIn:
		placeholders := strings.Repeat("?,", len(condition.Values))
		placeholders = placeholders[:len(placeholders)-1] // Remove trailing comma
		return fmt.Sprintf("%s IN (%s)", field, placeholders), condition.Values, nil
	case OpNotIn:
		placeholders := strings.Repeat("?,", len(condition.Values))
		placeholders = placeholders[:len(placeholders)-1] // Remove trailing comma
		return fmt.Sprintf("%s NOT IN (%s)", field, placeholders), condition.Values, nil
	case OpIsNull:
		return fmt.Sprintf("%s IS NULL", field), nil, nil
	case OpIsNotNull:
		return fmt.Sprintf("%s IS NOT NULL", field), nil, nil
	case OpBetween:
		return fmt.Sprintf("%s BETWEEN ? AND ?", field), condition.Values, nil
	case OpNotBetween:
		return fmt.Sprintf("%s NOT BETWEEN ? AND ?", field), condition.Values, nil
	case OpContains:
		return fmt.Sprintf("%s LIKE ?", field), []interface{}{fmt.Sprintf("%%%v%%", condition.Value)}, nil
	case OpNotContains:
		return fmt.Sprintf("%s NOT LIKE ?", field), []interface{}{fmt.Sprintf("%%%v%%", condition.Value)}, nil
	case OpStartsWith:
		return fmt.Sprintf("%s LIKE ?", field), []interface{}{fmt.Sprintf("%v%%", condition.Value)}, nil
	case OpEndsWith:
		return fmt.Sprintf("%s LIKE ?", field), []interface{}{fmt.Sprintf("%%%v", condition.Value)}, nil
	default:
		return "", nil, &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: fmt.Sprintf("Unsupported operator: %s", condition.Operator),
		}
	}
}

// buildGroupByClause builds GROUP BY clause
func (s *Service) buildGroupByClause(groupBy *GroupBy) (string, []interface{}, error) {
	var params []interface{}
	
	// Build GROUP BY fields
	var groupFields []string
	for _, field := range groupBy.Fields {
		groupFields = append(groupFields, fmt.Sprintf("main.%s", field))
	}
	
	groupClause := "GROUP BY " + strings.Join(groupFields, ", ")
	
	// Add ROLLUP or CUBE if specified
	if groupBy.Rollup {
		groupClause = fmt.Sprintf("GROUP BY ROLLUP(%s)", strings.Join(groupFields, ", "))
	} else if groupBy.Cube {
		groupClause = fmt.Sprintf("GROUP BY CUBE(%s)", strings.Join(groupFields, ", "))
	}
	
	// Add HAVING clause if specified
	if len(groupBy.Having) > 0 {
		havingClause, havingParams, err := s.buildWhereClause(groupBy.Having)
		if err != nil {
			return "", nil, err
		}
		groupClause += " HAVING " + havingClause
		params = append(params, havingParams...)
	}
	
	return groupClause, params, nil
}

// buildAggregateClause builds an aggregate function clause
func (s *Service) buildAggregateClause(agg Aggregate) (string, []interface{}, error) {
	var params []interface{}
	
	var fieldClause string
	if agg.Field != "" {
		fieldClause = fmt.Sprintf("main.%s", agg.Field)
		if agg.Distinct {
			fieldClause = fmt.Sprintf("DISTINCT %s", fieldClause)
		}
	} else {
		fieldClause = "*"
	}
	
	aggClause := fmt.Sprintf("%s(%s)", agg.Function, fieldClause)
	
	if agg.Alias != "" {
		aggClause += fmt.Sprintf(" AS %s", agg.Alias)
	}
	
	// Handle conditional aggregation
	if len(agg.Filter) > 0 {
		filterClause, filterParams, err := s.buildWhereClause(agg.Filter)
		if err != nil {
			return "", nil, err
		}
		aggClause = fmt.Sprintf("SUM(CASE WHEN %s THEN %s ELSE 0 END)", filterClause, fieldClause)
		params = append(params, filterParams...)
	}
	
	return aggClause, params, nil
}

// buildOrderByClause builds ORDER BY clause
func (s *Service) buildOrderByClause(sorting []types.Sort) string {
	var orderParts []string
	
	for _, sort := range sorting {
		direction := "ASC"
		if sort.Order == "desc" {
			direction = "DESC"
		}
		orderParts = append(orderParts, fmt.Sprintf("main.%s %s", sort.Field, direction))
	}
	
	return "ORDER BY " + strings.Join(orderParts, ", ")
}

// buildLimitClause builds LIMIT clause
func (s *Service) buildLimitClause(pagination *types.Pagination) (string, []interface{}) {
	offset := pagination.GetOffset()
	return "LIMIT ? OFFSET ?", []interface{}{pagination.PageSize, offset}
}

// processGrouping processes data for grouping
func (s *Service) processGrouping(data []map[string]interface{}, groupBy *GroupBy) []GroupResult {
	groups := make(map[string]GroupResult)
	
	for _, row := range data {
		// Build group key
		groupKey := make(map[string]interface{})
		var keyParts []string
		for _, field := range groupBy.Fields {
			value := row[field]
			groupKey[field] = value
			keyParts = append(keyParts, fmt.Sprintf("%v", value))
		}
		
		keyStr := strings.Join(keyParts, "|")
		
		// Get or create group
		group := groups[keyStr]
		if group.GroupKey == nil {
			group.GroupKey = groupKey
			group.Data = []map[string]interface{}{}
		}
		
		// Add row to group
		group.Data = append(group.Data, row)
		group.Count++
		
		groups[keyStr] = group
	}
	
	// Convert to slice
	var result []GroupResult
	for _, group := range groups {
		result = append(result, group)
	}
	
	return result
}

// applyTemplateParameters applies parameters to a query template
func (s *Service) applyTemplateParameters(template QueryBuilder, templateParams []TemplateParam, userParams map[string]interface{}) (*QueryBuilder, error) {
	// This is a simplified implementation
	// In a real implementation, you would parse the template and replace parameter placeholders
	result := template
	
	// Apply user parameters
	for key, value := range userParams {
		// Find the parameter definition
		for _, param := range templateParams {
			if param.Name == key {
				// Apply the parameter value to the query
				// This would involve replacing placeholders in conditions, etc.
				_ = value // Placeholder for actual implementation
				break
			}
		}
	}
	
	return &result, nil
}

// SaveQuery saves a query for later reuse
func (s *Service) SaveQuery(ctx context.Context, req *SavedQuery) (*SavedQuery, error) {
	if err := s.repo.CreateSavedQuery(ctx, req); err != nil {
		return nil, fmt.Errorf("failed to save query: %w", err)
	}
	return req, nil
}

// GetSavedQueries retrieves saved queries
func (s *Service) GetSavedQueries(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*SavedQuery, *types.Pagination, error) {
	return s.repo.ListSavedQueries(ctx, tenantID, options)
}

// CreateQueryTemplate creates a new query template
func (s *Service) CreateQueryTemplate(ctx context.Context, req *QueryTemplate) (*QueryTemplate, error) {
	if err := s.repo.CreateQueryTemplate(ctx, req); err != nil {
		return nil, fmt.Errorf("failed to create query template: %w", err)
	}
	return req, nil
}

// GetQueryTemplates retrieves query templates
func (s *Service) GetQueryTemplates(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*QueryTemplate, *types.Pagination, error) {
	return s.repo.ListQueryTemplates(ctx, tenantID, options)
}