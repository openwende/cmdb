package types

import (
	"time"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// DynamicModel 模型定义表 - 定义资源类型（如 Host, Switch）
// 替代传统的为每种资源创建独立表的方式，通过元数据驱动实现动态模型
type DynamicModel struct {
	ID           uint64         `gorm:"primaryKey" json:"id"`
	UID          string         `gorm:"uniqueIndex;size:50;not null;comment:模型唯一标识，如 host, switch" json:"uid"`
	Name         string         `gorm:"size:100;not null;comment:显示名称，如 主机, 交换机" json:"name"`
	IsPaused     bool           `gorm:"default:false;comment:是否停用" json:"is_paused"`
	Description  string         `gorm:"size:500;comment:模型描述" json:"description"`
	Icon         string         `gorm:"size:50;comment:图标标识" json:"icon"`
	UniqueFields datatypes.JSON `gorm:"type:jsonb;comment:唯一键配置，存储需要建立唯一约束的字段列表" json:"unique_fields"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
}

// UniqueFieldConfig 唯一键配置结构
// 用于定义模型实例的唯一性约束
type UniqueFieldConfig struct {
	Fields []string `json:"fields"` // 唯一字段列表，如 ["cloud_id", "inner_ip"]
	Name   string   `json:"name"`   // 索引名称，如 idx_unique_host
}

// DynamicAttribute 属性定义表 - 定义模型字段的元数据
// 通过 Category 字段实现冷热数据分离：config（低频）存主表，state（高频）存侧车表
type DynamicAttribute struct {
	ID          uint64         `gorm:"primaryKey" json:"id"`
	ModelUID    string         `gorm:"index:idx_model_field;size:50;not null;comment:关联模型 UID" json:"model_uid"`
	FieldUID    string         `gorm:"index:idx_model_field;size:50;not null;comment:字段英文名，如 cpu_usage" json:"field_uid"`
	FieldName   string         `gorm:"size:100;not null;comment:字段显示名称" json:"field_name"`
	FieldType   string         `gorm:"size:20;not null;comment:字段类型：string, int, float, bool, enum, date" json:"field_type"`
	Category    string         `gorm:"size:20;not null;comment:字段分类：config(静态配置) 或 state(动态状态)" json:"category"`
	IsRequired  bool           `gorm:"default:false;comment:是否必填" json:"is_required"`
	IsUnique    bool           `gorm:"default:false;comment:是否单字段唯一" json:"is_unique"`
	UniqueGroup string         `gorm:"size:50;comment:组合唯一分组，相同分组的字段组合唯一" json:"unique_group"`
	IsReadOnly  bool           `gorm:"default:false;comment:是否只读" json:"is_read_only"`
	DefaultValue string        `gorm:"size:500;comment:默认值" json:"default_value"`
	Placeholder  string        `gorm:"size:200;comment:输入提示" json:"placeholder"`
	Unit         string        `gorm:"size:20;comment:单位，如 GB, 核" json:"unit"`
	Validators  datatypes.JSON `gorm:"type:jsonb;comment:校验规则（JSONB）" json:"validators"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
}

// FieldValidators 字段校验规则
type FieldValidators struct {
	// 数值类型校验
	Min *float64 `json:"min,omitempty"` // 最小值
	Max *float64 `json:"max,omitempty"` // 最大值

	// 字符串类型校验
	MinLength *int    `json:"min_length,omitempty"` // 最小长度
	MaxLength *int    `json:"max_length,omitempty"` // 最大长度
	Pattern   *string `json:"pattern,omitempty"`    // 正则表达式

	// 枚举类型校验
	EnumValues []string `json:"enum_values,omitempty"` // 枚举值列表

	// 自定义错误消息
	ErrorMessage string `json:"error_message,omitempty"` // 校验失败时的提示信息
}

// Resource 资源主表 - 存储低频配置数据（Cold Data）
// 采用 EAV 模式升级版：用 JSONB 存储动态字段，用生成列加速高频查询
type Resource struct {
	ID        uint64         `gorm:"primaryKey" json:"id"`
	ModelUID  string         `gorm:"index:idx_model;size:50;not null;comment:关联模型 UID" json:"model_uid"`
	Name      string         `gorm:"index;size:200;not null;comment:资源名称" json:"name"`
	Configs   datatypes.JSON `gorm:"type:jsonb;not null;comment:配置数据（JSONB），存储所有 category=config 的字段" json:"configs"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index;comment:软删除时间" json:"deleted_at,omitempty"`

	// 生成列（Generated Columns）- 从 JSONB 中提取高频查询字段
	// 注意：这些字段由数据库自动维护，应用层不应直接赋值
	CloudID int64  `gorm:"type:bigint;comment:云区域 ID（生成列）" json:"cloud_id,omitempty"`
	InnerIP string `gorm:"type:varchar(50);comment:内网 IP（生成列）" json:"inner_ip,omitempty"`

	// 关联关系（仅用于查询，不在数据库中存储）
	State *ResourceState `gorm:"foreignKey:ResourceID" json:"state,omitempty"`
}

// TableName 自定义表名
func (Resource) TableName() string {
	return "resources"
}

// ResourceState 资源状态侧车表 - 存储高频状态数据（Hot Data）
// 1:1 关联 resources 表，采用相同主键策略（避免 JOIN 开销）
type ResourceState struct {
	ResourceID    uint64         `gorm:"primaryKey;comment:关联 resources.id，1:1 关系" json:"resource_id"`
	LastCheckTime time.Time      `gorm:"comment:最后检查时间" json:"last_check_time"`
	HealthStatus  int            `gorm:"default:0;comment:健康状态：0=OK, 1=Warn, 2=Error" json:"health_status"`
	Metrics       datatypes.JSON `gorm:"type:jsonb;comment:监控指标（JSONB），存储所有 category=state 的字段" json:"metrics"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

// TableName 自定义表名
func (ResourceState) TableName() string {
	return "resource_states"
}

// AssociationType 关联类型定义表（参考蓝鲸 CMDB 设计）
// 支持预定义 + 自定义的混合模式
type AssociationType struct {
	ID               uint64    `gorm:"primaryKey" json:"id"`
	UID              string    `gorm:"uniqueIndex;size:50;not null;comment:关联类型标识，如 runs_on, connects_to" json:"uid"`
	Name             string    `gorm:"size:100;not null;comment:显示名称，如 运行于, 连接到" json:"name"`
	SourceToDestDesc string    `gorm:"size:100;comment:源到目标的描述，如 运行于" json:"source_to_dest_desc"`
	DestToSourceDesc string    `gorm:"size:100;comment:目标到源的描述，如 运行" json:"dest_to_source_desc"`
	IsBuiltin        bool      `gorm:"default:false;comment:是否内置（内置类型不允许删除）" json:"is_builtin"`
	Description      string    `gorm:"size:500;comment:关联类型描述" json:"description"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// TableName 自定义表名
func (AssociationType) TableName() string {
	return "association_types"
}

// 预定义的关联类型常量
const (
	AssocRunsOn      = "runs_on"       // 运行于（如 虚拟机运行在物理机）
	AssocDeployedOn  = "deployed_on"   // 部署于（如 应用部署在虚拟机）
	AssocConnectsTo  = "connects_to"   // 连接到（如 主机连接到交换机）
	AssocBelongsTo   = "belongs_to"    // 属于（如 网卡属于主机）
	AssocDependsOn   = "depends_on"    // 依赖于（如 服务依赖另一个服务）
	AssocComposedOf  = "composed_of"   // 组成（如 集群由节点组成）
)

// BuiltinAssociationTypes 预定义的关联类型
var BuiltinAssociationTypes = []AssociationType{
	{
		UID:              AssocRunsOn,
		Name:             "运行于",
		SourceToDestDesc: "运行于",
		DestToSourceDesc: "运行",
		IsBuiltin:        true,
		Description:      "表示虚拟化关系，如虚拟机运行在物理机上",
	},
	{
		UID:              AssocDeployedOn,
		Name:             "部署于",
		SourceToDestDesc: "部署于",
		DestToSourceDesc: "部署",
		IsBuiltin:        true,
		Description:      "表示软件部署关系，如应用部署在服务器上",
	},
	{
		UID:              AssocConnectsTo,
		Name:             "连接到",
		SourceToDestDesc: "连接到",
		DestToSourceDesc: "被连接",
		IsBuiltin:        true,
		Description:      "表示网络连接关系，如主机连接到交换机",
	},
	{
		UID:              AssocBelongsTo,
		Name:             "属于",
		SourceToDestDesc: "属于",
		DestToSourceDesc: "包含",
		IsBuiltin:        true,
		Description:      "表示所属关系，如网卡属于主机",
	},
	{
		UID:              AssocDependsOn,
		Name:             "依赖于",
		SourceToDestDesc: "依赖于",
		DestToSourceDesc: "被依赖",
		IsBuiltin:        true,
		Description:      "表示依赖关系，如服务依赖数据库",
	},
	{
		UID:              AssocComposedOf,
		Name:             "组成",
		SourceToDestDesc: "由...组成",
		DestToSourceDesc: "组成",
		IsBuiltin:        true,
		Description:      "表示组合关系，如集群由多个节点组成",
	},
}

// DynamicModelAssociation 模型关联定义表
// 定义哪两个模型之间可以使用哪种关联类型，以及约束规则
type DynamicModelAssociation struct {
	ID              uint64    `gorm:"primaryKey" json:"id"`
	SourceModelUID  string    `gorm:"index:idx_model_assoc;size:50;not null;comment:源模型 UID" json:"source_model_uid"`
	TargetModelUID  string    `gorm:"index:idx_model_assoc;size:50;not null;comment:目标模型 UID" json:"target_model_uid"`
	AssociationUID  string    `gorm:"index:idx_model_assoc;size:50;not null;comment:关联类型 UID" json:"association_uid"`
	Mapping         string    `gorm:"size:10;not null;comment:映射关系：1:1, 1:N, N:N" json:"mapping"`
	OnDelete        string    `gorm:"size:20;default:restrict;comment:删除行为：cascade, restrict, set_null" json:"on_delete"`
	Description     string    `gorm:"size:500;comment:关联描述" json:"description"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// TableName 自定义表名
func (DynamicModelAssociation) TableName() string {
	return "model_associations"
}

// Relation 实例关联表 - 存储具体资源之间的关联关系
type Relation struct {
	ID             uint64         `gorm:"primaryKey" json:"id"`
	SourceID       uint64         `gorm:"index:idx_source;not null;comment:源资源 ID" json:"source_id"`
	TargetID       uint64         `gorm:"index:idx_target;not null;comment:目标资源 ID" json:"target_id"`
	AssociationUID string         `gorm:"index;size:50;not null;comment:关联类型 UID" json:"association_uid"`
	SourceModelUID string         `gorm:"size:50;comment:源模型 UID（冗余字段，加速查询）" json:"source_model_uid"`
	TargetModelUID string         `gorm:"size:50;comment:目标模型 UID（冗余字段，加速查询）" json:"target_model_uid"`
	Properties     datatypes.JSON `gorm:"type:jsonb;comment:关联属性，如带宽、端口号等" json:"properties,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

// TableName 自定义表名
func (Relation) TableName() string {
	return "relations"
}

// ResourceHistory 资源变更历史表 - 审计日志
// 记录配置变更历史，支持合规审计和回溯
type ResourceHistory struct {
	ID         uint64         `gorm:"primaryKey" json:"id"`
	ResourceID uint64         `gorm:"index:idx_resource_time;not null;comment:资源 ID" json:"resource_id"`
	ModelUID   string         `gorm:"index;size:50;not null;comment:模型 UID" json:"model_uid"`
	ChangeType string         `gorm:"size:20;not null;comment:变更类型：create, update, delete" json:"change_type"`
	BeforeData datatypes.JSON `gorm:"type:jsonb;comment:变更前的数据（完整 configs）" json:"before_data,omitempty"`
	AfterData  datatypes.JSON `gorm:"type:jsonb;comment:变更后的数据（完整 configs）" json:"after_data,omitempty"`
	ChangedBy  string         `gorm:"size:100;comment:操作用户 ID" json:"changed_by"`
	ChangedAt  time.Time      `gorm:"index:idx_resource_time;not null;comment:变更时间" json:"changed_at"`
	ClientIP   string         `gorm:"size:50;comment:客户端 IP" json:"client_ip"`
	UserAgent  string         `gorm:"size:500;comment:用户代理" json:"user_agent"`
}

// TableName 自定义表名
func (ResourceHistory) TableName() string {
	return "resource_histories"
}

// TopologyNode 拓扑查询结果节点
type TopologyNode struct {
	ResourceID     uint64            `json:"resource_id"`
	ModelUID       string            `json:"model_uid"`
	Name           string            `json:"name"`
	AssociationUID string            `json:"association_uid,omitempty"`
	Depth          int               `json:"depth"`
	Path           string            `json:"path"`           // 路径，如 "1.5.10"
	Properties     map[string]interface{} `json:"properties,omitempty"` // 关联属性
}
