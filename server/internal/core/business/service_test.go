package business

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"
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
	args := m.Called(ctx, tenantID, id)
	return args.Error(0)
}
func (m *MockBusinessRepository) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	args := m.Called(ctx, tenantID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]types.Business), args.Int(1), args.Error(2)
}

func (m *MockBusinessRepository) GetBusinessByBusinessID(ctx context.Context, tenantID string, businessID int64) (*types.Business, error) {
	args := m.Called(ctx, tenantID, businessID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockBusinessRepository) CheckBusinessIDExists(ctx context.Context, tenantID string, businessID int64, excludeID string) (bool, error) {
	args := m.Called(ctx, tenantID, businessID, excludeID)
	return args.Bool(0), args.Error(1)
}

func (m *MockBusinessRepository) GetNextBusinessID(ctx context.Context, tenantID string) (int64, error) {
	args := m.Called(ctx, tenantID)
	return args.Get(0).(int64), args.Error(1)
}

func TestLifecycleLogic(t *testing.T) {
	mockRepo := new(MockBusinessRepository)
	service := NewService(mockRepo, nil, nil)

	t.Run("Create Default", func(t *testing.T) {
		req := &types.CreateBusinessRequest{Name: "default-test"}

		// reset mock
		mockRepo.ExpectedCalls = nil
		// Must use On just before call if reusing, or clear

		mockRepo.On("GetNextBusinessID", mock.Anything, mock.Anything).Return(int64(1000), nil)
		mockRepo.On("CreateBusiness", mock.Anything, mock.MatchedBy(func(b *types.Business) bool {
			return b.Lifecycle == types.BusinessLifecycleOnline && b.BusinessID != nil && *b.BusinessID == 1000
		})).Return(nil)

		_, err := service.CreateBusiness(context.Background(), req)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Create Testing", func(t *testing.T) {
		lc := types.BusinessLifecycleTesting
		req := &types.CreateBusinessRequest{Name: "test-test", Lifecycle: &lc}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetNextBusinessID", mock.Anything, mock.Anything).Return(int64(1001), nil)
		mockRepo.On("CreateBusiness", mock.Anything, mock.MatchedBy(func(b *types.Business) bool {
			return b.Lifecycle == types.BusinessLifecycleTesting && b.BusinessID != nil && *b.BusinessID == 1001
		})).Return(nil)

		_, err := service.CreateBusiness(context.Background(), req)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Create With Timezone And Language", func(t *testing.T) {
		lc := types.BusinessLifecycleOnline
		tz := "Asia/Shanghai"
		lang := "zh"
		req := &types.CreateBusinessRequest{
			Name:      "regional-test",
			Lifecycle: &lc,
			Timezone:  &tz,
			Language:  &lang,
		}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetNextBusinessID", mock.Anything, mock.Anything).Return(int64(1002), nil)
		mockRepo.On("CreateBusiness", mock.Anything, mock.MatchedBy(func(b *types.Business) bool {
			return b.Lifecycle == types.BusinessLifecycleOnline &&
				b.Timezone == tz &&
				b.Language == lang &&
				b.BusinessID != nil &&
				*b.BusinessID == 1002
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
		assert.True(t, errors.Is(err, apperrors.ErrInvalidInput))
	})
}

func TestDeleteBusiness(t *testing.T) {
	mockRepo := new(MockBusinessRepository)
	service := NewService(mockRepo, nil, nil)

	t.Run("Delete Offline Business - Success", func(t *testing.T) {
		id := uuid.New().String()
		tn := "00000000-0000-0000-0000-000000000001"
		offlineBusiness := &types.Business{
			ID:        uuid.MustParse(id),
			TenantID:  uuid.MustParse(tn),
			Name:      "Archived Business",
			Lifecycle: types.BusinessLifecycleOffline,
		}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetBusinessByID", mock.Anything, tn, id).Return(offlineBusiness, nil)
		mockRepo.On("DeleteBusiness", mock.Anything, tn, id).Return(nil)

		err := service.DeleteBusiness(context.Background(), tn, id)
		assert.NoError(t, err)
		mockRepo.AssertExpectations(t)
	})

	t.Run("Delete Online Business - Should Fail", func(t *testing.T) {
		id := uuid.New().String()
		tn := "00000000-0000-0000-0000-000000000001"
		onlineBusiness := &types.Business{
			ID:        uuid.MustParse(id),
			TenantID:  uuid.MustParse(tn),
			Name:      "Online Business",
			Lifecycle: types.BusinessLifecycleOnline,
		}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetBusinessByID", mock.Anything, tn, id).Return(onlineBusiness, nil)

		err := service.DeleteBusiness(context.Background(), tn, id)
		assert.Error(t, err)
		assert.True(t, errors.Is(err, apperrors.ErrInvalidState))
		assert.Contains(t, err.Error(), "online")
	})

	t.Run("Delete Testing Business - Should Fail", func(t *testing.T) {
		id := uuid.New().String()
		tn := "00000000-0000-0000-0000-000000000001"
		testingBusiness := &types.Business{
			ID:        uuid.MustParse(id),
			TenantID:  uuid.MustParse(tn),
			Name:      "Testing Business",
			Lifecycle: types.BusinessLifecycleTesting,
		}

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetBusinessByID", mock.Anything, tn, id).Return(testingBusiness, nil)

		err := service.DeleteBusiness(context.Background(), tn, id)
		assert.Error(t, err)
		assert.True(t, errors.Is(err, apperrors.ErrInvalidState))
		assert.Contains(t, err.Error(), "testing")
	})

	t.Run("Delete Non-existent Business - Should Fail", func(t *testing.T) {
		id := uuid.New().String()
		tn := "00000000-0000-0000-0000-000000000001"

		mockRepo.ExpectedCalls = nil
		mockRepo.On("GetBusinessByID", mock.Anything, tn, id).Return(nil, apperrors.NotFoundError("business", id))

		err := service.DeleteBusiness(context.Background(), tn, id)
		assert.Error(t, err)
		assert.True(t, errors.Is(err, apperrors.ErrNotFound))
	})
}
