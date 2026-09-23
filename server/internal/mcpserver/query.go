package mcpserver

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// shanghai 工具输出统一用北京时间（带偏移量），避免 Agent 把 UTC 当本地时间讲给用户。
// 用固定时区而非 LoadLocation：运行镜像不一定带 tzdata。
var shanghai = time.FixedZone("Asia/Shanghai", 8*3600)

func fmtTime(t time.Time) string { return t.In(shanghai).Format(time.RFC3339) }

// ErrNotFound 查询对象不存在。
var ErrNotFound = errors.New("not found")

// Query 面向 Agent 的只读查询：把主机、拓扑、资源池和审计拼成"可直接引用"的视图。
// 只读，不经 service 层写路径；所有结果都带可引用的 ID（host_id / record_id 等）。
type Query struct {
	db *gorm.DB
}

// NewQuery 创建只读查询。
func NewQuery(db *gorm.DB) *Query { return &Query{db: db} }

func (q *Query) isPostgres() bool { return q.db.Dialector.Name() == "postgres" }

// ipExpr / customFieldsText 屏蔽 PG（inet / jsonb）与测试用 sqlite（text）的差异。
func (q *Query) ipExpr() string {
	if q.isPostgres() {
		return "host(h.primary_ip)"
	}
	return "h.primary_ip"
}

func (q *Query) customFieldsText() string {
	if q.isPostgres() {
		return "h.custom_fields::text"
	}
	return "h.custom_fields"
}

// ---------- 归属 ----------

// Placement 主机的一处归属：业务模块或资源池目录。
type Placement struct {
	Kind        string `json:"kind" jsonschema:"business_module（业务模块）或 pool_directory（资源池目录）"`
	BusinessID  uint64 `json:"business_id,omitempty"`
	Business    string `json:"business,omitempty"`
	SetID       uint64 `json:"set_id,omitempty"`
	Set         string `json:"set,omitempty"`
	ModuleID    uint64 `json:"module_id,omitempty"`
	Module      string `json:"module,omitempty"`
	DirectoryID uint64 `json:"directory_id,omitempty"`
	Directory   string `json:"directory,omitempty"`
}

func (p Placement) String() string {
	if p.Kind == "pool_directory" {
		return "资源池 / " + p.Directory
	}
	return strings.Join([]string{p.Business, p.Set, p.Module}, " / ")
}

func (q *Query) placements(ctx context.Context, hostIDs []uuid.UUID) (map[uuid.UUID][]Placement, error) {
	out := make(map[uuid.UUID][]Placement, len(hostIDs))
	if len(hostIDs) == 0 {
		return out, nil
	}
	var rows []struct {
		HostID      uuid.UUID
		NodeKind    string
		NodeID      uint64
		ModuleName  *string
		SetID       *uint64
		SetName     *string
		BusinessID  *uint64
		BizName     *string
		DirName     *string
		DirectoryID *uint64
	}
	err := q.db.WithContext(ctx).Table("host_node_memberships m").
		Select(`m.host_id, m.node_kind, m.node_id,
			mo.name AS module_name, s.id AS set_id, s.name AS set_name,
			b.id AS business_id, b.name AS biz_name,
			d.id AS directory_id, d.name AS dir_name`).
		Joins("LEFT JOIN modules mo ON m.node_kind = ? AND mo.id = m.node_id", types.NodeKindBizModule).
		Joins("LEFT JOIN sets s ON s.id = mo.set_id").
		Joins("LEFT JOIN businesses b ON b.id = mo.business_id").
		Joins("LEFT JOIN resource_directories d ON m.node_kind = ? AND d.id = m.node_id", types.NodeKindPoolDirectory).
		Where("m.host_id IN ?", hostIDs).
		Order("m.node_kind, m.node_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		p := Placement{}
		if r.NodeKind == types.NodeKindPoolDirectory {
			p.Kind, p.DirectoryID, p.Directory = "pool_directory", r.NodeID, deref(r.DirName)
		} else {
			p.Kind, p.ModuleID, p.Module = "business_module", r.NodeID, deref(r.ModuleName)
			p.SetID, p.Set = derefU(r.SetID), deref(r.SetName)
			p.BusinessID, p.Business = derefU(r.BusinessID), deref(r.BizName)
		}
		out[r.HostID] = append(out[r.HostID], p)
	}
	return out, nil
}

