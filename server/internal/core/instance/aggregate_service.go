package instance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/gorm"
)

var ErrInvalidInstanceKey = errors.New("invalid instance key")

type AggregateService struct {
	db           *gorm.DB
	dynamicModel *dynamic_model.Service
}

func NewAggregateService(db *gorm.DB, dynamicModelService *dynamic_model.Service) *AggregateService {
	if dynamicModelService == nil && db != nil {
		dynamicModelService = dynamic_model.NewService(db)
	}
	return &AggregateService{
		db:           db,
		dynamicModel: dynamicModelService,
	}
}

func (s *AggregateService) GetAggregateInstance(ctx context.Context, instanceKey string) (*types.AggregateInstanceView, error) {
	modelUID, resourceID, err := parseAggregateInstanceKey(instanceKey)
	if err != nil {
		return nil, err
	}

	detail, err := s.dynamicModel.GetInstanceView(ctx, modelUID, resourceID)
	if err != nil {
		return nil, err
	}

	relations, err := s.dynamicModel.ListInstanceRelations(ctx, modelUID, resourceID, "both", "")
	if err != nil {
		return nil, err
	}

	historyItems, historyTotal, err := s.dynamicModel.GetResourceHistoryView(ctx, modelUID, resourceID, 1, 10)
	if err != nil {
		return nil, err
	}

	return &types.AggregateInstanceView{
		InstanceKey: instanceKey,
		Model: types.AggregateInstanceModelSummary{
			ModelUID:    detail.ModelUID,
			DisplayName: detail.Name,
		},
		Properties: detail.Configs,
		BindingContext: map[string]any{
			"instance_key":   instanceKey,
			"model_uid":      modelUID,
			"resource_id":    resourceID,
			"topology_bound": false,
		},
		RelationSummary: map[string]any{
			"total": relationsCount(relations),
			"items": relations,
		},
		HistorySummary: map[string]any{
			"total": historyTotal,
			"items": historyItems,
		},
		AllowedActions: allowedActionsForAggregateInstance(modelUID),
	}, nil
}

func (s *AggregateService) ListAggregateInstances(ctx context.Context, modelUID string, page, pageSize int) ([]types.AggregateInstanceView, int64, error) {
	resources, total, err := s.dynamicModel.ListInstances(ctx, modelUID, map[string]interface{}{}, page, pageSize)
	if err != nil {
		return nil, 0, err
	}

	items := make([]types.AggregateInstanceView, 0, len(resources))
	for _, resource := range resources {
		items = append(items, types.AggregateInstanceView{
			InstanceKey: fmt.Sprintf("%s:%d", resource.ModelUID, resource.ID),
			Model: types.AggregateInstanceModelSummary{
				ModelUID:    resource.ModelUID,
				DisplayName: resource.Name,
			},
			Properties:     decodeInstanceConfigs(resource.Configs),
			BindingContext: map[string]any{"topology_bound": false},
			AllowedActions: allowedActionsForAggregateInstance(resource.ModelUID),
		})
	}

	return items, total, nil
}

func parseAggregateInstanceKey(instanceKey string) (string, uint64, error) {
	parts := strings.SplitN(strings.TrimSpace(instanceKey), ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", 0, ErrInvalidInstanceKey
	}

	resourceID, err := strconv.ParseUint(parts[1], 10, 64)
	if err != nil {
		return "", 0, ErrInvalidInstanceKey
	}

	return parts[0], resourceID, nil
}

func allowedActionsForAggregateInstance(modelUID string) []string {
	actions := []string{"view_relations", "view_history"}
	if modelUID == "host" {
		actions = append(actions, "bind_topology", "unbind_topology")
	}
	return actions
}

func relationsCount(items []types.InstanceRelationView) int {
	return len(items)
}

func decodeInstanceConfigs(raw []byte) map[string]any {
	if len(raw) == 0 {
		return nil
	}

	var decoded map[string]any
	if err := json.Unmarshal(raw, &decoded); err != nil {
		return nil
	}
	return decoded
}
