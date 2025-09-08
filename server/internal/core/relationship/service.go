package relationship

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Service provides relationship management functionality
type Service struct {
	repo *Repository
}

// NewService creates a new relationship service
func NewService(db *gorm.DB) *Service {
	return &Service{
		repo: NewRepository(db),
	}
}

// Model relationship operations

// CreateModelRelationship creates a new model relationship
func (s *Service) CreateModelRelationship(ctx context.Context, tenantID string, req *CreateModelRelationshipRequest) (*types.Relationship, error) {
	// Validate request
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Check if source and target models exist
	if _, err := s.repo.GetModelByID(ctx, tenantID, req.SourceModelID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Source model not found",
			}
		}
		return nil, fmt.Errorf("failed to get source model: %w", err)
	}

	if _, err := s.repo.GetModelByID(ctx, tenantID, req.TargetModelID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Target model not found",
			}
		}
		return nil, fmt.Errorf("failed to get target model: %w", err)
	}

	// Check for duplicate relationships
	exists, err := s.repo.RelationshipExists(ctx, tenantID, req.SourceModelID, req.TargetModelID, req.Name)
	if err != nil {
		return nil, fmt.Errorf("failed to check relationship existence: %w", err)
	}
	if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "A relationship with this name already exists between these models",
		}
	}

	relationship := &types.Relationship{
		TenantModel: types.TenantModel{
			BaseModel: types.BaseModel{
				ID: uuid.New(),
			},
			TenantID: uuid.MustParse(tenantID),
		},
		SourceModelID: uuid.MustParse(req.SourceModelID),
		TargetModelID: uuid.MustParse(req.TargetModelID),
		Name:          req.Name,
		Description:   req.Description,
		IsBuiltIn:     false,
	}

	if err := s.repo.CreateRelationship(ctx, relationship); err != nil {
		return nil, fmt.Errorf("failed to create relationship: %w", err)
	}

	return relationship, nil
}

// GetModelRelationship retrieves a model relationship by ID
func (s *Service) GetModelRelationship(ctx context.Context, tenantID, id string) (*types.Relationship, error) {
	relationship, err := s.repo.GetRelationshipByID(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Relationship not found",
			}
		}
		return nil, fmt.Errorf("failed to get relationship: %w", err)
	}

	return relationship, nil
}

// UpdateModelRelationship updates a model relationship
func (s *Service) UpdateModelRelationship(ctx context.Context, tenantID, id string, req *UpdateModelRelationshipRequest) (*types.Relationship, error) {
	relationship, err := s.GetModelRelationship(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	if relationship.IsBuiltIn {
		return nil, &types.AppError{
			Code:    types.ErrorCodePermissionDenied,
			Message: "Built-in relationships cannot be modified",
		}
	}

	// Update fields
	if req.Name != nil {
		relationship.Name = *req.Name
	}
	if req.Description != nil {
		relationship.Description = *req.Description
	}
	if req.Constraints != nil {
		if err := req.Constraints.Validate(); err != nil {
			return nil, err
		}
		// Note: Type constraint handling would need to be implemented based on actual schema
	}

	if err := s.repo.UpdateRelationship(ctx, relationship); err != nil {
		return nil, fmt.Errorf("failed to update relationship: %w", err)
	}

	return relationship, nil
}

// DeleteModelRelationship deletes a model relationship
func (s *Service) DeleteModelRelationship(ctx context.Context, tenantID, id string) error {
	relationship, err := s.GetModelRelationship(ctx, tenantID, id)
	if err != nil {
		return err
	}

	if relationship.IsBuiltIn {
		return &types.AppError{
			Code:    types.ErrorCodePermissionDenied,
			Message: "Built-in relationships cannot be deleted",
		}
	}

	// Check if relationship has instances
	hasInstances, err := s.repo.RelationshipHasInstances(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check relationship instances: %w", err)
	}
	if hasInstances {
		return &types.AppError{
			Code:    types.ErrorCodeConstraintViolation,
			Message: "Cannot delete relationship that has instances",
		}
	}

	if err := s.repo.DeleteRelationship(ctx, id); err != nil {
		return fmt.Errorf("failed to delete relationship: %w", err)
	}

	return nil
}

// ListModelRelationships lists model relationships with pagination
func (s *Service) ListModelRelationships(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Relationship, *types.Pagination, error) {
	relationships, pagination, err := s.repo.ListRelationships(ctx, tenantID, options)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list relationships: %w", err)
	}

	return relationships, pagination, nil
}