// ---------- 业务 ----------

// BusinessSummary 业务概要。
type BusinessSummary struct {
	BusinessID uint64   `json:"business_id"`
	Name       string   `json:"name"`
	Identifier string   `json:"identifier,omitempty"`
	Lifecycle  string   `json:"lifecycle,omitempty"`
	HostCount  int64    `json:"host_count"`
	Contacts   []string `json:"contacts,omitempty" gorm:"-" jsonschema:"业务人员，格式为 角色: 联系方式"`
}

// SearchBusinesses 按名称或英文标识模糊查业务；keyword 为空时列出全部。
func (q *Query) SearchBusinesses(ctx context.Context, keyword string, limit int) ([]BusinessSummary, error) {
	tx := q.db.WithContext(ctx).Table("businesses b").
		Select(`b.id AS business_id, b.name, b.identifier, b.lifecycle,
			(SELECT COUNT(DISTINCT m.host_id) FROM host_node_memberships m WHERE m.business_id = b.id) AS host_count`).
		Where("b.deleted_at IS NULL")
	if kw := strings.TrimSpace(keyword); kw != "" {
		like := "%" + kw + "%"
		tx = tx.Where("b.name LIKE ? OR b.identifier LIKE ?", like, like)
	}
	var out []BusinessSummary
	if err := tx.Order("b.id").Limit(limit).Scan(&out).Error; err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return out, nil
	}
	ids := make([]uint64, len(out))
	for i, b := range out {
		ids[i] = b.BusinessID
	}
	var people []struct {
		BusinessID uint64
		Role       string
		Identity   string
	}
	if err := q.db.WithContext(ctx).Table("business_personnel").Select("business_id, role, identity").
		Where("business_id IN ?", ids).Order("business_id, role, identity").Scan(&people).Error; err != nil {
		return nil, err
	}
	contacts := map[uint64][]string{}
	for _, p := range people {
		contacts[p.BusinessID] = append(contacts[p.BusinessID], p.Role+": "+p.Identity)
	}
	for i := range out {
		out[i].Contacts = contacts[out[i].BusinessID]
	}
	return out, nil
}

// TopologyModule 拓扑中的模块。
type TopologyModule struct {
	ModuleID    uint64 `json:"module_id"`
	Name        string `json:"name"`
	ServiceType string `json:"service_type,omitempty"`
	HostCount   int64  `json:"host_count"`
}

// TopologySet 拓扑中的集群。
type TopologySet struct {
	SetID      uint64           `json:"set_id"`
	Name       string           `json:"name"`
	EnvType    string           `json:"env_type,omitempty"`
	IsIdlePool bool             `json:"is_idle_pool" jsonschema:"是否为内置的空闲机池（含 空闲机/故障机/待回收 三个模块）"`
	Modules    []TopologyModule `json:"modules"`
}

// BusinessTopology 业务拓扑：业务 → 集群 → 模块（含主机数）。
type BusinessTopology struct {
	BusinessID uint64        `json:"business_id"`
	Name       string        `json:"name"`
	Sets       []TopologySet `json:"sets"`
}

// GetBusinessTopology 返回业务的集群/模块树及各模块主机数。
func (q *Query) GetBusinessTopology(ctx context.Context, businessID uint64) (*BusinessTopology, error) {
	var biz struct {
		ID   uint64
		Name string
	}
	if err := q.db.WithContext(ctx).Table("businesses").Select("id, name").
		Where("id = ? AND deleted_at IS NULL", businessID).Take(&biz).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("业务 %d %w", businessID, ErrNotFound)
		}
		return nil, err
	}
	var sets []struct {
		ID        uint64
		Name      string
		EnvType   string
		IsDefault bool
	}
	if err := q.db.WithContext(ctx).Table("sets").Select("id, name, env_type, is_default").
		Where("business_id = ? AND deleted_at IS NULL", businessID).Order("sort_order, id").Scan(&sets).Error; err != nil {
		return nil, err
	}
	var modules []struct {
		ID          uint64
		SetID       uint64
		Name        string
		ServiceType string
		HostCount   int64
	}
	if err := q.db.WithContext(ctx).Table("modules mo").
		Select(`mo.id, mo.set_id, mo.name, mo.service_type,
			(SELECT COUNT(*) FROM host_node_memberships m WHERE m.node_kind = ? AND m.node_id = mo.id) AS host_count`, types.NodeKindBizModule).
		Where("mo.business_id = ? AND mo.deleted_at IS NULL", businessID).Order("mo.sort_order, mo.id").Scan(&modules).Error; err != nil {
		return nil, err
	}
	out := &BusinessTopology{BusinessID: biz.ID, Name: biz.Name}
	index := map[uint64]int{}
	for _, s := range sets {
		index[s.ID] = len(out.Sets)
		out.Sets = append(out.Sets, TopologySet{SetID: s.ID, Name: s.Name, EnvType: s.EnvType, IsIdlePool: s.IsDefault, Modules: []TopologyModule{}})
	}
	for _, m := range modules {
		if i, ok := index[m.SetID]; ok {
			out.Sets[i].Modules = append(out.Sets[i].Modules, TopologyModule{ModuleID: m.ID, Name: m.Name, ServiceType: m.ServiceType, HostCount: m.HostCount})
		}
	}
	return out, nil
}

