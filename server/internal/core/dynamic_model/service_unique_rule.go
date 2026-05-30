package dynamic_model

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"

	"github.com/wend/cmdb-backend/internal/types"
)

func (s *service) EnsureLegacyUniqueRules(ctx context.Context, modelUID string) error {
	var existingCount int64
	if err := s.db.WithContext(ctx).Model(&types.ModelUniqueRule{}).Where("model_uid = ? AND deleted_at IS NULL", modelUID).Count(&existingCount).Error; err != nil {
		return err
	}
	if existingCount > 0 {
		return nil
	}

	model, err := s.GetModel(ctx, modelUID)
	if err != nil {
		return err
	}
	attributes, err := s.ListAttributes(ctx, modelUID)
	if err != nil {
		return err
	}

	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		createdNames := map[string]struct{}{}

		var legacyConfig types.UniqueFieldConfig
		if len(model.UniqueFields) > 0 {
			if err := json.Unmarshal(model.UniqueFields, &legacyConfig); err == nil && len(legacyConfig.Fields) > 0 {
				ruleName := strings.TrimSpace(legacyConfig.Name)
				if ruleName == "" {
					ruleName = modelUID + "_default_unique"
				}
				if err := s.createUniqueRuleInTx(tx, &types.ModelUniqueRule{
					ModelUID:         modelUID,
					Name:             ruleName,
					IsDefault:        true,
					Enabled:          true,
					IgnoreIfAllEmpty: true,
					Description:      "legacy model unique_fields",
				}, legacyConfig.Fields); err != nil {
					return err
				}
				createdNames[ruleName] = struct{}{}
			}
		}

		for _, attr := range attributes {
			if !attr.IsUnique {
				continue
			}
			ruleName := attr.FieldUID + "_unique"
			if _, exists := createdNames[ruleName]; exists {
				continue
			}
			if err := s.createUniqueRuleInTx(tx, &types.ModelUniqueRule{
				ModelUID:         modelUID,
				Name:             ruleName,
				IsAuxiliary:      true,
				Enabled:          true,
				IgnoreIfAllEmpty: true,
				Description:      "legacy attribute unique",
			}, []string{attr.FieldUID}); err != nil {
				return err
			}
			createdNames[ruleName] = struct{}{}
		}

		groups := map[string][]string{}
		for _, attr := range attributes {
			group := strings.TrimSpace(attr.UniqueGroup)
			if group == "" {
				continue
			}
			groups[group] = append(groups[group], attr.FieldUID)
		}

		for group, fields := range groups {
			if len(fields) == 0 {
				continue
			}
			sort.Strings(fields)
			ruleName := "group_" + group
			if _, exists := createdNames[ruleName]; exists {
				continue
			}
			if err := s.createUniqueRuleInTx(tx, &types.ModelUniqueRule{
				ModelUID:         modelUID,
				Name:             ruleName,
				IsAuxiliary:      true,
				Enabled:          true,
				IgnoreIfAllEmpty: true,
				Description:      "legacy unique_group",
			}, fields); err != nil {
				return err
			}
			createdNames[ruleName] = struct{}{}
		}

		return nil
	})
}

func (s *service) ListUniqueRules(ctx context.Context, modelUID string) ([]types.UniqueRuleDetail, error) {
	if _, err := s.GetModel(ctx, modelUID); err != nil {
		return nil, err
	}
	if err := s.EnsureLegacyUniqueRules(ctx, modelUID); err != nil {
		return nil, err
	}
	return s.listUniqueRules(ctx, modelUID)
}

func (s *service) CreateUniqueRule(ctx context.Context, rule *types.ModelUniqueRule, fields []string) (*types.UniqueRuleDetail, error) {
	if _, err := s.GetModel(ctx, rule.ModelUID); err != nil {
		return nil, err
	}
	if err := s.validateUniqueRuleDefinition(ctx, rule.ModelUID, 0, rule, fields); err != nil {
		return nil, err
	}
	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		return s.createUniqueRuleInTx(tx, rule, fields)
	}); err != nil {
		return nil, err
	}
	return s.getUniqueRuleDetail(ctx, rule.ID)
}

