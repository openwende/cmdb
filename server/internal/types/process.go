package types

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// ========== 进程模板 ==========

// ProcessTemplate 进程模板定义
// 定义进程的启动命令、端口、运行用户等配置
type ProcessTemplate struct {
	ID                uint64         `gorm:"primaryKey" json:"id"`
	Name              string         `gorm:"size:200;not null;comment:进程名称" json:"name"`
	BusinessID        uint64      `gorm:"index;not null;comment:所属业务ID" json:"business_id"`
	ServiceTemplateID *uint64        `gorm:"index;comment:所属服务模板ID，NULL表示独立进程模板" json:"service_template_id,omitempty"`
	StartCommand      string         `gorm:"size:500;comment:启动命令" json:"start_command"`
	StopCommand       string         `gorm:"size:500;comment:停止命令" json:"stop_command"`
	RestartCommand    string         `gorm:"size:500;comment:重启命令" json:"restart_command"`
	ReloadCommand     string         `gorm:"size:500;comment:重载命令" json:"reload_command"`
	FaceStopCommand   string         `gorm:"size:500;comment:强制停止命令" json:"face_stop_command"`
	WorkPath          string         `gorm:"size:500;comment:工作目录" json:"work_path"`
	PidFile           string         `gorm:"size:500;comment:PID文件路径" json:"pid_file"`
	User              string         `gorm:"size:100;comment:运行用户" json:"user"`
	ProcNum           int            `gorm:"default:1;comment:进程数量" json:"proc_num"`
	StartParamRegex   string         `gorm:"size:500;comment:启动参数匹配正则" json:"start_param_regex"`
	Priority          int            `gorm:"default:0;comment:启动优先级，数字越小优先级越高" json:"priority"`
	Timeout           int            `gorm:"default:60;comment:超时时间（秒）" json:"timeout"`
	AutoStart         bool           `gorm:"default:true;comment:是否自动启动" json:"auto_start"`
	AutoRecover       bool           `gorm:"default:true;comment:是否自动恢复" json:"auto_recover"`
	BindInfo          datatypes.JSON `gorm:"type:jsonb;comment:绑定信息（IP和端口列表）" json:"bind_info"`
	Description       string         `gorm:"size:500;comment:描述" json:"description"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`

	// 关联
	ServiceTemplate *ServiceTemplate `gorm:"foreignKey:ServiceTemplateID" json:"service_template,omitempty"`
}

func (ProcessTemplate) TableName() string {
	return "process_templates"
}

// ProcessBindInfo 进程绑定信息
type ProcessBindInfo struct {
	IP       string `json:"ip"`       // 绑定IP，如 127.0.0.1, 0.0.0.0, 或具体IP
	Port     string `json:"port"`     // 端口，可以是 "8080" 或范围 "8080-8090"
	Protocol string `json:"protocol"` // tcp 或 udp
	Enable   bool   `json:"enable"`   // 是否启用
}

// ========== 进程实例 ==========

// Process 进程实例
// 绑定到具体主机上的进程
type Process struct {
	ID                uint64         `gorm:"primaryKey" json:"id"`
	ProcessTemplateID uint64         `gorm:"index;not null;comment:关联进程模板ID" json:"process_template_id"`
	HostID            uuid.UUID      `gorm:"type:uuid;index;not null;comment:关联主机ID" json:"host_id"`
	ModuleID          uint64         `gorm:"index;not null;comment:关联模块ID" json:"module_id"`
	BusinessID        uint64      `gorm:"index;not null;comment:所属业务ID" json:"business_id"`
	ProcessName       string         `gorm:"size:200;comment:进程名称（可覆盖模板）" json:"process_name"`
	BindInfo          datatypes.JSON `gorm:"type:jsonb;comment:实际绑定信息（覆盖模板）" json:"bind_info"`
	StartCommand      string         `gorm:"size:500;comment:启动命令（可覆盖模板）" json:"start_command,omitempty"`
	User              string         `gorm:"size:100;comment:运行用户（可覆盖模板）" json:"user,omitempty"`
	WorkPath          string         `gorm:"size:500;comment:工作目录（可覆盖模板）" json:"work_path,omitempty"`
	Priority          *int           `gorm:"comment:启动优先级（可覆盖模板）" json:"priority,omitempty"`
	ProcNum           *int           `gorm:"comment:进程数量（可覆盖模板）" json:"proc_num,omitempty"`
	Description       string         `gorm:"size:500;comment:描述" json:"description"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`

	// 关联
	ProcessTemplate *ProcessTemplate `gorm:"foreignKey:ProcessTemplateID" json:"process_template,omitempty"`
	Host            *Host            `gorm:"foreignKey:HostID" json:"host,omitempty"`
	Module          *Module          `gorm:"foreignKey:ModuleID" json:"module,omitempty"`
}

