package business

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/wend/cmdb-backend/internal/types"
)

// MockBusinessSetRepository for testing
type MockBusinessSetRepository struct {
	mock.Mock
}

func (m *MockBusinessSetRepository) CreateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error {
	args := m.Called(ctx, businessSet)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) CreateBusinessSetMember(ctx context.Context, member *types.BusinessSetMember) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) CreateBusinessSetWithMember(ctx context.Context, businessSet *types.BusinessSet, member *types.BusinessSetMember) error {
	args := m.Called(ctx, businessSet, member)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) GetBusinessSetByID(ctx context.Context, tenantID, id string) (*types.BusinessSet, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.BusinessSet), args.Error(1)
}

func (m *MockBusinessSetRepository) ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error) {
	args := m.Called(ctx, tenantID, limit, offset)
	if args.Get(0) == nil {
		return nil, args.Int(1), args.Error(2)
	}
	return args.Get(0).([]types.BusinessSet), args.Int(1), args.Error(2)
}

func (m *MockBusinessSetRepository) UpdateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error {
	args := m.Called(ctx, businessSet)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) DeleteBusinessSet(ctx context.Context, tenantID, id string) error {
	args := m.Called(ctx, tenantID, id)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uuid.UUID, error) {
	args := m.Called(ctx, businessSetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uuid.UUID), args.Error(1)
}

func (m *MockBusinessSetRepository) AddBusinessToSet(ctx context.Context, member *types.BusinessSetMember) error {
	args := m.Called(ctx, member)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) RemoveBusinessFromSet(ctx context.Context, businessSetID, businessID uuid.UUID) error {
	args := m.Called(ctx, businessSetID, businessID)
	return args.Error(0)
}

func (m *MockBusinessSetRepository) CheckIdentifierExists(ctx context.Context, tenantID, identifier string, excludeID string) (bool, error) {
	args := m.Called(ctx, tenantID, identifier, excludeID)
	return args.Bool(0), args.Error(1)
}

// ========================================
// CreateBusinessSet - 4 test cases
// ========================================

