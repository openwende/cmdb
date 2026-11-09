package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/openwende/cmdb/server/internal/core/audit"
	"github.com/openwende/cmdb/server/pkg/apperrors"
)

// AuditHandler 审计日志处理器
type AuditHandler struct {
	service *audit.Service
}

// NewAuditHandler 创建审计处理器
func NewAuditHandler(service *audit.Service) *AuditHandler {
	return &AuditHandler{service: service}
}

// ListAuditLogs 查询审计日志
// GET /api/v1/audit
// Query params:
//
//	audit_type    string  host | business | resource  (default: host)
//	bk_biz_id    int     optional business filter
//	resource_id   int     optional exact resource_id filter (positive; with audit_type=host it is the host display_id)
//	resource_type string  optional model_uid filter within the tab
//	action        string  comma-separated: create,update,delete
//	start_time    string  YYYY-MM-DD
//	end_time      string  YYYY-MM-DD
//	account       string  operator keyword
//	account_match string  include | exclude  (default: include)
//	host          string  host IP / name keyword (for host tab)
//	host_type     string  ip | hostname  (default: ip)
//	instance      string  instance name keyword (for non-host tabs)
//	instance_type string  name | id  (default: name)
//	page          int     default 1
//	page_size     int     default 20
func (h *AuditHandler) ListAuditLogs(c *gin.Context) {
	auditType := c.DefaultQuery("audit_type", "host")
	if auditType != "host" && auditType != "business" && auditType != "resource" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "audit_type must be one of: host, business, resource"})
		return
	}

	var bizID int64
	if v := c.Query("bk_biz_id"); v != "" {
		if _, err := parseIntQuery(c, "bk_biz_id", &bizID); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid bk_biz_id"})
			return
		}
	}

	var resourceID uint64
	if v := c.Query("resource_id"); v != "" {
		id, err := strconv.ParseUint(strings.TrimSpace(v), 10, 64)
		if err != nil || id == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid resource_id"})
			return
		}
		resourceID = id
	}

	var actions []string
	if raw := c.Query("action"); raw != "" {
		for _, a := range strings.Split(raw, ",") {
			if t := strings.TrimSpace(a); t != "" {
				actions = append(actions, t)
			}
		}
	}

	page, pageSize := parsePaginationParams(c, 20, 200)

	req := &audit.QueryRequest{
		AuditType:    auditType,
		BusinessID:   bizID,
		ResourceID:   resourceID,
		ResourceType: c.Query("resource_type"),
		Actions:      actions,
		StartTime:    c.Query("start_time"),
		EndTime:      c.Query("end_time"),
		Account:      c.Query("account"),
		AccountMatch: c.DefaultQuery("account_match", "include"),
		HostKeyword:  c.Query("host"),
		HostType:     c.DefaultQuery("host_type", "ip"),
		Instance:     c.Query("instance"),
		InstanceType: c.DefaultQuery("instance_type", "name"),
		Page:         page,
		PageSize:     pageSize,
	}

	result, err := h.service.Query(c.Request.Context(), req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": result,
	})
}

// GetAuditLog 按 ID 取单条审计记录
// GET /api/v1/audit/:id
// 返回结构和 ListAuditLogs 的 data.info 里的一项相同，供前端按记录 ID 直接打开详情
// （AI 助手回答里的 [record_id=N] 引用）。
func (h *AuditHandler) GetAuditLog(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil || id == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid audit id"})
		return
	}
	entry, err := h.service.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if entry == nil {
		notFound := apperrors.NotFoundError("audit record", c.Param("id"))
		c.JSON(apperrors.HTTPStatus(notFound), apperrors.NewErrorResponse(notFound, ""))
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": entry})
}

// parseIntQuery parses an integer query param into dest. Returns (true, nil) on success.
func parseIntQuery(c *gin.Context, key string, dest *int64) (bool, error) {
	v := c.Query(key)
	if v == "" {
		return false, nil
	}
	var n int64
	if _, err := parseInt64(v, &n); err != nil {
		return false, err
	}
	*dest = n
	return true, nil
}

func parseInt64(s string, dest *int64) (int64, error) {
	var n int64
	if _, err := fmt.Sscanf(s, "%d", &n); err != nil {
		return 0, err
	}
	*dest = n
	return n, nil
}
