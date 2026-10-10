package mcpserver

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const (
	defaultLimit = 20
	maxLimit     = 100
)

func clampLimit(n int) int {
	if n <= 0 {
		return defaultLimit
	}
	if n > maxLimit {
		return maxLimit
	}
	return n
}

// parseTime 接受 RFC3339 或 YYYY-MM-DD（按北京时间当天 00:00）。
func parseTime(s string) (*time.Time, error) {
	if s == "" {
		return nil, nil
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return &t, nil
	}
	if t, err := time.ParseInLocation("2006-01-02", s, shanghai); err == nil {
		return &t, nil
	}
	return nil, fmt.Errorf("时间格式无效 %q，请用 RFC3339 或 YYYY-MM-DD", s)
}

func readOnly(title string) *mcp.ToolAnnotations {
	return &mcp.ToolAnnotations{Title: title, ReadOnlyHint: true, IdempotentHint: true}
}

// ---------- inputs / outputs ----------

type searchBusinessesIn struct {
	Keyword string `json:"keyword,omitempty" jsonschema:"业务名称、英文标识或模块名称的片段；为空时列出全部业务"`
	Limit   int    `json:"limit,omitempty" jsonschema:"最多返回条数，默认 20，最大 100"`
}

type searchBusinessesOut struct {
	Businesses []BusinessSummary `json:"businesses"`
}

type businessTopologyIn struct {
	BusinessID uint64 `json:"business_id" jsonschema:"业务 ID（先用 search_businesses 查到）"`
}

type searchHostsIn struct {
	Keyword     string `json:"keyword,omitempty" jsonschema:"IP、主机名或固资编号等自定义字段值的片段"`
	BusinessID  uint64 `json:"business_id,omitempty" jsonschema:"只看该业务下的主机"`
	ModuleID    uint64 `json:"module_id,omitempty" jsonschema:"只看该模块下的主机（模块 ID 来自 get_business_topology）"`
	Location    string `json:"location,omitempty" jsonschema:"取值 pool（只看资源池里的主机）或 business（只看已分配到业务的主机）"`
	DirectoryID uint64 `json:"directory_id,omitempty" jsonschema:"只看该资源池目录下的主机"`
	OSType      string `json:"os_type,omitempty" jsonschema:"linux 或 windows"`
	Status      string `json:"status,omitempty" jsonschema:"running、stopped 或 terminated"`
	MinCPU      int    `json:"min_cpu,omitempty" jsonschema:"最少 CPU 核数"`
	MinMemoryGB int    `json:"min_memory_gb,omitempty" jsonschema:"最少内存 GB"`
	Limit       int    `json:"limit,omitempty" jsonschema:"最多返回条数，默认 20，最大 100"`
}

type searchHostsOut struct {
	Total int64         `json:"total" jsonschema:"满足条件的主机总数（可能多于返回条数）"`
	Hosts []HostSummary `json:"hosts"`
}

type getHostIn struct {
	HostID int64  `json:"host_id,omitempty" jsonschema:"主机展示 ID；与 ip 二选一"`
	IP     string `json:"ip,omitempty" jsonschema:"主机内网 IPv4；与 host_id 二选一"`
}

type changesIn struct {
	HostID     int64  `json:"host_id,omitempty" jsonschema:"只看这台主机（主机展示 ID）"`
	IP         string `json:"ip,omitempty" jsonschema:"只看这台主机（按 IP；与 host_id 二选一）"`
	BusinessID uint64 `json:"business_id,omitempty" jsonschema:"只看变更前或变更后属于该业务的记录"`
	ModuleID   uint64 `json:"module_id,omitempty" jsonschema:"只看变更前或变更后在该模块的记录（模块 ID 来自 get_business_topology 或 search_businesses）；查某个模块的主机转入转出时配合 action=placement_change"`
	Operator   string `json:"operator,omitempty" jsonschema:"只看该操作人（登录用户名，如 zhangwei）"`
	Since      string `json:"since,omitempty" jsonschema:"起始时间，RFC3339 或 YYYY-MM-DD（北京时间）"`
	Until      string `json:"until,omitempty" jsonschema:"截止时间，RFC3339 或 YYYY-MM-DD（北京时间）"`
	Action     string `json:"action,omitempty" jsonschema:"只看某类变更：placement_change（归属变更）、config_change（配置变更）、create、delete"`
	Keyword    string `json:"keyword,omitempty" jsonschema:"匹配变更前后归属或变更字段，如 故障机、待回收、备份、memory"`
	Limit      int    `json:"limit,omitempty" jsonschema:"最多返回条数，默认 20，最大 100"`
}

type changesOut struct {
	Matched int           `json:"matched" jsonschema:"命中的记录总数（可能多于返回条数）"`
	Changes []ChangeEntry `json:"changes" jsonschema:"按时间倒序"`
}

type poolDirectoriesOut struct {
	Directories []PoolDirectory `json:"directories"`
}

type noInput struct{}