func TestCreateBusinessSet_Success(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	req := &types.CreateBusinessSetRequest{
		Name:        "Test Business Set",
		Description: stringPtr("Test description"),
		Identifier:  "test-set",
		BusinessID:  businessID,
	}

	existingBusiness := &types.Business{
		ID:   businessID,
		Name: "Existing Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(existingBusiness, nil)
	mockBusinessSetRepo.On("CreateBusinessSetWithMember", ctx, mock.AnythingOfType("*types.BusinessSet"), mock.AnythingOfType("*types.BusinessSetMember")).Return(nil)

	// Act
	result, err := service.CreateBusinessSet(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "Test Business Set", result.Name)
	assert.Equal(t, "test-set", result.Identifier)
	assert.NotNil(t, result.Description)
	assert.Equal(t, "Test description", *result.Description)

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertExpectations(t)
}

func TestCreateBusinessSet_AutoGenerateIdentifier(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	req := &types.CreateBusinessSetRequest{
		Name:       "My Test Set",
		Identifier: "", // Empty identifier should be auto-generated
		BusinessID: businessID,
	}

	existingBusiness := &types.Business{
		ID:   businessID,
		Name: "Existing Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(existingBusiness, nil)
	mockBusinessSetRepo.On("CreateBusinessSetWithMember", ctx, mock.MatchedBy(func(bs *types.BusinessSet) bool {
		// Verify identifier was auto-generated from name
		return bs.Identifier != "" && bs.Identifier[:12] == "my-test-set-"
	}), mock.AnythingOfType("*types.BusinessSetMember")).Return(nil)

	// Act
	result, err := service.CreateBusinessSet(ctx, req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.NotEmpty(t, result.Identifier)
	assert.Contains(t, result.Identifier, "my-test-set-")

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertExpectations(t)
}

func TestCreateBusinessSet_BusinessNotFound(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	req := &types.CreateBusinessSetRequest{
		Name:       "Test Business Set",
		Identifier: "test-set",
		BusinessID: businessID,
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(nil, fmt.Errorf("business not found"))

	// Act
	result, err := service.CreateBusinessSet(ctx, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "related business not found")

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertNotCalled(t, "CreateBusinessSetWithMember")
}

func TestCreateBusinessSet_RepositoryError(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessID := uuid.New()

	req := &types.CreateBusinessSetRequest{
		Name:       "Test Business Set",
		Identifier: "test-set",
		BusinessID: businessID,
	}

	existingBusiness := &types.Business{
		ID:   businessID,
		Name: "Existing Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(existingBusiness, nil)
	mockBusinessSetRepo.On("CreateBusinessSetWithMember", ctx, mock.AnythingOfType("*types.BusinessSet"), mock.AnythingOfType("*types.BusinessSetMember")).Return(fmt.Errorf("database error"))

	// Act
	result, err := service.CreateBusinessSet(ctx, req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "database error")

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// GetBusinessSet - 2 test cases
// ========================================

func TestGetBusinessSet_Success(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	expectedBusinessSet := &types.BusinessSet{
		ID:         businessSetID,
		Name:       "Test Business Set",
		Identifier: "test-set",
	}

	mockBusinessSetRepo.On("GetBusinessSetByID", ctx, tenantID, businessSetID.String()).Return(expectedBusinessSet, nil)

	// Act
	result, err := service.GetBusinessSet(ctx, tenantID, businessSetID.String())

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "Test Business Set", result.Name)
	assert.Equal(t, "test-set", result.Identifier)

	mockBusinessSetRepo.AssertExpectations(t)
}

func TestGetBusinessSet_NotFound(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	mockBusinessSetRepo.On("GetBusinessSetByID", ctx, tenantID, businessSetID.String()).Return(nil, fmt.Errorf("business set not found"))

	// Act
	result, err := service.GetBusinessSet(ctx, tenantID, businessSetID.String())

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)

	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// ListBusinessSets - 2 test cases
// ========================================

func TestListBusinessSets_MultipleWithPagination(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	businessSets := []types.BusinessSet{
		{ID: uuid.New(), Name: "Business Set 1", Identifier: "set-1"},
		{ID: uuid.New(), Name: "Business Set 2", Identifier: "set-2"},
		{ID: uuid.New(), Name: "Business Set 3", Identifier: "set-3"},
	}

	mockBusinessSetRepo.On("ListBusinessSets", ctx, tenantID, 10, 0).Return(businessSets, 3, nil)

	// Act
	result, total, err := service.ListBusinessSets(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 3)
	assert.Equal(t, 3, total)
	assert.Equal(t, "Business Set 1", result[0].Name)
	assert.Equal(t, "Business Set 2", result[1].Name)
	assert.Equal(t, "Business Set 3", result[2].Name)

	mockBusinessSetRepo.AssertExpectations(t)
}

func TestListBusinessSets_Empty(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"

	mockBusinessSetRepo.On("ListBusinessSets", ctx, tenantID, 10, 0).Return([]types.BusinessSet{}, 0, nil)

	// Act
	result, total, err := service.ListBusinessSets(ctx, tenantID, 10, 0)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 0)
	assert.Equal(t, 0, total)

	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// UpdateBusinessSet - 4 test cases
// ========================================

func TestUpdateBusinessSet_AllFields(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	existingBusinessSet := &types.BusinessSet{
		ID:         businessSetID,
		TenantID:   uuid.MustParse(tenantID),
		Name:       "Old Name",
		Identifier: "old-identifier",
	}

	newName := "Updated Name"
	newDescription := "Updated description"
	newIdentifier := "new-identifier"
	newScope := `{"key": "value"}`
	newMaintainers := []uuid.UUID{uuid.New(), uuid.New()}

	req := &types.UpdateBusinessSetRequest{
		Name:        &newName,
		Description: &newDescription,
		Identifier:  &newIdentifier,
		Scope:       &newScope,
		Maintainers: &newMaintainers,
	}

	mockBusinessSetRepo.On("GetBusinessSetByID", ctx, tenantID, businessSetID.String()).Return(existingBusinessSet, nil)
	mockBusinessSetRepo.On("CheckIdentifierExists", ctx, tenantID, newIdentifier, businessSetID.String()).Return(false, nil)
	mockBusinessSetRepo.On("UpdateBusinessSet", ctx, mock.MatchedBy(func(bs *types.BusinessSet) bool {
		return bs.Name == newName &&
			bs.Identifier == newIdentifier &&
			*bs.Description == newDescription &&
			*bs.Scope == newScope &&
			len(bs.Maintainers) == 2
	})).Return(nil)

	// Act
	result, err := service.UpdateBusinessSet(ctx, tenantID, businessSetID.String(), req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, newName, result.Name)
	assert.Equal(t, newIdentifier, result.Identifier)
	assert.Equal(t, newDescription, *result.Description)

	mockBusinessSetRepo.AssertExpectations(t)
}

func TestUpdateBusinessSet_IdentifierConflict(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	existingBusinessSet := &types.BusinessSet{
		ID:         businessSetID,
		TenantID:   uuid.MustParse(tenantID),
		Name:       "Old Name",
		Identifier: "old-identifier",
	}

	newIdentifier := "conflicting-identifier"
	req := &types.UpdateBusinessSetRequest{
		Identifier: &newIdentifier,
	}

	mockBusinessSetRepo.On("GetBusinessSetByID", ctx, tenantID, businessSetID.String()).Return(existingBusinessSet, nil)
	mockBusinessSetRepo.On("CheckIdentifierExists", ctx, tenantID, newIdentifier, businessSetID.String()).Return(true, nil)

	// Act
	result, err := service.UpdateBusinessSet(ctx, tenantID, businessSetID.String(), req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "already exists")

	mockBusinessSetRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertNotCalled(t, "UpdateBusinessSet")
}

func TestUpdateBusinessSet_NotFound(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	newName := "Updated Name"
	req := &types.UpdateBusinessSetRequest{
		Name: &newName,
	}

	mockBusinessSetRepo.On("GetBusinessSetByID", ctx, tenantID, businessSetID.String()).Return(nil, fmt.Errorf("business set not found"))

	// Act
	result, err := service.UpdateBusinessSet(ctx, tenantID, businessSetID.String(), req)

	// Assert
	assert.Error(t, err)
	assert.Nil(t, result)

	mockBusinessSetRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertNotCalled(t, "UpdateBusinessSet")
}

func TestUpdateBusinessSet_PartialUpdate(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	existingBusinessSet := &types.BusinessSet{
		ID:         businessSetID,
		TenantID:   uuid.MustParse(tenantID),
		Name:       "Old Name",
		Identifier: "old-identifier",
	}

	newName := "Updated Name"
	req := &types.UpdateBusinessSetRequest{
		Name: &newName, // Only updating name
	}

	mockBusinessSetRepo.On("GetBusinessSetByID", ctx, tenantID, businessSetID.String()).Return(existingBusinessSet, nil)
	mockBusinessSetRepo.On("UpdateBusinessSet", ctx, mock.MatchedBy(func(bs *types.BusinessSet) bool {
		return bs.Name == newName && bs.Identifier == "old-identifier" // Identifier unchanged
	})).Return(nil)

	// Act
	result, err := service.UpdateBusinessSet(ctx, tenantID, businessSetID.String(), req)

	// Assert
	assert.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, newName, result.Name)
	assert.Equal(t, "old-identifier", result.Identifier) // Should remain unchanged

	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// DeleteBusinessSet - 2 test cases
// ========================================

func TestDeleteBusinessSet_Success(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	mockBusinessSetRepo.On("DeleteBusinessSet", ctx, tenantID, businessSetID.String()).Return(nil)

	// Act
	err := service.DeleteBusinessSet(ctx, tenantID, businessSetID.String())

	// Assert
	assert.NoError(t, err)

	mockBusinessSetRepo.AssertExpectations(t)
}

func TestDeleteBusinessSet_NotFound(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()

	mockBusinessSetRepo.On("DeleteBusinessSet", ctx, tenantID, businessSetID.String()).Return(fmt.Errorf("business set not found"))

	// Act
	err := service.DeleteBusinessSet(ctx, tenantID, businessSetID.String())

	// Assert
	assert.Error(t, err)

	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// AddBusinessToSet - 3 test cases
// ========================================

func TestAddBusinessToSet_Success(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()
	businessID := uuid.New()

	req := &types.AddBusinessToSetRequest{
		BusinessID: businessID,
	}

	existingBusiness := &types.Business{
		ID:   businessID,
		Name: "Existing Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(existingBusiness, nil)
	mockBusinessSetRepo.On("AddBusinessToSet", ctx, mock.MatchedBy(func(member *types.BusinessSetMember) bool {
		return member.BusinessSetID == businessSetID && member.BusinessID == businessID
	})).Return(nil)

	// Act
	err := service.AddBusinessToSet(ctx, businessSetID, req)

	// Assert
	assert.NoError(t, err)

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertExpectations(t)
}

func TestAddBusinessToSet_BusinessNotFound(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()
	businessID := uuid.New()

	req := &types.AddBusinessToSetRequest{
		BusinessID: businessID,
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(nil, fmt.Errorf("business not found"))

	// Act
	err := service.AddBusinessToSet(ctx, businessSetID, req)

	// Assert
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "business not found")

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertNotCalled(t, "AddBusinessToSet")
}

func TestAddBusinessToSet_DuplicateMember(t *testing.T) {
	// Arrange
	mockBusinessRepo := new(MockBusinessRepository)
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(mockBusinessRepo, mockBusinessSetRepo, nil)

	ctx := context.Background()
	tenantID := "00000000-0000-0000-0000-000000000001"
	businessSetID := uuid.New()
	businessID := uuid.New()

	req := &types.AddBusinessToSetRequest{
		BusinessID: businessID,
	}

	existingBusiness := &types.Business{
		ID:   businessID,
		Name: "Existing Business",
	}

	mockBusinessRepo.On("GetBusinessByID", ctx, tenantID, businessID.String()).Return(existingBusiness, nil)
	mockBusinessSetRepo.On("AddBusinessToSet", ctx, mock.AnythingOfType("*types.BusinessSetMember")).Return(fmt.Errorf("business is already a member of this business set"))

	// Act
	err := service.AddBusinessToSet(ctx, businessSetID, req)

	// Assert
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already a member")

	mockBusinessRepo.AssertExpectations(t)
	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// RemoveBusinessFromSet - 2 test cases
// ========================================

func TestRemoveBusinessFromSet_Success(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	businessSetID := uuid.New()
	businessID := uuid.New()

	mockBusinessSetRepo.On("RemoveBusinessFromSet", ctx, businessSetID, businessID).Return(nil)

	// Act
	err := service.RemoveBusinessFromSet(ctx, businessSetID, businessID)

	// Assert
	assert.NoError(t, err)

	mockBusinessSetRepo.AssertExpectations(t)
}

func TestRemoveBusinessFromSet_NonExistentMember(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	businessSetID := uuid.New()
	businessID := uuid.New()

	mockBusinessSetRepo.On("RemoveBusinessFromSet", ctx, businessSetID, businessID).Return(fmt.Errorf("business is not a member of this business set"))

	// Act
	err := service.RemoveBusinessFromSet(ctx, businessSetID, businessID)

	// Assert
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not a member")

	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// ListBusinessSetMembers - 2 test cases
// ========================================

func TestListBusinessSetMembers_Multiple(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	businessSetID := uuid.New()

	memberIDs := []uuid.UUID{
		uuid.New(),
		uuid.New(),
		uuid.New(),
	}

	mockBusinessSetRepo.On("ListBusinessSetMembers", ctx, businessSetID).Return(memberIDs, nil)

	// Act
	result, err := service.ListBusinessSetMembers(ctx, businessSetID)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 3)
	assert.Equal(t, memberIDs, result)

	mockBusinessSetRepo.AssertExpectations(t)
}

func TestListBusinessSetMembers_Empty(t *testing.T) {
	// Arrange
	mockBusinessSetRepo := new(MockBusinessSetRepository)
	service := NewService(nil, mockBusinessSetRepo, nil)

	ctx := context.Background()
	businessSetID := uuid.New()

	mockBusinessSetRepo.On("ListBusinessSetMembers", ctx, businessSetID).Return([]uuid.UUID{}, nil)

	// Act
	result, err := service.ListBusinessSetMembers(ctx, businessSetID)

	// Assert
	assert.NoError(t, err)
	assert.Len(t, result, 0)

	mockBusinessSetRepo.AssertExpectations(t)
}

// ========================================
// Helper functions
// ========================================

func stringPtr(s string) *string {
	return &s
}
