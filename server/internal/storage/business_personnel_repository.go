package storage

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/gorm"
)

type BusinessPersonnelRepository interface {
	Add(ctx context.Context, p *types.BusinessPersonnel) error
	ListByBusiness(ctx context.Context, businessID uuid.UUID) ([]types.BusinessPersonnel, error)
	ListByBusinessAndRole(ctx context.Context, businessID uuid.UUID, role string) ([]types.BusinessPersonnel, error)
	Remove(ctx context.Context, id uuid.UUID) error
	RemoveByBusinessAndRole(ctx context.Context, businessID uuid.UUID, role string) error
}

type businessPersonnelRepository struct{ db *gorm.DB }

func NewBusinessPersonnelRepository(db *gorm.DB) BusinessPersonnelRepository {
	return &businessPersonnelRepository{db: db}
}

func (r *businessPersonnelRepository) Add(ctx context.Context, p *types.BusinessPersonnel) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	return r.db.WithContext(ctx).Table("business_personnel").Create(p).Error
}

func (r *businessPersonnelRepository) ListByBusiness(ctx context.Context, businessID uuid.UUID) ([]types.BusinessPersonnel, error) {
	var rows []types.BusinessPersonnel
	if err := r.db.WithContext(ctx).Table("business_personnel").Where("business_id = ?", businessID).Order("created_at ASC").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("list personnel: %w", err)
	}
	return rows, nil
}

func (r *businessPersonnelRepository) ListByBusinessAndRole(ctx context.Context, businessID uuid.UUID, role string) ([]types.BusinessPersonnel, error) {
	var rows []types.BusinessPersonnel
	if err := r.db.WithContext(ctx).Table("business_personnel").Where("business_id = ? AND role = ?", businessID, role).Order("created_at ASC").Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("list personnel by role: %w", err)
	}
	return rows, nil
}

func (r *businessPersonnelRepository) Remove(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Table("business_personnel").Where("id = ?", id).Delete(nil).Error
}

func (r *businessPersonnelRepository) RemoveByBusinessAndRole(ctx context.Context, businessID uuid.UUID, role string) error {
	return r.db.WithContext(ctx).Table("business_personnel").Where("business_id = ? AND role = ?", businessID, role).Delete(nil).Error
}
