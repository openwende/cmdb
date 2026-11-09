package host

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/openwende/cmdb-server/internal/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockHostRepository 主机仓库的 Mock
type MockHostRepository struct {
	mock.Mock
}

func (m *MockHostRepository) CreateHost(ctx context.Context, tenantID uuid.UUID, req *types.CreateHostRequest, createdBy *uuid.UUID) (*types.Host, error) {
	args := m.Called(ctx, tenantID, req, createdBy)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Host), args.Error(1)
}

func (m *MockHostRepository) BatchCreateHosts(ctx context.Context, tenantID uuid.UUID, hosts []*types.Host) error {
	args := m.Called(ctx, tenantID, hosts)
	return args.Error(0)
}

func (m *MockHostRepository) GetHost(ctx context.Context, id uuid.UUID) (*types.Host, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Host), args.Error(1)
}

func (m *MockHostRepository) GetHostByCloudInstance(ctx context.Context, cloudVendor, cloudInstanceID string) (*types.Host, error) {
	args := m.Called(ctx, cloudVendor, cloudInstanceID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Host), args.Error(1)
}

func (m *MockHostRepository) GetHostByCloudAreaIP(ctx context.Context, cloudAreaID uuid.UUID, primaryIP string) (*types.Host, error) {
	args := m.Called(ctx, cloudAreaID, primaryIP)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Host), args.Error(1)
}

func (m *MockHostRepository) ListHosts(ctx context.Context, tenantID uuid.UUID, params *types.HostQueryParams) ([]types.Host, int64, error) {
	args := m.Called(ctx, tenantID, params)
	return args.Get(0).([]types.Host), args.Get(1).(int64), args.Error(2)
}

func (m *MockHostRepository) UpdateHost(ctx context.Context, id uuid.UUID, req *types.UpdateHostRequest, updatedBy *uuid.UUID) (*types.Host, error) {
	args := m.Called(ctx, id, req, updatedBy)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Host), args.Error(1)
}

func (m *MockHostRepository) UpdateCustomFields(ctx context.Context, id uuid.UUID, customFields map[string]interface{}, updatedBy *uuid.UUID) (*types.Host, error) {
	args := m.Called(ctx, id, customFields, updatedBy)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Host), args.Error(1)
}

func (m *MockHostRepository) MarkAsDestroyed(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockHostRepository) DeleteHost(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockHostRepository) CheckIPConflict(ctx context.Context, cloudAreaID *uuid.UUID, primaryIP string, excludeHostID *uuid.UUID) (bool, error) {
	args := m.Called(ctx, cloudAreaID, primaryIP, excludeHostID)
	return args.Get(0).(bool), args.Error(1)
}

func (m *MockHostRepository) HostStatistics(ctx context.Context) (*types.HostStatistics, error) {
	return &types.HostStatistics{}, nil
}

// MockCloudAreaRepository 云区域仓库的 Mock
type MockCloudAreaRepository struct {
	mock.Mock
}

func (m *MockCloudAreaRepository) CreateCloudArea(ctx context.Context, tenantID uuid.UUID, req *types.CreateCloudAreaRequest) (*types.CloudArea, error) {
	args := m.Called(ctx, tenantID, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.CloudArea), args.Error(1)
}

func (m *MockCloudAreaRepository) GetCloudArea(ctx context.Context, id uuid.UUID) (*types.CloudArea, error) {
	args := m.Called(ctx, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.CloudArea), args.Error(1)
}

func (m *MockCloudAreaRepository) GetCloudAreaByIdentifier(ctx context.Context, tenantID uuid.UUID, identifier string) (*types.CloudArea, error) {
	args := m.Called(ctx, tenantID, identifier)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.CloudArea), args.Error(1)
}

func (m *MockCloudAreaRepository) GetDefaultCloudArea(ctx context.Context) (*types.CloudArea, error) {
	args := m.Called(ctx)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.CloudArea), args.Error(1)
}

func (m *MockCloudAreaRepository) ListCloudAreas(ctx context.Context, tenantID uuid.UUID, params *types.CloudAreaQueryParams) ([]types.CloudArea, int64, error) {
	args := m.Called(ctx, tenantID, params)
	return args.Get(0).([]types.CloudArea), args.Get(1).(int64), args.Error(2)
}

func (m *MockCloudAreaRepository) UpdateCloudArea(ctx context.Context, id uuid.UUID, req *types.UpdateCloudAreaRequest) (*types.CloudArea, error) {
	args := m.Called(ctx, id, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.CloudArea), args.Error(1)
}