// Instance relationship operations

// CreateInstanceRelationship creates a new instance relationship
func (s *Service) CreateInstanceRelationship(ctx context.Context, tenantID string, req *CreateInstanceRelationshipRequest) (*types.InstanceRelationship, error) {
	// Validate relationship exists
	relationship, err := s.GetModelRelationship(ctx, tenantID, req.RelationshipID)
	if err != nil {
		return nil, err
	}

	// Validate instances exist and belong to correct models
	sourceInstance, err := s.repo.GetInstanceByID(ctx, tenantID, req.SourceInstanceID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Source instance not found",
			}
		}
		return nil, fmt.Errorf("failed to get source instance: %w", err)
	}

	targetInstance, err := s.repo.GetInstanceByID(ctx, tenantID, req.TargetInstanceID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Target instance not found",
			}
		}
		return nil, fmt.Errorf("failed to get target instance: %w", err)
	}

	// Validate model compatibility
	if sourceInstance.ModelID != relationship.SourceModelID {
		return nil, &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Source instance does not belong to the relationship's source model",
		}
	}

	if targetInstance.ModelID != relationship.TargetModelID {
		return nil, &types.AppError{
			Code:    types.ErrorCodeValidationFailed,
			Message: "Target instance does not belong to the relationship's target model",
		}
	}

	// Check for duplicate relationships
	exists, err := s.repo.InstanceRelationshipExists(ctx, req.SourceInstanceID, req.TargetInstanceID, req.RelationshipID)
	if err != nil {
		return nil, fmt.Errorf("failed to check instance relationship existence: %w", err)
	}
	if exists {
		return nil, &types.AppError{
			Code:    types.ErrorCodeAlreadyExists,
			Message: "Instance relationship already exists",
		}
	}

	// Validate relationship constraints
	if err := s.validateRelationshipConstraints(ctx, relationship, req.SourceInstanceID, req.TargetInstanceID); err != nil {
		return nil, err
	}

	instanceRelationship := &types.InstanceRelationship{
		TenantModel: types.TenantModel{
			BaseModel: types.BaseModel{
				ID: uuid.New(),
			},
			TenantID: uuid.MustParse(tenantID),
		},
		SourceInstanceID: uuid.MustParse(req.SourceInstanceID),
		TargetInstanceID: uuid.MustParse(req.TargetInstanceID),
		RelationshipID:   uuid.MustParse(req.RelationshipID),
	}

	if err := s.repo.CreateInstanceRelationship(ctx, instanceRelationship); err != nil {
		return nil, fmt.Errorf("failed to create instance relationship: %w", err)
	}

	return instanceRelationship, nil
}

// DeleteInstanceRelationship deletes an instance relationship
func (s *Service) DeleteInstanceRelationship(ctx context.Context, tenantID, id string) error {
	_, err := s.repo.GetInstanceRelationshipByID(ctx, tenantID, id)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return &types.AppError{
				Code:    types.ErrorCodeNotFound,
				Message: "Instance relationship not found",
			}
		}
		return fmt.Errorf("failed to get instance relationship: %w", err)
	}

	if err := s.repo.DeleteInstanceRelationship(ctx, id); err != nil {
		return fmt.Errorf("failed to delete instance relationship: %w", err)
	}

	return nil
}

// Topology query operations

