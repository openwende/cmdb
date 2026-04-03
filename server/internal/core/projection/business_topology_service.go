package projection

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

const containsRelType = "contains"

type BusinessTopologyService struct {
	db *gorm.DB
}

type graphNode struct {
	resource     types.ResourceV2
	incomingFrom []string
	outgoingTo   []string
}

type hostEntry struct {
	host   types.ResourceV2
	module *types.ResourceV2
	set    *types.ResourceV2
}

func NewBusinessTopologyService(db *gorm.DB) *BusinessTopologyService {
	return &BusinessTopologyService{db: db}
}

func (s *BusinessTopologyService) GetTopologyTree(
	ctx context.Context,
	businessID string,
	includeHosts bool,
	maxDepth int,
	expandNodeID string,
) ([]types.TopologyTreeNode, error) {
	graph, err := s.loadGraph(ctx)
	if err != nil {
		return nil, err
	}

	roots := make([]*graphNode, 0)
	for _, node := range graph {
		if node.resource.TypeName != string(types.NodeTypeBusiness) {
			continue
		}
		if businessID != "" && graphRefID(node.resource) != businessID && node.resource.ID != businessID {
			continue
		}
		roots = append(roots, node)
	}
	sort.Slice(roots, func(i, j int) bool {
		return topologySortKey(roots[i].resource) < topologySortKey(roots[j].resource)
	})

	tree := make([]types.TopologyTreeNode, 0, len(roots))
	for _, root := range roots {
		tree = append(tree, s.buildTreeNode(graph, root, "", includeHosts, defaultMaxDepth(maxDepth), expandNodeID))
	}

	return tree, nil
}

func (s *BusinessTopologyService) GetNodeDetail(ctx context.Context, nodeID string) (*types.AggregateTopologyNode, error) {
	nodeType, refID, wantDefault, err := parseDetailNodeID(nodeID)
	if err != nil {
		return nil, err
	}

	graph, err := s.loadGraph(ctx)
	if err != nil {
		return nil, err
	}

	node, err := findGraphNode(graph, nodeType, refID, wantDefault)
	if err != nil {
		return nil, err
	}

	pathNodes, err := s.buildPath(graph, node)
	if err != nil {
		return nil, err
	}

	stats := s.buildStatistics(graph, node)

	return &types.AggregateTopologyNode{
		NodeID:         nodeID,
		NodeType:       nodeType,
		Name:           resourceDisplayName(node.resource),
		ModelUID:       node.resource.TypeName,
		Path:           pathNodes,
		Statistics:     stats,
		AllowedActions: allowedActions(node.resource.TypeName),
		FormSchemaRef:  fmt.Sprintf("%s:topology", node.resource.TypeName),
		BindingSummary: cloneMap(node.resource.Spec),
	}, nil
}

func (s *BusinessTopologyService) ListNodeHosts(
	ctx context.Context,
	nodeID string,
	page int,
	pageSize int,
	keyword string,
) (*types.AggregateTopologyHostsResponse, error) {
	nodeType, refID, wantDefault, err := parseDetailNodeID(nodeID)
	if err != nil {
		return nil, err
	}

	graph, err := s.loadGraph(ctx)
	if err != nil {
		return nil, err
	}

	node, err := findGraphNode(graph, nodeType, refID, wantDefault)
	if err != nil {
		return nil, err
	}

	entries := filterHostEntries(s.collectHostEntries(graph, node), keyword)

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	total := int64(len(entries))
	start := (page - 1) * pageSize
	if start > len(entries) {
		start = len(entries)
	}
	end := start + pageSize
	if end > len(entries) {
		end = len(entries)
	}

	totalPage := 0
	if total > 0 {
		totalPage = (int(total) + pageSize - 1) / pageSize
	}

	items := make([]types.AggregateTopologyHostItem, 0, end-start)
	for _, entry := range entries[start:end] {
		items = append(items, entry.toResponseItem())
	}

	return &types.AggregateTopologyHostsResponse{
		Items: items,
		Pagination: types.AggregateTopologyPagination{
			Page:      page,
			PageSize:  pageSize,
			Total:     total,
			TotalPage: totalPage,
		},
	}, nil
}

