package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/wend/cmdb-backend/internal/types"
)

// stubInstanceService 是 instance.Service 接口的测试替身：BatchCreateInstances / ListInstances 返回固定数据。
type stubInstanceService struct {
	created   []types.Instance
	listed    []types.Instance
	listTotal int64
}

func (s *stubInstanceService) CreateInstance(ctx context.Context, tenantID, modelName string, req *types.CreateInstanceRequest) (*types.Instance, error) {
	return nil, nil
}
func (s *stubInstanceService) BatchCreateInstances(ctx context.Context, tenantID, modelName string, req *types.BatchCreateInstanceRequest) ([]types.Instance, error) {
	return s.created, nil
}
func (s *stubInstanceService) ListInstances(ctx context.Context, tenantID, modelName string, params types.QueryParams) ([]types.Instance, int64, error) {
	return s.listed, s.listTotal, nil
}

// TestBatchCreateInstancesEnvelope 锁定 R8 契约：批量创建实例返回统一 envelope
// {code:0,data:{count,ids}}（HTTP 201），旧裸字段(count/ids 顶层)已收进 data。
func TestBatchCreateInstancesEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubInstanceService{created: []types.Instance{{ID: uuid.New()}, {ID: uuid.New()}}}
	handler := NewInstanceHandler(stub)
	router := gin.Default()
	router.POST("/models/:name/instances/batch", handler.BatchCreateInstances)

	body := `{"instances":[{"properties":{"k":"v"}}]}`
	req, _ := http.NewRequest(http.MethodPost, "/models/host/instances/batch", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var resp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(0), resp["code"])
	assert.Nil(t, resp["count"]) // 旧顶层裸字段已收进 data
	assert.Nil(t, resp["ids"])

	data, ok := resp["data"].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, float64(2), data["count"])
	ids, ok := data["ids"].([]interface{})
	assert.True(t, ok)
	assert.Len(t, ids, 2)
}

// TestListInstancesEnvelope 锁定 R8 契约：实例列表返回统一 envelope
// {code:0,data:{items,pagination:{page,page_size,total}}}，旧 {data,meta} 形状已移除。
func TestListInstancesEnvelope(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubInstanceService{
		listed:    []types.Instance{{ID: uuid.New()}, {ID: uuid.New()}, {ID: uuid.New()}},
		listTotal: 3,
	}
	handler := NewInstanceHandler(stub)
	router := gin.Default()
	router.GET("/models/:name/instances", handler.ListInstances)

	req, _ := http.NewRequest(http.MethodGet, "/models/host/instances?page=1&page_size=20", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(0), resp["code"])
	assert.Nil(t, resp["meta"]) // 旧 meta 顶层键已移除

	data, ok := resp["data"].(map[string]interface{})
	assert.True(t, ok)
	items, ok := data["items"].([]interface{})
	assert.True(t, ok)
	assert.Len(t, items, 3)

	pagination, ok := data["pagination"].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, float64(1), pagination["page"])
	assert.Equal(t, float64(20), pagination["page_size"])
	assert.Equal(t, float64(3), pagination["total"])
}