func (Process) TableName() string {
	return "processes"
}

// ProcessStatus 进程运行状态（从 Agent 上报）
type ProcessStatus struct {
	ProcessID    uint64    `gorm:"primaryKey;comment:进程实例ID" json:"process_id"`
	HostID       uuid.UUID `gorm:"type:uuid;index;comment:主机ID" json:"host_id"`
	PID          int       `gorm:"comment:系统进程ID" json:"pid"`
	Status       string    `gorm:"size:50;comment:状态：running/stopped/unknown" json:"status"`
	CPU          float64   `gorm:"comment:CPU使用率" json:"cpu"`
	Memory       float64   `gorm:"comment:内存使用率" json:"memory"`
	StartTime    time.Time `gorm:"comment:进程启动时间" json:"start_time"`
	LastCheckAt  time.Time `gorm:"comment:最后检查时间" json:"last_check_at"`
	ErrorMessage string    `gorm:"size:500;comment:错误信息" json:"error_message,omitempty"`
}

func (ProcessStatus) TableName() string {
	return "process_statuses"
}

// 进程状态常量
const (
	ProcessStatusRunning  = "running"
	ProcessStatusStopped  = "stopped"
	ProcessStatusUnknown  = "unknown"
	ProcessStatusStarting = "starting"
	ProcessStatusStopping = "stopping"
)

// ========== 请求/响应结构 ==========

// CreateProcessTemplateRequest 创建进程模板请求
type CreateProcessTemplateRequest struct {
	Name           string            `json:"name" binding:"required"`
	BusinessID     uint64         `json:"business_id" binding:"required"`
	StartCommand   string            `json:"start_command"`
	StopCommand    string            `json:"stop_command"`
	RestartCommand string            `json:"restart_command"`
	ReloadCommand  string            `json:"reload_command"`
	WorkPath       string            `json:"work_path"`
	PidFile        string            `json:"pid_file"`
	User           string            `json:"user"`
	ProcNum        int               `json:"proc_num"`
	Priority       int               `json:"priority"`
	Timeout        int               `json:"timeout"`
	AutoStart      *bool             `json:"auto_start"`
	AutoRecover    *bool             `json:"auto_recover"`
	BindInfo       []ProcessBindInfo `json:"bind_info"`
	Description    string            `json:"description"`
}

// UpdateProcessTemplateRequest 更新进程模板请求
type UpdateProcessTemplateRequest struct {
	Name           *string           `json:"name"`
	StartCommand   *string           `json:"start_command"`
	StopCommand    *string           `json:"stop_command"`
	RestartCommand *string           `json:"restart_command"`
	ReloadCommand  *string           `json:"reload_command"`
	WorkPath       *string           `json:"work_path"`
	PidFile        *string           `json:"pid_file"`
	User           *string           `json:"user"`
	ProcNum        *int              `json:"proc_num"`
	Priority       *int              `json:"priority"`
	Timeout        *int              `json:"timeout"`
	AutoStart      *bool             `json:"auto_start"`
	AutoRecover    *bool             `json:"auto_recover"`
	BindInfo       []ProcessBindInfo `json:"bind_info"`
	Description    *string           `json:"description"`
}

// CreateProcessRequest 创建进程实例请求
type CreateProcessRequest struct {
	ProcessTemplateID uint64            `json:"process_template_id" binding:"required"`
	HostID            uuid.UUID         `json:"host_id" binding:"required"`
	ModuleID          uint64            `json:"module_id" binding:"required"`
	ProcessName       string            `json:"process_name"`
	BindInfo          []ProcessBindInfo `json:"bind_info"`
	StartCommand      string            `json:"start_command"`
	User              string            `json:"user"`
	WorkPath          string            `json:"work_path"`
	Priority          *int              `json:"priority"`
	ProcNum           *int              `json:"proc_num"`
	Description       string            `json:"description"`
}

// UpdateProcessRequest 更新进程实例请求
type UpdateProcessRequest struct {
	ProcessName  *string           `json:"process_name"`
	BindInfo     []ProcessBindInfo `json:"bind_info"`
	StartCommand *string           `json:"start_command"`
	User         *string           `json:"user"`
	WorkPath     *string           `json:"work_path"`
	Priority     *int              `json:"priority"`
	ProcNum      *int              `json:"proc_num"`
	Description  *string           `json:"description"`
}

// BatchCreateProcessRequest 批量创建进程请求
type BatchCreateProcessRequest struct {
	ProcessTemplateID uint64      `json:"process_template_id" binding:"required"`
	HostIDs           []uuid.UUID `json:"host_ids" binding:"required,min=1"`
	ModuleID          uint64      `json:"module_id" binding:"required"`
}

// ProcessWithStatus 进程及其状态
type ProcessWithStatus struct {
	Process
	Status *ProcessStatus `json:"status,omitempty"`
}
