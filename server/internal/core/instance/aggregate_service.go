package instance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/google/uuid"
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
	modelUID, rawID, err := parseAggregateInstanceKey(instanceKey)
	if err != nil {
		return nil, err
	}

	switch modelUID {
	case "business", "set", "module":
		return s.getMainlineAggregateInstance(ctx, modelUID, rawID)
	case "host":
		return s.getHostAggregateInstance(ctx, rawID)
	default:
		resourceID, err := strconv.ParseUint(rawID, 10, 64)
		if err != nil {
			return nil, ErrInvalidInstanceKey
		}
		return s.getResourceAggregateInstance(ctx, modelUID, resourceID)
	}
}

func (s *AggregateService) getResourceAggregateInstance(ctx context.Context, modelUID string, resourceID uint64) (*types.AggregateInstanceView, error) {
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

	instanceKey := fmt.Sprintf("%s:%d", modelUID, resourceID)

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
	switch modelUID {
	case "business", "set", "module":
		return s.listMainlineAggregateInstances(ctx, modelUID, page, pageSize)
	case "host":
		return s.listHostAggregateInstances(ctx, page, pageSize)
	default:
		return s.listResourceAggregateInstances(ctx, modelUID, page, pageSize)
	}
}

func (s *AggregateService) listResourceAggregateInstances(ctx context.Context, modelUID string, page, pageSize int) ([]types.AggregateInstanceView, int64, error) {
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

func (s *AggregateService) getMainlineAggregateInstance(ctx context.Context, modelUID, refID string) (*types.AggregateInstanceView, error) {
	var node types.MainlineInstance
	if err := s.db.WithContext(ctx).
		Where("model_name = ? AND ref_id = ?", modelUID, strings.TrimSpace(refID)).
		First(&node).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, dynamic_model.NewResourceNotFoundError(0)
		}
		return nil, err
	}

	properties := map[string]any{
		"name": node.Name,
	}
	for key, value := range decodeInstanceConfigs(node.Extra) {
		properties[key] = value
	}

	return &types.AggregateInstanceView{
		InstanceKey: fmt.Sprintf("%s:%s", modelUID, node.RefID),
		Model: types.AggregateInstanceModelSummary{
			ModelUID:    modelUID,
			DisplayName: node.Name,
		},
		Properties: properties,
		BindingContext: map[string]any{
			"source":         "mainline",
			"topology_bound": true,
			"business_id":    node.BusinessID.String(),
			"ref_id":         node.RefID,
			"path":           node.Path,
			"level":          node.Level,
		},
		RelationSummary: map[string]any{"total": 0, "items": []any{}},
		HistorySummary:  map[string]any{"total": 0, "items": []any{}},
		AllowedActions:  allowedActionsForAggregateInstance(modelUID),
	}, nil
}

func (s *AggregateService) getHostAggregateInstance(ctx context.Context, hostID string) (*types.AggregateInstanceView, error) {
	parsedHostID, err := uuid.Parse(strings.TrimSpace(hostID))
	if err != nil {
		return nil, ErrInvalidInstanceKey
	}

	var host types.Host
	if err := s.db.WithContext(ctx).Where("id = ?", parsedHostID).First(&host).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, dynamic_model.NewResourceNotFoundError(0)
		}
		return nil, err
	}

	topologyBound, businessIDs, moduleIDs, err := s.loadHostBindingContext(ctx, parsedHostID)
	if err != nil {
		return nil, err
	}

	return &types.AggregateInstanceView{
		InstanceKey: fmt.Sprintf("host:%s", host.ID.String()),
		Model: types.AggregateInstanceModelSummary{
			ModelUID:    "host",
			DisplayName: host.HostName,
		},
		Properties: map[string]any{
			"name":       host.HostName,
			"primary_ip": host.PrimaryIP,
			"status":     host.Status,
		},
		BindingContext: map[string]any{
			"source":         "host",
			"topology_bound": topologyBound,
			"business_ids":   businessIDs,
			"module_ids":     moduleIDs,
		},
		RelationSummary: map[string]any{"total": 0, "items": []any{}},
		HistorySummary:  map[string]any{"total": 0, "items": []any{}},
		AllowedActions:  allowedActionsForAggregateInstance("host"),
	}, nil
}