// QueryTopology performs a topology query starting from an instance or model
func (s *Service) QueryTopology(ctx context.Context, tenantID string, req *TopologyQueryRequest) (*TopologyQueryResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	// Set defaults
	if req.MaxDepth == 0 {
		req.MaxDepth = 3
	}
	if req.Direction == "" {
		req.Direction = "both"
	}

	var startInstances []string
	
	// Get starting instances
	if req.StartInstanceID != "" {
		startInstances = []string{req.StartInstanceID}
	} else if req.StartModelID != "" {
		// Get all instances of the model
		instances, err := s.repo.GetInstancesByModel(ctx, tenantID, req.StartModelID)
		if err != nil {
			return nil, fmt.Errorf("failed to get instances by model: %w", err)
		}
		for _, instance := range instances {
			startInstances = append(startInstances, instance.ID.String())
		}
	}

	// Perform topology traversal
	nodes := make(map[string]*TopologyNode)
	relationships := make(map[string]*TopologyRelationship)
	maxDepthReached := 0

	for _, startInstanceID := range startInstances {
		err := s.traverseTopology(ctx, tenantID, startInstanceID, req, nodes, relationships, 0, &maxDepthReached)
		if err != nil {
			return nil, err
		}
	}

	// Convert maps to slices
	var nodeList []TopologyNode
	var relationshipList []TopologyRelationship

	for _, node := range nodes {
		nodeList = append(nodeList, *node)
	}

	for _, rel := range relationships {
		relationshipList = append(relationshipList, *rel)
	}

	// Calculate statistics
	stats := s.calculateTopologyStats(nodeList, relationshipList)

	return &TopologyQueryResponse{
		Nodes:         nodeList,
		Relationships: relationshipList,
		Depth:         maxDepthReached,
		Stats:         stats,
	}, nil
}

// SearchRelationships searches relationships across models
func (s *Service) SearchRelationships(ctx context.Context, tenantID string, req *RelationshipSearchRequest) (*RelationshipSearchResponse, error) {
	relationships, pagination, err := s.repo.SearchRelationships(ctx, tenantID, req)
	if err != nil {
		return nil, fmt.Errorf("failed to search relationships: %w", err)
	}

	// Calculate facets
	facets := s.calculateRelationshipFacets(relationships)

	return &RelationshipSearchResponse{
		Relationships: relationships,
		Pagination:    pagination,
		Facets:        facets,
	}, nil
}

// Helper methods

// validateRelationshipConstraints validates relationship constraints for instance relationships
func (s *Service) validateRelationshipConstraints(ctx context.Context, relationship *types.Relationship, sourceInstanceID, targetInstanceID string) error {
	// Check cardinality constraints based on relationship constraint
	switch relationship.Constraint {
	case types.ConstraintOneToOne:
		// Check if source already has a relationship of this type
		sourceCount, err := s.repo.GetInstanceRelationshipCount(ctx, sourceInstanceID, relationship.ID.String(), "source")
		if err != nil {
			return fmt.Errorf("failed to check source relationship count: %w", err)
		}
		if sourceCount > 0 {
			return &types.AppError{
				Code:    types.ErrorCodeConstraintViolation,
				Message: "Source instance already has a relationship of this type (one-to-one constraint)",
			}
		}

		// Check if target already has a relationship of this type
		targetCount, err := s.repo.GetInstanceRelationshipCount(ctx, targetInstanceID, relationship.ID.String(), "target")
		if err != nil {
			return fmt.Errorf("failed to check target relationship count: %w", err)
		}
		if targetCount > 0 {
			return &types.AppError{
				Code:    types.ErrorCodeConstraintViolation,
				Message: "Target instance already has a relationship of this type (one-to-one constraint)",
			}
		}

	case types.ConstraintOneToMany:
		// Check if target already has a relationship of this type (many side can only have one)
		targetCount, err := s.repo.GetInstanceRelationshipCount(ctx, targetInstanceID, relationship.ID.String(), "target")
		if err != nil {
			return fmt.Errorf("failed to check target relationship count: %w", err)
		}
		if targetCount > 0 {
			return &types.AppError{
				Code:    types.ErrorCodeConstraintViolation,
				Message: "Target instance already has a relationship of this type (one-to-many constraint)",
			}
		}

	case types.ConstraintManyToMany:
		// No cardinality constraints for many-to-many
		break
	}

	return nil
}

