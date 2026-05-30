package handlers

import (
	"context"
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/projection"
	"github.com/wend/cmdb-backend/internal/core/topology"
	"github.com/wend/cmdb-backend/internal/types"
)

// TopologyHandler 业务拓扑处理器
type TopologyHandler struct {
	service    topology.Service
	aggregate  *topology.AggregateService
	projection *projection.BusinessTopologyService
	commands   *projection.BusinessTopologyCommandService
}

// NewTopologyHandler 创建处理器
func NewTopologyHandler(
	service topology.Service,
	aggregate *topology.AggregateService,
	projectionSvc *projection.BusinessTopologyService,
	commandSvc *projection.BusinessTopologyCommandService,
) *TopologyHandler {
	return &TopologyHandler{
		service:    service,
		aggregate:  aggregate,
		projection: projectionSvc,
		commands:   commandSvc,
	}
}

// ========== 拓扑树 API ==========

// GetTopologyTree 获取拓扑树
// GET /api/v1/topology/tree
func (h *TopologyHandler) GetTopologyTree(c *gin.Context) {
	var req types.GetTopologyTreeRequest

	// 解析参数
	if bizIDStr := c.Query("business_id"); bizIDStr != "" {
		bizID, err := strconv.ParseUint(bizIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的业务ID"})
			return
		}
		req.BusinessID = &bizID
	}

	req.IncludeHosts = c.Query("include_hosts") == "true"
	req.MaxDepth, _ = strconv.Atoi(c.DefaultQuery("max_depth", "3"))
	req.ExpandNodeID = c.Query("expand_node_id")

	var businessRef string
	if req.BusinessID != nil {
		businessRef = strconv.FormatUint(*req.BusinessID, 10)
	}

	if h.projection != nil {
		tree, err := h.projection.GetTopologyTree(
			c.Request.Context(),
			businessRef,
			req.IncludeHosts,
			req.MaxDepth,
			req.ExpandNodeID,
		)
		switch {
		case err == nil && len(tree) > 0:
			if projectionTreeNeedsLegacyDefault(tree) {
				if legacyTree, legacyErr := h.service.GetTopologyTree(c.Request.Context(), &req); legacyErr == nil {
					tree = mergeLegacyDefaultTopology(tree, legacyTree)
				}
			}
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": tree})
			return
		case err != nil && !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	tree, err := h.service.GetTopologyTree(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": tree,
	})
}

// GetNodeChildren 获取节点子节点（懒加载）
// GET /api/v1/topology/node-children/:type/:id
func (h *TopologyHandler) GetNodeChildren(c *gin.Context) {
	nodeType := types.TopologyNodeType(c.Param("type"))
	idStr := c.Param("id")

	var nodeID interface{}
	var err error

	switch nodeType {
	case types.NodeTypeBusiness:
		nodeID, err = strconv.ParseUint(idStr, 10, 64)
	case types.NodeTypeSet, types.NodeTypeModule:
		nodeID, err = strconv.ParseUint(idStr, 10, 64)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点类型"})
		return
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点ID"})
		return
	}

	children, err := h.service.GetNodeChildren(c.Request.Context(), nodeType, nodeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": children,
	})
}

// GetNodeDetail 获取聚合节点详情
// GET /api/v1/topology/nodes/:id
func (h *TopologyHandler) GetNodeDetail(c *gin.Context) {
	if h.projection != nil {
		detail, err := h.projection.GetNodeDetail(c.Request.Context(), c.Param("id"))
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": detail})
			return
		case err != nil && !shouldFallbackProjection(err):
			switch {
			case errors.Is(err, gorm.ErrRecordNotFound):
				c.JSON(http.StatusNotFound, gin.H{"error": "节点不存在"})
			case err.Error() == "invalid node id":
				c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点ID"})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			}
			return
		}
	}

	detail, err := h.aggregate.GetNodeDetail(c.Request.Context(), c.Param("id"))
	if err != nil {
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "节点不存在"})
		case err.Error() == "invalid node id":
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点ID"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": detail,
	})
}

