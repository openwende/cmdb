package business

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/wend/cmdb-backend/internal/types"
)

// MockBusinessPersonnelRepository for testing
type MockBusinessPersonnelRepository struct {
	mock.Mock
}

func (m *MockBusinessPersonnelRepository) Add(ctx context.Context, personnel *types.BusinessPersonnel) error {
	args := m.Called(ctx, personnel)
	return args.Error(0)
}

func (m *MockBusinessPersonnelRepository) ListByBusiness(ctx context.Context, businessID uuid.UUID) ([]types.BusinessPersonnel, error) {
	args := m.Called(ctx, businessID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]types.BusinessPersonnel), args.Error(1)
}

func (m *MockBusinessPersonnelRepository) ListByBusinessIDs(ctx context.Context, businessIDs []uuid.UUID) ([]types.BusinessPersonnel, error) {
	args := m.Called(ctx, businessIDs)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]types.BusinessPersonnel), args.Error(1)
}

func (m *MockBusinessPersonnelRepository) ListByBusinessAndRole(ctx context.Context, businessID uuid.UUID, role string) ([]types.BusinessPersonnel, error) {
	args := m.Called(ctx, businessID, role)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]types.BusinessPersonnel), args.Error(1)
}

func (m *MockBusinessPersonnelRepository) Remove(ctx context.Context, id uuid.UUID) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockBusinessPersonnelRepository) RemoveByBusinessAndRole(ctx context.Context, businessID uuid.UUID, role string) error {
	args := m.Called(ctx, businessID, role)
	return args.Error(0)
}

// ========================================
// TestGetBusiness - 4 test cases
// ========================================

func TestGetBusiness_Success_WithPersonnel(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	expectedBusiness := &types.Business{
		ID:   businessID,
		Name: "Test Business",
	}

	expectedPersonnel := []types.BusinessPersonnel{
		{BusinessID: businessID, Identity: "alice@example.com", Role: "sre"},
		{BusinessID: businessID, Identity: "bob@example.com", Role: "developer"},
		{BusinessID: businessID, Identity: "charlie@example.com", Role: "tester"},
		{BusinessID: businessID, Identity: "diana@example.com", Role: "bizops"},
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(expectedBusiness, nil)
	mockPersonnelRepo.On("ListByBusiness", ctx, businessID).Return(expectedPersonnel, nil)

	// Act
	result, err := service.GetBusiness(ctx, tenantID, businessID.String())

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "Test Business", result.Name)
	assert.Len(t, result.Sres, 1)
	assert.Equal(t, "alice@example.com", result.Sres[0])
	assert.Len(t, result.Developers, 1)
	assert.Equal(t, "bob@example.com", result.Developers[0])
	assert.Len(t, result.Testers, 1)
	assert.Equal(t, "charlie@example.com", result.Testers[0])
	assert.Len(t, result.Bizops, 1)
	assert.Equal(t, "diana@example.com", result.Bizops[0])

	mockBusinessRepo.AssertExpectations(t)
	mockPersonnelRepo.AssertExpectations(t)
}

func TestGetBusiness_Success_WithoutPersonnelRepo(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	service := NewService(mockBusinessRepo, nil, nil) // No personnel repo

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	expectedBusiness := &types.Business{
		ID:   businessID,
		Name: "Test Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(expectedBusiness, nil)

	// Act
	result, err := service.GetBusiness(ctx, tenantID, businessID.String())

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "Test Business", result.Name)
	assert.Len(t, result.Sres, 0)
	assert.Len(t, result.Developers, 0)
	assert.Len(t, result.Testers, 0)
	assert.Len(t, result.Bizops, 0)

	mockBusinessRepo.AssertExpectations(t)
}

func TestGetBusiness_NotFound(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(nil, assert.AnError)

	// Act
	result, err := service.GetBusiness(ctx, tenantID, businessID.String())

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)

	mockBusinessRepo.AssertExpectations(t)
}

