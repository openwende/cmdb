package handlers

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/openwende/cmdb/server/internal/core/mainline"
	"github.com/openwende/cmdb/server/internal/core/topology"
	"github.com/openwende/cmdb/server/internal/types"
)

// GetTree 走 topology.Service(legacy 实体 + mainline 主线树),v2 已在 P1 退出拓扑路径。
func TestMainlineHandler_GetTree_ReadsFromTopologyService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	topologySvc := topology.NewService(db, mainlineSvc)
	handler := NewMainlineHandler(mainlineSvc, topologySvc)

	ctx := context.Background()
	bizID := seedTopologyHandlerBusiness(t, db, "mainline-tree-biz")
	_, err := topologySvc.CreateSet(ctx, &types.CreateSetRequest{
		BusinessID: bizID,
		Name:       "mainline-set",
	})
	require.NoError(t, err)

	router := gin.New()
	router.GET("/api/v1/mainline/tree", handler.GetTree)

	req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("/api/v1/mainline/tree?business_id=%d&max_depth=2", bizID), nil)
	require.NoError(t, err)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"mainline-set"`)
}