func (m *MockCloudAreaRepository) DeleteCloudArea(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockCloudAreaRepository) CountHostsInCloudArea(ctx context.Context, id uuid.UUID) (int64, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(int64), args.Error(1)
}

// 测试创建主机时使用默认云区域
func TestCreateHost_UseDefaultCloudArea(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	mockCloudAreaRepo := new(MockCloudAreaRepository)
	service := NewService(mockHostRepo, mockCloudAreaRepo)

	ctx := context.Background()
	tenantID := uuid.New()
	defaultCloudAreaID := uuid.New()

	// Mock 默认云区域
	defaultCloudArea := &types.CloudArea{
		ID:         defaultCloudAreaID,
		Name:       "直连区域",
		Identifier: "default",
	}

	req := &types.CreateHostRequest{
		HostName:  "test-host",
		PrimaryIP: "192.168.1.100",
		// CloudAreaID 未指定，应该使用默认
	}

	// 期望调用
	mockCloudAreaRepo.On("GetDefaultCloudArea", ctx).Return(defaultCloudArea, nil)
	mockCloudAreaRepo.On("GetCloudArea", ctx, defaultCloudAreaID).Return(defaultCloudArea, nil)
	mockHostRepo.On("CheckIPConflict", ctx, &defaultCloudAreaID, "192.168.1.100", (*uuid.UUID)(nil)).Return(false, nil)
	mockHostRepo.On("CreateHost", ctx, tenantID, mock.AnythingOfType("*types.CreateHostRequest"), (*uuid.UUID)(nil)).Return(&types.Host{
		ID:          uuid.New(),
		HostName:    "test-host",
		PrimaryIP:   "192.168.1.100",
		CloudAreaID: &defaultCloudAreaID,
	}, nil)

	// 执行测试
	host, err := service.CreateHost(ctx, tenantID, req, nil)

	// 验证
	assert.NoError(t, err)
	assert.NotNil(t, host)
	assert.Equal(t, defaultCloudAreaID, *host.CloudAreaID)
	mockCloudAreaRepo.AssertExpectations(t)
	mockHostRepo.AssertExpectations(t)
}

// 测试 IP 冲突检测
func TestCreateHost_IPConflict(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	mockCloudAreaRepo := new(MockCloudAreaRepository)
	service := NewService(mockHostRepo, mockCloudAreaRepo)

	ctx := context.Background()
	tenantID := uuid.New()
	cloudAreaID := uuid.New()

	req := &types.CreateHostRequest{
		HostName:    "test-host",
		PrimaryIP:   "192.168.1.100",
		CloudAreaID: &cloudAreaID,
	}

	cloudArea := &types.CloudArea{ID: cloudAreaID}

	// Mock 云区域存在，但 IP 冲突
	mockCloudAreaRepo.On("GetCloudArea", ctx, cloudAreaID).Return(cloudArea, nil)
	mockHostRepo.On("CheckIPConflict", ctx, &cloudAreaID, "192.168.1.100", (*uuid.UUID)(nil)).Return(true, nil)

	// 执行测试
	host, err := service.CreateHost(ctx, tenantID, req, nil)

	// 验证
	assert.Error(t, err)
	assert.Nil(t, host)
	assert.Contains(t, err.Error(), "already exists")
	mockCloudAreaRepo.AssertExpectations(t)
	mockHostRepo.AssertExpectations(t)
}

// 测试无效的 IP 地址格式
func TestCreateHost_InvalidIPFormat(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	mockCloudAreaRepo := new(MockCloudAreaRepository)
	service := NewService(mockHostRepo, mockCloudAreaRepo)

	ctx := context.Background()
	tenantID := uuid.New()
	cloudAreaID := uuid.New()

	req := &types.CreateHostRequest{
		HostName:    "test-host",
		PrimaryIP:   "invalid-ip",
		CloudAreaID: &cloudAreaID,
	}

	// 执行测试
	host, err := service.CreateHost(ctx, tenantID, req, nil)

	// 验证
	assert.Error(t, err)
	assert.Nil(t, host)
	assert.Contains(t, err.Error(), "invalid primary_ip format")
}