// ---------- 主机 ----------

// HostFilter 主机搜索条件（均为可选，组合为 AND）。
type HostFilter struct {
	Keyword     string
	BusinessID  uint64
	ModuleID    uint64
	Location    string // pool | business
	DirectoryID uint64
	OSType      string
	Status      string
	MinCPU      int
	MinMemoryMB int
	Limit       int
}

// HostSummary 主机概要。
type HostSummary struct {
	HostID     int64    `json:"host_id" jsonschema:"主机展示 ID，其他主机工具用它定位主机"`
	IP         string   `json:"ip"`
	HostName   string   `json:"host_name"`
	CPU        *int     `json:"cpu,omitempty"`
	MemoryMB   *int     `json:"memory_mb,omitempty"`
	DiskGB     *int     `json:"disk_gb,omitempty"`
	OSType     *string  `json:"os_type,omitempty"`
	OSVersion  *string  `json:"os_version,omitempty"`
	Status     string   `json:"status"`
	Placements []string `json:"placements" jsonschema:"当前归属，业务 / 集群 / 模块 或 资源池 / 目录；可能多处"`
}

type hostRow struct {
	ID          uuid.UUID
	DisplayID   int64
	HostName    string
	PrimaryIP   string
	CPU         *int
	Memory      *int
	DiskSize    *int
	OSType      *string
	OSVersion   *string
	Status      string
	CloudVendor *string
	CloudRegion *string
	AreaName    *string
	Custom      *string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

func (q *Query) hostColumns() string {
	return fmt.Sprintf(`h.id, h.display_id, h.host_name, %s AS primary_ip, h.cpu, h.memory, h.disk_size,
		h.os_type, h.os_version, h.status, h.cloud_vendor, h.cloud_region, ca.name AS area_name,
		%s AS custom, h.created_at, h.updated_at`, q.ipExpr(), q.customFieldsText())
}

// SearchHosts 按条件搜主机，返回总数与前 Limit 条。
func (q *Query) SearchHosts(ctx context.Context, f HostFilter) (int64, []HostSummary, error) {
	tx := q.db.WithContext(ctx).Table("hosts h").
		Joins("LEFT JOIN cloud_areas ca ON ca.id = h.cloud_area_id").
		Where("h.deleted_at IS NULL")
	if kw := strings.TrimSpace(f.Keyword); kw != "" {
		like := "%" + kw + "%"
		tx = tx.Where(fmt.Sprintf("(%s LIKE ? OR h.host_name LIKE ? OR %s LIKE ?)", q.ipExpr(), q.customFieldsText()), like, like, like)
	}
	member := func(cond string, args ...any) {
		tx = tx.Where("EXISTS (SELECT 1 FROM host_node_memberships m WHERE m.host_id = h.id AND "+cond+")", args...)
	}
	if f.BusinessID != 0 {
		member("m.business_id = ?", f.BusinessID)
	}
	if f.ModuleID != 0 {
		member("m.node_kind = ? AND m.node_id = ?", types.NodeKindBizModule, f.ModuleID)
	}
	if f.DirectoryID != 0 {
		member("m.node_kind = ? AND m.node_id = ?", types.NodeKindPoolDirectory, f.DirectoryID)
	}
	switch f.Location {
	case "pool":
		member("m.node_kind = ?", types.NodeKindPoolDirectory)
	case "business":
		member("m.node_kind = ?", types.NodeKindBizModule)
	}
	if f.OSType != "" {
		tx = tx.Where("h.os_type = ?", f.OSType)
	}
	if f.Status != "" {
		tx = tx.Where("h.status = ?", f.Status)
	}
	if f.MinCPU > 0 {
		tx = tx.Where("h.cpu >= ?", f.MinCPU)
	}
	if f.MinMemoryMB > 0 {
		tx = tx.Where("h.memory >= ?", f.MinMemoryMB)
	}

	var total int64
	if err := tx.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return 0, nil, err
	}
	var rows []hostRow
	if err := tx.Select(q.hostColumns()).Order("h.display_id").Limit(f.Limit).Scan(&rows).Error; err != nil {
		return 0, nil, err
	}
	ids := make([]uuid.UUID, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	places, err := q.placements(ctx, ids)
	if err != nil {
		return 0, nil, err
	}
	out := make([]HostSummary, len(rows))
	for i, r := range rows {
		out[i] = summarize(r, places[r.ID])
	}
	return total, out, nil
}

func summarize(r hostRow, places []Placement) HostSummary {
	s := HostSummary{HostID: r.DisplayID, IP: r.PrimaryIP, HostName: r.HostName, CPU: r.CPU, MemoryMB: r.Memory,
		DiskGB: r.DiskSize, OSType: r.OSType, OSVersion: r.OSVersion, Status: r.Status, Placements: []string{}}
	for _, p := range places {
		s.Placements = append(s.Placements, p.String())
	}
	return s
}

// HostDetail 主机详情。
type HostDetail struct {
	HostSummary
	UUID         string         `json:"uuid"`
	CloudVendor  string         `json:"cloud_vendor,omitempty"`
	CloudArea    string         `json:"cloud_area,omitempty" jsonschema:"管控区域"`
	CloudRegion  string         `json:"cloud_region,omitempty"`
	CustomFields map[string]any `json:"custom_fields,omitempty" jsonschema:"自定义字段，如 固资编号、环境、责任团队、标签、SLA、备份"`
	Locations    []Placement    `json:"locations" jsonschema:"当前归属明细（带 ID）"`
	CreatedAt    string         `json:"created_at"`
	UpdatedAt    string         `json:"updated_at"`
}

// GetHost 按主机展示 ID 或 IP 取详情。IP 在多个管控区域重复时返回错误并列出候选。
func (q *Query) GetHost(ctx context.Context, hostID int64, ip string) (*HostDetail, error) {
	tx := q.db.WithContext(ctx).Table("hosts h").
		Joins("LEFT JOIN cloud_areas ca ON ca.id = h.cloud_area_id").
		Where("h.deleted_at IS NULL").Select(q.hostColumns())
	switch {
	case hostID != 0:
		tx = tx.Where("h.display_id = ?", hostID)
	case strings.TrimSpace(ip) != "":
		tx = tx.Where(q.ipExpr()+" = ?", strings.TrimSpace(ip))
	default:
		return nil, errors.New("需要 host_id 或 ip 其中之一")
	}
	var rows []hostRow
	if err := tx.Limit(5).Scan(&rows).Error; err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("主机 %w（host_id=%d ip=%q）", ErrNotFound, hostID, ip)
	}
	if len(rows) > 1 {
		cands := make([]string, len(rows))
		for i, r := range rows {
			cands[i] = fmt.Sprintf("host_id=%d %s(%s, 管控区域 %s)", r.DisplayID, r.PrimaryIP, r.HostName, deref(r.AreaName))
		}
		return nil, fmt.Errorf("IP %s 对应多台主机，请用 host_id 指定：%s", ip, strings.Join(cands, "；"))
	}
	r := rows[0]
	places, err := q.placements(ctx, []uuid.UUID{r.ID})
	if err != nil {
		return nil, err
	}
	d := &HostDetail{
		HostSummary: summarize(r, places[r.ID]),
		UUID:        r.ID.String(), CloudVendor: deref(r.CloudVendor), CloudArea: deref(r.AreaName), CloudRegion: deref(r.CloudRegion),
		Locations: places[r.ID], CreatedAt: fmtTime(r.CreatedAt), UpdatedAt: fmtTime(r.UpdatedAt),
	}
	if d.Locations == nil {
		d.Locations = []Placement{}
	}
	if r.Custom != nil && *r.Custom != "" {
		_ = json.Unmarshal([]byte(*r.Custom), &d.CustomFields)
	}
	return d, nil
}

