package dynamic_model

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/types"
)

var validAssociationMappings = map[string]struct{}{
	"1:1": {},
	"1:N": {},
	"N:N": {},
}

var validAssociationDeleteActions = map[string]struct{}{
	"cascade":  {},
	"restrict": {},
	"set_null": {},
}

func (s *service) ListAssociationTypes(ctx context.Context) ([]types.AssociationType, error) {
	var items []types.AssociationType
	if err := s.db.WithContext(ctx).Order("is_builtin DESC, created_at ASC, id ASC").Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *service) GetAssociationType(ctx context.Context, uid string) (*types.AssociationType, error) {
	var item types.AssociationType
	if err := s.db.WithContext(ctx).Where("uid = ?", strings.TrimSpace(uid)).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) CreateAssociationType(ctx context.Context, item *types.AssociationType) error {
	item.UID = strings.TrimSpace(item.UID)
	item.Name = strings.TrimSpace(item.Name)
	item.SourceToDestDesc = strings.TrimSpace(item.SourceToDestDesc)
	item.DestToSourceDesc = strings.TrimSpace(item.DestToSourceDesc)
	item.Description = strings.TrimSpace(item.Description)
	if item.UID == "" || item.Name == "" {
		return fmt.Errorf("uid and name are required")
	}

	var count int64
	if err := s.db.WithContext(ctx).Model(&types.AssociationType{}).Where("uid = ?", item.UID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("association type %q already exists", item.UID)
	}

	return s.db.WithContext(ctx).Create(item).Error
}

func (s *service) UpdateAssociationType(ctx context.Context, uid string, updates map[string]interface{}) (*types.AssociationType, error) {
	item, err := s.GetAssociationType(ctx, uid)
	if err != nil {
		return nil, err
	}

	cleaned := map[string]interface{}{}
	for key, value := range updates {
		switch key {
		case "name", "source_to_dest_desc", "dest_to_source_desc", "description":
			if text, ok := value.(string); ok {
				cleaned[key] = strings.TrimSpace(text)
			}
		}
	}
	if len(cleaned) == 0 {
		return item, nil
	}

	if err := s.db.WithContext(ctx).Model(&types.AssociationType{}).Where("id = ?", item.ID).Updates(cleaned).Error; err != nil {
		return nil, err
	}
	return s.GetAssociationType(ctx, uid)
}

func (s *service) DeleteAssociationType(ctx context.Context, uid string) error {
	item, err := s.GetAssociationType(ctx, uid)
	if err != nil {
		return err
	}
	if item.IsBuiltin {
		return fmt.Errorf("builtin association type %q cannot be deleted", item.UID)
	}

	var modelAssocCount int64
	if err := s.db.WithContext(ctx).Model(&types.DynamicModelAssociation{}).Where("association_uid = ?", item.UID).Count(&modelAssocCount).Error; err != nil {
		return err
	}
	if modelAssocCount > 0 {
		return fmt.Errorf("association type %q is still referenced by %d model associations", item.UID, modelAssocCount)
	}

	var relationCount int64
	if err := s.db.WithContext(ctx).Model(&types.Relation{}).Where("association_uid = ?", item.UID).Count(&relationCount).Error; err != nil {
		return err
	}
	if relationCount > 0 {
		return fmt.Errorf("association type %q is still referenced by %d instance relations", item.UID, relationCount)
	}

	return s.db.WithContext(ctx).Delete(&types.AssociationType{}, item.ID).Error
}

func (s *service) ListModelAssociations(ctx context.Context, sourceModelUID string) ([]types.DynamicModelAssociation, error) {
	if _, err := s.GetModel(ctx, strings.TrimSpace(sourceModelUID)); err != nil {
		return nil, err
	}

	var items []types.DynamicModelAssociation
	if err := s.db.WithContext(ctx).
		Where("source_model_uid = ?", strings.TrimSpace(sourceModelUID)).
		Order("created_at ASC, id ASC").
		Find(&items).Error; err != nil {
		return nil, err
	}
	return items, nil
}

func (s *service) CreateModelAssociation(ctx context.Context, item *types.DynamicModelAssociation) error {
	item.SourceModelUID = strings.TrimSpace(item.SourceModelUID)
	item.TargetModelUID = strings.TrimSpace(item.TargetModelUID)
	item.AssociationUID = strings.TrimSpace(item.AssociationUID)
	item.Mapping = strings.TrimSpace(item.Mapping)
	item.OnDelete = strings.TrimSpace(item.OnDelete)
	item.Description = strings.TrimSpace(item.Description)

	if item.SourceModelUID == "" || item.TargetModelUID == "" || item.AssociationUID == "" {
		return fmt.Errorf("source_model_uid, target_model_uid and association_uid are required")
	}
	if item.Mapping == "" {
		item.Mapping = "N:N"
	}
	if item.OnDelete == "" {
		item.OnDelete = "restrict"
	}
	if err := s.validateModelAssociation(ctx, item.SourceModelUID, item.TargetModelUID, item.AssociationUID, item.Mapping, item.OnDelete); err != nil {
		return err
	}

	var count int64
	if err := s.db.WithContext(ctx).Model(&types.DynamicModelAssociation{}).
		Where("source_model_uid = ? AND target_model_uid = ? AND association_uid = ?", item.SourceModelUID, item.TargetModelUID, item.AssociationUID).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("model association already exists")
	}

	return s.db.WithContext(ctx).Create(item).Error
}

