package business

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/core/auditlog"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
	"github.com/wend/cmdb-backend/pkg/apperrors"
)

type Service interface {
	CreateBusiness(ctx context.Context, req *types.CreateBusinessRequest) (*types.Business, error)
	GetBusiness(ctx context.Context, tenantID string, id uint64) (*types.Business, error)
	UpdateBusiness(ctx context.Context, tenantID string, id uint64, req *types.UpdateBusinessRequest) (*types.Business, error)
	DeleteBusiness(ctx context.Context, tenantID string, id uint64) error
	ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error)

	SetTopologyInitializer(fn TopologyInitializer)

	// Business Set operations
	CreateBusinessSet(ctx context.Context, req *types.CreateBusinessSetRequest) (*types.BusinessSet, error)
	GetBusinessSet(ctx context.Context, tenantID, id string) (*types.BusinessSet, error)
	ListBusinessSets(ctx context.Context, tenantID string, limit, offset int) ([]types.BusinessSet, int, error)
	UpdateBusinessSet(ctx context.Context, tenantID, id string, req *types.UpdateBusinessSetRequest) (*types.BusinessSet, error)
	DeleteBusinessSet(ctx context.Context, tenantID, id string) error
	AddBusinessToSet(ctx context.Context, businessSetID uuid.UUID, req *types.AddBusinessToSetRequest) error
	RemoveBusinessFromSet(ctx context.Context, businessSetID uuid.UUID, businessID uint64) error
	ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uint64, error)
}

// TopologyInitializer is called after a business is created to set up its default topology.
type TopologyInitializer func(ctx context.Context, businessID uint64) error

type service struct {
	db              *gorm.DB
	businessRepo    storage.BusinessRepository
	businessSetRepo storage.BusinessSetRepository
	personnelRepo   storage.BusinessPersonnelRepository
	initTopology    TopologyInitializer
}

func NewService(db *gorm.DB, businessRepo storage.BusinessRepository, businessSetRepo storage.BusinessSetRepository, personnelRepo storage.BusinessPersonnelRepository) Service {
	return &service{db: db, businessRepo: businessRepo, businessSetRepo: businessSetRepo, personnelRepo: personnelRepo}
}

// SetTopologyInitializer injects the topology initializer after construction to break the
// circular dependency between the business and topology packages.
func (s *service) SetTopologyInitializer(fn TopologyInitializer) {
	s.initTopology = fn
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

	tenantID := types.SystemTenantID // Default tenant

	// Determine timezone and language with defaults
	timezone := "UTC"
	if req.Timezone != nil && *req.Timezone != "" {
		timezone = *req.Timezone
	}
	language := "en"
	if req.Language != nil && *req.Language != "" {
		language = *req.Language
	}

	// Create the business object — ID is auto-assigned by the database
	business := &types.Business{
		CreatedAt:   now,
		UpdatedAt:   now,
		TenantID:    uuid.MustParse(tenantID),
		Name:        req.Name,
		Identifier:  identifier,
		Description: req.Description,
		Lifecycle:   lifecycle,
		Timezone:    timezone,
		Language:    language,
		Maintainers: types.UUIDArray{},
		IsBuiltIn:   false,
	}

	err := s.businessRepo.CreateBusiness(ctx, business)
	if err != nil {
		return nil, err
	}

	if s.initTopology != nil {
		if err := s.initTopology(ctx, business.ID); err != nil {
			return nil, fmt.Errorf("初始化业务拓扑失败: %w", err)
		}
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
	auditlog.Record(s.db, "business", "create", business.ID, business.ID, business.Name, business.Name)
	return business, nil
}

func (s *service) GetBusiness(ctx context.Context, tenantID string, id uint64) (*types.Business, error) {
	business, err := s.businessRepo.GetBusinessByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}
	if err := s.populatePersonnel(ctx, business); err != nil {
		return nil, apperrors.InternalError("populate personnel", err)
	}
	return business, nil
}

func (s *service) UpdateBusiness(ctx context.Context, tenantID string, id uint64, req *types.UpdateBusinessRequest) (*types.Business, error) {
	// First, get the existing business
	business, err := s.businessRepo.GetBusinessByID(ctx, tenantID, id)
	if err != nil {
		return nil, err
	}

	// Check identifier uniqueness if updating
	if req.Identifier != nil && *req.Identifier != business.Identifier {
		exists, err := s.businessRepo.CheckIdentifierExists(ctx, tenantID, *req.Identifier, id)
		if err != nil {
			return nil, apperrors.InternalError("check identifier", err)
		}
		if exists {
			return nil, apperrors.AlreadyExistsError("business", *req.Identifier)
		}
		business.Identifier = *req.Identifier
	}

	// Update fields
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
			return nil, apperrors.InvalidInputError("lifecycle", fmt.Sprintf("invalid value: %s", *req.Lifecycle))
		}
	}
	if req.Timezone != nil {
		business.Timezone = *req.Timezone
	}
	if req.Language != nil {
		business.Language = *req.Language
	}
	if req.Maintainers != nil {
		business.Maintainers = types.UUIDArray(*req.Maintainers)
	}

	err = s.businessRepo.UpdateBusiness(ctx, business)
	if err != nil {
		return nil, err
	}

	auditlog.Record(s.db, "business", "update", business.ID, business.ID, business.Name, business.Name)
	return business, nil
}

