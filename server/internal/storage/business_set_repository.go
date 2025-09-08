package storage

import (
    "context"
    "fmt"

    "github.com/wend/cmdb-backend/internal/types"

    "github.com/lib/pq"
    "gorm.io/gorm"
)

type BusinessSetRepository interface {
    CreateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error
    CreateBusinessSetMember(ctx context.Context, member *types.BusinessSetMember) error
    CreateBusinessSetWithMember(ctx context.Context, businessSet *types.BusinessSet, member *types.BusinessSetMember) error
}

type businessSetRepository struct {
	db *gorm.DB
}

func NewBusinessSetRepository(db *gorm.DB) BusinessSetRepository {
	return &businessSetRepository{db: db}
}

func (r *businessSetRepository) CreateBusinessSet(ctx context.Context, businessSet *types.BusinessSet) error {
    err := r.db.WithContext(ctx).Table("business_sets").Create(map[string]interface{}{
        "id":          businessSet.ID,
        "created_at":  businessSet.CreatedAt,
        "updated_at":  businessSet.UpdatedAt,
        "tenant_id":   businessSet.TenantID,
        "name":        businessSet.Name,
        "identifier":  businessSet.Identifier,
        "description": businessSet.Description,
        "scope":       businessSet.Scope,
        "maintainers": pq.Array(businessSet.Maintainers),
    }).Error
    if err != nil {
        if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
            return fmt.Errorf("business set with identifier '%s' already exists", businessSet.Identifier)
        }
        return fmt.Errorf("failed to create business set: %w", err)
    }
    return nil
}

func (r *businessSetRepository) CreateBusinessSetMember(ctx context.Context, member *types.BusinessSetMember) error {
    return r.db.WithContext(ctx).Table("business_set_members").Create(map[string]interface{}{
        "id":              member.ID,
        "created_at":      member.CreatedAt,
        "business_set_id": member.BusinessSetID,
        "business_id":     member.BusinessID,
    }).Error
}

func (r *businessSetRepository) CreateBusinessSetWithMember(ctx context.Context, businessSet *types.BusinessSet, member *types.BusinessSetMember) error {
    return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        if err := tx.Table("business_sets").Create(map[string]interface{}{
            "id":          businessSet.ID,
            "created_at":  businessSet.CreatedAt,
            "updated_at":  businessSet.UpdatedAt,
            "tenant_id":   businessSet.TenantID,
            "name":        businessSet.Name,
            "identifier":  businessSet.Identifier,
            "description": businessSet.Description,
            "scope":       businessSet.Scope,
            "maintainers": pq.Array(businessSet.Maintainers),
        }).Error; err != nil {
            if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
                return fmt.Errorf("business set with identifier '%s' already exists", businessSet.Identifier)
            }
            return fmt.Errorf("failed to create business set: %w", err)
        }

        if err := tx.Table("business_set_members").Create(map[string]interface{}{
            "id":              member.ID,
            "created_at":      member.CreatedAt,
            "business_set_id": member.BusinessSetID,
            "business_id":     member.BusinessID,
        }).Error; err != nil {
            return fmt.Errorf("failed to create business set member: %w", err)
        }
        return nil
    })
}