func shouldFallbackProjection(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return true
	}

	message := strings.ToLower(err.Error())
	return strings.Contains(message, "no such table") ||
		strings.Contains(message, "does not exist") ||
		strings.Contains(message, "record not found") ||
		strings.Contains(message, "目标模块不存在")
}

func projectionTreeNeedsLegacyDefault(tree []types.TopologyTreeNode) bool {
	for _, root := range tree {
		if root.NodeType != types.NodeTypeBusiness {
			continue
		}
		if !containsDefaultSetNode(root.Children) {
			return true
		}
	}
	return false
}

func containsDefaultSetNode(children []types.TopologyTreeNode) bool {
	for _, child := range children {
		if child.NodeType == types.NodeTypeSet && child.IsDefault {
			return true
		}
	}
	return false
}

func mergeLegacyDefaultTopology(
	projected []types.TopologyTreeNode,
	legacy []types.TopologyTreeNode,
) []types.TopologyTreeNode {
	if len(projected) == 0 || len(legacy) == 0 {
		return projected
	}

	legacyDefaultsByBusiness := make(map[string][]types.TopologyTreeNode, len(legacy))
	for _, root := range legacy {
		if root.NodeType != types.NodeTypeBusiness {
			continue
		}
		defaults := make([]types.TopologyTreeNode, 0, 1)
		for _, child := range root.Children {
			if child.NodeType == types.NodeTypeSet && child.IsDefault {
				defaults = append(defaults, child)
			}
		}
		if len(defaults) > 0 {
			legacyDefaultsByBusiness[topologyTreeNodeRef(root)] = defaults
		}
	}

	merged := append([]types.TopologyTreeNode(nil), projected...)
	for index := range merged {
		root := &merged[index]
		if root.NodeType != types.NodeTypeBusiness || containsDefaultSetNode(root.Children) {
			continue
		}

		legacyDefaults := legacyDefaultsByBusiness[topologyTreeNodeRef(*root)]
		if len(legacyDefaults) == 0 {
			continue
		}

		existingChildren := make(map[string]struct{}, len(root.Children))
		for _, child := range root.Children {
			existingChildren[topologyTreeNodeIdentity(child)] = struct{}{}
		}

		injected := make([]types.TopologyTreeNode, 0, len(legacyDefaults))
		for _, child := range legacyDefaults {
			if _, exists := existingChildren[topologyTreeNodeIdentity(child)]; exists {
				continue
			}
			injected = append(injected, child)
		}
		if len(injected) == 0 {
			continue
		}

		root.Children = append(injected, root.Children...)
		root.ChildCount = len(root.Children)
		root.IsLeaf = false
		root.Expandable = true
	}

	return merged
}

func topologyTreeNodeRef(node types.TopologyTreeNode) string {
	switch value := node.NodeID.(type) {
	case string:
		return strings.TrimSpace(value)
	case fmt.Stringer:
		return strings.TrimSpace(value.String())
	default:
		return strings.TrimSpace(fmt.Sprint(value))
	}
}

func topologyTreeNodeIdentity(node types.TopologyTreeNode) string {
	return string(node.NodeType) + ":" + topologyTreeNodeRef(node)
}

func shouldFallbackProjectionBatch(result *types.BatchOperationResult) bool {
	if result == nil || result.Successful > 0 || len(result.Errors) == 0 {
		return false
	}

	for _, item := range result.Errors {
		message := strings.ToLower(item)
		if strings.Contains(message, "record not found") ||
			strings.Contains(message, "does not exist") ||
			strings.Contains(message, "无法确定主机所属业务") {
			return true
		}
	}
	return false
}

func (h *TopologyHandler) hasProjectionTopology(ctx context.Context) bool {
	if h.service == nil {
		return false
	}
	return h.service.HasProjectionTopology(ctx)
}

