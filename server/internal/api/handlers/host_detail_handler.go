package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/pkg/apperrors"
)

// HostDetailHandler 按展示 ID 取主机详情（只读）。
type HostDetailHandler struct {
	repo storage.HostDetailRepository
}

// NewHostDetailHandler 创建主机详情处理器。
func NewHostDetailHandler(repo storage.HostDetailRepository) *HostDetailHandler {
	return &HostDetailHandler{repo: repo}
}

// GetHostByDisplayID 按 display_id 取主机详情
// GET /api/v1/hosts/display/:display_id
//
// display_id 是界面上显示的主机编号，也是 AI 助手 [host_id=N] 引用和主机审计记录 resource_id 用的编号。
// 成功 {"code":0,"data":<HostDetail>}：主机表全部字段（同 Host 的 JSON）+ cloud_area_name + placements（当前归属）。
// 已销毁（is_destroyed=true）的主机照常返回；不存在 404，display_id 不是正整数 400。
func (h *HostDetailHandler) GetHostByDisplayID(c *gin.Context) {
	raw := c.Param("display_id")
	displayID, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || displayID <= 0 {
		invalid := apperrors.InvalidInputError("display_id", "must be a positive integer")
		c.JSON(apperrors.HTTPStatus(invalid), apperrors.NewErrorResponse(invalid, ""))
		return
	}
	detail, err := h.repo.GetHostDetailByDisplayID(c.Request.Context(), displayID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if detail == nil {
		notFound := apperrors.NotFoundError("host", raw)
		c.JSON(apperrors.HTTPStatus(notFound), apperrors.NewErrorResponse(notFound, ""))
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": detail})
}
