package dynamic_model

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/types"
)

var ErrInvalidRelationInstanceKey = fmt.Errorf("invalid relation instance key")

type RelationAggregateService struct {
	db      *gorm.DB
	dynamic *service
}

func NewRelationAggregateService(db *gorm.DB, dynamicService Service) *RelationAggregateService {
	svc, _ := dynamicService.(*service)
	if svc == nil && db != nil {
		svc = NewService(db).(*service)
	}

	return &RelationAggregateService{
		db:      db,
		dynamic: svc,
	}
}

func (s *RelationAggregateService) GetModelRelationCapabilities(ctx context.Context, modelUID string) (*types.AggregateRelationCapabilities, error) {
	modelUID = strings.TrimSpace(modelUID)
	if _, err := s.dynamic.GetModel(ctx, modelUID); err != nil {
		return nil, err
	}

	associations, err := s.dynamic.ListModelAssociations(ctx, modelUID)
	if err != nil {
		return nil, err
	}

	candidateTargets := make([]map[string]any, 0, len(associations))
	for _, assoc := range associations {
		targetName := assoc.TargetModelUID
		if targetModel, lookupErr := s.dynamic.GetModel(ctx, assoc.TargetModelUID); lookupErr == nil && targetModel != nil {
			targetName = targetModel.Name
		}

		candidateTargets = append(candidateTargets, map[string]any{
			"target_model_uid":  assoc.TargetModelUID,
			"target_model_name": targetName,
			"association_uid":   assoc.AssociationUID,
			"mapping":           assoc.Mapping,
			"on_delete":         assoc.OnDelete,
		})
	}

	return &types.AggregateRelationCapabilities{
		ModelUID:         modelUID,
		AllowedActions:   []string{"create_relation", "delete_relation", "validate_relation"},
		Constraints:      relationConstraints(associations),
		CandidateTargets: candidateTargets,
		ConflictDetails:  []map[string]any{},
		ImpactSummary: map[string]any{
			"association_count":      len(associations),
			"candidate_target_count": len(candidateTargets),
		},
	}, nil
}

func (s *RelationAggregateService) GetInstanceRelationCapabilities(ctx context.Context, modelUID string, resourceID uint64) (*types.AggregateRelationCapabilities, error) {
	resource, err := s.dynamic.getResourceByModel(ctx, strings.TrimSpace(modelUID), resourceID, false)
	if err != nil {
		return nil, err
	}

	associations, err := s.dynamic.ListModelAssociations(ctx, resource.ModelUID)
	if err != nil {
		return nil, err
	}

	candidateTargets := make([]map[string]any, 0)
	conflictDetails := make([]map[string]any, 0)

	for _, assoc := range associations {
		sourceRelationCount, err := s.countRelations(ctx, "source_id = ? AND association_uid = ?", resource.ID, assoc.AssociationUID)
		if err != nil {
			return nil, err
		}

		if (assoc.Mapping == "1:1" || assoc.Mapping == "1:N") && sourceRelationCount > 0 {
			conflictDetails = append(conflictDetails, map[string]any{
				"association_uid": assoc.AssociationUID,
				"mapping":         assoc.Mapping,
				"reason":          "source_cardinality_reached",
				"current_count":   sourceRelationCount,
			})
		}

		targets, err := s.listCandidateResources(ctx, assoc.TargetModelUID, resource.ID)
		if err != nil {
			return nil, err
		}

		for _, target := range targets {
			item := map[string]any{
				"resource_id":      target.ID,
				"name":             target.Name,
				"model_uid":        target.ModelUID,
				"association_uid":  assoc.AssociationUID,
				"mapping":          assoc.Mapping,
				"on_delete":        assoc.OnDelete,
				"existing_source":  sourceRelationCount,
				"relation_allowed": true,
			}

			if assoc.Mapping == "1:1" {
				targetRelationCount, countErr := s.countRelations(ctx, "target_id = ? AND association_uid = ?", target.ID, assoc.AssociationUID)
				if countErr != nil {
					return nil, countErr
				}
				item["existing_target"] = targetRelationCount
				if targetRelationCount > 0 || sourceRelationCount > 0 {
					item["relation_allowed"] = false
				}
			}

			candidateTargets = append(candidateTargets, item)
		}
	}

	currentRelations, err := s.countRelations(ctx, "source_id = ? OR target_id = ?", resource.ID, resource.ID)
	if err != nil {
		return nil, err
	}

	return &types.AggregateRelationCapabilities{
		ModelUID:         resource.ModelUID,
		InstanceKey:      formatRelationInstanceKey(resource.ModelUID, resource.ID),
		AllowedActions:   []string{"create_relation", "delete_relation"},
		Constraints:      relationConstraints(associations),
		CandidateTargets: candidateTargets,
		ConflictDetails:  conflictDetails,
		ImpactSummary: map[string]any{
			"existing_relation_count": currentRelations,
			"association_count":       len(associations),
			"candidate_target_count":  len(candidateTargets),
		},
	}, nil
}

func (s *RelationAggregateService) GetInstanceRelationCapabilitiesByKey(ctx context.Context, instanceKey string) (*types.AggregateRelationCapabilities, error) {
	modelUID, resourceID, err := parseRelationInstanceKey(instanceKey)
	if err != nil {
		return nil, err
	}

	return s.GetInstanceRelationCapabilities(ctx, modelUID, resourceID)
}

func (s *RelationAggregateService) listCandidateResources(ctx context.Context, modelUID string, excludeResourceID uint64) ([]types.Resource, error) {
	var items []types.Resource
	query := s.db.WithContext(ctx).
		Model(&types.Resource{}).
		Where("model_uid = ?", modelUID).
		Where("deleted_at IS NULL")
	if excludeResourceID > 0 {
		query = query.Where("id <> ?", excludeResourceID)
	}

	if err := query.Order("id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *RelationAggregateService) countRelations(ctx context.Context, query string, args ...any) (int64, error) {
	var count int64
	if err := s.db.WithContext(ctx).Model(&types.Relation{}).Where(query, args...).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

func relationConstraints(associations []types.DynamicModelAssociation) map[string]any {
	items := make([]map[string]any, 0, len(associations))
	for _, assoc := range associations {
		items = append(items, map[string]any{
			"target_model_uid": assoc.TargetModelUID,
			"association_uid":  assoc.AssociationUID,
			"mapping":          assoc.Mapping,
			"on_delete":        assoc.OnDelete,
		})
	}

	return map[string]any{
		"associations": items,
	}
}

func parseRelationInstanceKey(raw string) (string, uint64, error) {
	parts := strings.SplitN(strings.TrimSpace(raw), ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", 0, ErrInvalidRelationInstanceKey
	}

	resourceID, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		return "", 0, ErrInvalidRelationInstanceKey
	}

	return parts[0], resourceID, nil
}

func formatRelationInstanceKey(modelUID string, resourceID uint64) string {
	return fmt.Sprintf("%s:%d", modelUID, resourceID)
}
