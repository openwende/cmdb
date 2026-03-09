package model

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/internal/types"
)

type Service interface {
	CreateModelGroup(ctx context.Context, req *types.CreateModelGroupRequest) (*types.ModelGroup, error)
	ListModelGroups(ctx context.Context) ([]types.ModelGroup, error)

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

func (s *service) CreateModelGroup(ctx context.Context, req *types.CreateModelGroupRequest) (*types.ModelGroup, error) {
	group := &types.ModelGroup{
		ID:          uuid.New(),
		Name:        req.Name,
		DisplayName: req.DisplayName,
		Description: req.Description,
		SortOrder:   req.SortOrder,
	}

	if err := s.repo.CreateModelGroup(ctx, group); err != nil {
		return nil, err
	}

	return group, nil
}

func (s *service) ListModelGroups(ctx context.Context) ([]types.ModelGroup, error) {
	return s.repo.ListModelGroups(ctx)
}

func (s *service) CreateModel(ctx context.Context, req *types.CreateModelRequest) (*types.Model, error) {
	model := &types.Model{
		ID:             uuid.New(),
		Name:           req.Name,
		DisplayName:    req.DisplayName,
		Classification: req.Classification,
		Icon:           req.Icon,
		Description:    req.Description,
	}

	if req.GroupID != "" {
		group, err := s.repo.GetModelGroupByID(ctx, req.GroupID)
		if err != nil {
			return nil, fmt.Errorf("invalid model group: %w", err)
		}
		model.GroupID = &group.ID
	} else {
		defaultGroup, err := s.repo.GetModelGroupByName(ctx, "custom_models")
		if err == nil {
			model.GroupID = &defaultGroup.ID
		}
	}

	if err := s.applyMainlineMetadata(ctx, req, model); err != nil {
		return nil, err
	}

	if err := s.repo.CreateModel(ctx, model); err != nil {
		return nil, err
	}
	if err := s.repo.EnsureInstancePartition(ctx, model); err != nil {
		_ = s.repo.DeleteModel(ctx, model.ID.String())
		return nil, fmt.Errorf("failed to create model instance partition: %w", err)
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

	options := json.RawMessage([]byte("{}"))
	if len(req.Options) > 0 {
		raw, marshalErr := json.Marshal(req.Options)
		if marshalErr != nil {
			return nil, fmt.Errorf("marshal attribute options: %w", marshalErr)
		}
		options = raw
	}

	isEditable := true
	if req.IsEditable != nil {
		isEditable = *req.IsEditable
	}

	attr := &types.Attribute{
		ModelID:     modelUUID.ID,
		Name:        req.Name,
		DisplayName: req.DisplayName,
		FieldType:   req.FieldType,
		IsRequired:  req.IsRequired,
		IsUnique:    req.IsUnique,
		IsEditable:  isEditable,
		SortOrder:   req.SortOrder,
		Options:     options,
	}

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

func (s *service) applyMainlineMetadata(ctx context.Context, req *types.CreateModelRequest, model *types.Model) error {
	if !req.IsMainline {
		if req.MainlineLevel != nil || req.MainlineParentModel != "" {
			return fmt.Errorf("non-mainline model cannot set mainline_level or mainline_parent_model")
		}
		switch req.MainlineScope {
		case "", types.MainlineScopeNone:
			model.MainlineScope = types.MainlineScopeNone
			return nil
		default:
			return fmt.Errorf("non-mainline model cannot set mainline_scope=%q", req.MainlineScope)
		}
	}

	scope := req.MainlineScope
	if scope == "" {
		scope = types.MainlineScopeBusiness
	}
	switch scope {
	case types.MainlineScopeGlobal, types.MainlineScopeBusiness:
	default:
		return fmt.Errorf("invalid mainline_scope: %s", scope)
	}
	if req.MainlineLevel == nil {
		return fmt.Errorf("mainline model requires mainline_level")
	}
	if *req.MainlineLevel <= 0 {
		return fmt.Errorf("mainline level 0 is reserved for built-in business root")
	}
	if req.MainlineParentModel == "" {
		return fmt.Errorf("mainline model requires mainline_parent_model")
	}

	parent, err := s.repo.GetModelByName(ctx, req.MainlineParentModel)
	if err != nil {
		return fmt.Errorf("invalid mainline parent model: %w", err)
	}
	if !parent.IsMainline {
		return fmt.Errorf("mainline parent model %q is not marked as mainline", parent.Name)
	}
	if parent.MainlineLevel == nil {
		return fmt.Errorf("mainline parent model %q is missing mainline level", parent.Name)
	}
	if *req.MainlineLevel <= *parent.MainlineLevel {
		return fmt.Errorf("mainline level %d must be greater than parent level %d", *req.MainlineLevel, *parent.MainlineLevel)
	}
	if parent.Name == string(types.NodeTypeModule) {
		return fmt.Errorf("custom mainline model cannot be attached under module in P1")
	}

	existingModels, err := s.repo.ListModels(ctx)
	if err != nil {
		return err
	}
	for _, existing := range existingModels {
		if !existing.IsMainline || existing.MainlineLevel == nil {
			continue
		}
		if *existing.MainlineLevel == *req.MainlineLevel {
			return fmt.Errorf("mainline level %d is already used by model %q", *req.MainlineLevel, existing.Name)
		}
	}

	model.IsMainline = true
	model.MainlineScope = scope
	model.MainlineLevel = req.MainlineLevel
	model.MainlineParentModelID = &parent.ID
	return nil
}