func TestGetBusiness_PersonnelError(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	expectedBusiness := &types.Business{
		ID:   businessID,
		Name: "Test Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(expectedBusiness, nil)
	mockPersonnelRepo.On("ListByBusiness", ctx, businessID).Return(nil, assert.AnError)

	// Act
	result, err := service.GetBusiness(ctx, tenantID, businessID.String())

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "failed to populate personnel")

	mockBusinessRepo.AssertExpectations(t)
	mockPersonnelRepo.AssertExpectations(t)
}

// ========================================
// TestListBusinesses - 6 test cases
// ========================================

func TestListBusinesses_Success_WithPersonnel(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	businessID1 := uuid.New()
	businessID2 := uuid.New()

	businesses := []types.Business{
		{ID: businessID1, Name: "Business 1"},
		{ID: businessID2, Name: "Business 2"},
	}

	allPersonnel := []types.BusinessPersonnel{
		{BusinessID: businessID1, Identity: "alice@example.com", Role: "sre"},
		{BusinessID: businessID1, Identity: "bob@example.com", Role: "developer"},
		{BusinessID: businessID2, Identity: "charlie@example.com", Role: "tester"},
	}

	mockBusinessRepo.On("ListBusinesses", ctx, tenantID, 10, 0).Return(businesses, 2, nil)
	mockPersonnelRepo.On("ListByBusinessIDs", ctx, []uuid.UUID{businessID1, businessID2}).Return(allPersonnel, nil)

	// Act
	result, total, err := service.ListBusinesses(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, 2, total)

	// Verify business 1 personnel
	assert.Len(t, result[0].Sres, 1)
	assert.Equal(t, "alice@example.com", result[0].Sres[0])
	assert.Len(t, result[0].Developers, 1)
	assert.Equal(t, "bob@example.com", result[0].Developers[0])

	// Verify business 2 personnel
	assert.Len(t, result[1].Testers, 1)
	assert.Equal(t, "charlie@example.com", result[1].Testers[0])

	mockBusinessRepo.AssertExpectations(t)
	mockPersonnelRepo.AssertExpectations(t)
}

func TestListBusinesses_EmptyResult(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	mockBusinessRepo.On("ListBusinesses", ctx, tenantID, 10, 0).Return([]types.Business{}, 0, nil)

	// Act
	result, total, err := service.ListBusinesses(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 0)
	assert.Equal(t, 0, total)

	mockBusinessRepo.AssertExpectations(t)
	// Personnel repo should NOT be called for empty results
	mockPersonnelRepo.AssertNotCalled(t, "ListByBusinessIDs")
}

func TestListBusinesses_Pagination(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	businessID := uuid.New()
	businesses := []types.Business{
		{ID: businessID, Name: "Business Page 2"},
	}

	mockBusinessRepo.On("ListBusinesses", ctx, tenantID, 5, 5).Return(businesses, 10, nil)
	mockPersonnelRepo.On("ListByBusinessIDs", ctx, []uuid.UUID{businessID}).Return([]types.BusinessPersonnel{}, nil)

	// Act
	result, total, err := service.ListBusinesses(ctx, tenantID, 5, 5)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, 10, total) // Total count across all pages

	mockBusinessRepo.AssertExpectations(t)
	mockPersonnelRepo.AssertExpectations(t)
}

