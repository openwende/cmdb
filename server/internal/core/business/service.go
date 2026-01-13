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

	// Business Set operations
	CreateBusinessSet(ctx context.Context, req *types.CreateBusinessSetRequest) (*types.BusinessSet, error)
	GetBusinessSet(ctx context.Context, tenantID, id string) (*types.BusinessSet, error)
	ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error)
	UpdateBusinessSet(ctx context.Context, tenantID, id string, req *types.UpdateBusinessSetRequest) (*types.BusinessSet, error)
	DeleteBusinessSet(ctx context.Context, tenantID, id string) error
	AddBusinessToSet(ctx context.Context, businessSetID uuid.UUID, req *types.AddBusinessToSetRequest) error
	RemoveBusinessFromSet(ctx context.Context, businessSetID, businessID uuid.UUID) error
	ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uuid.UUID, error)
}

type service struct {
	businessRepo    storage.BusinessRepository
	businessSetRepo storage.BusinessSetRepository
	personnelRepo   storage.BusinessPersonnelRepository
}

func NewService(businessRepo storage.BusinessRepository, businessSetRepo storage.BusinessSetRepository, personnelRepo storage.BusinessPersonnelRepository) Service {
	return &service{businessRepo: businessRepo, businessSetRepo: businessSetRepo, personnelRepo: personnelRepo}
}

func (s *service) CreateBusiness(ctx context.Context, req *types.CreateBusinessRequest) (*types.Business, error) {
	now := time.Now()

	// Generate an identifier from the name if not provided
	identifier := req.Identifier
	if identifier == "" {
		identifier = strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
		identifier = fmt.Sprintf("%s-%d", identifier, time.Now().Unix())
	}

	// Determine lifecycle
	lifecycle := types.BusinessLifecycleOnline
	if req.Lifecycle != nil {
		lifecycle = *req.Lifecycle
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
		Lifecycle:   lifecycle,
		Timezone:    "UTC",         // Default value
		Language:    "en",          // Default value
		Maintainers: []uuid.UUID{}, // Default to an empty array
		IsBuiltIn:   false,
	}

	err := s.businessRepo.CreateBusiness(ctx, business)
	if err != nil {
		return nil, err
	}

	// Insert initial personnel if provided (normalized table)
	if s.personnelRepo != nil {
		addRole := func(idents []string, role string) {
			for _, idt := range idents {
				idt = strings.TrimSpace(idt)
				if idt == "" {
					continue
				}
				if err := s.personnelRepo.Add(ctx, &types.BusinessPersonnel{
					BusinessID: business.ID,
					Identity:   idt,
					Role:       role,
				}); err != nil {
					fmt.Printf("ERROR adding personnel: %v\n", err)
				}
			}
		}
		addRole(req.Sres, "sre")
		addRole(req.Developers, "developer")
		addRole(req.Testers, "tester")
		addRole(req.Bizops, "bizops")

		// Fill transient fields for response
		business.Sres = req.Sres
		business.Developers = req.Developers
		business.Testers = req.Testers
		business.Bizops = req.Bizops
	}
	return business, nil
}

