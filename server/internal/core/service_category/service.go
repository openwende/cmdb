package service_category

import (
	"context"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

func (s *Service) DB() *gorm.DB {
	return s.db
}

func (s *Service) ListCategories(ctx context.Context, businessID uuid.UUID) ([]types.ServiceCategory, error) {
	var rows []types.ServiceCategory
	if err := s.db.WithContext(ctx).
		Where("business_id IS NULL OR business_id = ?", businessID).
		Order("root_id ASC, parent_id ASC NULLS FIRST, sort_order ASC, id ASC").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	return rows, nil
}