// traverseTopology recursively traverses the topology graph
func (s *Service) traverseTopology(ctx context.Context, tenantID, instanceID string, req *TopologyQueryRequest, nodes map[string]*TopologyNode, relationships map[string]*TopologyRelationship, currentDepth int, maxDepthReached *int) error {
	if currentDepth > req.MaxDepth {
		return nil
	}

	if currentDepth > *maxDepthReached {
		*maxDepthReached = currentDepth
	}

	// Skip if node already processed
	if _, exists := nodes[instanceID]; exists {
		return nil
	}

	// Get instance details
	instance, err := s.repo.GetInstanceByID(ctx, tenantID, instanceID)
	if err != nil {
		return fmt.Errorf("failed to get instance: %w", err)
	}

	// Apply instance filters
	if !s.matchesInstanceFilters(instance, req.InstanceFilters) {
		return nil
	}

	// Add node
	node := &TopologyNode{
		InstanceID: instanceID,
		Name:       instance.Name,
		ModelID:    instance.ModelID.String(),
		Level:      currentDepth,
	}

	if req.IncludeProperties {
		// Convert JSON raw message to map
		var dataMap map[string]interface{}
		if err := json.Unmarshal(instance.Data, &dataMap); err == nil {
			node.Properties = dataMap
		}
	}

	nodes[instanceID] = node

	// Get related instances
	relatedInstances, instanceRels, err := s.repo.GetRelatedInstances(ctx, tenantID, instanceID, req.Direction, req.RelationshipTypes)
	if err != nil {
		return fmt.Errorf("failed to get related instances: %w", err)
	}

	// Add relationships
	for _, rel := range instanceRels {
		relKey := rel.ID.String()
		if _, exists := relationships[relKey]; !exists {
			relationships[relKey] = &TopologyRelationship{
				ID:               relKey,
				SourceInstanceID: rel.SourceInstanceID.String(),
				TargetInstanceID: rel.TargetInstanceID.String(),
				RelationshipID:   rel.RelationshipID.String(),
			}

			if req.IncludeProperties {
				// Note: Properties would need to be added to InstanceRelationship type
				// relationships[relKey].Properties = rel.Properties
			}
		}
	}

	// Recursively process related instances
	for _, relatedInstanceID := range relatedInstances {
		if err := s.traverseTopology(ctx, tenantID, relatedInstanceID, req, nodes, relationships, currentDepth+1, maxDepthReached); err != nil {
			return err
		}
	}

	return nil
}

// matchesInstanceFilters checks if an instance matches the provided filters
func (s *Service) matchesInstanceFilters(instance *types.Instance, filters []TopologyInstanceFilter) bool {
	for _, filter := range filters {
		// Convert JSON raw message to map for filtering
		var dataMap map[string]interface{}
		if err := json.Unmarshal(instance.Data, &dataMap); err != nil {
			return false
		}
		
		value, exists := dataMap[filter.Field]
		if !exists {
			return false
		}

		if !s.matchesFilter(value, filter.Operator, filter.Value) {
			return false
		}
	}
	return true
}

// matchesFilter checks if a value matches a filter condition
func (s *Service) matchesFilter(value interface{}, operator string, filterValue interface{}) bool {
	switch operator {
	case "eq":
		return value == filterValue
	case "ne":
		return value != filterValue
	case "like":
		if valueStr, ok := value.(string); ok {
			if filterStr, ok := filterValue.(string); ok {
				return strings.Contains(strings.ToLower(valueStr), strings.ToLower(filterStr))
			}
		}
		return false
	case "in":
		if filterSlice, ok := filterValue.([]interface{}); ok {
			for _, v := range filterSlice {
				if value == v {
					return true
				}
			}
		}
		return false
	}
	return false
}

