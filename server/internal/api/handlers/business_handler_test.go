package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/wend/cmdb-backend/internal/core/business"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"
)

// MockService is a mock implementation of business.Service
type MockService struct {
	mock.Mock
}

func (m *MockService) CreateBusiness(ctx context.Context, req *types.CreateBusinessRequest) (*types.Business, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockService) GetBusiness(ctx context.Context, tenantID string, id uint64) (*types.Business, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockService) UpdateBusiness(ctx context.Context, tenantID string, id uint64, req *types.UpdateBusinessRequest) (*types.Business, error) {
	args := m.Called(ctx, tenantID, id, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockService) DeleteBusiness(ctx context.Context, tenantID string, id uint64) error {
	args := m.Called(ctx, tenantID, id)
	return args.Error(0)
}

func (m *MockService) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	args := m.Called(ctx, tenantID, limit, offset)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]types.Business), args.Int(1), args.Error(2)
}

func (m *MockService) SetTopologyInitializer(fn business.TopologyInitializer) {}

func (m *MockService) CreateBusinessSet(ctx context.Context, req *types.CreateBusinessSetRequest) (*types.BusinessSet, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.BusinessSet), args.Error(1)
}

func (m *MockService) GetBusinessSet(ctx context.Context, tenantID, id string) (*types.BusinessSet, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.BusinessSet), args.Error(1)
}

func (m *MockService) ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error) {
	args := m.Called(ctx, tenantID, limit, offset)
	if args.Get(0) == nil {
		return nil, 0, args.Error(2)
	}
	return args.Get(0).([]types.BusinessSet), args.Int(1), args.Error(2)
}

func (m *MockService) UpdateBusinessSet(ctx context.Context, tenantID, id string, req *types.UpdateBusinessSetRequest) (*types.BusinessSet, error) {
	args := m.Called(ctx, tenantID, id, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.BusinessSet), args.Error(1)
}

func (m *MockService) DeleteBusinessSet(ctx context.Context, tenantID, id string) error {
	args := m.Called(ctx, tenantID, id)
	return args.Error(0)
}

func (m *MockService) AddBusinessToSet(ctx context.Context, businessSetID uuid.UUID, req *types.AddBusinessToSetRequest) error {
	args := m.Called(ctx, businessSetID, req)
	return args.Error(0)
}

func (m *MockService) RemoveBusinessFromSet(ctx context.Context, businessSetID uuid.UUID, businessID uint64) error {
	args := m.Called(ctx, businessSetID, businessID)
	return args.Error(0)
}

func (m *MockService) ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uint64, error) {
	args := m.Called(ctx, businessSetID)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]uint64), args.Error(1)
}

func TestCreateBusiness(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.POST("/businesses", handler.CreateBusiness)

		name := "Test Business"
		reqBody := types.CreateBusinessRequest{Name: name}

		expectedBusiness := &types.Business{
			ID:   1001,
			Name: name,
		}

		mockService.On("CreateBusiness", mock.Anything, &reqBody).Return(expectedBusiness, nil)

		body, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/businesses", bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusCreated, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, true, response["success"])
	})

	t.Run("Validation Error", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.POST("/businesses", handler.CreateBusiness)

		// Empty name
		reqBody := types.CreateBusinessRequest{Name: ""}

		body, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/businesses", bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("Already Exists", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.POST("/businesses", handler.CreateBusiness)

		name := "Test Business"
		reqBody := types.CreateBusinessRequest{Name: name}

		mockService.On("CreateBusiness", mock.Anything, &reqBody).Return(nil, apperrors.AlreadyExistsError("business", name))

		body, _ := json.Marshal(reqBody)
		req, _ := http.NewRequest(http.MethodPost, "/businesses", bytes.NewBuffer(body))
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusConflict, w.Code)
	})
}

func TestGetBusiness(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.GET("/businesses/:id", handler.GetBusiness)

		id := uint64(1001)
		expectedBusiness := &types.Business{
			ID:   id,
			Name: "Existing Business",
		}

		mockService.On("GetBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).Return(expectedBusiness, nil)

		req, _ := http.NewRequest(http.MethodGet, "/businesses/1001", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Not Found", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.GET("/businesses/:id", handler.GetBusiness)

		id := uint64(1002)

		mockService.On("GetBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).Return(nil, apperrors.NotFoundError("business", "1002"))

		req, _ := http.NewRequest(http.MethodGet, "/businesses/1002", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}

func TestDeleteBusiness(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success - Delete Offline Business", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.DELETE("/businesses/:id", handler.DeleteBusiness)

		id := uint64(1001)
		mockService.On("DeleteBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).Return(nil)

		req, _ := http.NewRequest(http.MethodDelete, "/businesses/1001", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, true, response["success"])
		assert.Equal(t, "Business deleted successfully", response["message"])
	})

	t.Run("Fail - Delete Online Business", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.DELETE("/businesses/:id", handler.DeleteBusiness)

		id := uint64(1001)
		mockService.On("DeleteBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).
			Return(apperrors.InvalidStateError("business", "online", "offline"))

		req, _ := http.NewRequest(http.MethodDelete, "/businesses/1001", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, false, response["success"])
		assert.Equal(t, "INVALID_STATE", response["error"])
	})

	t.Run("Fail - Business Not Found", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.DELETE("/businesses/:id", handler.DeleteBusiness)

		id := uint64(9999)
		mockService.On("DeleteBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).
			Return(apperrors.NotFoundError("business", "9999"))

		req, _ := http.NewRequest(http.MethodDelete, "/businesses/9999", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, false, response["success"])
		assert.Equal(t, "NOT_FOUND", response["error"])
	})

	t.Run("Fail - Invalid ID", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.DELETE("/businesses/:id", handler.DeleteBusiness)

		req, _ := http.NewRequest(http.MethodDelete, "/businesses/invalid-id", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})
}