// ---------- 变更历史 ----------

// FieldChange 单个字段的变更。
type FieldChange struct {
	Field  string `json:"field"`
	Before any    `json:"before"`
	After  any    `json:"after"`
}

// ChangeEntry 一条主机变更记录（来自审计 resource_histories）。
type ChangeEntry struct {
	RecordID uint64        `json:"record_id" jsonschema:"审计记录 ID，结论中引用它作为依据"`
	Time     string        `json:"time" jsonschema:"变更时间（北京时间）"`
	Operator string        `json:"operator"`
	HostID   uint64        `json:"host_id"`
	Host     string        `json:"host" jsonschema:"主机 IP（主机名）"`
	Action   string        `json:"action" jsonschema:"create（录入）/ config_change（配置变更）/ placement_change（归属变更）/ delete"`
	Source   string        `json:"source,omitempty" jsonschema:"归属变更的类型，如 分配、转移、回收"`
	From     string        `json:"from,omitempty" jsonschema:"变更前归属"`
	To       string        `json:"to,omitempty" jsonschema:"变更后归属"`
	Changes  []FieldChange `json:"changes,omitempty"`
	Note     string        `json:"note,omitempty"`
}

var sourceLabels = map[string]string{
	types.HostMembershipSourceImport:   "导入资源池",
	types.HostMembershipSourceAllocate: "分配到业务",
	types.HostMembershipSourceTransfer: "转移",
	types.HostMembershipSourceReclaim:  "回收到资源池",
	types.HostMembershipSourceRecycle:  "转入待回收",
	types.HostMembershipSourceBackfill: "历史数据回填",
}

