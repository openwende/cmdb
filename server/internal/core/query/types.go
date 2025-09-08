package query

import (
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
)

// QueryBuilder represents a dynamic query builder
type QueryBuilder struct {
	BusinessID uuid.UUID      `json:"business_id"`
	ModelID    uuid.UUID      `json:"model_id"`
	Conditions []Condition    `json:"conditions,omitempty"`
	Joins      []Join         `json:"joins,omitempty"`
	Grouping   *GroupBy       `json:"grouping,omitempty"`
	Aggregates []Aggregate    `json:"aggregates,omitempty"`
	Sorting    []types.Sort   `json:"sorting,omitempty"`
	Pagination *types.Pagination `json:"pagination,omitempty"`
}

// Condition represents a query condition
type Condition struct {
	Field     string          `json:"field" validate:"required"`
	Operator  ConditionOperator `json:"operator" validate:"required"`
	Value     interface{}     `json:"value"`
	Values    []interface{}   `json:"values,omitempty"` // For IN, NOT_IN operators
	LogicalOp LogicalOperator `json:"logical_op,omitempty"` // AND, OR for combining conditions
}

// ConditionOperator represents query operators
type ConditionOperator string

const (
	OpEquals             ConditionOperator = "eq"
	OpNotEquals         ConditionOperator = "ne"
	OpGreaterThan       ConditionOperator = "gt"
	OpGreaterThanEqual  ConditionOperator = "gte"
	OpLessThan          ConditionOperator = "lt"
	OpLessThanEqual     ConditionOperator = "lte"
	OpLike              ConditionOperator = "like"
	OpNotLike          ConditionOperator = "not_like"
	OpIn                ConditionOperator = "in"
	OpNotIn            ConditionOperator = "not_in"
	OpIsNull           ConditionOperator = "is_null"
	OpIsNotNull        ConditionOperator = "is_not_null"
	OpBetween          ConditionOperator = "between"
	OpNotBetween       ConditionOperator = "not_between"
	OpContains         ConditionOperator = "contains"
	OpNotContains      ConditionOperator = "not_contains"
	OpStartsWith       ConditionOperator = "starts_with"
	OpEndsWith         ConditionOperator = "ends_with"
)

// LogicalOperator represents logical operators for combining conditions
type LogicalOperator string

const (
	LogicalAnd LogicalOperator = "AND"
	LogicalOr  LogicalOperator = "OR"
)

// Join represents a join operation between models
type Join struct {
	ModelID      uuid.UUID `json:"model_id" validate:"required"`
	JoinType     JoinType  `json:"join_type"`
	OnConditions []JoinCondition `json:"on_conditions" validate:"required,min=1"`
	Alias        string    `json:"alias,omitempty"`
}

// JoinType represents the type of join
type JoinType string

const (
	JoinTypeInner JoinType = "INNER"
	JoinTypeLeft  JoinType = "LEFT"
	JoinTypeRight JoinType = "RIGHT"
	JoinTypeFull  JoinType = "FULL"
)

// JoinCondition represents a condition for joining tables
type JoinCondition struct {
	LeftField  string `json:"left_field" validate:"required"`
	RightField string `json:"right_field" validate:"required"`
	Operator   ConditionOperator `json:"operator"`
}

// GroupBy represents grouping configuration
type GroupBy struct {
	Fields   []string        `json:"fields" validate:"required,min=1"`
	Having   []Condition     `json:"having,omitempty"`
	Rollup   bool            `json:"rollup,omitempty"`   // SQL ROLLUP functionality
	Cube     bool            `json:"cube,omitempty"`     // SQL CUBE functionality
}

// Aggregate represents an aggregation function
type Aggregate struct {
	Function   AggregateFunction `json:"function" validate:"required"`
	Field      string           `json:"field" validate:"required"`
	Alias      string           `json:"alias,omitempty"`
	Distinct   bool             `json:"distinct,omitempty"`
	Filter     []Condition      `json:"filter,omitempty"` // Conditional aggregation
}

// AggregateFunction represents aggregation functions
type AggregateFunction string

const (
	AggCount   AggregateFunction = "COUNT"
	AggSum     AggregateFunction = "SUM"
	AggAvg     AggregateFunction = "AVG"
	AggMin     AggregateFunction = "MIN"
	AggMax     AggregateFunction = "MAX"
	AggStdDev  AggregateFunction = "STDDEV"
	AggVariance AggregateFunction = "VARIANCE"
	AggConcat  AggregateFunction = "GROUP_CONCAT"
)

// QueryResult represents the result of a dynamic query
type QueryResult struct {
	Data        []map[string]interface{} `json:"data"`
	Aggregates  map[string]interface{}   `json:"aggregates,omitempty"`
	Groups      []GroupResult            `json:"groups,omitempty"`
	Pagination  *types.Pagination        `json:"pagination,omitempty"`
	ExecutionTime time.Duration          `json:"execution_time"`
	QueryInfo   QueryInfo                `json:"query_info"`
}

// GroupResult represents grouped query results
type GroupResult struct {
	GroupKey   map[string]interface{}   `json:"group_key"`
	Data       []map[string]interface{} `json:"data"`
	Aggregates map[string]interface{}   `json:"aggregates"`
	Count      int64                    `json:"count"`
}

// QueryInfo provides information about the executed query
type QueryInfo struct {
	SQL         string                 `json:"sql"`
	Parameters  []interface{}          `json:"parameters"`
	TablesUsed  []string              `json:"tables_used"`
	IndexesUsed []string              `json:"indexes_used,omitempty"`
	CacheHit    bool                  `json:"cache_hit"`
}

