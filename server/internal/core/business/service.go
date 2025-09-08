package business

import (
    "context"
    "fmt"
    "strings"
    "time"

    "github.com/wend/cmdb-backend/internal/storage"
    "github.com/wend/cmdb-backend/internal/types"

    "github.com/google/uuid"
)

type Service interface {
	CreateBusiness(ctx context.Context, req *types.CreateBusinessRequest) (*types.Business, error)
	GetBusiness(ctx context.Context, tenantID, id string) (*types.Business, error)
	UpdateBusiness(ctx context.Context, tenantID, id string, req *types.UpdateBusinessRequest) (*types.Business, error)
	DeleteBusiness(ctx context.Context, tenantID, id string) error
	ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error)
	CreateBusinessSet(ctx context.Context, req *types.CreateBusinessSetRequest) (*types.BusinessSet, error)
}

type service struct {
	businessRepo    storage.BusinessRepository
	businessSetRepo storage.BusinessSetRepository
}

func NewService(businessRepo storage.BusinessRepository, businessSetRepo storage.BusinessSetRepository) Service {
	return &service{businessRepo: businessRepo, businessSetRepo: businessSetRepo}
}

func (s *service) CreateBusiness(ctx context.Context, req *types.CreateBusinessRequest) (*types.Business, error) {
    now := time.Now()

	// Generate an identifier from the name if not provided
	identifier := req.Identifier
	if identifier == "" {
		identifier = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
		identifier = fmt.Sprintf("%s-%d", identifier, time.Now().Unix())
	}

	// Create the business object with defaults for required fields
    business := &types.Business{
        ID:          uuid.New(),
        CreatedAt:   now,
        UpdatedAt:   now,
        TenantID:    uuid.MustParse("00000000-0000-0000-0000-000000000001"), // Default tenant
        Name:        req.Name,
        Identifier:  identifier,
        Description: req.Description,
        Lifecycle:   "production",     // Default value
        Timezone:    "UTC",            // Default value
        Language:    "en",             // Default value
        Maintainers: []uuid.UUID{}, // Default to an empty array
        IsBuiltIn:   false,
        Sres:        req.Sres,
        Developers:  req.Developers,
        Testers:     req.Testers,
        Bizops:      req.Bizops,
    }

	err := s.businessRepo.CreateBusiness(ctx, business)
	if err != nil {
		return nil, err
	}
	return business, nil
}

func (s *service) GetBusiness(ctx context.Context, tenantID, id string) (*types.Business, error) {
	return s.businessRepo.GetBusinessByID(ctx, tenantID, id)
}

func (s *service) UpdateBusiness(ctx context.Context, tenantID, id string, req *types.UpdateBusinessRequest) (*types.Business, error) {
	// 首先获取现有业务
	business, err := s.businessRepo.GetBusinessByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	// 检查标识符是否已存在（如果要更新标识符）
	if req.Identifier != nil && *req.Identifier != business.Identifier {
		exists, err := s.businessRepo.CheckIdentifierExists(ctx, tenantID, *req.Identifier, id)
		if err != nil {
			return nil, fmt.Errorf("failed to check identifier: %w", err)
		}
		if exists {
			return nil, fmt.Errorf("business with identifier '%s' already exists", *req.Identifier)
		}
		business.Identifier = *req.Identifier
	}

	// 更新字段
	business.UpdatedAt = time.Now()
	if req.Name != nil {
		business.Name = *req.Name
	}
	if req.Description != nil {
		business.Description = req.Description
	}
	if req.Lifecycle != nil {
		business.Lifecycle = *req.Lifecycle
	}
	if req.Timezone != nil {
		business.Timezone = *req.Timezone
	}
	if req.Language != nil {
		business.Language = *req.Language
	}
	if req.Maintainers != nil {
		business.Maintainers = *req.Maintainers
	}
	if req.Sres != nil {
		business.Sres = *req.Sres
	}
	if req.Developers != nil {
		business.Developers = *req.Developers
	}
	if req.Testers != nil {
		business.Testers = *req.Testers
	}
	if req.Bizops != nil {
		business.Bizops = *req.Bizops
	}

	err = s.businessRepo.UpdateBusiness(ctx, business)
	if err != nil {
		return nil, err
	}

	return business, nil
}

func (s *service) DeleteBusiness(ctx context.Context, tenantID, id string) error {
	return s.businessRepo.DeleteBusiness(ctx, tenantID, id)
}

func (s *service) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	return s.businessRepo.ListBusinesses(ctx, tenantID, limit, offset)
}

func (s *service) CreateBusinessSet(ctx context.Context, req *types.CreateBusinessSetRequest) (*types.BusinessSet, error) {
    now := time.Now()

	// Generate an identifier from the name if not provided
	identifier := req.Identifier
	if identifier == "" {
		identifier = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
		identifier = fmt.Sprintf("%s-%d", identifier, time.Now().Unix())
	}

	// Create the business set object
	scope := "{}"
    businessSet := &types.BusinessSet{
        ID:          uuid.New(),
        CreatedAt:   now,
        UpdatedAt:   now,
        TenantID:    uuid.MustParse("00000000-0000-0000-0000-000000000001"), // Default tenant
        Name:        req.Name,
        Identifier:  identifier,
        Description: req.Description,
        Scope:       &scope, // Default to an empty JSON object
        Maintainers: []uuid.UUID{},
    }

    // Ensure the business exists (basic referential integrity check at service level)
    // Using default tenant for MVP
    tenantID := "00000000-0000-0000-0000-000000000001"
    if _, err := s.businessRepo.GetBusinessByID(ctx, tenantID, req.BusinessID.String()); err != nil {
        return nil, fmt.Errorf("related business not found: %w", err)
    }

    // Link the business set to the business within a transaction
    member := &types.BusinessSetMember{
        ID:            uuid.New(),
        CreatedAt:     now,
        BusinessSetID: businessSet.ID,
        BusinessID:    req.BusinessID,
    }

    if txRepo, ok := s.businessSetRepo.(interface{ CreateBusinessSetWithMember(context.Context, *types.BusinessSet, *types.BusinessSetMember) error }); ok {
        if err := txRepo.CreateBusinessSetWithMember(ctx, businessSet, member); err != nil {
            return nil, err
        }
        return businessSet, nil
    }

    // Fallback (should not happen): create sequentially
    if err := s.businessSetRepo.CreateBusinessSet(ctx, businessSet); err != nil {
        return nil, err
    }
    if err := s.businessSetRepo.CreateBusinessSetMember(ctx, member); err != nil {
        return nil, err
    }
    return businessSet, nil
}