func (s *service) UpdateUniqueRule(ctx context.Context, modelUID string, ruleID uint64, updates *types.ModelUniqueRule, fields []string) (*types.UniqueRuleDetail, error) {
	current, err := s.getUniqueRule(ctx, modelUID, ruleID)
	if err != nil {
		return nil, err
	}

	candidate := *current
	candidate.Name = strings.TrimSpace(updates.Name)
	candidate.Description = strings.TrimSpace(updates.Description)
	candidate.Enabled = updates.Enabled
	candidate.IsAuxiliary = updates.IsAuxiliary
	candidate.IgnoreIfAllEmpty = updates.IgnoreIfAllEmpty
	if updates.IsDefault {
		candidate.IsDefault = true
	}

	if err := s.validateUniqueRuleDefinition(ctx, modelUID, ruleID, &candidate, fields); err != nil {
		return nil, err
	}

	if err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&types.ModelUniqueRule{}).Where("id = ?", ruleID).Updates(map[string]interface{}{
			"name":                candidate.Name,
			"description":         candidate.Description,
			"enabled":             candidate.Enabled,
			"is_auxiliary":        candidate.IsAuxiliary,
			"ignore_if_all_empty": candidate.IgnoreIfAllEmpty,
			"updated_by":          candidate.UpdatedBy,
		}).Error; err != nil {
			return err
		}
		if err := tx.Where("rule_id = ?", ruleID).Delete(&types.ModelUniqueRuleField{}).Error; err != nil {
			return err
		}
		for index, fieldUID := range fields {
			field := types.ModelUniqueRuleField{RuleID: ruleID, FieldUID: strings.TrimSpace(fieldUID), SortOrder: index}
			if err := tx.Create(&field).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return nil, err
	}

	return s.getUniqueRuleDetail(ctx, ruleID)
}

func (s *service) DeleteUniqueRule(ctx context.Context, modelUID string, ruleID uint64) error {
	rule, err := s.getUniqueRule(ctx, modelUID, ruleID)
	if err != nil {
		return err
	}
	if rule.IsDefault {
		return fmt.Errorf("default unique rule cannot be deleted")
	}
	return s.db.WithContext(ctx).Delete(&types.ModelUniqueRule{}, ruleID).Error
}

func (s *service) ValidateUnique(ctx context.Context, modelUID string, resourceID *uint64, data map[string]interface{}) ([]types.UniqueRuleViolation, error) {
	if _, err := s.GetModel(ctx, modelUID); err != nil {
		return nil, err
	}
	if err := s.EnsureLegacyUniqueRules(ctx, modelUID); err != nil {
		return nil, err
	}

	rules, err := s.listUniqueRules(ctx, modelUID)
	if err != nil {
		return nil, err
	}

	violations := make([]types.UniqueRuleViolation, 0)
	for _, rule := range rules {
		if !rule.Enabled || len(rule.Fields) == 0 {
			continue
		}
		conflictValues, shouldValidate := buildUniqueConflictValues(rule, data)
		if !shouldValidate {
			continue
		}

		query := s.db.WithContext(ctx).Model(&types.Resource{}).Where("model_uid = ? AND deleted_at IS NULL", modelUID)
		if resourceID != nil {
			query = query.Where("id <> ?", *resourceID)
		}
		for _, field := range rule.Fields {
			query = query.Where(fmt.Sprintf("configs->>'%s' = ?", field), fmt.Sprint(conflictValues[field]))
		}

		var matched []types.Resource
		if err := query.Find(&matched).Error; err != nil {
			return nil, err
		}
		if len(matched) == 0 {
			continue
		}

		ids := make([]uint64, 0, len(matched))
		for _, item := range matched {
			ids = append(ids, item.ID)
		}
		violations = append(violations, types.UniqueRuleViolation{
			RuleID:              rule.ID,
			RuleName:            rule.Name,
			Fields:              append([]string(nil), rule.Fields...),
			ConflictResourceIDs: ids,
			ConflictValues:      conflictValues,
		})
	}

	return violations, nil
}

func (s *service) listUniqueRules(ctx context.Context, modelUID string) ([]types.UniqueRuleDetail, error) {
	var rules []types.ModelUniqueRule
	if err := s.db.WithContext(ctx).
		Where("model_uid = ? AND deleted_at IS NULL", modelUID).
		Order("is_default DESC, created_at ASC, id ASC").
		Find(&rules).Error; err != nil {
		return nil, err
	}

	result := make([]types.UniqueRuleDetail, 0, len(rules))
	for _, rule := range rules {
		fields, err := s.listUniqueRuleFields(ctx, rule.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, types.UniqueRuleDetail{
			ID:               rule.ID,
			ModelUID:         rule.ModelUID,
			Name:             rule.Name,
			IsDefault:        rule.IsDefault,
			IsAuxiliary:      rule.IsAuxiliary,
			Enabled:          rule.Enabled,
			IgnoreIfAllEmpty: rule.IgnoreIfAllEmpty,
			Description:      rule.Description,
			Fields:           fields,
			CreatedAt:        rule.CreatedAt,
			UpdatedAt:        rule.UpdatedAt,
		})
	}
	return result, nil
}

