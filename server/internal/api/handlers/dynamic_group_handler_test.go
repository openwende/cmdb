package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"

	"github.com/openwende/cmdb-server/internal/core/dynamic_group"
	"github.com/openwende/cmdb-server/internal/types"
)

// stubDynamicGroupService 是 dynamic_group.Service 接口的测试替身：仅 List 返回固定数据。
type stubDynamicGroupService struct {
	items []types.DynamicGroupDetail
	total int64
}

func (s *stubDynamicGroupService) List(ctx context.Context, businessID uint64, targetModelUID, searchField, keyword string, limit, offset int) ([]types.DynamicGroupDetail, int64, error) {
	return s.items, s.total, nil
}
func (s *stubDynamicGroupService) Get(ctx context.Context, businessID uint64, groupID uuid.UUID) (*types.DynamicGroupDetail, error) {
	return nil, nil
}
func (s *stubDynamicGroupService) Create(ctx context.Context, businessID uint64, input *dynamic_group.CreateDynamicGroupInput) (*types.DynamicGroupDetail, error) {
	return nil, nil
}
func (s *stubDynamicGroupService) Update(ctx context.Context, businessID uint64, groupID uuid.UUID, input *dynamic_group.UpdateDynamicGroupInput) (*types.DynamicGroupDetail, error) {
	return nil, nil
}
func (s *stubDynamicGroupService) Delete(ctx context.Context, businessID uint64, groupID uuid.UUID) error {
	return nil
}
func (s *stubDynamicGroupService) GetMeta(ctx context.Context) (map[string]interface{}, error) {
	return nil, nil
}
func (s *stubDynamicGroupService) Preview(ctx context.Context, businessID uint64, targetModelUID string, condition []types.DynamicGroupConditionGroup, limit int) ([]types.DynamicGroupPreviewHost, int64, error) {
	return nil, 0, nil
}
func (s *stubDynamicGroupService) UpdatePreviewCount(ctx context.Context, businessID uint64, groupID uuid.UUID, count int64) error {
	return nil
}

// TestDynamicGroupList 锁定 R8 契约：动态分组列表返回统一 envelope
// {code:0,data:{items,pagination:{page,page_size,total}}}，旧扁平分页字段(total/limit/offset)已收进 pagination。
func TestDynamicGroupList(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubDynamicGroupService{
		items: []types.DynamicGroupDetail{{Name: "g1"}, {Name: "g2"}, {Name: "g3"}},
		total: 3,
	}
	handler := NewDynamicGroupHandler(stub)
	router := gin.Default()
	router.GET("/:id/dynamic-groups", handler.List)

	req, _ := http.NewRequest(http.MethodGet, "/1000/dynamic-groups", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(0), resp["code"])

	data, ok := resp["data"].(map[string]interface{})
	assert.True(t, ok)
	// 旧扁平分页键已移除（前端改读 pagination.total）。
	assert.Nil(t, data["total"])
	assert.Nil(t, data["limit"])
	assert.Nil(t, data["offset"])

	items, ok := data["items"].([]interface{})
	assert.True(t, ok)
	assert.Len(t, items, 3)

	pagination, ok := data["pagination"].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, float64(1), pagination["page"])       // 未传分页 → offset(0)/limit(20)+1 = 1
	assert.Equal(t, float64(20), pagination["page_size"]) // 默认 limit=20
	assert.Equal(t, float64(3), pagination["total"])
}
