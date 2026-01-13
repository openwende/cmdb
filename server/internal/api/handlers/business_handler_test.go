package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/wend/cmdb-backend/internal/types"
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

func (m *MockService) GetBusiness(ctx context.Context, tenantID, id string) (*types.Business, error) {
	args := m.Called(ctx, tenantID, id)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockService) UpdateBusiness(ctx context.Context, tenantID, id string, req *types.UpdateBusinessRequest) (*types.Business, error) {
	args := m.Called(ctx, tenantID, id, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.Business), args.Error(1)
}

func (m *MockService) DeleteBusiness(ctx context.Context, tenantID, id string) error {
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

func (m *MockService) CreateBusinessSet(ctx context.Context, req *types.CreateBusinessSetRequest) (*types.BusinessSet, error) {
	args := m.Called(ctx, req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*types.BusinessSet), args.Error(1)
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
			ID:   uuid.New(),
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
}

func TestGetBusiness(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("Success", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.GET("/businesses/:id", handler.GetBusiness)

		id := uuid.New().String()
		expectedBusiness := &types.Business{
			ID:   uuid.MustParse(id),
			Name: "Existing Business",
		}

		mockService.On("GetBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).Return(expectedBusiness, nil)

		req, _ := http.NewRequest(http.MethodGet, "/businesses/"+id, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusOK, w.Code)
	})

	t.Run("Not Found", func(t *testing.T) {
		mockService := new(MockService)
		handler := NewBusinessHandler(mockService)
		router := gin.Default()
		router.GET("/businesses/:id", handler.GetBusiness)

		id := uuid.New().String()

		mockService.On("GetBusiness", mock.Anything, "00000000-0000-0000-0000-000000000001", id).Return(nil, errors.New("business not found"))

		req, _ := http.NewRequest(http.MethodGet, "/businesses/"+id, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		assert.Equal(t, http.StatusNotFound, w.Code)
	})
}