func (s *service) getUniqueRule(ctx context.Context, modelUID string, ruleID uint64) (*types.ModelUniqueRule, error) {
	var rule types.ModelUniqueRule
	if err := s.db.WithContext(ctx).Where("id = ? AND model_uid = ? AND deleted_at IS NULL", ruleID, modelUID).First(&rule).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

func (s *service) getUniqueRuleDetail(ctx context.Context, ruleID uint64) (*types.UniqueRuleDetail, error) {
	var rule types.ModelUniqueRule
	if err := s.db.WithContext(ctx).Where("id = ? AND deleted_at IS NULL", ruleID).First(&rule).Error; err != nil {
		return nil, err
	}
	fields, err := s.listUniqueRuleFields(ctx, ruleID)
	if err != nil {
		return nil, err
	}
	return &types.UniqueRuleDetail{
		ID:               rule.ID,
		ModelUID:         rule.ModelUID,
		Name:             rule.Name,
		IsDefault:        rule.IsDefault,
		IsAuxiliary:      rule.IsAuxiliary,
		Enabled:          rule.Enabled,
		IgnoreIfAllEmpty: rule.IgnoreIfAllEmpty,
		Description:      rule.Description,
		Fields:           fields,
		CreatedAt:        rule.CreatedAt,
		UpdatedAt:        rule.UpdatedAt,
	}, nil
}

func (s *service) listUniqueRuleFields(ctx context.Context, ruleID uint64) ([]string, error) {
	var fields []types.ModelUniqueRuleField
	if err := s.db.WithContext(ctx).Where("rule_id = ?", ruleID).Order("sort_order ASC, id ASC").Find(&fields).Error; err != nil {
		return nil, err
	}
	result := make([]string, 0, len(fields))
	for _, field := range fields {
		result = append(result, field.FieldUID)
	}
	return result, nil
}

func (s *service) createUniqueRuleInTx(tx *gorm.DB, rule *types.ModelUniqueRule, fields []string) error {
	rule.Name = strings.TrimSpace(rule.Name)
	rule.ModelUID = strings.TrimSpace(rule.ModelUID)
	if err := tx.Create(rule).Error; err != nil {
		return err
	}
	for index, fieldUID := range fields {
		field := types.ModelUniqueRuleField{RuleID: rule.ID, FieldUID: strings.TrimSpace(fieldUID), SortOrder: index}
		if err := tx.Create(&field).Error; err != nil {
			return err
		}
	}
	return nil
}

func (s *service) validateUniqueRuleDefinition(ctx context.Context, modelUID string, ruleID uint64, rule *types.ModelUniqueRule, fields []string) error {
	if strings.TrimSpace(rule.Name) == "" {
		return fmt.Errorf("rule name is required")
	}
	if len(fields) == 0 {
		return fmt.Errorf("at least one unique field is required")
	}

	attrSet := map[string]struct{}{}
	attrs, err := s.ListAttributes(ctx, modelUID)
	if err != nil {
		return err
	}
	for _, attr := range attrs {
		attrSet[attr.FieldUID] = struct{}{}
	}
	for _, fieldUID := range fields {
		fieldUID = strings.TrimSpace(fieldUID)
		if fieldUID == "" {
			return fmt.Errorf("field uid cannot be empty")
		}
		if _, exists := attrSet[fieldUID]; !exists {
			return fmt.Errorf("field %q does not exist on model %q", fieldUID, modelUID)
		}
	}

	var duplicateCount int64
	query := s.db.WithContext(ctx).Model(&types.ModelUniqueRule{}).Where("model_uid = ? AND name = ? AND deleted_at IS NULL", modelUID, strings.TrimSpace(rule.Name))
	if ruleID > 0 {
		query = query.Where("id <> ?", ruleID)
	}
	if err := query.Count(&duplicateCount).Error; err != nil {
		return err
	}
	if duplicateCount > 0 {
		return fmt.Errorf("unique rule %q already exists", rule.Name)
	}

	if rule.IsDefault {
		var defaultCount int64
		query := s.db.WithContext(ctx).Model(&types.ModelUniqueRule{}).Where("model_uid = ? AND is_default = true AND deleted_at IS NULL", modelUID)
		if ruleID > 0 {
			query = query.Where("id <> ?", ruleID)
		}
		if err := query.Count(&defaultCount).Error; err != nil {
			return err
		}
		if defaultCount > 0 {
			return fmt.Errorf("default unique rule already exists for model %q", modelUID)
		}
	}

	return nil
}

func buildUniqueConflictValues(rule types.UniqueRuleDetail, data map[string]interface{}) (map[string]interface{}, bool) {
	values := make(map[string]interface{}, len(rule.Fields))
	allEmpty := true
	for _, field := range rule.Fields {
		value, exists := data[field]
		if !exists {
			return nil, false
		}
		values[field] = value
		if strings.TrimSpace(fmt.Sprint(value)) != "" {
			allEmpty = false
		}
	}
	if allEmpty && rule.IgnoreIfAllEmpty {
		return nil, false
	}
	return values, true
}
