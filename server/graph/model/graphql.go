package model

import (
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"time"

	"github.com/99designs/gqlgen/graphql"
	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/pkg/types"
)

// Custom scalar implementations

// MarshalUUID marshals UUID to GraphQL
func MarshalUUID(id uuid.UUID) graphql.Marshaler {
	return graphql.WriterFunc(func(w io.Writer) {
		io.WriteString(w, strconv.Quote(id.String()))
	})
}

// UnmarshalUUID unmarshals UUID from GraphQL
func UnmarshalUUID(v interface{}) (uuid.UUID, error) {
	switch v := v.(type) {
	case string:
		return uuid.Parse(v)
	case []byte:
		return uuid.Parse(string(v))
	default:
		return uuid.Nil, fmt.Errorf("cannot unmarshal %T into UUID", v)
	}
}

// MarshalTime marshals time to GraphQL
func MarshalTime(t time.Time) graphql.Marshaler {
	return graphql.WriterFunc(func(w io.Writer) {
		io.WriteString(w, strconv.Quote(t.Format(time.RFC3339)))
	})
}

// UnmarshalTime unmarshals time from GraphQL
func UnmarshalTime(v interface{}) (time.Time, error) {
	switch v := v.(type) {
	case string:
		return time.Parse(time.RFC3339, v)
	case []byte:
		return time.Parse(time.RFC3339, string(v))
	case int64:
		return time.Unix(v, 0), nil
	default:
		return time.Time{}, fmt.Errorf("cannot unmarshal %T into Time", v)
	}
}

// MarshalJSON marshals JSON to GraphQL
func MarshalJSON(data types.JSON) graphql.Marshaler {
	return graphql.WriterFunc(func(w io.Writer) {
		if data == nil {
			io.WriteString(w, "null")
			return
		}
		bytes, _ := json.Marshal(data)
		w.Write(bytes)
	})
}

// UnmarshalJSON unmarshals JSON from GraphQL
func UnmarshalJSON(v interface{}) (types.JSON, error) {
	switch v := v.(type) {
	case map[string]interface{}:
		return types.JSON(v), nil
	case []interface{}:
		return types.JSON(v), nil
	case string:
		var result interface{}
		if err := json.Unmarshal([]byte(v), &result); err != nil {
			return nil, err
		}
		return types.JSON(result), nil
	case nil:
		return nil, nil
	default:
		return types.JSON(v), nil
	}
}

// GraphQL-specific types that don't exist in the main types package

// FieldType enum values
type FieldType string

const (
	FieldTypeString    FieldType = "STRING"
	FieldTypeInteger   FieldType = "INTEGER"
	FieldTypeFloat     FieldType = "FLOAT"
	FieldTypeBoolean   FieldType = "BOOLEAN"
	FieldTypeDate      FieldType = "DATE"
	FieldTypeDatetime  FieldType = "DATETIME"
	FieldTypeJSON      FieldType = "JSON"
	FieldTypeReference FieldType = "REFERENCE"
	FieldTypeEnum      FieldType = "ENUM"
)

// SortOrder enum values
type SortOrder string

const (
	SortOrderAsc  SortOrder = "ASC"
	SortOrderDesc SortOrder = "DESC"
)

// AuditAction enum values
type AuditAction string

const (
	AuditActionCreate AuditAction = "CREATE"
	AuditActionRead   AuditAction = "READ"
	AuditActionUpdate AuditAction = "UPDATE"
	AuditActionDelete AuditAction = "DELETE"
	AuditActionLogin  AuditAction = "LOGIN"
	AuditActionLogout AuditAction = "LOGOUT"
	AuditActionExport AuditAction = "EXPORT"
	AuditActionImport AuditAction = "IMPORT"
)

// Input types for GraphQL mutations
type FieldInput struct {
	Name           string      `json:"name"`
	DisplayName    *string     `json:"displayName"`
	Type           FieldType   `json:"type"`
	Required       *bool       `json:"required"`
	DefaultValue   *string     `json:"defaultValue"`
	Description    *string     `json:"description"`
	Validation     types.JSON  `json:"validation"`
	EnumValues     []string    `json:"enumValues"`
	ReferenceModel *string     `json:"referenceModel"`
}

type ModelInput struct {
	Name        string       `json:"name"`
	DisplayName *string      `json:"displayName"`
	Description *string      `json:"description"`
	Category    *string      `json:"category"`
	Icon        *string      `json:"icon"`
	Fields      []FieldInput `json:"fields"`
}

type InstanceInput struct {
	ModelName string     `json:"modelName"`
	Data      types.JSON `json:"data"`
}

type QueryConditionInput struct {
	Field           string     `json:"field"`
	Operator        string     `json:"operator"`
	Value           types.JSON `json:"value"`
	LogicalOperator *string    `json:"logicalOperator"`
}

type QueryJoinInput struct {
	Model     string  `json:"model"`
	JoinField string  `json:"joinField"`
	Type      *string `json:"type"`
	Alias     *string `json:"alias"`
}

type QueryGroupByInput struct {
	Field    string  `json:"field"`
	Function *string `json:"function"`
}

type QueryOrderByInput struct {
	Field     string    `json:"field"`
	Direction SortOrder `json:"direction"`
}

type DynamicQueryInput struct {
	Model      string                 `json:"model"`
	Fields     []string               `json:"fields"`
	Conditions []QueryConditionInput  `json:"conditions"`
	Joins      []QueryJoinInput       `json:"joins"`
	GroupBy    []QueryGroupByInput    `json:"groupBy"`
	OrderBy    []QueryOrderByInput    `json:"orderBy"`
	Limit      *int                   `json:"limit"`
	Offset     *int                   `json:"offset"`
}

type PaginationInput struct {
	Page     *int `json:"page"`
	PageSize *int `json:"pageSize"`
}

// Output types
type QueryResult struct {
	Data          []types.JSON `json:"data"`
	Total         int          `json:"total"`
	Aggregations  types.JSON   `json:"aggregations"`
	ExecutionTime int          `json:"executionTime"`
}

type Pagination struct {
	Page       int `json:"page"`
	PageSize   int `json:"pageSize"`
	Total      int `json:"total"`
	TotalPages int `json:"totalPages"`
}

type ModelList struct {
	Items      []*types.Model `json:"items"`
	Pagination *Pagination    `json:"pagination"`
}

type InstanceList struct {
	Items      []*types.Instance `json:"items"`
	Pagination *Pagination       `json:"pagination"`
}

type UserList struct {
	Items      []*types.User `json:"items"`
	Pagination *Pagination   `json:"pagination"`
}

type AuditLogList struct {
	Items      []*types.AuditLog `json:"items"`
	Pagination *Pagination       `json:"pagination"`
}

// Topology types
type TopologyNode struct {
	ID            uuid.UUID       `json:"id"`
	ModelName     string          `json:"modelName"`
	InstanceID    uuid.UUID       `json:"instanceId"`
	InstanceData  types.JSON      `json:"instanceData"`
	Relationships []*TopologyEdge `json:"relationships"`
}

type TopologyEdge struct {
	ID               uuid.UUID  `json:"id"`
	RelationshipName string     `json:"relationshipName"`
	SourceNode       uuid.UUID  `json:"sourceNode"`
	TargetNode       uuid.UUID  `json:"targetNode"`
	Direction        string     `json:"direction"`
	Metadata         types.JSON `json:"metadata"`
}

type TopologyGraph struct {
	Nodes    []*TopologyNode `json:"nodes"`
	Edges    []*TopologyEdge `json:"edges"`
	Metadata types.JSON      `json:"metadata"`
}