func (s *service) GetBusiness(ctx context.Context, tenantID, id string) (*types.Business, error) {
	business, err := s.businessRepo.GetBusinessByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.populatePersonnel(ctx, business); err != nil {
		return nil, fmt.Errorf("failed to populate personnel: %w", err)
	}
	return business, nil
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
		switch *req.Lifecycle {
		case types.BusinessLifecycleTesting, types.BusinessLifecycleOnline, types.BusinessLifecycleOffline:
			business.Lifecycle = *req.Lifecycle
		default:
			return nil, fmt.Errorf("invalid lifecycle value: %s", *req.Lifecycle)
		}
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
	// Personnel arrays are normalized to business_personnel table (not part of Business fields)

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
	businesses, total, err := s.businessRepo.ListBusinesses(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	for i := range businesses {
		if err := s.populatePersonnel(ctx, &businesses[i]); err != nil {
			fmt.Printf("ERROR populating personnel for %s: %v\n", businesses[i].ID, err)
		}
	}
	return businesses, total, nil
}

func (s *service) populatePersonnel(ctx context.Context, b *types.Business) error {
	if s.personnelRepo == nil {
		return nil
	}
	personnel, err := s.personnelRepo.ListByBusiness(ctx, b.ID)
	if err != nil {
		return err
	}

	for _, p := range personnel {
		switch p.Role {
		case "sre":
			b.Sres = append(b.Sres, p.Identity)
		case "developer":
			b.Developers = append(b.Developers, p.Identity)
		case "tester":
			b.Testers = append(b.Testers, p.Identity)
		case "bizops":
			b.Bizops = append(b.Bizops, p.Identity)
		}
	}
	return nil
}

// ========================================
// Business Set operations
// ========================================

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

	if err := s.businessSetRepo.CreateBusinessSetWithMember(ctx, businessSet, member); err != nil {
		return nil, err
	}

	return businessSet, nil
}

func (s *service) GetBusinessSet(ctx context.Context, tenantID, id string) (*types.BusinessSet, error) {
	return s.businessSetRepo.GetBusinessSetByID(ctx, tenantID, id)
}

func (s *service) ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error) {
	return s.businessSetRepo.ListBusinessSets(ctx, tenantID, limit, offset)
}

func (s *service) UpdateBusinessSet(ctx context.Context, tenantID, id string, req *types.UpdateBusinessSetRequest) (*types.BusinessSet, error) {
	// Get existing business set
	businessSet, err := s.businessSetRepo.GetBusinessSetByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	// Check identifier uniqueness if updating
	if req.Identifier != nil && *req.Identifier != businessSet.Identifier {
		exists, err := s.businessSetRepo.CheckIdentifierExists(ctx, tenantID, *req.Identifier, id)
		if err != nil {
			return nil, fmt.Errorf("failed to check identifier: %w", err)
		}
		if exists {
			return nil, fmt.Errorf("business set with identifier '%s' already exists", *req.Identifier)
		}
		businessSet.Identifier = *req.Identifier
	}

	// Update fields
	businessSet.UpdatedAt = time.Now()
	if req.Name != nil {
		businessSet.Name = *req.Name
	}
	if req.Description != nil {
		businessSet.Description = req.Description
	}
	if req.Scope != nil {
		businessSet.Scope = req.Scope
	}
	if req.Maintainers != nil {
		businessSet.Maintainers = *req.Maintainers
	}

	err = s.businessSetRepo.UpdateBusinessSet(ctx, businessSet)
	if err != nil {
		return nil, err
	}

	return businessSet, nil
}

func (s *service) DeleteBusinessSet(ctx context.Context, tenantID, id string) error {
	return s.businessSetRepo.DeleteBusinessSet(ctx, tenantID, id)
}

func (s *service) AddBusinessToSet(ctx context.Context, businessSetID uuid.UUID, req *types.AddBusinessToSetRequest) error {
	// Verify the business exists
	tenantID := "00000000-0000-0000-0000-000000000001"
	if _, err := s.businessRepo.GetBusinessByID(ctx, tenantID, req.BusinessID.String()); err != nil {
		return fmt.Errorf("business not found: %w", err)
	}

	member := &types.BusinessSetMember{
		ID:            uuid.New(),
		CreatedAt:     time.Now(),
		BusinessSetID: businessSetID,
		BusinessID:    req.BusinessID,
	}

	return s.businessSetRepo.AddBusinessToSet(ctx, member)
}

func (s *service) RemoveBusinessFromSet(ctx context.Context, businessSetID, businessID uuid.UUID) error {
	return s.businessSetRepo.RemoveBusinessFromSet(ctx, businessSetID, businessID)
}

func (s *service) ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uuid.UUID, error) {
	return s.businessSetRepo.ListBusinessSetMembers(ctx, businessSetID)
}