func (s *BusinessTopologyService) loadGraph(ctx context.Context) (map[string]*graphNode, error) {
	var resources []types.ResourceV2
	if err := s.db.WithContext(ctx).
		Where("type_name IN ?", []string{
			string(types.NodeTypeBusiness),
			string(types.NodeTypeSet),
			string(types.NodeTypeModule),
			string(types.NodeTypeHost),
		}).
		Order("created_at ASC, id ASC").
		Find(&resources).Error; err != nil {
		return nil, err
	}

	graph := make(map[string]*graphNode, len(resources))
	for i := range resources {
		resource := resources[i]
		graph[resource.ID] = &graphNode{resource: resource}
	}

	var edges []types.EdgeV2
	if err := s.db.WithContext(ctx).
		Where("rel_type = ?", containsRelType).
		Order("id ASC").
		Find(&edges).Error; err != nil {
		return nil, err
	}

	for _, edge := range edges {
		fromNode, ok := graph[edge.FromID]
		if !ok {
			continue
		}
		toNode, ok := graph[edge.ToID]
		if !ok {
			continue
		}
		fromNode.outgoingTo = append(fromNode.outgoingTo, edge.ToID)
		toNode.incomingFrom = append(toNode.incomingFrom, edge.FromID)
	}

	return graph, nil
}

func (s *BusinessTopologyService) buildTreeNode(
	graph map[string]*graphNode,
	node *graphNode,
	parentNodeID string,
	includeHosts bool,
	maxDepth int,
	expandNodeID string,
) types.TopologyTreeNode {
	apiID := apiTreeNodeID(node.resource)
	children := sortedChildren(graph, node.outgoingTo)
	visibleChildren := filterVisibleChildren(children, includeHosts)

	treeNode := types.TopologyTreeNode{
		ID:         apiID,
		NodeID:     graphNodeRef(node.resource),
		Name:       resourceDisplayName(node.resource),
		NodeType:   types.TopologyNodeType(node.resource.TypeName),
		ParentID:   parentNodeID,
		Icon:       resourceIcon(node.resource.TypeName),
		IsDefault:  resourceIsDefault(node.resource),
		ChildCount: len(visibleChildren),
		Extra:      buildExtra(node.resource),
	}

	if node.resource.TypeName == string(types.NodeTypeModule) && !includeHosts {
		hostCount := countChildrenByType(children, string(types.NodeTypeHost))
		treeNode.ChildCount = len(filterVisibleChildren(children, false)) + hostCount
		treeNode.IsLeaf = true
		treeNode.Expandable = false
	} else {
		treeNode.IsLeaf = len(visibleChildren) == 0
		treeNode.Expandable = len(visibleChildren) > 0
	}

	if shouldExpandNode(node.resource.TypeName, maxDepth, expandNodeID, apiID) {
		treeNode.Children = make([]types.TopologyTreeNode, 0, len(visibleChildren))
		for _, child := range visibleChildren {
			treeNode.Children = append(treeNode.Children, s.buildTreeNode(
				graph,
				child,
				apiID,
				includeHosts,
				maxDepth,
				expandNodeID,
			))
		}
	}

	return treeNode
}

func (s *BusinessTopologyService) buildPath(
	graph map[string]*graphNode,
	node *graphNode,
) ([]types.AggregateTopologyPathNode, error) {
	lineage := make([]types.AggregateTopologyPathNode, 0, 4)
	current := node

	for current != nil {
		lineage = append([]types.AggregateTopologyPathNode{{
			NodeID:   apiDetailNodeID(current.resource),
			NodeType: types.TopologyNodeType(current.resource.TypeName),
			Name:     resourceDisplayName(current.resource),
			ModelUID: current.resource.TypeName,
		}}, lineage...)

		if len(current.incomingFrom) == 0 {
			break
		}

		parent := graph[current.incomingFrom[0]]
		if parent == nil {
			return nil, gorm.ErrRecordNotFound
		}
		current = parent
	}

	return lineage, nil
}