func (s *AggregateService) listMainlineAggregateInstances(ctx context.Context, modelUID string, page, pageSize int) ([]types.AggregateInstanceView, int64, error) {
	query := s.db.WithContext(ctx).Model(&types.MainlineInstance{}).Where("model_name = ?", modelUID)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var nodes []types.MainlineInstance
	offset := (page - 1) * pageSize
	if err := query.Order("sort_order ASC, id ASC").Offset(offset).Limit(pageSize).Find(&nodes).Error; err != nil {
		return nil, 0, err
	}

	items := make([]types.AggregateInstanceView, 0, len(nodes))
	for _, node := range nodes {
		properties := map[string]any{
			"name": node.Name,
		}
		for key, value := range decodeInstanceConfigs(node.Extra) {
			properties[key] = value
		}

		items = append(items, types.AggregateInstanceView{
			InstanceKey: fmt.Sprintf("%s:%s", modelUID, node.RefID),
			Model: types.AggregateInstanceModelSummary{
				ModelUID:    modelUID,
				DisplayName: node.Name,
			},
			Properties: properties,
			BindingContext: map[string]any{
				"source":         "mainline",
				"topology_bound": true,
				"business_id":    node.BusinessID.String(),
				"ref_id":         node.RefID,
				"path":           node.Path,
				"level":          node.Level,
			},
			AllowedActions: allowedActionsForAggregateInstance(modelUID),
		})
	}

	return items, total, nil
}

func (s *AggregateService) listHostAggregateInstances(ctx context.Context, page, pageSize int) ([]types.AggregateInstanceView, int64, error) {
	query := s.db.WithContext(ctx).Model(&types.Host{}).Where("deleted_at IS NULL")

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var hosts []types.Host
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC, id DESC").Offset(offset).Limit(pageSize).Find(&hosts).Error; err != nil {
		return nil, 0, err
	}

	items := make([]types.AggregateInstanceView, 0, len(hosts))
	for _, host := range hosts {
		topologyBound, businessIDs, moduleIDs, err := s.loadHostBindingContext(ctx, host.ID)
		if err != nil {
			return nil, 0, err
		}

		items = append(items, types.AggregateInstanceView{
			InstanceKey: fmt.Sprintf("host:%s", host.ID.String()),
			Model: types.AggregateInstanceModelSummary{
				ModelUID:    "host",
				DisplayName: host.HostName,
			},
			Properties: map[string]any{
				"name":       host.HostName,
				"primary_ip": host.PrimaryIP,
				"status":     host.Status,
			},
			BindingContext: map[string]any{
				"source":         "host",
				"topology_bound": topologyBound,
				"business_ids":   businessIDs,
				"module_ids":     moduleIDs,
			},
			AllowedActions: allowedActionsForAggregateInstance("host"),
		})
	}

	return items, total, nil
}

func (s *AggregateService) loadHostBindingContext(ctx context.Context, hostID uuid.UUID) (bool, []string, []uint64, error) {
	type hostBusinessRow struct {
		BusinessID string
	}

	type hostModuleRow struct {
		ModuleID uint64
	}

	var businessRows []hostBusinessRow
	if err := s.db.WithContext(ctx).
		Table("host_business_relations").
		Select("business_id").
		Where("host_id = ?", hostID.String()).
		Find(&businessRows).Error; err != nil {
		return false, nil, nil, err
	}

	var moduleRows []hostModuleRow
	if err := s.db.WithContext(ctx).
		Table("host_module_relations").
		Select("module_id").
		Where("host_id = ?", hostID.String()).
		Find(&moduleRows).Error; err != nil {
		return false, nil, nil, err
	}

	businessIDs := make([]string, 0, len(businessRows))
	for _, row := range businessRows {
		if row.BusinessID != "" {
			businessIDs = append(businessIDs, row.BusinessID)
		}
	}

	moduleIDs := make([]uint64, 0, len(moduleRows))
	for _, row := range moduleRows {
		if row.ModuleID != 0 {
			moduleIDs = append(moduleIDs, row.ModuleID)
		}
	}

	return len(businessIDs) > 0 || len(moduleIDs) > 0, businessIDs, moduleIDs, nil
}

func parseAggregateInstanceKey(instanceKey string) (string, string, error) {
	parts := strings.SplitN(strings.TrimSpace(instanceKey), ":", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", ErrInvalidInstanceKey
	}

	return parts[0], parts[1], nil
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
