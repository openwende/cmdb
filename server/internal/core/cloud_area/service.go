package cloud_area

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

// Service 云区域服务
type Service struct {
	repo storage.CloudAreaRepository
}

// NewService 创建云区域服务实例
func NewService(repo storage.CloudAreaRepository) *Service {
	return &Service{
		repo: repo,
	}
}

// CreateCloudArea 创建云区域
func (s *Service) CreateCloudArea(ctx context.Context, tenantID uuid.UUID, req *types.CreateCloudAreaRequest) (*types.CloudArea, error) {
	// 1. 校验标识符是否已存在
	existing, _ := s.repo.GetCloudAreaByIdentifier(ctx, tenantID, req.Identifier)
	if existing != nil {
		return nil, fmt.Errorf("cloud area with identifier '%s' already exists", req.Identifier)
	}

	// 2. 创建云区域
	return s.repo.CreateCloudArea(ctx, tenantID, req)
}

// GetCloudArea 获取云区域
func (s *Service) GetCloudArea(ctx context.Context, id uuid.UUID) (*types.CloudArea, error) {
	return s.repo.GetCloudArea(ctx, id)
}

// GetCloudAreaByIdentifier 根据标识符获取云区域
func (s *Service) GetCloudAreaByIdentifier(ctx context.Context, tenantID uuid.UUID, identifier string) (*types.CloudArea, error) {
	return s.repo.GetCloudAreaByIdentifier(ctx, tenantID, identifier)
}

// GetDefaultCloudArea 获取默认云区域（直连区域）
func (s *Service) GetDefaultCloudArea(ctx context.Context) (*types.CloudArea, error) {
	return s.repo.GetDefaultCloudArea(ctx)
}

// ListCloudAreas 获取云区域列表
func (s *Service) ListCloudAreas(ctx context.Context, tenantID uuid.UUID, params *types.CloudAreaQueryParams) ([]types.CloudArea, int64, error) {
	return s.repo.ListCloudAreas(ctx, tenantID, params)
}

// UpdateCloudArea 更新云区域
func (s *Service) UpdateCloudArea(ctx context.Context, id uuid.UUID, req *types.UpdateCloudAreaRequest) (*types.CloudArea, error) {
	// 1. 检查云区域是否存在
	if _, err := s.repo.GetCloudArea(ctx, id); err != nil {
		return nil, err
	}

	// 2. 执行更新
	return s.repo.UpdateCloudArea(ctx, id, req)
}

// DeleteCloudArea 删除云区域
func (s *Service) DeleteCloudArea(ctx context.Context, id uuid.UUID) error {
	// TODO: 检查是否有主机关联到此云区域
	// 如果有，可以选择：1) 禁止删除 2) 级联删除 3) 转移到默认云区域

	return s.repo.DeleteCloudArea(ctx, id)
}