func (s *BusinessTopologyService) buildStatistics(graph map[string]*graphNode, node *graphNode) *types.TopologyStatistics {
	root := node
	for len(root.incomingFrom) > 0 {
		parent := graph[root.incomingFrom[0]]
		if parent == nil {
			break
		}
		root = parent
	}

	stats := &types.TopologyStatistics{
		ByEnvType:     map[string]int{},
		ByServiceType: map[string]int{},
	}

	visited := map[string]bool{}
	var walk func(current *graphNode)
	walk = func(current *graphNode) {
		if current == nil || visited[current.resource.ID] {
			return
		}
		visited[current.resource.ID] = true

		switch current.resource.TypeName {
		case string(types.NodeTypeBusiness):
			stats.BusinessCount++
		case string(types.NodeTypeSet):
			stats.SetCount++
			if env, _ := current.resource.Spec["env_type"].(string); strings.TrimSpace(env) != "" {
				stats.ByEnvType[env]++
			}
		case string(types.NodeTypeModule):
			stats.ModuleCount++
			if serviceType, _ := current.resource.Spec["service_type"].(string); strings.TrimSpace(serviceType) != "" {
				stats.ByServiceType[serviceType]++
			}
		case string(types.NodeTypeHost):
			stats.HostCount++
		}

		for _, childID := range current.outgoingTo {
			walk(graph[childID])
		}
	}

	walk(root)
	return stats
}

func findGraphNode(graph map[string]*graphNode, nodeType types.TopologyNodeType, refID string, wantDefault bool) (*graphNode, error) {
	for _, node := range graph {
		if node.resource.TypeName != string(nodeType) {
			continue
		}
		if wantDefault && !resourceIsDefault(node.resource) {
			continue
		}
		if graphRefID(node.resource) == refID || node.resource.ID == refID {
			return node, nil
		}
	}

	return nil, gorm.ErrRecordNotFound
}

func parseDetailNodeID(raw string) (types.TopologyNodeType, string, bool, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "", "", false, fmt.Errorf("invalid node id")
	}

	wantDefault := false
	if strings.HasPrefix(raw, "idle_set-") {
		return types.NodeTypeSet, strings.TrimPrefix(raw, "idle_set-"), true, nil
	}
	if strings.HasPrefix(raw, "idle_module-") {
		return types.NodeTypeModule, strings.TrimPrefix(raw, "idle_module-"), true, nil
	}

	parts := strings.SplitN(raw, "-", 2)
	if len(parts) != 2 || strings.TrimSpace(parts[1]) == "" {
		return "", "", false, fmt.Errorf("invalid node id")
	}

	return types.TopologyNodeType(parts[0]), parts[1], wantDefault, nil
}

func apiTreeNodeID(resource types.ResourceV2) string {
	return fmt.Sprintf("%s_%s", resource.TypeName, graphRefID(resource))
}

func apiDetailNodeID(resource types.ResourceV2) string {
	prefix := resource.TypeName
	if resourceIsDefault(resource) {
		switch resource.TypeName {
		case string(types.NodeTypeSet):
			prefix = "idle_set"
		case string(types.NodeTypeModule):
			prefix = "idle_module"
		}
	}
	return fmt.Sprintf("%s-%s", prefix, graphRefID(resource))
}

func graphRefID(resource types.ResourceV2) string {
	if refID, ok := resource.Spec["ref_id"].(string); ok && strings.TrimSpace(refID) != "" {
		return strings.TrimSpace(refID)
	}
	return resource.ID
}

func graphNodeRef(resource types.ResourceV2) interface{} {
	refID := graphRefID(resource)

	switch resource.TypeName {
	case string(types.NodeTypeBusiness), string(types.NodeTypeHost):
		if id, err := uuid.Parse(refID); err == nil {
			return id
		}
		return refID
	case string(types.NodeTypeSet), string(types.NodeTypeModule):
		if n, err := strconv.ParseUint(refID, 10, 64); err == nil {
			return n
		}
	}

	return refID
}

