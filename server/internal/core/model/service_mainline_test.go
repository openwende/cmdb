package model

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/openwende/cmdb/server/internal/types"
)

var errFakeNotFound = errors.New("not found")

type fakeModelRepo struct {
	models          map[string]*types.Model
	modelGroups     map[string]*types.ModelGroup
	lastCreatedAttr *types.Attribute
}

func newFakeModelRepo(models ...*types.Model) *fakeModelRepo {
	repo := &fakeModelRepo{
		models:      make(map[string]*types.Model, len(models)),
		modelGroups: make(map[string]*types.ModelGroup),
	}
	for _, model := range models {
		repo.models[model.Name] = model
	}
	customGroupID := uuid.New()
	repo.modelGroups["custom_models"] = &types.ModelGroup{
		ID:          customGroupID,
		Name:        "custom_models",
		DisplayName: "自定义模型",
	}
	return repo
}

func (r *fakeModelRepo) CreateModelGroup(_ context.Context, group *types.ModelGroup) error {
	if group.ID == uuid.Nil {
		group.ID = uuid.New()
	}
	r.modelGroups[group.Name] = group
	return nil
}

func (r *fakeModelRepo) GetModelGroupByID(_ context.Context, id string) (*types.ModelGroup, error) {
	for _, group := range r.modelGroups {
		if group.ID.String() == id {
			return group, nil
		}
	}
	return nil, errFakeNotFound
}

func (r *fakeModelRepo) GetModelGroupByName(_ context.Context, name string) (*types.ModelGroup, error) {
	group, ok := r.modelGroups[name]
	if !ok {
		return nil, errFakeNotFound
	}
	return group, nil
}

func (r *fakeModelRepo) ListModelGroups(_ context.Context) ([]types.ModelGroup, error) {
	groups := make([]types.ModelGroup, 0, len(r.modelGroups))
	for _, group := range r.modelGroups {
		groups = append(groups, *group)
	}
	return groups, nil
}

func (r *fakeModelRepo) CreateModel(_ context.Context, model *types.Model) error {
	if model.ID == uuid.Nil {
		model.ID = uuid.New()
	}
	r.models[model.Name] = model
	return nil
}

func (r *fakeModelRepo) EnsureInstancePartition(_ context.Context, _ *types.Model) error { return nil }

func (r *fakeModelRepo) GetModelByID(_ context.Context, id string) (*types.Model, error) {
	for _, model := range r.models {
		if model.ID.String() == id {
			return model, nil
		}
	}
	return nil, errFakeNotFound
}

func (r *fakeModelRepo) GetModelByName(_ context.Context, name string) (*types.Model, error) {
	model, ok := r.models[name]
	if !ok {
		return nil, errFakeNotFound
	}
	return model, nil
}

func (r *fakeModelRepo) ListModels(_ context.Context) ([]types.Model, error) {
	models := make([]types.Model, 0, len(r.models))
	for _, model := range r.models {
		models = append(models, *model)
	}
	return models, nil
}

func (r *fakeModelRepo) UpdateModel(_ context.Context, _ *types.Model) error { return nil }
func (r *fakeModelRepo) DeleteModel(_ context.Context, _ string) error       { return nil }

func (r *fakeModelRepo) CreateAttribute(_ context.Context, attr *types.Attribute) error {
	r.lastCreatedAttr = attr
	return nil
}
func (r *fakeModelRepo) GetAttributeByID(_ context.Context, _ string) (*types.Attribute, error) {
	return nil, errFakeNotFound
}
func (r *fakeModelRepo) UpdateAttribute(_ context.Context, _ *types.Attribute) error { return nil }
func (r *fakeModelRepo) ListAttributesByModel(_ context.Context, _ string) ([]types.Attribute, error) {
	return nil, nil
}
func (r *fakeModelRepo) GetModelWithAttributes(_ context.Context, _ string) (*types.Model, []types.Attribute, error) {
	return nil, nil, errFakeNotFound
}