// calculateTopologyStats calculates statistics for topology query results
func (s *Service) calculateTopologyStats(nodes []TopologyNode, relationships []TopologyRelationship) TopologyStats {
	modelCounts := make(map[string]int)
	typeCounts := make(map[string]int)

	for _, node := range nodes {
		modelCounts[node.ModelName]++
	}

	for _, rel := range relationships {
		typeCounts[rel.RelationshipType]++
	}

	return TopologyStats{
		NodeCount:         len(nodes),
		RelationshipCount: len(relationships),
		ModelCounts:       modelCounts,
		TypeCounts:        typeCounts,
	}
}

// calculateRelationshipFacets calculates facets for relationship search results
func (s *Service) calculateRelationshipFacets(relationships []*RelationshipSummary) *RelationshipFacets {
	typeCounts := make(map[string]int64)
	sourceModelCounts := make(map[string]int64)
	targetModelCounts := make(map[string]int64)

	for _, rel := range relationships {
		typeCounts[rel.Type]++
		sourceModelCounts[rel.SourceModelName]++
		targetModelCounts[rel.TargetModelName]++
	}

	return &RelationshipFacets{
		TypeCounts:        typeCounts,
		SourceModelCounts: sourceModelCounts,
		TargetModelCounts: targetModelCounts,
	}
}

// Repository provides data access for relationship operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new relationship repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// Model relationship operations
func (r *Repository) CreateRelationship(ctx context.Context, relationship *types.Relationship) error {
	return r.db.WithContext(ctx).Create(relationship).Error
}

func (r *Repository) GetRelationshipByID(ctx context.Context, tenantID, id string) (*types.Relationship, error) {
	var relationship types.Relationship
	err := r.db.WithContext(ctx).
		Preload("SourceModel").
		Preload("TargetModel").
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&relationship).Error
	if err != nil {
		return nil, err
	}
	return &relationship, nil
}

func (r *Repository) UpdateRelationship(ctx context.Context, relationship *types.Relationship) error {
	return r.db.WithContext(ctx).Save(relationship).Error
}

func (r *Repository) DeleteRelationship(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.Relationship{}, "id = ?", id).Error
}

func (r *Repository) ListRelationships(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Relationship, *types.Pagination, error) {
	var relationships []*types.Relationship
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &relationships, options)
	if err != nil {
		return nil, nil, err
	}
	return relationships, pagination, nil
}

func (r *Repository) RelationshipExists(ctx context.Context, tenantID, sourceModelID, targetModelID, name string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Relationship{}).
		Where("tenant_id = ? AND source_model_id = ? AND target_model_id = ? AND name = ? AND deleted_at IS NULL", 
			tenantID, sourceModelID, targetModelID, name).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) RelationshipHasInstances(ctx context.Context, relationshipID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.InstanceRelationship{}).
		Where("relationship_id = ? AND deleted_at IS NULL", relationshipID).
		Count(&count).Error
	return count > 0, err
}

// Instance relationship operations
func (r *Repository) CreateInstanceRelationship(ctx context.Context, instanceRelationship *types.InstanceRelationship) error {
	return r.db.WithContext(ctx).Create(instanceRelationship).Error
}

func (r *Repository) GetInstanceRelationshipByID(ctx context.Context, tenantID, id string) (*types.InstanceRelationship, error) {
	var instanceRelationship types.InstanceRelationship
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&instanceRelationship).Error
	if err != nil {
		return nil, err
	}
	return &instanceRelationship, nil
}