func buildExtra(resource types.ResourceV2) map[string]interface{} {
	extra := cloneMap(resource.Spec)
	delete(extra, "ref_id")
	extra["allowed_actions"] = allowedActions(resource.TypeName)
	extra["created_at"] = resource.CreatedAt.UTC().Format(time.RFC3339)
	extra["updated_at"] = resource.UpdatedAt.UTC().Format(time.RFC3339)

	switch resource.TypeName {
	case string(types.NodeTypeBusiness):
		extra["bk_biz_id"] = graphRefID(resource)
	case string(types.NodeTypeSet):
		extra["bk_set_id"] = uintValue(resource.Spec["ref_id"])
		extra["bk_set_name"] = resourceDisplayName(resource)
		extra["bk_set_desc"] = stringValue(resource.Spec["description"])
		extra["bk_set_env"] = envTypeToLegacyValue(stringValue(resource.Spec["env_type"]))
	case string(types.NodeTypeModule):
		extra["bk_module_id"] = uintValue(resource.Spec["ref_id"])
		extra["bk_module_name"] = resourceDisplayName(resource)
		extra["bk_module_type"] = moduleTypeToLegacyValue(stringValue(resource.Spec["service_type"]))
		if _, ok := extra["host_count"]; !ok {
			extra["host_count"] = 0
		}
	}

	return extra
}

func resourceDisplayName(resource types.ResourceV2) string {
	if strings.TrimSpace(resource.Name) != "" {
		return resource.Name
	}

	if name, ok := resource.Spec["name"].(string); ok && strings.TrimSpace(name) != "" {
		return strings.TrimSpace(name)
	}

	return graphRefID(resource)
}

func resourceIcon(typeName string) string {
	switch typeName {
	case string(types.NodeTypeBusiness):
		return "business"
	case string(types.NodeTypeSet):
		return "cluster"
	case string(types.NodeTypeModule):
		return "module"
	case string(types.NodeTypeHost):
		return "host"
	default:
		return typeName
	}
}

func resourceIsDefault(resource types.ResourceV2) bool {
	if value, ok := resource.Spec["is_default"].(bool); ok {
		return value
	}
	return false
}

func allowedActions(typeName string) []string {
	switch typeName {
	case string(types.NodeTypeBusiness):
		return []string{"create_child"}
	case string(types.NodeTypeSet):
		return []string{"create_child", "move", "delete"}
	case string(types.NodeTypeModule):
		return []string{"move", "delete"}
	case string(types.NodeTypeHost):
		return []string{"view"}
	default:
		return []string{"view"}
	}
}

func shouldExpandNode(typeName string, maxDepth int, expandNodeID, apiID string) bool {
	if strings.TrimSpace(expandNodeID) != "" && strings.TrimSpace(expandNodeID) == apiID {
		return true
	}
	return nodeDepth(typeName) < maxDepth
}

func nodeDepth(typeName string) int {
	switch typeName {
	case string(types.NodeTypeBusiness):
		return 1
	case string(types.NodeTypeSet):
		return 2
	case string(types.NodeTypeModule):
		return 3
	case string(types.NodeTypeHost):
		return 4
	default:
		return 99
	}
}

func defaultMaxDepth(maxDepth int) int {
	if maxDepth <= 0 {
		return 10
	}
	return maxDepth
}

func sortedChildren(graph map[string]*graphNode, childIDs []string) []*graphNode {
	children := make([]*graphNode, 0, len(childIDs))
	for _, childID := range childIDs {
		child := graph[childID]
		if child != nil {
			children = append(children, child)
		}
	}
	sort.Slice(children, func(i, j int) bool {
		return topologySortKey(children[i].resource) < topologySortKey(children[j].resource)
	})
	return children
}

