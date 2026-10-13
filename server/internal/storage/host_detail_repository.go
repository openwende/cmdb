package storage

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

// HostDetailRepository 主机详情只读查询（按 display_id，带归属）。
type HostDetailRepository interface {
	// GetHostDetailByDisplayID 不存在（或已软删）时返回 (nil, nil)；已销毁（is_destroyed）的主机照常返回。
	GetHostDetailByDisplayID(ctx context.Context, displayID int64) (*types.HostDetail, error)
}

type hostDetailRepository struct {
	db *gorm.DB
}

// NewHostDetailRepository 创建主机详情只读仓库。
func NewHostDetailRepository(db *gorm.DB) HostDetailRepository {
	return &hostDetailRepository{db: db}
}

func (r *hostDetailRepository) GetHostDetailByDisplayID(ctx context.Context, displayID int64) (*types.HostDetail, error) {
	var host types.Host
	err := r.db.WithContext(ctx).Where("display_id = ? AND deleted_at IS NULL", displayID).First(&host).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	detail := &types.HostDetail{Host: host, Placements: []types.HostPlacement{}}
	if host.CloudAreaID != nil {
		var names []string
		if err := r.db.WithContext(ctx).Table("cloud_areas").Where("id = ?", *host.CloudAreaID).
			Limit(1).Pluck("name", &names).Error; err != nil {
			return nil, err
		}
		if len(names) > 0 {
			detail.CloudAreaName = names[0]
		}
	}

	places, err := ListHostPlacements(ctx, r.db, []uuid.UUID{host.ID})
	if err != nil {
		return nil, err
	}
	if p := places[host.ID]; len(p) > 0 {
		detail.Placements = p
	}
	return detail, nil
}

// ListHostPlacements 批量取主机的当前归属（host_node_memberships → 业务 / 集群 / 模块 或 资源池目录）。
// 每台主机的归属按 node_kind、node_id 排序；没有归属的主机不在返回的 map 里。
// MCP 只读工具和 REST 主机详情共用这一份解析。
func ListHostPlacements(ctx context.Context, db *gorm.DB, hostIDs []uuid.UUID) (map[uuid.UUID][]types.HostPlacement, error) {
	out := make(map[uuid.UUID][]types.HostPlacement, len(hostIDs))
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
	err := db.WithContext(ctx).Table("host_node_memberships m").
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
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	num := func(p *uint64) uint64 {
		if p == nil {
			return 0
		}
		return *p
	}
	for _, r := range rows {
		p := types.HostPlacement{}
		if r.NodeKind == types.NodeKindPoolDirectory {
			p.Kind, p.DirectoryID, p.DirectoryName = types.HostPlacementPool, r.NodeID, str(r.DirName)
		} else {
			p.Kind, p.ModuleID, p.ModuleName = types.HostPlacementBusiness, r.NodeID, str(r.ModuleName)
			p.SetID, p.SetName = num(r.SetID), str(r.SetName)
			p.BusinessID, p.BusinessName = num(r.BusinessID), str(r.BizName)
		}
		out[r.HostID] = append(out[r.HostID], p)
	}
	return out, nil
}
