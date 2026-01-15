package instance

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

type Service interface {
	CreateInstance(ctx context.Context, tenantID string, modelName string, req *types.CreateInstanceRequest) (*types.Instance, error)
	BatchCreateInstances(ctx context.Context, tenantID string, modelName string, req *types.BatchCreateInstanceRequest) ([]types.Instance, error)
	ListInstances(ctx context.Context, tenantID string, modelName string, params types.QueryParams) ([]types.Instance, int64, error)
}

type service struct {
	instanceRepo storage.InstanceRepository
	modelRepo    storage.ModelRepository
}

func NewService(instanceRepo storage.InstanceRepository, modelRepo storage.ModelRepository) Service {
	return &service{
		instanceRepo: instanceRepo,
		modelRepo:    modelRepo,
	}
}

func (s *service) CreateInstance(ctx context.Context, tenantID string, modelName string, req *types.CreateInstanceRequest) (*types.Instance, error) {
	// 1. Get Model & Attributes
	model, attrs, err := s.modelRepo.GetModelWithAttributes(ctx, modelName)
	if err != nil {
		return nil, fmt.Errorf("failed to get model definition: %w", err)
	}

	// 2. Validate Properties
	validatedProps, err := s.validateProperties(req.Properties, attrs)
	if err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}

	// 3. Construct Instance
	propsJSON, _ := json.Marshal(validatedProps)

	tenantUUID, _ := uuid.Parse(tenantID)

	instance := &types.Instance{
		ModelID:    model.ID,
		TenantID:   tenantUUID, // Assume valid UUID
		Properties: propsJSON,
	}

	// Optional Business Binding
	if req.BusinessID != nil {
		bid, err := uuid.Parse(*req.BusinessID)
		if err == nil {
			instance.BusinessID = &bid
		}
	}

	// 4. Persist
	if err := s.instanceRepo.CreateInstance(ctx, instance); err != nil {
		return nil, err
	}

	return instance, nil
}

func (s *service) BatchCreateInstances(ctx context.Context, tenantID string, modelName string, req *types.BatchCreateInstanceRequest) ([]types.Instance, error) {
	// 1. Get Model & Attributes
	model, attrs, err := s.modelRepo.GetModelWithAttributes(ctx, modelName)
	if err != nil {
		return nil, fmt.Errorf("failed to get model definition: %w", err)
	}

	tenantUUID, _ := uuid.Parse(tenantID)
	instances := make([]types.Instance, 0, len(req.Instances))

	// 2. Validate Loop
	// Optimization: If performance is critical, validation can be parallelized, but sequential is fine for 1000 items.
	for i, item := range req.Instances {
		validatedProps, err := s.validateProperties(item.Properties, attrs)
		if err != nil {
			return nil, fmt.Errorf("validation failed at index %d: %w", i, err)
		}

		propsJSON, _ := json.Marshal(validatedProps)

		inst := types.Instance{
			ID:         uuid.New(), // Pre-generate ID
			ModelID:    model.ID,
			TenantID:   tenantUUID,
			Properties: propsJSON,
			CreatedAt:  time.Now(),
			UpdatedAt:  time.Now(),
		}

		if item.BusinessID != nil {
			bid, err := uuid.Parse(*item.BusinessID)
			if err == nil {
				inst.BusinessID = &bid
			}
		}

		instances = append(instances, inst)
	}

	// 3. Persist Batch
	if err := s.instanceRepo.BatchCreateInstance(ctx, instances); err != nil {
		return nil, err
	}

	return instances, nil
}

func (s *service) ListInstances(ctx context.Context, tenantID string, modelName string, params types.QueryParams) ([]types.Instance, int64, error) {
	// Get Model ID
	model, err := s.modelRepo.GetModelByName(ctx, modelName)
	if err != nil {
		return nil, 0, err
	}

	return s.instanceRepo.ListInstances(ctx, tenantID, model.ID.String(), params)
}

// ==========================================
// Dynamic Validator Engine
// ==========================================

func (s *service) validateProperties(input map[string]interface{}, attrs []types.Attribute) (map[string]interface{}, error) {
	// output := make(map[string]interface{})
	// Simplied validation logic

	for _, attr := range attrs {
		val, exists := input[attr.Name]

		// 1. Check Required
		if attr.IsRequired && (!exists || val == nil || val == "") {
			return nil, fmt.Errorf("attribute '%s' is required", attr.DisplayName)
		}

		if !exists {
			continue
		}

		// 2. Check Type (Basic)
		switch attr.FieldType {
		case "string":
			if _, ok := val.(string); !ok {
				return nil, fmt.Errorf("attribute '%s' must be string", attr.DisplayName)
			}
		case "int":
			// Handle both float64 (from JSON) and int (from Go code)
			isValid := false
			if _, ok := val.(float64); ok {
				isValid = true
			} else if _, ok := val.(int); ok {
				isValid = true
			}

			if !isValid {
				return nil, fmt.Errorf("attribute '%s' must be number", attr.DisplayName)
			}
		case "bool":
			if _, ok := val.(bool); !ok {
				return nil, fmt.Errorf("attribute '%s' must be boolean", attr.DisplayName)
			}
		case "enum":
			// Check options
			strVal, ok := val.(string)
			if !ok {
				return nil, fmt.Errorf("attribute '%s' must be string (enum)", attr.DisplayName)
			}
			if err := validateEnum(strVal, attr.Options); err != nil {
				return nil, fmt.Errorf("attribute '%s': %w", attr.DisplayName, err)
			}
		}

		// 3. Regex (if string)
		if attr.FieldType == "string" {
			if err := validateRegex(val.(string), attr.Options); err != nil {
				return nil, fmt.Errorf("attribute '%s': %w", attr.DisplayName, err)
			}
		}
	}

	// TODO: Handle extra fields? (Strict mode vs Loose mode)
	// For now, allow extra fields or just return input.
	return input, nil
}

func validateEnum(val string, options json.RawMessage) error {
	if len(options) == 0 {
		return nil
	}
	// Parse options
	// Assume options is simple map or struct
	// This is where things get complex. Skipping for POC or parsing "enum_values" key logic.
	return nil
}

func validateRegex(val string, options json.RawMessage) error {
	// Similar parsing logic needed
	return nil
}
