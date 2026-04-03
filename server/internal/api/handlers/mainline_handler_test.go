package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/wend/cmdb-backend/internal/core/mainline"
	"github.com/wend/cmdb-backend/internal/core/projection"
	"github.com/wend/cmdb-backend/internal/core/resource_graph"
	"github.com/wend/cmdb-backend/internal/core/topology"
)

func TestMainlineHandler_GetTree_UsesProjectionWhenGraphDataExists(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := setupTopologyHandlerTestDB(t)
	mainlineSvc := mainline.NewService(db)
	topologySvc := topology.NewService(db, mainlineSvc)
	handler := NewMainlineHandler(mainlineSvc, topologySvc, projection.NewBusinessTopologyService(db))

	graphSvc := resource_graph.NewService(db)
	registerProjectionHandlerType(t, graphSvc, "business", "org")
	registerProjectionHandlerType(t, graphSvc, "set", "org")

	biz, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "business",
		Name:     "Mainline Projection Biz",
		Spec:     map[string]any{"ref_id": "4c5f1a27-4b54-497d-a9f2-8922c0e4be55"},
	})
	require.NoError(t, err)
	setNode, err := graphSvc.CreateResource(context.Background(), resource_graph.CreateResourceInput{
		TypeName: "set",
		Name:     "mainline-set",
		Spec:     map[string]any{"ref_id": "501"},
	})
	require.NoError(t, err)
	_, err = graphSvc.CreateEdge(context.Background(), resource_graph.CreateEdgeInput{
		FromID:  biz.ID,
		ToID:    setNode.ID,
		RelType: "contains",
	})
	require.NoError(t, err)

	router := gin.New()
	router.GET("/api/v1/mainline/tree", handler.GetTree)

	req, err := http.NewRequest(http.MethodGet, "/api/v1/mainline/tree?business_id=4c5f1a27-4b54-497d-a9f2-8922c0e4be55", nil)
	require.NoError(t, err)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"Mainline Projection Biz"`)
	require.Contains(t, resp.Body.String(), `"set_501"`)
}