func TestListBusinesses_BatchPersonnelLoading(t *testing.T) {
	// Arrange - This test verifies the N+1 query optimization
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	// Create 3 businesses
	businessID1 := uuid.New()
	businessID2 := uuid.New()
	businessID3 := uuid.New()

	businesses := []types.Business{
		{ID: businessID1, Name: "Business 1"},
		{ID: businessID2, Name: "Business 2"},
		{ID: businessID3, Name: "Business 3"},
	}

	allPersonnel := []types.BusinessPersonnel{
		{BusinessID: businessID1, Identity: "user1@example.com", Role: "sre"},
		{BusinessID: businessID2, Identity: "user2@example.com", Role: "developer"},
		{BusinessID: businessID3, Identity: "user3@example.com", Role: "tester"},
	}

	mockBusinessRepo.On("ListBusinesses", ctx, tenantID, 10, 0).Return(businesses, 3, nil)

	// CRITICAL: ListByBusinessIDs should be called ONCE with all business IDs
	mockPersonnelRepo.On("ListByBusinessIDs", ctx, []uuid.UUID{businessID1, businessID2, businessID3}).Return(allPersonnel, nil).Once()

	// Act
	result, total, err := service.ListBusinesses(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 3)
	assert.Equal(t, 3, total)

	mockBusinessRepo.AssertExpectations(t)
	mockPersonnelRepo.AssertExpectations(t)

	// Verify that ListByBusinessIDs was called exactly once (N+1 optimization)
	mockPersonnelRepo.AssertNumberOfCalls(t, "ListByBusinessIDs", 1)
}

func TestListBusinesses_PersonnelError(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := NewService(mockBusinessRepo, nil, mockPersonnelRepo)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	businessID := uuid.New()
	businesses := []types.Business{
		{ID: businessID, Name: "Business 1"},
	}

	mockBusinessRepo.On("ListBusinesses", ctx, tenantID, 10, 0).Return(businesses, 1, nil)
	mockPersonnelRepo.On("ListByBusinessIDs", ctx, []uuid.UUID{businessID}).Return(nil, assert.AnError)

	// Act - Should succeed even if personnel loading fails (error is logged, not returned)
	result, total, err := service.ListBusinesses(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err) // Service handles personnel errors gracefully
	assert.Len(t, result, 1)
	assert.Equal(t, 1, total)

	mockBusinessRepo.AssertExpectations(t)
	mockPersonnelRepo.AssertExpectations(t)
}

func TestListBusinesses_WithoutPersonnelRepo(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	service := NewService(mockBusinessRepo, nil, nil) // No personnel repo

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	businessID := uuid.New()
	businesses := []types.Business{
		{ID: businessID, Name: "Business 1"},
	}

	mockBusinessRepo.On("ListBusinesses", ctx, tenantID, 10, 0).Return(businesses, 1, nil)

	// Act
	result, total, err := service.ListBusinesses(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, 1, total)
	assert.Len(t, result[0].Sres, 0)
	assert.Len(t, result[0].Developers, 0)

	mockBusinessRepo.AssertExpectations(t)
}

// ========================================
// TestPopulatePersonnel - 3 test cases
// ========================================

func TestPopulatePersonnel_AllRoles(t *testing.T) {
	// Arrange
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := &service{personnelRepo: mockPersonnelRepo}

	ctx := context.Background()
	businessID := uuid.New()
	business := &types.Business{
		ID:   businessID,
		Name: "Test Business",
	}

	personnel := []types.BusinessPersonnel{
		{BusinessID: businessID, Identity: "sre1@example.com", Role: "sre"},
		{BusinessID: businessID, Identity: "sre2@example.com", Role: "sre"},
		{BusinessID: businessID, Identity: "dev1@example.com", Role: "developer"},
		{BusinessID: businessID, Identity: "tester1@example.com", Role: "tester"},
		{BusinessID: businessID, Identity: "bizops1@example.com", Role: "bizops"},
	}

	mockPersonnelRepo.On("ListByBusiness", ctx, businessID).Return(personnel, nil)

	// Act
	err := service.populatePersonnel(ctx, business)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, business.Sres, 2)
	assert.Contains(t, business.Sres, "sre1@example.com")
	assert.Contains(t, business.Sres, "sre2@example.com")
	assert.Len(t, business.Developers, 1)
	assert.Equal(t, "dev1@example.com", business.Developers[0])
	assert.Len(t, business.Testers, 1)
	assert.Equal(t, "tester1@example.com", business.Testers[0])
	assert.Len(t, business.Bizops, 1)
	assert.Equal(t, "bizops1@example.com", business.Bizops[0])

	mockPersonnelRepo.AssertExpectations(t)
}

