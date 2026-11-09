package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"

	"github.com/openwende/cmdb/server/internal/core/cloud_area"
	"github.com/openwende/cmdb/server/internal/types"
)

// TestListCloudAreas 锁定 R8 契约：云区域列表返回统一 envelope
// {code:0,data:{items,pagination:{page,page_size,total}}}，旧扁平字段(cloud_areas/total/page/page_size)已移除。
// 复用 host_handler_test.go 的 fakeCloudAreaRepo（listAreas/listTotal 字段驱动 ListCloudAreas）。
func TestListCloudAreas(t *testing.T) {
	gin.SetMode(gin.TestMode)

	repo := &fakeCloudAreaRepo{
		listAreas: []types.CloudArea{{Name: "default"}, {Name: "vpc-a"}},
		listTotal: 2,
	}
	handler := NewCloudAreaHandler(cloud_area.NewService(repo))
	router := gin.Default()
	router.GET("/cloud-areas", handler.ListCloudAreas)

	req, _ := http.NewRequest(http.MethodGet, "/cloud-areas", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var resp map[string]interface{}
	assert.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, float64(0), resp["code"])
	assert.Nil(t, resp["cloud_areas"]) // 旧扁平键已移除

	data, ok := resp["data"].(map[string]interface{})
	assert.True(t, ok)
	items, ok := data["items"].([]interface{})
	assert.True(t, ok)
	assert.Len(t, items, 2)

	pagination, ok := data["pagination"].(map[string]interface{})
	assert.True(t, ok)
	assert.Equal(t, float64(1), pagination["page"])       // 未传分页 → handler 默认 page=1
	assert.Equal(t, float64(20), pagination["page_size"]) // 默认 page_size=20
	assert.Equal(t, float64(2), pagination["total"])
}