// 快照里用于定位/搜索的上下文字段，不算作配置变更。
var contextKeys = map[string]bool{"business_id": true, "business_name": true, "source": true,
	"module_id": true, "module_ids": true, "module_names": true, "directory_id": true}

type historyRow struct {
	ID           uint64
	ResourceID   uint64
	ChangeType   string
	BeforeData   *string
	AfterData    *string
	ChangedBy    string
	ChangedAt    time.Time
	ResourceName string
}

// ChangeFilter 主机变更查询条件。
type ChangeFilter struct {
	HostID     int64
	BusinessID uint64
	Operator   string
	Since      *time.Time
	Until      *time.Time
	Action     string // config_change | placement_change | create | delete
	Keyword    string // 匹配变更前后归属（模块名/目录名）或变更字段
	Limit      int
}

// scanLimit 在库里先按时间/操作人/主机收窄，再在内存里做快照字段级过滤的扫描上限。
const scanLimit = 5000

// QueryChanges 按条件查主机变更，按时间倒序返回前 Limit 条，并返回命中总数。
func (q *Query) QueryChanges(ctx context.Context, f ChangeFilter) (int, []ChangeEntry, error) {
	tx := q.db.WithContext(ctx).Table("resource_histories").
		Select("id, resource_id, change_type, before_data, after_data, changed_by, changed_at, resource_name").
		Where("model_uid = ?", "host")
	if f.HostID != 0 {
		tx = tx.Where("resource_id = ?", f.HostID)
	}
	if f.Operator != "" {
		tx = tx.Where("changed_by = ?", f.Operator)
	}
	if f.Since != nil {
		tx = tx.Where("changed_at >= ?", *f.Since)
	}
	if f.Until != nil {
		tx = tx.Where("changed_at <= ?", *f.Until)
	}
	var rows []historyRow
	if err := tx.Order("changed_at DESC, id DESC").Limit(scanLimit).Scan(&rows).Error; err != nil {
		return 0, nil, err
	}
	names, err := q.nameLookups(ctx)
	if err != nil {
		return 0, nil, err
	}
	hostNames, err := q.hostNamesByDisplayID(ctx, rows)
	if err != nil {
		return 0, nil, err
	}

	bizFilter := ""
	if f.BusinessID != 0 {
		bizFilter = fmt.Sprint(f.BusinessID)
	}
	matched := 0
	out := []ChangeEntry{}
	for _, r := range rows {
		before, after := decode(r.BeforeData), decode(r.AfterData)
		if bizFilter != "" && fmt.Sprint(before["business_id"]) != bizFilter && fmt.Sprint(after["business_id"]) != bizFilter {
			continue
		}
		e := buildEntry(r, before, after, names, hostNames)
		if f.Action != "" && e.Action != f.Action {
			continue
		}
		if kw := strings.TrimSpace(f.Keyword); kw != "" && !entryMentions(e, kw) {
			continue
		}
		matched++
		if len(out) < f.Limit {
			out = append(out, e)
		}
	}
	return matched, out, nil
}