func TestPopulatePersonnel_EmptyPersonnel(t *testing.T) {
	// Arrange
	mockPersonnelRepo := new(MockBusinessPersonnelRepository)
	service := &service{personnelRepo: mockPersonnelRepo}

	ctx := context.Background()
	businessID := uuid.New()
	business := &types.Business{
		ID:   businessID,
		Name: "Test Business",
	}

	mockPersonnelRepo.On("ListByBusiness", ctx, businessID).Return([]types.BusinessPersonnel{}, nil)

	// Act
	err := service.populatePersonnel(ctx, business)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, business.Sres, 0)
	assert.Len(t, business.Developers, 0)
	assert.Len(t, business.Testers, 0)
	assert.Len(t, business.Bizops, 0)

	mockPersonnelRepo.AssertExpectations(t)
}

func TestPopulatePersonnel_NilRepo(t *testing.T) {
	// Arrange
	service := &service{personnelRepo: nil}

	ctx := context.Background()
	business := &types.Business{
		ID:   uuid.New(),
		Name: "Test Business",
	}

	// Act
	err := service.populatePersonnel(ctx, business)

	// Assert
	assert.NoError(t, err) // Should return nil when repo is nil
	assert.Len(t, business.Sres, 0)
}

// ========================================
// TestPopulatePersonnelBatch - 2 test cases
// ========================================

func TestPopulatePersonnelBatch_MultipleBusinesses(t *testing.T) {
	// Arrange
	service := &service{}

	businessID1 := uuid.New()
	businessID2 := uuid.New()
	businessID3 := uuid.New()

	businesses := []types.Business{
		{ID: businessID1, Name: "Business 1"},
		{ID: businessID2, Name: "Business 2"},
		{ID: businessID3, Name: "Business 3"},
	}

	allPersonnel := []types.BusinessPersonnel{
		{BusinessID: businessID1, Identity: "sre1@example.com", Role: "sre"},
		{BusinessID: businessID1, Identity: "dev1@example.com", Role: "developer"},
		{BusinessID: businessID2, Identity: "sre2@example.com", Role: "sre"},
		{BusinessID: businessID2, Identity: "tester2@example.com", Role: "tester"},
		{BusinessID: businessID3, Identity: "bizops3@example.com", Role: "bizops"},
	}

	// Act
	service.populatePersonnelBatch(businesses, allPersonnel)

	// Assert
	// Business 1
	assert.Len(t, businesses[0].Sres, 1)
	assert.Equal(t, "sre1@example.com", businesses[0].Sres[0])
	assert.Len(t, businesses[0].Developers, 1)
	assert.Equal(t, "dev1@example.com", businesses[0].Developers[0])

	// Business 2
	assert.Len(t, businesses[1].Sres, 1)
	assert.Equal(t, "sre2@example.com", businesses[1].Sres[0])
	assert.Len(t, businesses[1].Testers, 1)
	assert.Equal(t, "tester2@example.com", businesses[1].Testers[0])

	// Business 3
	assert.Len(t, businesses[2].Bizops, 1)
	assert.Equal(t, "bizops3@example.com", businesses[2].Bizops[0])
}

func TestPopulatePersonnelBatch_EmptyPersonnel(t *testing.T) {
	// Arrange
	service := &service{}

	businessID := uuid.New()
	businesses := []types.Business{
		{ID: businessID, Name: "Business 1"},
	}

	// Act
	service.populatePersonnelBatch(businesses, []types.BusinessPersonnel{})

	// Assert
	assert.Len(t, businesses[0].Sres, 0)
	assert.Len(t, businesses[0].Developers, 0)
	assert.Len(t, businesses[0].Testers, 0)
	assert.Len(t, businesses[0].Bizops, 0)
}