// GetNodeHosts 获取聚合节点下的主机列表
// GET /api/v1/topology/nodes/:id/hosts
func (h *TopologyHandler) GetNodeHosts(c *gin.Context) {
	nodeType, refID, err := parseTopologyHostNodeID(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的节点ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	keyword := strings.TrimSpace(c.Query("keyword"))

	if h.projection != nil {
		result, err := h.projection.ListNodeHosts(c.Request.Context(), c.Param("id"), page, pageSize, keyword)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	rows, total, err := h.service.GetNodeHosts(c.Request.Context(), nodeType, refID, keyword, page, pageSize)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	totalPage := 0
	if total > 0 {
		totalPage = int(math.Ceil(float64(total) / float64(pageSize)))
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": types.AggregateTopologyHostsResponse{
			Items: collapseTopologyHostRows(rows),
			Pagination: types.AggregateTopologyPagination{
				Page:      page,
				PageSize:  pageSize,
				Total:     total,
				TotalPage: totalPage,
			},
		},
	})
}

// GetStatistics 获取拓扑统计信息
// GET /api/v1/topology/statistics
func (h *TopologyHandler) GetStatistics(c *gin.Context) {
	var businessID *uint64

	if bizIDStr := c.Query("business_id"); bizIDStr != "" {
		bizID, err := strconv.ParseUint(bizIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的业务ID"})
			return
		}
		businessID = &bizID
	}

	stats, err := h.service.GetStatistics(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": stats,
	})
}

// ========== 集群（Set）API ==========

// CreateSet 创建集群
// POST /api/v1/topology/sets
func (h *TopologyHandler) CreateSet(c *gin.Context) {
	var req types.CreateSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil {
		set, err := h.commands.CreateSet(c.Request.Context(), &req)
		switch {
		case err == nil:
			c.JSON(http.StatusCreated, gin.H{"code": 0, "data": set})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	set, err := h.service.CreateSet(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": set,
	})
}

// GetSet 获取集群详情
// GET /api/v1/topology/sets/:id
func (h *TopologyHandler) GetSet(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的集群ID"})
		return
	}

	if h.commands != nil {
		set, err := h.commands.GetSet(c.Request.Context(), id)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": set})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusNotFound, gin.H{"error": "集群不存在"})
			return
		}
	}

	set, err := h.service.GetSet(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "集群不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": set,
	})
}

// ListSets 获取业务下的集群列表
// GET /api/v1/topology/sets?business_id=xxx
func (h *TopologyHandler) ListSets(c *gin.Context) {
	businessIDStr := c.Query("business_id")
	if businessIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "缺少 business_id 参数"})
		return
	}

	businessID, err := strconv.ParseUint(businessIDStr, 10, 64)
	if err != nil || businessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的业务ID"})
		return
	}

	if h.commands != nil {
		sets, err := h.commands.ListSets(c.Request.Context(), businessID)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": sets})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	sets, err := h.service.ListSets(c.Request.Context(), businessID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": sets,
	})
}

// UpdateSet 更新集群
// PUT /api/v1/topology/sets/:id
func (h *TopologyHandler) UpdateSet(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的集群ID"})
		return
	}

	var req types.UpdateSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil {
		set, err := h.commands.UpdateSet(c.Request.Context(), id, &req)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": set})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	set, err := h.service.UpdateSet(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": set,
	})
}

// DeleteSet 删除集群
// DELETE /api/v1/topology/sets/:id
func (h *TopologyHandler) DeleteSet(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的集群ID"})
		return
	}

	if h.commands != nil {
		if err := h.commands.DeleteSet(c.Request.Context(), id); err == nil {
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
			return
		} else if !shouldFallbackProjection(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.service.DeleteSet(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "删除成功"},
	})
}

