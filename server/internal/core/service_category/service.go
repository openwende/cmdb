package service_category

import (
	"context"

	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

type Service interface {
	ListCategories(ctx context.Context, businessID uint64) ([]types.ServiceCategory, error)
}

type service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

func (s *service) DB() *gorm.DB {
	return s.db
}

func (s *service) ListCategories(ctx context.Context, businessID uint64) ([]types.ServiceCategory, error) {
	var rows []types.ServiceCategory
	if err := s.db.WithContext(ctx).
		Where("business_id IS NULL OR business_id = ?", businessID).
		Order("root_id ASC, parent_id ASC NULLS FIRST, sort_order ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}