func (r *Repository) DeleteInstanceRelationship(ctx context.Context, id string) error {
	return r.db.WithContext(ctx).Delete(&types.InstanceRelationship{}, "id = ?", id).Error
}

func (r *Repository) InstanceRelationshipExists(ctx context.Context, sourceInstanceID, targetInstanceID, relationshipID string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.InstanceRelationship{}).
		Where("source_instance_id = ? AND target_instance_id = ? AND relationship_id = ? AND deleted_at IS NULL", 
			sourceInstanceID, targetInstanceID, relationshipID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) GetInstanceRelationshipCount(ctx context.Context, instanceID, relationshipID, direction string) (int64, error) {
	var count int64
	query := r.db.WithContext(ctx).Model(&types.InstanceRelationship{}).
		Where("relationship_id = ? AND deleted_at IS NULL", relationshipID)
	
	if direction == "source" {
		query = query.Where("source_instance_id = ?", instanceID)
	} else {
		query = query.Where("target_instance_id = ?", instanceID)
	}
	
	err := query.Count(&count).Error
	return count, err
}

// Helper methods for validation
func (r *Repository) GetModelByID(ctx context.Context, tenantID, id string) (*types.Model, error) {
	var model types.Model
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&model).Error
	if err != nil {
		return nil, err
	}
	return &model, nil
}

func (r *Repository) GetInstanceByID(ctx context.Context, tenantID, id string) (*types.Instance, error) {
	var instance types.Instance
	err := r.db.WithContext(ctx).
		Where("id = ? AND tenant_id = ? AND deleted_at IS NULL", id, tenantID).
		First(&instance).Error
	if err != nil {
		return nil, err
	}
	return &instance, nil
}

func (r *Repository) GetInstancesByModel(ctx context.Context, tenantID, modelID string) ([]*types.Instance, error) {
	var instances []*types.Instance
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND model_id = ? AND deleted_at IS NULL", tenantID, modelID).
		Find(&instances).Error
	return instances, err
}

func (r *Repository) GetRelatedInstances(ctx context.Context, tenantID, instanceID, direction string, relationshipTypes []types.RelationshipType) ([]string, []*types.InstanceRelationship, error) {
	var instanceRelationships []*types.InstanceRelationship
	query := r.db.WithContext(ctx).
		Where("tenant_id = ? AND deleted_at IS NULL", tenantID)

	// Add direction filter
	switch direction {
	case "inbound":
		query = query.Where("target_instance_id = ?", instanceID)
	case "outbound":
		query = query.Where("source_instance_id = ?", instanceID)
	case "both":
		query = query.Where("source_instance_id = ? OR target_instance_id = ?", instanceID, instanceID)
	}

	// Add relationship type filter
	if len(relationshipTypes) > 0 {
		query = query.Joins("JOIN relationships ON instance_relationships.relationship_id = relationships.id").
			Where("relationships.type IN ?", relationshipTypes)
	}

	err := query.Find(&instanceRelationships).Error
	if err != nil {
		return nil, nil, err
	}

	var relatedInstanceIDs []string
	for _, rel := range instanceRelationships {
		if rel.SourceInstanceID.String() == instanceID {
			relatedInstanceIDs = append(relatedInstanceIDs, rel.TargetInstanceID.String())
		} else {
			relatedInstanceIDs = append(relatedInstanceIDs, rel.SourceInstanceID.String())
		}
	}

	return relatedInstanceIDs, instanceRelationships, nil
}

func (r *Repository) SearchRelationships(ctx context.Context, tenantID string, req *RelationshipSearchRequest) ([]*RelationshipSummary, *types.Pagination, error) {
	// This is a placeholder implementation
	// In a real implementation, you would build a complex query based on the search criteria
	var summaries []*RelationshipSummary
	
	// For now, return empty results with proper pagination structure
	pagination := &types.Pagination{
		Page:     1,
		PageSize: 20,
		Total:    0,
	}
	
	return summaries, pagination, nil
}