// MoveSet 移动集群到另一个业务
// POST /api/v1/topology/sets/:id/move
func (h *TopologyHandler) MoveSet(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的集群ID"})
		return
	}

	var req struct {
		TargetBusinessID uint64 `json:"target_business_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil {
		if err := h.commands.MoveSet(c.Request.Context(), id, req.TargetBusinessID); err == nil {
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "移动成功"}})
			return
		} else if !shouldFallbackProjection(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.service.MoveSet(c.Request.Context(), id, req.TargetBusinessID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "移动成功"},
	})
}

// ========== 模块（Module）API ==========

// CreateModule 创建模块
// POST /api/v1/topology/modules
func (h *TopologyHandler) CreateModule(c *gin.Context) {
	var req types.CreateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil {
		module, err := h.commands.CreateModule(c.Request.Context(), &req)
		switch {
		case err == nil:
			c.JSON(http.StatusCreated, gin.H{"code": 0, "data": module})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	module, err := h.service.CreateModule(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": module,
	})
}

// GetModule 获取模块详情
// GET /api/v1/topology/modules/:id
func (h *TopologyHandler) GetModule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模块ID"})
		return
	}

	if h.commands != nil {
		module, err := h.commands.GetModule(c.Request.Context(), id)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": module})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusNotFound, gin.H{"error": "模块不存在"})
			return
		}
	}

	module, err := h.service.GetModule(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "模块不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": module,
	})
}

// ListModules 获取集群下的模块列表
// GET /api/v1/topology/modules?set_id=xxx
func (h *TopologyHandler) ListModules(c *gin.Context) {
	setIDStr := c.Query("set_id")
	businessIDStr := c.Query("business_id")

	if setIDStr != "" {
		setID, err := strconv.ParseUint(setIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的集群ID"})
			return
		}

		if h.commands != nil {
			modules, err := h.commands.ListModules(c.Request.Context(), setID)
			switch {
			case err == nil:
				c.JSON(http.StatusOK, gin.H{"code": 0, "data": modules})
				return
			case !shouldFallbackProjection(err):
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		modules, err := h.service.ListModules(c.Request.Context(), setID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"code": 0,
			"data": modules,
		})
		return
	}

	if businessIDStr != "" {
		businessID, err := strconv.ParseUint(businessIDStr, 10, 64)
		if err != nil || businessID == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "无效的业务ID"})
			return
		}

		if h.commands != nil {
			modules, err := h.commands.ListModulesByBusiness(c.Request.Context(), businessID)
			switch {
			case err == nil:
				c.JSON(http.StatusOK, gin.H{"code": 0, "data": modules})
				return
			case !shouldFallbackProjection(err):
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
		}

		modules, err := h.service.ListModulesByBusiness(c.Request.Context(), businessID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"code": 0,
			"data": modules,
		})
		return
	}

	c.JSON(http.StatusBadRequest, gin.H{"error": "需要提供 set_id 或 business_id 参数"})
}

// UpdateModule 更新模块
// PUT /api/v1/topology/modules/:id
func (h *TopologyHandler) UpdateModule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模块ID"})
		return
	}

	var req types.UpdateModuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil {
		module, err := h.commands.UpdateModule(c.Request.Context(), id, &req)
		switch {
		case err == nil:
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": module})
			return
		case !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	module, err := h.service.UpdateModule(c.Request.Context(), id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": module,
	})
}

// DeleteModule 删除模块
// DELETE /api/v1/topology/modules/:id
func (h *TopologyHandler) DeleteModule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模块ID"})
		return
	}

	if h.commands != nil {
		if err := h.commands.DeleteModule(c.Request.Context(), id); err == nil {
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
			return
		} else if !shouldFallbackProjection(err) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.service.DeleteModule(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "删除成功"},
	})
}

// MoveModule 移动模块到另一个集群
// POST /api/v1/topology/modules/:id/move
func (h *TopologyHandler) MoveModule(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模块ID"})
		return
	}

	var req struct {
		TargetSetID uint64 `json:"target_set_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil {
		if err := h.commands.MoveModule(c.Request.Context(), id, req.TargetSetID); err == nil {
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "移动成功"}})
			return
		} else if !shouldFallbackProjection(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.service.MoveModule(c.Request.Context(), id, req.TargetSetID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "移动成功"},
	})
}

// ========== 主机转移 API ==========

