package business

import (
    "context"
    "fmt"
    "sort"
    "strings"
    "sync"
    "time"

    itypes "github.com/wend/cmdb-backend/internal/types"

    "github.com/google/uuid"
)

// mockService provides an in-memory implementation of the Service interface for development without a DB.
type mockService struct {
    mu           sync.RWMutex
    businesses   map[uuid.UUID]*itypes.Business
    businessSets map[uuid.UUID]*itypes.BusinessSet
    // membership stored as append-only
    members      []itypes.BusinessSetMember
}

// NewMockService returns a Service backed by in-memory stores.
func NewMockService() Service {
    return &mockService{
        businesses:   make(map[uuid.UUID]*itypes.Business),
        businessSets: make(map[uuid.UUID]*itypes.BusinessSet),
        members:      make([]itypes.BusinessSetMember, 0),
    }
}

func (m *mockService) CreateBusiness(ctx context.Context, req *itypes.CreateBusinessRequest) (*itypes.Business, error) {
    m.mu.Lock()
    defer m.mu.Unlock()

    now := time.Now().UTC()

    // Default tenant for MVP
    tenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

    // Generate identifier if missing
    identifier := req.Identifier
    if strings.TrimSpace(identifier) == "" {
        slug := strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
        identifier = fmt.Sprintf("%s-%d", slug, now.Unix())
    }

    // Uniqueness check (tenant + identifier)
    for _, b := range m.businesses {
        if b.TenantID == tenantID && b.Identifier == identifier && b.DeletedAt == nil {
            return nil, fmt.Errorf("business with identifier '%s' already exists", identifier)
        }
    }

    biz := &itypes.Business{
        ID:          uuid.New(),
        CreatedAt:   now,
        UpdatedAt:   now,
        TenantID:    tenantID,
        Name:        req.Name,
        Identifier:  identifier,
        Description: req.Description,
        Lifecycle:   "production",
        Timezone:    "UTC",
        Language:    "en",
        Maintainers: []uuid.UUID{},
        IsBuiltIn:   false,
    }

    m.businesses[biz.ID] = biz
    return biz, nil
}

func (m *mockService) GetBusiness(ctx context.Context, tenantID, id string) (*itypes.Business, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    uid, err := uuid.Parse(id)
    if err != nil {
        return nil, fmt.Errorf("invalid id: %w", err)
    }
    b, ok := m.businesses[uid]
    if !ok || b == nil || b.DeletedAt != nil || b.TenantID.String() != tenantID {
        return nil, fmt.Errorf("business with id '%s' not found", id)
    }
    return b, nil
}

func (m *mockService) UpdateBusiness(ctx context.Context, tenantID, id string, req *itypes.UpdateBusinessRequest) (*itypes.Business, error) {
    m.mu.Lock()
    defer m.mu.Unlock()
    uid, err := uuid.Parse(id)
    if err != nil {
        return nil, fmt.Errorf("invalid id: %w", err)
    }
    b, ok := m.businesses[uid]
    if !ok || b == nil || b.DeletedAt != nil || b.TenantID.String() != tenantID {
        return nil, fmt.Errorf("business with id '%s' not found", id)
    }

    // Identifier uniqueness check if changed
    if req.Identifier != nil && *req.Identifier != b.Identifier {
        for _, other := range m.businesses {
            if other.TenantID.String() == tenantID && other.Identifier == *req.Identifier && (other.DeletedAt == nil) && other.ID != b.ID {
                return nil, fmt.Errorf("business with identifier '%s' already exists", *req.Identifier)
            }
        }
        b.Identifier = *req.Identifier
    }

    now := time.Now().UTC()
    b.UpdatedAt = now
    if req.Name != nil {
        b.Name = *req.Name
    }
    if req.Description != nil {
        b.Description = req.Description
    }
    if req.Lifecycle != nil {
        b.Lifecycle = *req.Lifecycle
    }
    if req.Timezone != nil {
        b.Timezone = *req.Timezone
    }
    if req.Language != nil {
        b.Language = *req.Language
    }
    if req.Maintainers != nil {
        b.Maintainers = *req.Maintainers
    }
    // Personnel arrays no longer part of Business; normalized to business_personnel table
    return b, nil
}

func (m *mockService) DeleteBusiness(ctx context.Context, tenantID, id string) error {
    m.mu.Lock()
    defer m.mu.Unlock()
    uid, err := uuid.Parse(id)
    if err != nil {
        return fmt.Errorf("invalid id: %w", err)
    }
    b, ok := m.businesses[uid]
    if !ok || b == nil || b.DeletedAt != nil || b.TenantID.String() != tenantID {
        return fmt.Errorf("business with id '%s' not found", id)
    }
    now := time.Now().UTC()
    b.DeletedAt = &now
    b.UpdatedAt = now
    return nil
}

func (m *mockService) ListBusinesses(ctx context.Context, tenantID string, limit, offset int) ([]itypes.Business, int, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()
    var items []*itypes.Business
    for _, b := range m.businesses {
        if b.DeletedAt == nil && b.TenantID.String() == tenantID {
            items = append(items, b)
        }
    }
    // Sort by created_at desc
    sort.Slice(items, func(i, j int) bool { return items[i].CreatedAt.After(items[j].CreatedAt) })
    total := len(items)
    // Pagination
    start := offset
    if start > total {
        start = total
    }
    end := start + limit
    if limit <= 0 || end > total {
        end = total
    }
    result := make([]itypes.Business, end-start)
    for i := start; i < end; i++ {
        result[i-start] = *items[i]
    }
    return result, total, nil
}

func (m *mockService) CreateBusinessSet(ctx context.Context, req *itypes.CreateBusinessSetRequest) (*itypes.BusinessSet, error) {
    m.mu.Lock()
    defer m.mu.Unlock()
    now := time.Now().UTC()
    tenantID := uuid.MustParse("00000000-0000-0000-0000-000000000001")

    // Generate identifier if missing
    identifier := req.Identifier
    if strings.TrimSpace(identifier) == "" {
        slug := strings.ToLower(strings.ReplaceAll(req.Name, " ", "-"))
        identifier = fmt.Sprintf("%s-%d", slug, now.Unix())
    }

    // Create business set
    scope := "{}"
    bs := &itypes.BusinessSet{
        ID:          uuid.New(),
        CreatedAt:   now,
        UpdatedAt:   now,
        TenantID:    tenantID,
        Name:        req.Name,
        Identifier:  identifier,
        Description: req.Description,
        Scope:       &scope,
        Maintainers: []uuid.UUID{},
    }
    m.businessSets[bs.ID] = bs

    // Link member
    member := itypes.BusinessSetMember{
        ID:            uuid.New(),
        CreatedAt:     now,
        BusinessSetID: bs.ID,
        BusinessID:    req.BusinessID,
    }
    m.members = append(m.members, member)
    return bs, nil
}
