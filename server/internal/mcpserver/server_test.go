package mcpserver

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authn "github.com/openwende/cmdb/server/internal/auth"
	"github.com/openwende/cmdb/server/pkg/config"
)

func connect(t *testing.T) *mcp.ClientSession {
	t.Helper()
	ctx := context.Background()
	serverT, clientT := mcp.NewInMemoryTransports()
	_, err := NewServer(setupQueryDB(t)).Connect(ctx, serverT, nil)
	require.NoError(t, err)
	session, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "v0"}, nil).Connect(ctx, clientT, nil)
	require.NoError(t, err)
	t.Cleanup(func() { _ = session.Close() })
	return session
}

// 所有工具都声明为只读，且都生成了输入 schema。
func TestTools_AllReadOnly(t *testing.T) {
	res, err := connect(t).ListTools(context.Background(), nil)
	require.NoError(t, err)
	names := []string{}
	for _, tool := range res.Tools {
		names = append(names, tool.Name)
		require.NotNil(t, tool.Annotations, tool.Name)
		assert.True(t, tool.Annotations.ReadOnlyHint, tool.Name)
		assert.NotNil(t, tool.InputSchema, tool.Name)
	}
	assert.ElementsMatch(t, []string{"search_businesses", "get_business_topology", "search_hosts", "get_host",
		"query_host_changes", "list_pool_directories"}, names)
}

func TestTools_CallRoundTrip(t *testing.T) {
	s := connect(t)
	ctx := context.Background()

	res, err := s.CallTool(ctx, &mcp.CallToolParams{Name: "get_host", Arguments: map[string]any{"ip": "10.20.1.11"}})
	require.NoError(t, err)
	require.False(t, res.IsError)
	out := mustJSON(t, res.StructuredContent)
	assert.Equal(t, "pay-gw-01", out["host_name"])

	res, err = s.CallTool(ctx, &mcp.CallToolParams{Name: "query_host_changes",
		Arguments: map[string]any{"host_id": 1, "action": "placement_change", "limit": 1}})
	require.NoError(t, err)
	out = mustJSON(t, res.StructuredContent)
	assert.EqualValues(t, 2, out["matched"])
	assert.Len(t, out["changes"], 1)

	// 模型看到的是文本内容，键按字母序排列：字段变更要读成 field → from → to，不能是 after 在前
	res, err = s.CallTool(ctx, &mcp.CallToolParams{Name: "query_host_changes",
		Arguments: map[string]any{"host_id": 1, "action": "config_change"}})
	require.NoError(t, err)
	require.NotEmpty(t, res.Content)
	text := res.Content[0].(*mcp.TextContent).Text
	assert.Contains(t, text, `{"field":"custom_fields.备份","from":true,"to":false}`)

	// 业务错误以工具错误返回给模型，而不是协议错误
	res, err = s.CallTool(ctx, &mcp.CallToolParams{Name: "get_host", Arguments: map[string]any{"ip": "10.99.99.99"}})
	require.NoError(t, err)
	assert.True(t, res.IsError)

	res, err = s.CallTool(ctx, &mcp.CallToolParams{Name: "search_hosts", Arguments: map[string]any{"location": "moon"}})
	require.NoError(t, err)
	assert.True(t, res.IsError)
}

func TestHandler_RequiresBearerJWT(t *testing.T) {
	jwt := authn.NewJWTManager(config.JWTConfig{Secret: "test-secret-please-change-1234567890", Issuer: "test", AccessTokenExpiry: time.Hour})
	srv := httptest.NewServer(NewHandler(setupQueryDB(t), jwt))
	defer srv.Close()

	call := func(token string) *http.Response {
		req, err := http.NewRequest(http.MethodPost, srv.URL, strings.NewReader(`{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}`))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json, text/event-stream")
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := http.DefaultClient.Do(req)
		require.NoError(t, err)
		t.Cleanup(func() { _ = resp.Body.Close() })
		return resp
	}

	assert.Equal(t, http.StatusUnauthorized, call("").StatusCode)
	assert.Equal(t, http.StatusUnauthorized, call("not-a-jwt").StatusCode)

	// viewer（只读角色）也能调用只读工具
	token, err := jwt.IssueToken(uuid.New(), "viewer", []string{"viewer"})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, call(token).StatusCode)
}