func TestCreateModelSupportsCustomMainlineMetadata(t *testing.T) {
	ctx := context.Background()
	parentLevel := 1
	repo := newFakeModelRepo(&types.Model{
		ID:            uuid.New(),
		Name:          "set",
		IsMainline:    true,
		MainlineLevel: &parentLevel,
		MainlineScope: types.MainlineScopeBusiness,
	})
	svc := NewService(repo)

	level := 3
	model, err := svc.CreateModel(ctx, &types.CreateModelRequest{
		Name:                "rack",
		DisplayName:         "机架",
		Classification:      "business",
		IsMainline:          true,
		MainlineScope:       types.MainlineScopeBusiness,
		MainlineLevel:       &level,
		MainlineParentModel: "set",
	})
	require.NoError(t, err)
	require.True(t, model.IsMainline)
	require.NotNil(t, model.MainlineParentModelID)
	require.Equal(t, level, *model.MainlineLevel)
	require.NotNil(t, model.GroupID)
}

func TestCreateModelRejectsModuleChildrenInP1(t *testing.T) {
	ctx := context.Background()
	parentLevel := 2
	repo := newFakeModelRepo(&types.Model{
		ID:            uuid.New(),
		Name:          "module",
		IsMainline:    true,
		MainlineLevel: &parentLevel,
		MainlineScope: types.MainlineScopeBusiness,
	})
	svc := NewService(repo)

	level := 3
	_, err := svc.CreateModel(ctx, &types.CreateModelRequest{
		Name:                "pod-group",
		DisplayName:         "Pod组",
		Classification:      "business",
		IsMainline:          true,
		MainlineScope:       types.MainlineScopeBusiness,
		MainlineLevel:       &level,
		MainlineParentModel: "module",
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "cannot be attached under module")
}

func TestCreateAttributePreservesOptionsAndEditable(t *testing.T) {
	ctx := context.Background()
	modelID := uuid.New()
	repo := newFakeModelRepo(&types.Model{
		ID:   modelID,
		Name: "rack",
	})
	svc := NewService(repo)
	editable := false

	attr, err := svc.CreateAttribute(ctx, modelID.String(), &types.CreateAttributeRequest{
		Name:        "region",
		DisplayName: "区域",
		FieldType:   "enum",
		IsRequired:  true,
		IsUnique:    true,
		IsEditable:  &editable,
		SortOrder:   12,
		Options: map[string]interface{}{
			"enum_values": []string{"ap", "eu"},
			"default":     "ap",
			"placeholder": "请选择区域",
		},
	})
	require.NoError(t, err)
	require.NotNil(t, attr)
	require.NotNil(t, repo.lastCreatedAttr)
	require.False(t, repo.lastCreatedAttr.IsEditable)
	require.JSONEq(t, `{"default":"ap","enum_values":["ap","eu"],"placeholder":"请选择区域"}`, string(repo.lastCreatedAttr.Options))

	var stored map[string]interface{}
	require.NoError(t, json.Unmarshal(repo.lastCreatedAttr.Options, &stored))
	require.Equal(t, "ap", stored["default"])
}

func TestCreateModelGroupAndAssignExplicitGroup(t *testing.T) {
	ctx := context.Background()
	parentLevel := 1
	repo := newFakeModelRepo(&types.Model{
		ID:            uuid.New(),
		Name:          "set",
		IsMainline:    true,
		MainlineLevel: &parentLevel,
		MainlineScope: types.MainlineScopeBusiness,
	})
	svc := NewService(repo)

	group, err := svc.CreateModelGroup(ctx, &types.CreateModelGroupRequest{
		Name:        "database_assets",
		DisplayName: "数据库资产",
		Description: "数据库相关模型",
		SortOrder:   40,
	})
	require.NoError(t, err)

	level := 4
	model, err := svc.CreateModel(ctx, &types.CreateModelRequest{
		Name:                "db_cluster",
		DisplayName:         "数据库集群",
		Classification:      "business",
		GroupID:             group.ID.String(),
		IsMainline:          true,
		MainlineScope:       types.MainlineScopeBusiness,
		MainlineLevel:       &level,
		MainlineParentModel: "set",
	})
	require.NoError(t, err)
	require.NotNil(t, model.GroupID)
	require.Equal(t, group.ID, *model.GroupID)
}