// TransferHosts 转移主机到目标模块
// POST /api/v1/topology/hosts/transfer
func (h *TopologyHandler) TransferHosts(c *gin.Context) {
	var req types.TransferHostsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil && h.hasProjectionTopology(c.Request.Context()) {
		result, err := h.commands.TransferHosts(c.Request.Context(), &req)
		switch {
		case err == nil && !shouldFallbackProjectionBatch(result):
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
			return
		case err != nil && !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	result, err := h.service.TransferHosts(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": result,
	})
}

// TransferHostsToPool 将主机转移到资源池
// POST /api/v1/topology/hosts/transfer-to-pool
func (h *TopologyHandler) TransferHostsToPool(c *gin.Context) {
	var req struct {
		HostIDs []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if h.commands != nil && h.hasProjectionTopology(c.Request.Context()) {
		result, err := h.commands.TransferHostsToPool(c.Request.Context(), req.HostIDs)
		switch {
		case err == nil && !shouldFallbackProjectionBatch(result):
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": result})
			return
		case err != nil && !shouldFallbackProjection(err):
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	result, err := h.service.TransferHostsToPool(c.Request.Context(), req.HostIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": result,
	})
}

// GetModuleHosts 获取模块下的主机列表
// GET /api/v1/topology/modules/:id/hosts
func (h *TopologyHandler) GetModuleHosts(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的模块ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}

	hosts, total, err := h.service.GetModuleHosts(c.Request.Context(), id, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": hosts,
			"pagination": gin.H{
				"page":       page,
				"page_size":  pageSize,
				"total":      total,
				"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
			},
		},
	})
}

func parseTopologyHostNodeID(raw string) (string, string, error) {
	raw = strings.TrimSpace(raw)
	switch {
	case strings.HasPrefix(raw, "idle_set-"):
		return "idle_set", strings.TrimPrefix(raw, "idle_set-"), nil
	case strings.HasPrefix(raw, "idle_module-"):
		return "idle_module", strings.TrimPrefix(raw, "idle_module-"), nil
	}

	idx := strings.Index(raw, "-")
	if idx <= 0 || idx >= len(raw)-1 {
		return "", "", errors.New("invalid node id")
	}

	return raw[:idx], raw[idx+1:], nil
}

func collapseTopologyHostRows(rows []topology.TopologyHostRow) []types.AggregateTopologyHostItem {
	items := make([]types.AggregateTopologyHostItem, 0, len(rows))
	seen := make(map[string]int, len(rows))

	for _, row := range rows {
		if idx, ok := seen[row.HostID]; ok {
			if items[idx].Module == nil && row.ModuleID != nil && row.ModuleName != nil {
				items[idx].Module = &types.AggregateTopologyHostModule{
					ID:   *row.ModuleID,
					Name: *row.ModuleName,
				}
			}
			if items[idx].Set == nil && row.SetID != nil && row.SetName != nil {
				items[idx].Set = &types.AggregateTopologyHostSet{
					ID:   *row.SetID,
					Name: *row.SetName,
				}
			}
			continue
		}

		item := types.AggregateTopologyHostItem{
			HostID:    row.HostID,
			InnerIPv4: row.InnerIPv4,
			InnerIPv6: row.InnerIPv6,
			Status:    row.Status,
		}
		if row.CloudAreaID != nil && row.CloudAreaName != nil {
			item.CloudArea = &types.AggregateTopologyHostCloudArea{
				ID:   *row.CloudAreaID,
				Name: *row.CloudAreaName,
			}
		}
		if row.ModuleID != nil && row.ModuleName != nil {
			item.Module = &types.AggregateTopologyHostModule{
				ID:   *row.ModuleID,
				Name: *row.ModuleName,
			}
		}
		if row.SetID != nil && row.SetName != nil {
			item.Set = &types.AggregateTopologyHostSet{
				ID:   *row.SetID,
				Name: *row.SetName,
			}
		}

		seen[row.HostID] = len(items)
		items = append(items, item)
	}

	return items
}

// InitializeBusinessTopology 初始化业务拓扑
// POST /api/v1/topology/businesses/:id/initialize
func (h *TopologyHandler) InitializeBusinessTopology(c *gin.Context) {
	businessIDStr := c.Param("id")
	businessID, err := strconv.ParseUint(businessIDStr, 10, 64)
	if err != nil || businessID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的业务ID"})
		return
	}

	if h.commands != nil {
		if err := h.commands.InitializeBusinessTopology(c.Request.Context(), businessID); err == nil {
			c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "初始化成功"}})
			return
		} else if !shouldFallbackProjection(err) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	if err := h.service.InitializeBusinessTopology(c.Request.Context(), businessID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "初始化成功"},
	})
}
