package handlers

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/openwende/cmdb/server/internal/auth"
	"github.com/openwende/cmdb/server/internal/types"
)

// systemTenantUUID 是 types.SystemTenantID 的 UUID 形态，供需要 uuid.UUID 的调用方使用。
var systemTenantUUID = uuid.MustParse(types.SystemTenantID)

// currentUserID 从认证中间件写入的上下文里取出当前用户 ID，用于审计字段
// （created_by / updated_by）。
//
// 写操作路径已被 ProtectAPI 强制认证，正常情况下必有值；若取不到（如配置变更
// 导致某路由未经认证）则返回 nil，由调用方按"无操作者"降级处理，而非 panic。
func currentUserID(c *gin.Context) *uuid.UUID {
	user, ok := auth.GetCurrentUser(c)
	if !ok {
		return nil
	}
	id := user.UserID
	return &id
}

// requestOperator 返回当前请求的操作人（认证用户名），用于审计与 created_by/updated_by 等
// 字符串操作人字段。只信任认证中间件写入的身份，不读客户端可伪造的请求头；
// 取不到时降级为 "system"。
func requestOperator(c *gin.Context) string {
	return auth.OperatorFromContext(c.Request.Context())
}