// registerTools 注册全部只读工具。
func registerTools(s *mcp.Server, q *Query) {
	mcp.AddTool(s, &mcp.Tool{
		Name: "search_businesses",
		Description: "按名称、英文标识或模块名称查业务，返回业务 ID、生命周期、主机数和业务人员；关键字命中模块名时，matched_modules 给出命中的模块和 module_id。" +
			"用户提到业务名或模块名时先用它定位；同名或相近的业务会一起返回，需要时向用户确认是哪一个。",
		Annotations: readOnly("查业务"),
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in searchBusinessesIn) (*mcp.CallToolResult, searchBusinessesOut, error) {
		items, err := q.SearchBusinesses(ctx, in.Keyword, clampLimit(in.Limit))
		return nil, searchBusinessesOut{Businesses: items}, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_business_topology",
		Description: "返回业务的拓扑：集群 → 模块，含每个模块的主机数。is_idle_pool=true 的集群是内置空闲机池，下有 空闲机、故障机、待回收 三个模块。需要模块 ID 或了解业务结构时使用。",
		Annotations: readOnly("业务拓扑"),
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in businessTopologyIn) (*mcp.CallToolResult, *BusinessTopology, error) {
		t, err := q.GetBusinessTopology(ctx, in.BusinessID)
		return nil, t, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "search_hosts",
		Description: "按条件搜主机：关键字（IP/主机名/固资编号）、业务、模块、资源池目录、位置（资源池或业务）、操作系统、状态、最低 CPU 与内存。返回主机概要和当前归属，total 为满足条件的总数。",
		Annotations: readOnly("搜主机"),
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in searchHostsIn) (*mcp.CallToolResult, searchHostsOut, error) {
		if in.Location != "" && in.Location != "pool" && in.Location != "business" {
			return nil, searchHostsOut{}, fmt.Errorf("location 只能是 pool 或 business")
		}
		total, hosts, err := q.SearchHosts(ctx, HostFilter{
			Keyword: in.Keyword, BusinessID: in.BusinessID, ModuleID: in.ModuleID, Location: in.Location,
			DirectoryID: in.DirectoryID, OSType: in.OSType, Status: in.Status, MinCPU: in.MinCPU,
			MinMemoryMB: in.MinMemoryGB * 1024, Limit: clampLimit(in.Limit),
		})
		return nil, searchHostsOut{Total: total, Hosts: hosts}, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "get_host",
		Description: "按 host_id 或 IP 取单台主机的当前详情：配置（CPU/内存/磁盘/系统/状态）、管控区域、自定义字段（固资编号、环境、责任团队、标签、SLA、备份等）和当前所有归属（一台主机可以同时属于多个模块）。",
		Annotations: readOnly("主机详情"),
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in getHostIn) (*mcp.CallToolResult, *HostDetail, error) {
		d, err := q.GetHost(ctx, in.HostID, in.IP)
		return nil, d, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name: "query_host_changes",
		Description: "查主机变更记录（来自审计），按时间倒序。每条包含 record_id、时间（北京时间）、操作人、类型：" +
			"placement_change 带变更前后归属（from/to）和类型（分配、转移、回收等）；config_change 带逐字段的前后值。" +
			"可按主机（host_id 或 ip）、业务、模块、操作人、时间范围、变更类型、关键字（如 故障机、待回收、备份）过滤。" +
			"调查某台主机的历史时传 host_id 或 ip；调查某个模块的主机进出时传 module_id，不用逐台主机去查。",
		Annotations: readOnly("主机变更记录"),
	}, func(ctx context.Context, _ *mcp.CallToolRequest, in changesIn) (*mcp.CallToolResult, changesOut, error) {
		since, err := parseTime(in.Since)
		if err != nil {
			return nil, changesOut{}, err
		}
		until, err := parseTime(in.Until)
		if err != nil {
			return nil, changesOut{}, err
		}
		hostID := in.HostID
		if hostID == 0 && strings.TrimSpace(in.IP) != "" {
			if hostID, err = q.HostIDByIP(ctx, in.IP); err != nil {
				return nil, changesOut{}, err
			}
		}
		matched, items, err := q.QueryChanges(ctx, ChangeFilter{
			HostID: hostID, BusinessID: in.BusinessID, ModuleID: in.ModuleID, Operator: in.Operator, Since: since, Until: until,
			Action: in.Action, Keyword: in.Keyword, Limit: clampLimit(in.Limit),
		})
		return nil, changesOut{Matched: matched, Changes: items}, err
	})

	mcp.AddTool(s, &mcp.Tool{
		Name:        "list_pool_directories",
		Description: "列出资源池目录及每个目录的主机数、运行中主机数。资源池里是尚未分配给业务的主机。",
		Annotations: readOnly("资源池目录"),
	}, func(ctx context.Context, _ *mcp.CallToolRequest, _ noInput) (*mcp.CallToolResult, poolDirectoriesOut, error) {
		dirs, err := q.ListPoolDirectories(ctx)
		return nil, poolDirectoriesOut{Directories: dirs}, err
	})
}
