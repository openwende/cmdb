package topology

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/types"
)

type AggregateService struct {
	db       *gorm.DB
	topology *Service
	mainline *mainline.Service
}

func NewAggregateService(db *gorm.DB, topologySvc *Service, mainlineSvc *mainline.Service) *AggregateService {
	if mainlineSvc == nil {
		mainlineSvc = mainline.NewService(db)
	}
	if topologySvc == nil {
		topologySvc = NewService(db, mainlineSvc)
	}
	return &AggregateService{
		db:       db,
		topology: topologySvc,
		mainline: mainlineSvc,
	}
}

func (s *AggregateService) GetNodeDetail(ctx context.Context, nodeID string) (*types.AggregateTopologyNode, error) {
	nodeType, refID, err := parseAggregateNodeID(nodeID)
	if err != nil {
		return nil, err
	}

	if nodeType == types.NodeTypeBusiness {
		businessID, parseErr := uuid.Parse(refID)
		if parseErr != nil {
			return nil, fmt.Errorf("invalid business node id: %w", parseErr)
		}
		if err := s.mainline.SyncBusinessLegacy(ctx, businessID); err != nil {
			return nil, err
		}
	}

	node, err := s.mainline.GetNodeByRef(ctx, nodeType, refID)
	if err != nil {
		return nil, err
	}

	path, err := s.buildNodePath(ctx, node)
	if err != nil {
		return nil, err
	}

	stats, err := s.topology.GetStatistics(ctx, &node.BusinessID)
	if err != nil {
		return nil, err
	}

	return &types.AggregateTopologyNode{
		NodeID:         normalizeAggregateNodeID(node),
		NodeType:       types.TopologyNodeType(node.ModelName),
		Name:           node.Name,
		ModelUID:       node.ModelName,
		Path:           path,
		Statistics:     stats,
		AllowedActions: allowedActionsForNode(node),
		FormSchemaRef:  fmt.Sprintf("%s:topology", node.ModelName),
		BindingSummary: decodeExtra(node.Extra),
	}, nil
}

func (s *AggregateService) buildNodePath(ctx context.Context, node *types.MainlineInstance) ([]types.AggregateTopologyPathNode, error) {
	lineage := make([]types.AggregateTopologyPathNode, 0, node.Level+1)
	current := node

	for current != nil {
		lineage = append([]types.AggregateTopologyPathNode{{
			NodeID:   normalizeAggregateNodeID(current),
			NodeType: types.TopologyNodeType(current.ModelName),
			Name:     current.Name,
			ModelUID: current.ModelName,
		}}, lineage...)

		if current.ParentID == nil {
			break
		}

		var parent types.MainlineInstance
		if err := s.db.WithContext(ctx).First(&parent, *current.ParentID).Error; err != nil {
			return nil, err
		}
		current = &parent
	}

	return lineage, nil
}

func parseAggregateNodeID(raw string) (types.TopologyNodeType, string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", fmt.Errorf("invalid node id")
	}

	if strings.Contains(raw, "_") {
		parts := strings.SplitN(raw, "_", 2)
		if len(parts) == 2 && parts[0] != "" && parts[1] != "" {
			return types.TopologyNodeType(parts[0]), parts[1], nil
		}
	}

	if idx := strings.Index(raw, "-"); idx > 0 && idx < len(raw)-1 {
		return types.TopologyNodeType(raw[:idx]), raw[idx+1:], nil
	}

	return "", "", fmt.Errorf("invalid node id")
}

func normalizeAggregateNodeID(node *types.MainlineInstance) string {
	return fmt.Sprintf("%s-%s", node.ModelName, node.RefID)
}

func allowedActionsForNode(node *types.MainlineInstance) []string {
	switch node.ModelName {
	case string(types.NodeTypeBusiness):
		return []string{"create_child"}
	case string(types.NodeTypeSet):
		return []string{"create_child", "move", "delete"}
	case string(types.NodeTypeModule):
		return []string{"move", "delete"}
	case string(types.NodeTypeHost):
		return []string{"view"}
	default:
		return []string{"create_child", "move", "delete"}
	}
}