// SavedQuery represents a saved query that can be reused
type SavedQuery struct {
	types.TenantModel
	Name         string         `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description  string         `json:"description" gorm:"size:500"`
	Query        QueryBuilder   `json:"query" gorm:"type:jsonb;not null"`
	CreatedBy    uuid.UUID      `json:"created_by" gorm:"type:uuid;not null" swaggertype:"string"`
	IsPublic     bool           `json:"is_public" gorm:"default:false"`
	Tags         []string       `json:"tags" gorm:"type:text[]"`
	Category     string         `json:"category" gorm:"size:50"`
	LastRun      *time.Time     `json:"last_run,omitempty"`
	RunCount     int64          `json:"run_count" gorm:"default:0"`
}

// QueryTemplate represents a query template for common patterns
type QueryTemplate struct {
	types.TenantModel
	Name         string         `json:"name" gorm:"size:100;not null" validate:"required,max=100"`
	Description  string         `json:"description" gorm:"size:500"`
	Template     QueryBuilder   `json:"template" gorm:"type:jsonb;not null"`
	Parameters   []TemplateParam `json:"parameters" gorm:"type:jsonb"`
	Category     string         `json:"category" gorm:"size:50"`
	IsBuiltIn    bool           `json:"is_built_in" gorm:"default:false"`
	UsageCount   int64          `json:"usage_count" gorm:"default:0"`
}

// TemplateParam represents a parameter in a query template
type TemplateParam struct {
	Name         string        `json:"name" validate:"required"`
	Type         types.FieldType `json:"type" validate:"required"`
	Required     bool          `json:"required"`
	DefaultValue interface{}   `json:"default_value,omitempty"`
	Description  string        `json:"description"`
	Options      []string      `json:"options,omitempty"` // For enum types
}

// QueryRequest represents a request to execute a dynamic query
type QueryRequest struct {
	Query       *QueryBuilder         `json:"query,omitempty"`
	SavedQueryID *uuid.UUID           `json:"saved_query_id,omitempty"`
	TemplateID  *uuid.UUID            `json:"template_id,omitempty"`
	Parameters  map[string]interface{} `json:"parameters,omitempty"`
	ExplainOnly bool                  `json:"explain_only,omitempty"`
	UseCache    bool                  `json:"use_cache"`
	CacheTTL    *time.Duration        `json:"cache_ttl,omitempty"`
}

// Validate validates the query request
func (qr *QueryRequest) Validate() error {
	if qr.Query == nil && qr.SavedQueryID == nil && qr.TemplateID == nil {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Either query, saved_query_id, or template_id must be provided",
		}
	}
	
	if qr.Query != nil {
		return qr.Query.Validate()
	}
	
	return nil
}

// Validate validates the query builder
func (qb *QueryBuilder) Validate() error {
	if qb.BusinessID == uuid.Nil {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "business_id is required",
		}
	}
	
	if qb.ModelID == uuid.Nil {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "model_id is required",
		}
	}
	
	// Validate conditions
	for _, condition := range qb.Conditions {
		if err := condition.Validate(); err != nil {
			return err
		}
	}
	
	// Validate joins
	for _, join := range qb.Joins {
		if err := join.Validate(); err != nil {
			return err
		}
	}
	
	// Validate grouping
	if qb.Grouping != nil {
		if err := qb.Grouping.Validate(); err != nil {
			return err
		}
	}
	
	// Validate aggregates
	for _, agg := range qb.Aggregates {
		if err := agg.Validate(); err != nil {
			return err
		}
	}
	
	return nil
}

// Validate validates a condition
func (c *Condition) Validate() error {
	if c.Field == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "condition field is required",
		}
	}
	
	if c.Operator == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "condition operator is required",
		}
	}
	
	// Validate operator-specific requirements
	switch c.Operator {
	case OpIn, OpNotIn:
		if len(c.Values) == 0 {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "IN and NOT_IN operators require values array",
			}
		}
	case OpIsNull, OpIsNotNull:
		// These operators don't need a value
	case OpBetween, OpNotBetween:
		if len(c.Values) != 2 {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "BETWEEN operators require exactly 2 values",
			}
		}
	default:
		if c.Value == nil {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "condition value is required for this operator",
			}
		}
	}
	
	return nil
}

// Validate validates a join
func (j *Join) Validate() error {
	if j.ModelID == uuid.Nil {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "join model_id is required",
		}
	}
	
	if len(j.OnConditions) == 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "join on_conditions are required",
		}
	}
	
	for _, condition := range j.OnConditions {
		if condition.LeftField == "" || condition.RightField == "" {
			return &types.AppError{
				Code:    types.ErrorCodeValidationFailed,
				Message: "join condition fields are required",
			}
		}
	}
	
	return nil
}

// Validate validates a group by clause
func (gb *GroupBy) Validate() error {
	if len(gb.Fields) == 0 {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "group by fields are required",
		}
	}
	
	// Validate having conditions
	for _, condition := range gb.Having {
		if err := condition.Validate(); err != nil {
			return err
		}
	}
	
	return nil
}

// Validate validates an aggregate
func (a *Aggregate) Validate() error {
	if a.Function == "" {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "aggregate function is required",
		}
	}
	
	if a.Field == "" && a.Function != AggCount {
		return &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "aggregate field is required for non-COUNT functions",
		}
	}
	
	// Validate filter conditions
	for _, condition := range a.Filter {
		if err := condition.Validate(); err != nil {
			return err
		}
	}
	
	return nil
}

// TableNames for GORM
func (SavedQuery) TableName() string    { return "saved_queries" }
func (QueryTemplate) TableName() string { return "query_templates" }