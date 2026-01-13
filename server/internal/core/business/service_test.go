package business

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/wend/cmdb-backend/internal/types"
)

// MockBusinessRepository for testing
type MockBusinessRepository struct {
	mock.Mock
}

func (m *MockBusinessRepository) CreateBusiness(ctx context.Context, business *types.Business) error {
	args := m.Called(ctx, business)
	return args.Error(0)
}

func (m *MockBusinessRepository) GetBusinessByID(ctx context.Context, tenantID, id string) (*types.Business, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockBusinessRepository) UpdateBusiness(ctx context.Context, business *types.Business) error {
	args := m.Called(ctx, business)
	return args.Error(0)
}

func (m *MockBusinessRepository) CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error) {
	args := m.Called(ctx, tenantID, identifier, excludeID)
	return args.Bool(0), args.Error(1)
}
func (m *MockBusinessRepository) GetBusinessByIdentifier(ctx context.Context, tenantID, identifier string) (*types.Business, error) {
	return nil, nil
}
func (m *MockBusinessRepository) DeleteBusiness(ctx context.Context, tenantID, id string) error {
	return nil
}
func (m *MockBusinessRepository) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	return nil, 0, nil
}

func TestLifecycleLogic(t *testing.T) {
	mockRepo := new(MockBusinessRepository)
	service := NewService(mockRepo, nil, nil)

	t.Run("Create Default", func(t *testing.T) {
		req := &types.CreateBusinessRequest{Name: "default-test"}

		// reset mock
		mockRepo.ExpectedCalls = nil
		// Must use On just before call if reusing, or clear

		mockRepo.On("CreateBusiness", mock.Anything, mock.MatchedBy(func(b *types.Business) bool {
			return b.Lifecycle == types.BusinessLifecycleOnline
		})).Return(nil)

		_, err := service.CreateBusiness(context.Background(), req)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Create Testing", func(t *testing.T) {
		lc := types.BusinessLifecycleTesting
		req := &types.CreateBusinessRequest{Name: "test-test", Lifecycle: &lc}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("CreateBusiness", mock.Anything, mock.MatchedBy(func(b *types.Business) bool {
			return b.Lifecycle == types.BusinessLifecycleTesting
		})).Return(nil)

		_, err := service.CreateBusiness(context.Background(), req)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Update Valid", func(t *testing.T) {
		id := uuid.New().String()
		tn := "00000000-0000-0000-0000-000000000001"
		existing := &types.Business{ID: uuid.MustParse(id), TenantID: uuid.MustParse(tn), Lifecycle: types.BusinessLifecycleOnline}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetBusinessByID", mock.Anything, tn, id).Return(existing, nil)

		lc := types.BusinessLifecycleOffline
		req := &types.UpdateBusinessRequest{Lifecycle: &lc}

		mockRepo.On("UpdateBusiness", mock.Anything, mock.MatchedBy(func(b *types.Business) bool {
			return b.Lifecycle == types.BusinessLifecycleOffline
		})).Return(nil)

		_, err := service.UpdateBusiness(context.Background(), tn, id, req)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Update Invalid", func(t *testing.T) {
		id := uuid.New().String()
		tn := "00000000-0000-0000-0000-000000000001"
		existing := &types.Business{ID: uuid.MustParse(id), TenantID: uuid.MustParse(tn), Lifecycle: types.BusinessLifecycleOnline}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetBusinessByID", mock.Anything, tn, id).Return(existing, nil)

		lc := "invalid-state"
		req := &types.UpdateBusinessRequest{Lifecycle: &lc}

		_, err := service.UpdateBusiness(context.Background(), tn, id, req)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "invalid lifecycle value")
	})
}
