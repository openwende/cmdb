package model

import (
	"context"

	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

type Service interface {
	CreateModel(ctx context.Context, req *types.CreateModelRequest) (*types.Model, error)
	GetModel(ctx context.Context, id string) (*types.Model, error)
	GetModelByName(ctx context.Context, name string) (*types.Model, error)
	ListModels(ctx context.Context) ([]types.Model, error)

	CreateAttribute(ctx context.Context, modelID string, req *types.CreateAttributeRequest) (*types.Attribute, error)
	ListAttributes(ctx context.Context, modelID string) ([]types.Attribute, error)
	GetFullModel(ctx context.Context, name string) (*types.Model, []types.Attribute, error)
}

type service struct {
	repo storage.ModelRepository
}

func NewService(repo storage.ModelRepository) Service {
	return &service{repo: repo}
}

func (s *service) CreateModel(ctx context.Context, req *types.CreateModelRequest) (*types.Model, error) {
	model := &types.Model{
		Name:           req.Name,
		DisplayName:    req.DisplayName,
		Classification: req.Classification,
		Icon:           req.Icon,
		Description:    req.Description,
	}

	if err := s.repo.CreateModel(ctx, model); err != nil {
		return nil, err
	}
	return model, nil
}

func (s *service) GetModel(ctx context.Context, id string) (*types.Model, error) {
	return s.repo.GetModelByID(ctx, id)
}

func (s *service) GetModelByName(ctx context.Context, name string) (*types.Model, error) {
	return s.repo.GetModelByName(ctx, name)
}

func (s *service) ListModels(ctx context.Context) ([]types.Model, error) {
	return s.repo.ListModels(ctx)
}

func (s *service) CreateAttribute(ctx context.Context, modelID string, req *types.CreateAttributeRequest) (*types.Attribute, error) {
	// Need to check if model exists? Repo will enforce FK but good to be explicit or catching validation.
	modelUUID, err := s.repo.GetModelByID(ctx, modelID)
	if err != nil {
		return nil, err
	}

	attr := &types.Attribute{
		ModelID:     modelUUID.ID,
		Name:        req.Name,
		DisplayName: req.DisplayName,
		FieldType:   req.FieldType,
		IsRequired:  req.IsRequired,
		IsUnique:    req.IsUnique,
		SortOrder:   req.SortOrder,
		// Options:     req.Options, // Need to serialize map to json.RawMessage
	}
	// Simple serialization for options
	// In real app, we validate options based on FieldType

	if err := s.repo.CreateAttribute(ctx, attr); err != nil {
		return nil, err
	}
	return attr, nil
}

func (s *service) ListAttributes(ctx context.Context, modelID string) ([]types.Attribute, error) {
	return s.repo.ListAttributesByModel(ctx, modelID)
}

func (s *service) GetFullModel(ctx context.Context, name string) (*types.Model, []types.Attribute, error) {
	return s.repo.GetModelWithAttributes(ctx, name)
}