func (s *BusinessTopologyService) collectHostEntries(graph map[string]*graphNode, anchor *graphNode) []hostEntry {
	visited := map[string]bool{}
	entries := make([]hostEntry, 0)

	var walk func(current *graphNode, currentSet *types.ResourceV2, currentModule *types.ResourceV2)
	walk = func(current *graphNode, currentSet *types.ResourceV2, currentModule *types.ResourceV2) {
		if current == nil || visited[current.resource.ID] {
			return
		}
		visited[current.resource.ID] = true

		switch current.resource.TypeName {
		case string(types.NodeTypeSet):
			currentSet = &current.resource
		case string(types.NodeTypeModule):
			currentModule = &current.resource
		case string(types.NodeTypeHost):
			entries = append(entries, hostEntry{
				host:   current.resource,
				module: currentModule,
				set:    currentSet,
			})
			return
		}

		for _, childID := range current.outgoingTo {
			walk(graph[childID], currentSet, currentModule)
		}
	}

	walk(anchor, nil, nil)
	sort.Slice(entries, func(i, j int) bool {
		return hostEntrySortKey(entries[i]) < hostEntrySortKey(entries[j])
	})
	return entries
}

func filterHostEntries(entries []hostEntry, keyword string) []hostEntry {
	keyword = strings.TrimSpace(strings.ToLower(keyword))
	if keyword == "" {
		return entries
	}

	filtered := make([]hostEntry, 0, len(entries))
	for _, entry := range entries {
		primaryIP := strings.ToLower(stringValue(entry.host.Spec["primary_ip"]))
		hostname := strings.ToLower(stringValue(entry.host.Spec["hostname"]))
		if strings.Contains(primaryIP, keyword) || strings.Contains(hostname, keyword) {
			filtered = append(filtered, entry)
		}
	}
	return filtered
}

func (e hostEntry) toResponseItem() types.AggregateTopologyHostItem {
	item := types.AggregateTopologyHostItem{
		HostID:    graphRefID(e.host),
		InnerIPv4: stringValue(e.host.Spec["primary_ip"]),
		InnerIPv6: stringValue(e.host.Spec["inner_ipv6"]),
		Status:    stringValue(e.host.Spec["status"]),
	}

	if cloudAreaID := stringValue(e.host.Spec["cloud_area_id"]); cloudAreaID != "" {
		item.CloudArea = &types.AggregateTopologyHostCloudArea{
			ID:   cloudAreaID,
			Name: stringValue(e.host.Spec["cloud_area_name"]),
		}
	}
	if e.module != nil {
		item.Module = &types.AggregateTopologyHostModule{
			ID:   uintValue(e.module.Spec["ref_id"]),
			Name: resourceDisplayName(*e.module),
		}
	}
	if e.set != nil {
		item.Set = &types.AggregateTopologyHostSet{
			ID:   uintValue(e.set.Spec["ref_id"]),
			Name: resourceDisplayName(*e.set),
		}
	}
	return item
}

func hostEntrySortKey(entry hostEntry) string {
	return fmt.Sprintf("%s:%s", stringValue(entry.host.Spec["primary_ip"]), resourceDisplayName(entry.host))
}

func filterVisibleChildren(children []*graphNode, includeHosts bool) []*graphNode {
	visible := make([]*graphNode, 0, len(children))
	for _, child := range children {
		if child.resource.TypeName == string(types.NodeTypeHost) && !includeHosts {
			continue
		}
		visible = append(visible, child)
	}
	return visible
}

func countChildrenByType(children []*graphNode, typeName string) int {
	count := 0
	for _, child := range children {
		if child.resource.TypeName == typeName {
			count++
		}
	}
	return count
}

func topologySortKey(resource types.ResourceV2) string {
	sortOrder := 0
	switch value := resource.Spec["sort_order"].(type) {
	case int:
		sortOrder = value
	case int64:
		sortOrder = int(value)
	case float64:
		sortOrder = int(value)
	}
	return fmt.Sprintf("%08d:%s:%s", sortOrder, resourceDisplayName(resource), graphRefID(resource))
}

func cloneMap(input map[string]any) map[string]any {
	if input == nil {
		return map[string]any{}
	}
	out := make(map[string]any, len(input))
	for key, value := range input {
		out[key] = value
	}
	return out
}

func envTypeToLegacyValue(value string) string {
	switch strings.TrimSpace(value) {
	case "test", "dev":
		return "1"
	case "staging":
		return "2"
	case "prod":
		return "3"
	default:
		return ""
	}
}

func moduleTypeToLegacyValue(value string) string {
	switch strings.TrimSpace(value) {
	case "db", "database":
		return "2"
	default:
		return "1"
	}
}