func entryMentions(e ChangeEntry, kw string) bool {
	if strings.Contains(e.From, kw) || strings.Contains(e.To, kw) || strings.Contains(e.Source, kw) || strings.Contains(e.Note, kw) {
		return true
	}
	for _, c := range e.Changes {
		if strings.Contains(c.Field, kw) || strings.Contains(fmt.Sprint(c.Before), kw) || strings.Contains(fmt.Sprint(c.After), kw) {
			return true
		}
	}
	return false
}

type lookups struct {
	modules     map[uint64]string // module id -> 业务 / 集群 / 模块（当前名称，旧审计无快照时兜底）
	directories map[uint64]string
}

func (q *Query) nameLookups(ctx context.Context) (lookups, error) {
	l := lookups{modules: map[uint64]string{}, directories: map[uint64]string{}}
	var mods []struct {
		ID      uint64
		Module  string
		SetName *string
		BizName *string
	}
	if err := q.db.WithContext(ctx).Table("modules mo").Select("mo.id, mo.name AS module, s.name AS set_name, b.name AS biz_name").
		Joins("LEFT JOIN sets s ON s.id = mo.set_id").Joins("LEFT JOIN businesses b ON b.id = mo.business_id").
		Scan(&mods).Error; err != nil {
		return l, err
	}
	for _, m := range mods {
		l.modules[m.ID] = strings.Join([]string{deref(m.BizName), deref(m.SetName), m.Module}, " / ")
	}
	var dirs []struct {
		ID   uint64
		Name string
	}
	if err := q.db.WithContext(ctx).Table("resource_directories").Select("id, name").Scan(&dirs).Error; err != nil {
		return l, err
	}
	for _, d := range dirs {
		l.directories[d.ID] = d.Name
	}
	return l, nil
}