func (s *service) DeleteBusiness(ctx context.Context, tenantID string, id uint64) error {
	// Get business to check lifecycle status
	business, err := s.businessRepo.GetBusinessByID(ctx, tenantID, id)
	if err != nil {
		return err
	}

	// Only allow deletion of archived (offline) businesses
	if business.Lifecycle != types.BusinessLifecycleOffline {
		return apperrors.InvalidStateError("business", business.Lifecycle, "offline")
	}

	if err := s.businessRepo.DeleteBusiness(ctx, tenantID, id); err != nil {
		return err
	}
	auditlog.Record(s.db, "business", "delete", business.ID, business.ID, business.Name, business.Name)
	return nil
}

func (s *service) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]types.Business, int, error) {
	businesses, total, err := s.businessRepo.ListBusinesses(ctx, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}

	// Use batch query to solve N+1 problem: 1 query instead of N
	if s.personnelRepo != nil && len(businesses) > 0 {
		businessIDs := make([]uint64, len(businesses))
		for i, b := range businesses {
			businessIDs[i] = b.ID
		}

		allPersonnel, err := s.personnelRepo.ListByBusinessIDs(ctx, businessIDs)
		if err != nil {
			log.Printf("ERROR batch fetching personnel: %v\n", err)
		} else {
			s.populatePersonnelBatch(businesses, allPersonnel)
		}
	}
	return businesses, total, nil
}

// populatePersonnelBatch batch populates personnel information into business list
func (s *service) populatePersonnelBatch(businesses []types.Business, allPersonnel []types.BusinessPersonnel) {
	// Group personnel by businessID
	personnelByBusiness := make(map[uint64][]types.BusinessPersonnel)
	for _, p := range allPersonnel {
		personnelByBusiness[p.BusinessID] = append(personnelByBusiness[p.BusinessID], p)
	}

	// Populate to corresponding business
	for i := range businesses {
		personnel := personnelByBusiness[businesses[i].ID]
		for _, p := range personnel {
			switch p.Role {
			case "sre":
				businesses[i].Sres = append(businesses[i].Sres, p.Identity)
			case "developer":
				businesses[i].Developers = append(businesses[i].Developers, p.Identity)
			case "tester":
				businesses[i].Testers = append(businesses[i].Testers, p.Identity)
			case "bizops":
				businesses[i].Bizops = append(businesses[i].Bizops, p.Identity)
			}
		}
	}
}

// populatePersonnel populates personnel for a single business
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
		TenantID:    uuid.MustParse(types.SystemTenantID), // Default tenant
		Name:        req.Name,
		Identifier:  identifier,
		Description: req.Description,
		Scope:       &scope,
		Maintainers: types.UUIDArray{},
	}

	// Ensure the business exists
	tenantID := types.SystemTenantID
	if _, err := s.businessRepo.GetBusinessByID(ctx, tenantID, req.BusinessID); err != nil {
		return nil, err
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
			return nil, apperrors.InternalError("check identifier", err)
		}
		if exists {
			return nil, apperrors.AlreadyExistsError("business set", *req.Identifier)
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
		businessSet.Maintainers = types.UUIDArray(*req.Maintainers)
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
	tenantID := types.SystemTenantID
	if _, err := s.businessRepo.GetBusinessByID(ctx, tenantID, req.BusinessID); err != nil {
		return err
	}

	member := &types.BusinessSetMember{
		ID:            uuid.New(),
		CreatedAt:     time.Now(),
		BusinessSetID: businessSetID,
		BusinessID:    req.BusinessID,
	}

	return s.businessSetRepo.AddBusinessToSet(ctx, member)
}

func (s *service) RemoveBusinessFromSet(ctx context.Context, businessSetID uuid.UUID, businessID uint64) error {
	return s.businessSetRepo.RemoveBusinessFromSet(ctx, businessSetID, businessID)
}

func (s *service) ListBusinessSetMembers(ctx context.Context, businessSetID uuid.UUID) ([]uint64, error) {
	return s.businessSetRepo.ListBusinessSetMembers(ctx, businessSetID)
}
