package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/resource_graph"
	"github.com/wend/cmdb-backend/internal/storage"
)

func setupResourceGraphHandlerTest(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()

	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, storage.MigrateResourceGraphTables(db))

	svc := resource_graph.NewService(db)
	handler := NewResourceGraphHandler(svc)

	router := gin.New()
	v2 := router.Group("/api/v2")
	{
		v2.GET("/types", handler.ListTypes)
		v2.POST("/types", handler.CreateType)
		v2.GET("/types/:name", handler.GetType)
		v2.POST("/resources", handler.CreateResource)
		v2.POST("/resources/batch", handler.BatchUpsertResources)
		v2.POST("/resources/search", handler.SearchResources)
		v2.POST("/edges", handler.CreateEdge)
		v2.GET("/resources/:id/edges", handler.ListResourceEdges)
		v2.GET("/events", handler.ListEvents)
	}

	return router, db
}

func TestResourceGraphHandler_CreateType(t *testing.T) {
	router, _ := setupResourceGraphHandlerTest(t)

	payload := map[string]any{
		"name":         "host",
		"display_name": "Host",
		"category":     "infra",
		"schema": map[string]any{
			"type":     "object",
			"required": []any{"inner_ip"},
			"properties": map[string]any{
				"inner_ip": map[string]any{"type": "string"},
			},
		},
		"identity_rules": map[string]any{
			"unique_keys": [][]string{{"inner_ip"}},
		},
	}

	body, err := json.Marshal(payload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v2/types", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusCreated, resp.Code)
	require.Contains(t, resp.Body.String(), `"name":"host"`)
}

func TestResourceGraphHandler_CreateResource(t *testing.T) {
	router, _ := setupResourceGraphHandlerTest(t)

	typePayload := map[string]any{
		"name":         "host",
		"display_name": "Host",
		"category":     "infra",
		"schema": map[string]any{
			"type":     "object",
			"required": []any{"inner_ip"},
			"properties": map[string]any{
				"inner_ip": map[string]any{"type": "string"},
			},
		},
		"identity_rules": map[string]any{
			"unique_keys": [][]string{{"inner_ip"}},
		},
	}
	typeBody, err := json.Marshal(typePayload)
	require.NoError(t, err)
	typeReq := httptest.NewRequest(http.MethodPost, "/api/v2/types", bytes.NewReader(typeBody))
	typeReq.Header.Set("Content-Type", "application/json")
	typeResp := httptest.NewRecorder()
	router.ServeHTTP(typeResp, typeReq)
	require.Equal(t, http.StatusCreated, typeResp.Code)

	resourcePayload := map[string]any{
		"type_name": "host",
		"spec": map[string]any{
			"inner_ip": "10.0.1.10",
		},
	}
	body, err := json.Marshal(resourcePayload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v2/resources", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusCreated, resp.Code)
	require.Contains(t, resp.Body.String(), `"type_name":"host"`)
}

func TestResourceGraphHandler_BatchUpsertResources(t *testing.T) {
	router, _ := setupResourceGraphHandlerTest(t)

	typePayload := map[string]any{
		"name":         "host",
		"display_name": "Host",
		"category":     "infra",
		"schema": map[string]any{
			"type":     "object",
			"required": []any{"inner_ip"},
			"properties": map[string]any{
				"inner_ip": map[string]any{"type": "string"},
				"hostname": map[string]any{"type": "string"},
			},
		},
		"identity_rules": map[string]any{
			"unique_keys": [][]string{{"inner_ip"}},
		},
	}
	typeBody, err := json.Marshal(typePayload)
	require.NoError(t, err)
	typeReq := httptest.NewRequest(http.MethodPost, "/api/v2/types", bytes.NewReader(typeBody))
	typeReq.Header.Set("Content-Type", "application/json")
	typeResp := httptest.NewRecorder()
	router.ServeHTTP(typeResp, typeReq)
	require.Equal(t, http.StatusCreated, typeResp.Code)

	batchPayload := map[string]any{
		"type_name": "host",
		"items": []map[string]any{
			{"inner_ip": "10.0.1.10", "hostname": "a"},
			{"inner_ip": "10.0.1.10", "hostname": "b"},
		},
	}
	body, err := json.Marshal(batchPayload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v2/resources/batch", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"created":1`)
	require.Contains(t, resp.Body.String(), `"updated":1`)
}

func TestResourceGraphHandler_SearchResources(t *testing.T) {
	router, _ := setupResourceGraphHandlerTest(t)

	typePayload := map[string]any{
		"name":         "host",
		"display_name": "Host",
		"category":     "infra",
		"schema": map[string]any{
			"type":     "object",
			"required": []any{"inner_ip"},
			"properties": map[string]any{
				"inner_ip": map[string]any{"type": "string"},
				"hostname": map[string]any{"type": "string"},
			},
		},
		"identity_rules": map[string]any{
			"unique_keys": [][]string{{"inner_ip"}},
		},
	}
	typeBody, err := json.Marshal(typePayload)
	require.NoError(t, err)
	typeReq := httptest.NewRequest(http.MethodPost, "/api/v2/types", bytes.NewReader(typeBody))
	typeReq.Header.Set("Content-Type", "application/json")
	typeResp := httptest.NewRecorder()
	router.ServeHTTP(typeResp, typeReq)
	require.Equal(t, http.StatusCreated, typeResp.Code)

	resourcePayload := map[string]any{
		"type_name": "host",
		"spec": map[string]any{
			"inner_ip": "10.0.1.10",
			"hostname": "alpha",
		},
	}
	resourceBody, err := json.Marshal(resourcePayload)
	require.NoError(t, err)
	resourceReq := httptest.NewRequest(http.MethodPost, "/api/v2/resources", bytes.NewReader(resourceBody))
	resourceReq.Header.Set("Content-Type", "application/json")
	resourceResp := httptest.NewRecorder()
	router.ServeHTTP(resourceResp, resourceReq)
	require.Equal(t, http.StatusCreated, resourceResp.Code)

	searchPayload := map[string]any{
		"type_name": "host",
		"filters": map[string]any{
			"hostname": "alpha",
		},
	}
	body, err := json.Marshal(searchPayload)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodPost, "/api/v2/resources/search", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"hostname":"alpha"`)
}

func TestResourceGraphHandler_CreateEdgeAndListEdges(t *testing.T) {
	router, _ := setupResourceGraphHandlerTest(t)

	typePayload := map[string]any{
		"name":         "host",
		"display_name": "Host",
		"category":     "infra",
		"schema": map[string]any{
			"type":     "object",
			"required": []any{"inner_ip"},
			"properties": map[string]any{
				"inner_ip": map[string]any{"type": "string"},
				"hostname": map[string]any{"type": "string"},
			},
		},
		"identity_rules": map[string]any{
			"unique_keys": [][]string{{"inner_ip"}},
		},
	}
	typeBody, err := json.Marshal(typePayload)
	require.NoError(t, err)
	typeReq := httptest.NewRequest(http.MethodPost, "/api/v2/types", bytes.NewReader(typeBody))
	typeReq.Header.Set("Content-Type", "application/json")
	typeResp := httptest.NewRecorder()
	router.ServeHTTP(typeResp, typeReq)
	require.Equal(t, http.StatusCreated, typeResp.Code)

	createResource := func(innerIP, hostname string) string {
		resourcePayload := map[string]any{
			"type_name": "host",
			"spec": map[string]any{
				"inner_ip": innerIP,
				"hostname": hostname,
			},
		}
		body, marshalErr := json.Marshal(resourcePayload)
		require.NoError(t, marshalErr)
		req := httptest.NewRequest(http.MethodPost, "/api/v2/resources", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)
		require.Equal(t, http.StatusCreated, resp.Code)

		var parsed struct {
			Data struct {
				ID string `json:"id"`
			} `json:"data"`
		}
		require.NoError(t, json.Unmarshal(resp.Body.Bytes(), &parsed))
		return parsed.Data.ID
	}

	sourceID := createResource("10.0.1.10", "alpha")
	targetID := createResource("10.0.1.11", "beta")

	edgePayload := map[string]any{
		"from_id":  sourceID,
		"to_id":    targetID,
		"rel_type": "connects_to",
		"data": map[string]any{
			"port": 3306,
		},
	}
	edgeBody, err := json.Marshal(edgePayload)
	require.NoError(t, err)
	edgeReq := httptest.NewRequest(http.MethodPost, "/api/v2/edges", bytes.NewReader(edgeBody))
	edgeReq.Header.Set("Content-Type", "application/json")
	edgeResp := httptest.NewRecorder()
	router.ServeHTTP(edgeResp, edgeReq)
	require.Equal(t, http.StatusCreated, edgeResp.Code)

	listReq := httptest.NewRequest(http.MethodGet, "/api/v2/resources/"+sourceID+"/edges?rel_type=connects_to", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)
	require.Equal(t, http.StatusOK, listResp.Code)
	require.Contains(t, listResp.Body.String(), `"rel_type":"connects_to"`)
}

func TestResourceGraphHandler_ListEvents(t *testing.T) {
	router, _ := setupResourceGraphHandlerTest(t)

	typePayload := map[string]any{
		"name":         "host",
		"display_name": "Host",
		"category":     "infra",
		"schema": map[string]any{
			"type":     "object",
			"required": []any{"inner_ip"},
			"properties": map[string]any{
				"inner_ip": map[string]any{"type": "string"},
			},
		},
		"identity_rules": map[string]any{
			"unique_keys": [][]string{{"inner_ip"}},
		},
	}
	typeBody, err := json.Marshal(typePayload)
	require.NoError(t, err)
	typeReq := httptest.NewRequest(http.MethodPost, "/api/v2/types", bytes.NewReader(typeBody))
	typeReq.Header.Set("Content-Type", "application/json")
	typeResp := httptest.NewRecorder()
	router.ServeHTTP(typeResp, typeReq)
	require.Equal(t, http.StatusCreated, typeResp.Code)

	resourcePayload := map[string]any{
		"type_name": "host",
		"spec": map[string]any{
			"inner_ip": "10.0.1.10",
		},
	}
	resourceBody, err := json.Marshal(resourcePayload)
	require.NoError(t, err)
	resourceReq := httptest.NewRequest(http.MethodPost, "/api/v2/resources", bytes.NewReader(resourceBody))
	resourceReq.Header.Set("Content-Type", "application/json")
	resourceResp := httptest.NewRecorder()
	router.ServeHTTP(resourceResp, resourceReq)
	require.Equal(t, http.StatusCreated, resourceResp.Code)

	req := httptest.NewRequest(http.MethodGet, "/api/v2/events?event_type=resource.created", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	require.Equal(t, http.StatusOK, resp.Code)
	require.Contains(t, resp.Body.String(), `"event_type":"resource.created"`)
}