func (q *Query) hostNamesByDisplayID(ctx context.Context, rows []historyRow) (map[uint64]string, error) {
	ids := map[uint64]bool{}
	for _, r := range rows {
		ids[r.ResourceID] = true
	}
	out := map[uint64]string{}
	if len(ids) == 0 {
		return out, nil
	}
	list := make([]uint64, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	var hosts []struct {
		DisplayID uint64
		PrimaryIP string
		HostName  string
	}
	if err := q.db.WithContext(ctx).Table("hosts h").Select("h.display_id, "+q.ipExpr()+" AS primary_ip, h.host_name").
		Where("h.display_id IN ?", list).Scan(&hosts).Error; err != nil {
		return nil, err
	}
	for _, h := range hosts {
		out[h.DisplayID] = fmt.Sprintf("%s（%s）", h.PrimaryIP, h.HostName)
	}
	return out, nil
}

func buildEntry(r historyRow, before, after map[string]any, names lookups, hostNames map[uint64]string) ChangeEntry {
	e := ChangeEntry{RecordID: r.ID, Time: fmtTime(r.ChangedAt), Operator: r.ChangedBy, HostID: r.ResourceID, Host: hostNames[r.ResourceID]}
	if e.Host == "" {
		e.Host = r.ResourceName
	}
	switch {
	case r.ChangeType == "create":
		e.Action = "create"
		e.Note = configSummary(after)
	case r.ChangeType == "delete":
		e.Action = "delete"
		e.Note = configSummary(before)
	case after["source"] != nil:
		e.Action = "placement_change"
		src := fmt.Sprint(after["source"])
		e.Source = sourceLabels[src]
		if e.Source == "" {
			e.Source = src
		}
		e.From = describePlacement(before, names)
		e.To = describePlacement(after, names)
		if before == nil {
			e.Note = "该记录未保存变更前归属（早于归属快照上线的旧审计）"
		}
	default:
		e.Action = "config_change"
		e.Changes = diff(before, after)
	}
	return e
}

func describePlacement(snap map[string]any, names lookups) string {
	if snap == nil {
		return ""
	}
	if mods, ok := snap["module_names"].([]any); ok && len(mods) > 0 {
		parts := make([]string, len(mods))
		for i, m := range mods {
			parts[i] = fmt.Sprint(m)
		}
		biz, _ := snap["business_name"].(string)
		return strings.TrimPrefix(biz+" / "+strings.Join(parts, "、"), " / ")
	}
	if id, ok := number(snap["module_id"]); ok {
		if n := names.modules[id]; n != "" {
			return n + "（按当前名称）"
		}
		return fmt.Sprintf("模块 #%d", id)
	}
	if id, ok := number(snap["directory_id"]); ok {
		if n := names.directories[id]; n != "" {
			return "资源池 / " + n
		}
		return fmt.Sprintf("资源池目录 #%d", id)
	}
	return "无归属"
}

func diff(before, after map[string]any) []FieldChange {
	keys := map[string]bool{}
	for k := range before {
		keys[k] = true
	}
	for k := range after {
		keys[k] = true
	}
	sorted := make([]string, 0, len(keys))
	for k := range keys {
		if !contextKeys[k] {
			sorted = append(sorted, k)
		}
	}
	sort.Strings(sorted)
	var out []FieldChange
	for _, k := range sorted {
		b, a := before[k], after[k]
		if !reflect.DeepEqual(b, a) {
			out = append(out, FieldChange{Field: k, Before: b, After: a})
		}
	}
	return out
}

func configSummary(snap map[string]any) string {
	if snap == nil {
		return ""
	}
	parts := []string{}
	if v, ok := snap["cpu"]; ok {
		parts = append(parts, fmt.Sprintf("%v 核", v))
	}
	if v, ok := number(snap["memory"]); ok {
		parts = append(parts, fmt.Sprintf("%d MB 内存", v))
	}
	if v, ok := snap["disk_size"]; ok {
		parts = append(parts, fmt.Sprintf("%v GB 磁盘", v))
	}
	for _, k := range []string{"os_version", "status"} {
		if v, ok := snap[k]; ok {
			parts = append(parts, fmt.Sprint(v))
		}
	}
	return strings.Join(parts, "，")
}

// ---------- 资源池 ----------

// PoolDirectory 资源池目录。
type PoolDirectory struct {
	DirectoryID  uint64 `json:"directory_id"`
	Name         string `json:"name"`
	Path         string `json:"path"`
	IsDefault    bool   `json:"is_default"`
	HostCount    int64  `json:"host_count"`
	RunningCount int64  `json:"running_count"`
}

// ListPoolDirectories 列出资源池目录及主机数。
func (q *Query) ListPoolDirectories(ctx context.Context) ([]PoolDirectory, error) {
	var out []PoolDirectory
	err := q.db.WithContext(ctx).Table("resource_directories d").
		Select(`d.id AS directory_id, d.name, d.path, d.is_default,
			COUNT(h.id) AS host_count,
			COUNT(CASE WHEN h.status = 'running' THEN 1 END) AS running_count`).
		Joins("LEFT JOIN host_node_memberships m ON m.node_kind = ? AND m.node_id = d.id", types.NodeKindPoolDirectory).
		Joins("LEFT JOIN hosts h ON h.id = m.host_id AND h.deleted_at IS NULL").
		Where("d.deleted_at IS NULL").
		Group("d.id, d.name, d.path, d.is_default, d.sort_order").
		Order("d.sort_order, d.id").Scan(&out).Error
	return out, err
}

// ---------- helpers ----------

func decode(raw *string) map[string]any {
	if raw == nil || *raw == "" || *raw == "null" {
		return nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(*raw), &m); err != nil {
		return nil
	}
	return m
}

func number(v any) (uint64, bool) {
	switch n := v.(type) {
	case float64:
		return uint64(n), n > 0
	case string:
		var u uint64
		_, err := fmt.Sscanf(n, "%d", &u)
		return u, err == nil && u > 0
	}
	return 0, false
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func derefU(u *uint64) uint64 {
	if u == nil {
		return 0
	}
	return *u
}