// 测试批量导入主机
func TestBatchImportHosts_Success(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	mockCloudAreaRepo := new(MockCloudAreaRepository)
	service := NewService(mockHostRepo, mockCloudAreaRepo)

	ctx := context.Background()
	tenantID := uuid.New()
	defaultCloudAreaID := uuid.New()

	defaultCloudArea := &types.CloudArea{
		ID:         defaultCloudAreaID,
		Name:       "直连区域",
		Identifier: "default",
	}

	req := &types.BatchImportHostsRequest{
		UseDefaultCloudArea: true,
		SkipErrors:          false,
		Hosts: []types.CreateHostRequest{
			{HostName: "host1", PrimaryIP: "192.168.1.1"},
			{HostName: "host2", PrimaryIP: "192.168.1.2"},
		},
	}

	// Mock 期望调用
	mockCloudAreaRepo.On("GetDefaultCloudArea", ctx).Return(defaultCloudArea, nil)
	mockCloudAreaRepo.On("GetCloudArea", ctx, defaultCloudAreaID).Return(defaultCloudArea, nil)
	mockHostRepo.On("CheckIPConflict", ctx, &defaultCloudAreaID, "192.168.1.1", (*uuid.UUID)(nil)).Return(false, nil)
	mockHostRepo.On("CheckIPConflict", ctx, &defaultCloudAreaID, "192.168.1.2", (*uuid.UUID)(nil)).Return(false, nil)
	mockHostRepo.On("BatchCreateHosts", ctx, tenantID, mock.AnythingOfType("[]*types.Host")).Return(nil)

	// 执行测试
	result, err := service.BatchImportHosts(ctx, tenantID, req, nil)

	// 验证
	assert.NoError(t, err)
	assert.Equal(t, 2, result.Total)
	assert.Equal(t, 2, result.Successful)
	assert.Equal(t, 0, result.Failed)
	assert.Len(t, result.CreatedIDs, 2)
	mockCloudAreaRepo.AssertExpectations(t)
	mockHostRepo.AssertExpectations(t)
}

// 测试批量导入时跳过错误
func TestBatchImportHosts_SkipErrors(t *testing.T) {
	mockHostRepo := new(MockHostRepository)
	mockCloudAreaRepo := new(MockCloudAreaRepository)
	service := NewService(mockHostRepo, mockCloudAreaRepo)

	ctx := context.Background()
	tenantID := uuid.New()
	defaultCloudAreaID := uuid.New()

	defaultCloudArea := &types.CloudArea{
		ID:         defaultCloudAreaID,
		Name:       "直连区域",
		Identifier: "default",
	}

	req := &types.BatchImportHostsRequest{
		UseDefaultCloudArea: true,
		SkipErrors:          true, // 跳过错误
		Hosts: []types.CreateHostRequest{
			{HostName: "host1", PrimaryIP: "192.168.1.1"},
			{HostName: "host2", PrimaryIP: "invalid-ip"}, // 无效 IP
			{HostName: "host3", PrimaryIP: "192.168.1.3"},
		},
	}

	// Mock 期望调用
	mockCloudAreaRepo.On("GetDefaultCloudArea", ctx).Return(defaultCloudArea, nil)
	mockCloudAreaRepo.On("GetCloudArea", ctx, defaultCloudAreaID).Return(defaultCloudArea, nil)
	mockHostRepo.On("CheckIPConflict", ctx, &defaultCloudAreaID, "192.168.1.1", (*uuid.UUID)(nil)).Return(false, nil)
	mockHostRepo.On("CheckIPConflict", ctx, &defaultCloudAreaID, "192.168.1.3", (*uuid.UUID)(nil)).Return(false, nil)
	mockHostRepo.On("BatchCreateHosts", ctx, tenantID, mock.AnythingOfType("[]*types.Host")).Return(nil)

	// 执行测试
	result, err := service.BatchImportHosts(ctx, tenantID, req, nil)

	// 验证
	assert.NoError(t, err)
	assert.Equal(t, 3, result.Total)
	assert.Equal(t, 2, result.Successful)
	assert.Equal(t, 1, result.Failed)
	assert.Len(t, result.Errors, 1)
	assert.Contains(t, result.Errors[0].Error, "invalid primary_ip format")
	mockCloudAreaRepo.AssertExpectations(t)
	mockHostRepo.AssertExpectations(t)
}

// 注：host 级 AssignToBusiness/ReclaimToPool 已废弃删除（阶段2，前端未用、绕过 hms），相关测试随之移除。
// 主机归属流转改由 resource-pool/topology 端点经 HostMembershipService 完成。
