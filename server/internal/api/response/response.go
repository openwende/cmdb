// Package response 定义后端统一响应规范的写入助手（R8）。
//
// 规范（新端点一律采用；存量端点逐步迁移——勿一次性改形状，以免破坏现有前端消费端）：
//
//	成功：     { "code": 0, "data": <payload> }                         HTTP 200
//	失败：     { "code": <非0>, "error": "<message>" }                  HTTP=对应状态码
//	分页列表： { "code": 0, "data": { "items": [...],
//	                                 "pagination": { "page", "page_size", "total" } } }
//	批量：     HTTP 200；响应体内用 { total, successful, failed, ... } 表达部分失败，
//	          不要用 2xx/4xx/207 混合表达批量结果（便于前端统一按 body 判定）。
//
// 选择 code（而非 success）作为统一包裹标识：资源池/拓扑等多数端点已采用 {code,data}。
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// CodeOK 是成功响应的业务码。
const CodeOK = 0

// Pagination 标准分页元信息。
type Pagination struct {
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
	Total    int64 `json:"total"`
}

// OK 写标准成功响应：{"code":0,"data":data}，HTTP 200。
func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, gin.H{"code": CodeOK, "data": data})
}

// Created 同 OK，但 HTTP 201。
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, gin.H{"code": CodeOK, "data": data})
}

// List 写标准分页列表响应：{"code":0,"data":{"items":...,"pagination":{...}}}。
func List(c *gin.Context, items interface{}, page, pageSize int, total int64) {
	c.JSON(http.StatusOK, gin.H{
		"code": CodeOK,
		"data": gin.H{
			"items":      items,
			"pagination": Pagination{Page: page, PageSize: pageSize, Total: total},
		},
	})
}

// Error 写标准错误响应：{"code":<status>,"error":msg}，HTTP=status。
func Error(c *gin.Context, status int, msg string) {
	c.JSON(status, gin.H{"code": status, "error": msg})
}
