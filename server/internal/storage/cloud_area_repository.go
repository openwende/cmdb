package storage

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/types"
)

// CloudAreaRepository 云区域数据仓库接口
type CloudAreaRepository interface {
	CreateCloudArea(ctx context.Context, tenantID uuid.UUID, req *types.CreateCloudAreaRequest) (*types.CloudArea, error)
	GetCloudArea(ctx context.Context, id uuid.UUID) (*types.CloudArea, error)
	GetCloudAreaByIdentifier(ctx context.Context, tenantID uuid.UUID, identifier string) (*types.CloudArea, error)
	GetDefaultCloudArea(ctx context.Context) (*types.CloudArea, error)
	ListCloudAreas(ctx context.Context, tenantID uuid.UUID, params *types.CloudAreaQueryParams) ([]types.CloudArea, int64, error)
	UpdateCloudArea(ctx context.Context, id uuid.UUID, req *types.UpdateCloudAreaRequest) (*types.CloudArea, error)
	DeleteCloudArea(ctx context.Context, id uuid.UUID) error
	// CountHostsInCloudArea 统计仍关联到该云区域且未被删除的主机数量。
	CountHostsInCloudArea(ctx context.Context, id uuid.UUID) (int64, error)
}

type cloudAreaRepository struct {
	db *gorm.DB
}

// NewCloudAreaRepository 创建云区域仓库实例
func NewCloudAreaRepository(db *gorm.DB) CloudAreaRepository {
	return &cloudAreaRepository{db: db}
}

// CreateCloudArea 创建云区域
func (r *cloudAreaRepository) CreateCloudArea(ctx context.Context, tenantID uuid.UUID, req *types.CreateCloudAreaRequest) (*types.CloudArea, error) {
	// 设置默认类型
	areaType := types.CloudAreaTypeDirect
	if req.Type != nil {
		areaType = *req.Type
	}

	cloudArea := &types.CloudArea{
		ID:           uuid.New(),
		TenantID:     tenantID,
		Name:         req.Name,
		Identifier:   req.Identifier,
		Type:         areaType,
		Description:  req.Description,
		CloudVendor:  req.CloudVendor,
		VPCID:        req.VPCID,
		CIDRBlock:    req.CIDRBlock,
		Region:       req.Region,
		CustomFields: req.CustomFields,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := r.db.WithContext(ctx).Create(cloudArea).Error; err != nil {
		return nil, err
	}

	return cloudArea, nil
}

// GetCloudArea 根据ID获取云区域
func (r *cloudAreaRepository) GetCloudArea(ctx context.Context, id uuid.UUID) (*types.CloudArea, error) {
	var cloudArea types.CloudArea
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", id).
		First(&cloudArea).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("cloud area not found")
		}
		return nil, err
	}

	return &cloudArea, nil
}

// GetCloudAreaByIdentifier 根据标识符获取云区域
func (r *cloudAreaRepository) GetCloudAreaByIdentifier(ctx context.Context, tenantID uuid.UUID, identifier string) (*types.CloudArea, error) {
	var cloudArea types.CloudArea
	err := r.db.WithContext(ctx).
		Where("tenant_id = ? AND identifier = ? AND deleted_at IS NULL", tenantID, identifier).
		First(&cloudArea).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("cloud area not found")
		}
		return nil, err
	}

	return &cloudArea, nil
}

// GetDefaultCloudArea 获取默认云区域（直连区域）
func (r *cloudAreaRepository) GetDefaultCloudArea(ctx context.Context) (*types.CloudArea, error) {
	var cloudArea types.CloudArea
	err := r.db.WithContext(ctx).
		Where("identifier = ? AND deleted_at IS NULL", "default").
		First(&cloudArea).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("default cloud area not found")
		}
		return nil, err
	}

	return &cloudArea, nil
}

// ListCloudAreas 获取云区域列表
func (r *cloudAreaRepository) ListCloudAreas(ctx context.Context, tenantID uuid.UUID, params *types.CloudAreaQueryParams) ([]types.CloudArea, int64, error) {
	zeroUUID := uuid.Nil
	query := r.db.WithContext(ctx).
		Where("(tenant_id = ? OR tenant_id = ?) AND deleted_at IS NULL", tenantID, zeroUUID)

	// 应用过滤条件
	if params.CloudVendor != nil {
		query = query.Where("cloud_vendor = ?", *params.CloudVendor)
	}
	if params.Type != nil {
		query = query.Where("type = ?", *params.Type)
	}
	if params.Region != nil {
		query = query.Where("region = ?", *params.Region)
	}

	// 获取总数
	var total int64
	if err := query.Model(&types.CloudArea{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 应用分页
	page := 1
	pageSize := 20
	if params.Page > 0 {
		page = params.Page
	}
	if params.PageSize > 0 {
		pageSize = params.PageSize
	}

	var cloudAreas []types.CloudArea
	err := query.
		Order("created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&cloudAreas).Error

	if err != nil {
		return nil, 0, err
	}

	return cloudAreas, total, nil
}

// UpdateCloudArea 更新云区域
func (r *cloudAreaRepository) UpdateCloudArea(ctx context.Context, id uuid.UUID, req *types.UpdateCloudAreaRequest) (*types.CloudArea, error) {
	// 先获取现有记录（验证存在性）
	_, err := r.GetCloudArea(ctx, id)
	if err != nil {
		return nil, err
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	updates["updated_at"] = time.Now()

	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Type != nil {
		updates["type"] = *req.Type
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.CIDRBlock != nil {
		updates["cidr_block"] = *req.CIDRBlock
	}
	if req.Region != nil {
		updates["region"] = *req.Region
	}
	if req.CustomFields != nil {
		updates["custom_fields"] = req.CustomFields
	}

	// 执行更新
	if err := r.db.WithContext(ctx).
		Model(&types.CloudArea{}).
		Where("id = ?", id).
		Updates(updates).Error; err != nil {
		return nil, err
	}

	// 重新获取更新后的数据
	return r.GetCloudArea(ctx, id)
}

// DeleteCloudArea 软删除云区域
func (r *cloudAreaRepository) DeleteCloudArea(ctx context.Context, id uuid.UUID) error {
	result := r.db.WithContext(ctx).
		Model(&types.CloudArea{}).
		Where("id = ? AND deleted_at IS NULL", id).
		Update("deleted_at", time.Now())

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("cloud area not found or already deleted")
	}

	return nil
}

// CountHostsInCloudArea 统计仍关联到该云区域且未被删除的主机数量。
func (r *cloudAreaRepository) CountHostsInCloudArea(ctx context.Context, id uuid.UUID) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Host{}).
		Where("cloud_area_id = ? AND deleted_at IS NULL", id).
		Count(&count).Error
	if err != nil {
		return 0, err
	}
	return count, nil
}