func (s *service) UpdateModelAssociation(ctx context.Context, sourceModelUID string, id uint64, updates map[string]interface{}) (*types.DynamicModelAssociation, error) {
	item, err := s.getModelAssociation(ctx, sourceModelUID, id)
	if err != nil {
		return nil, err
	}

	candidate := *item
	cleaned := map[string]interface{}{}

	if value, ok := updates["target_model_uid"].(string); ok {
		candidate.TargetModelUID = strings.TrimSpace(value)
		cleaned["target_model_uid"] = candidate.TargetModelUID
	}
	if value, ok := updates["association_uid"].(string); ok {
		candidate.AssociationUID = strings.TrimSpace(value)
		cleaned["association_uid"] = candidate.AssociationUID
	}
	if value, ok := updates["mapping"].(string); ok {
		candidate.Mapping = strings.TrimSpace(value)
		cleaned["mapping"] = candidate.Mapping
	}
	if value, ok := updates["on_delete"].(string); ok {
		candidate.OnDelete = strings.TrimSpace(value)
		cleaned["on_delete"] = candidate.OnDelete
	}
	if value, ok := updates["description"].(string); ok {
		candidate.Description = strings.TrimSpace(value)
		cleaned["description"] = candidate.Description
	}

	if len(cleaned) == 0 {
		return item, nil
	}
	if err := s.validateModelAssociation(ctx, candidate.SourceModelUID, candidate.TargetModelUID, candidate.AssociationUID, candidate.Mapping, candidate.OnDelete); err != nil {
		return nil, err
	}

	var duplicateCount int64
	if err := s.db.WithContext(ctx).Model(&types.DynamicModelAssociation{}).
		Where("source_model_uid = ? AND target_model_uid = ? AND association_uid = ? AND id <> ?", candidate.SourceModelUID, candidate.TargetModelUID, candidate.AssociationUID, candidate.ID).
		Count(&duplicateCount).Error; err != nil {
		return nil, err
	}
	if duplicateCount > 0 {
		return nil, fmt.Errorf("model association already exists")
	}

	if err := s.db.WithContext(ctx).Model(&types.DynamicModelAssociation{}).Where("id = ?", candidate.ID).Updates(cleaned).Error; err != nil {
		return nil, err
	}
	return s.getModelAssociation(ctx, sourceModelUID, id)
}

func (s *service) DeleteModelAssociation(ctx context.Context, sourceModelUID string, id uint64) error {
	item, err := s.getModelAssociation(ctx, sourceModelUID, id)
	if err != nil {
		return err
	}

	var relationCount int64
	if err := s.db.WithContext(ctx).Model(&types.Relation{}).
		Where("source_model_uid = ? AND target_model_uid = ? AND association_uid = ?", item.SourceModelUID, item.TargetModelUID, item.AssociationUID).
		Count(&relationCount).Error; err != nil {
		return err
	}
	if relationCount > 0 {
		return fmt.Errorf("model association is still referenced by %d instance relations", relationCount)
	}

	return s.db.WithContext(ctx).Delete(&types.DynamicModelAssociation{}, item.ID).Error
}

func (s *service) GetAvailableRelations(ctx context.Context, sourceModelUID string) (map[string]interface{}, error) {
	sourceModel, err := s.GetModel(ctx, strings.TrimSpace(sourceModelUID))
	if err != nil {
		return nil, err
	}

	var targetModels []types.DynamicModel
	if err := s.db.WithContext(ctx).
		Where("uid <> ?", sourceModel.UID).
		Order("created_at DESC, id DESC").
		Find(&targetModels).Error; err != nil {
		return nil, err
	}

	associationTypes, err := s.ListAssociationTypes(ctx)
	if err != nil {
		return nil, err
	}

	associations, err := s.ListModelAssociations(ctx, sourceModelUID)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"source_model":      sourceModel,
		"target_models":     targetModels,
		"association_types": associationTypes,
		"existing":          associations,
	}, nil
}

func (s *service) getModelAssociation(ctx context.Context, sourceModelUID string, id uint64) (*types.DynamicModelAssociation, error) {
	var item types.DynamicModelAssociation
	if err := s.db.WithContext(ctx).Where("id = ? AND source_model_uid = ?", id, strings.TrimSpace(sourceModelUID)).First(&item).Error; err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) validateModelAssociation(ctx context.Context, sourceModelUID, targetModelUID, associationUID, mapping, onDelete string) error {
	if _, err := s.GetModel(ctx, sourceModelUID); err != nil {
		return fmt.Errorf("source model not found: %w", err)
	}
	if _, err := s.GetModel(ctx, targetModelUID); err != nil {
		return fmt.Errorf("target model not found: %w", err)
	}
	if _, err := s.GetAssociationType(ctx, associationUID); err != nil {
		if err == gorm.ErrRecordNotFound {
			return fmt.Errorf("association type %q not found", associationUID)
		}
		return err
	}
	if _, ok := validAssociationMappings[mapping]; !ok {
		return fmt.Errorf("unsupported mapping %q", mapping)
	}
	if _, ok := validAssociationDeleteActions[onDelete]; !ok {
		return fmt.Errorf("unsupported on_delete %q", onDelete)
	}
	return nil
}
