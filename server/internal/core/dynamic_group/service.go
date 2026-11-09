package dynamic_group

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/types"
)

const (
	targetHost  = "host"
	modelHost   = "host"
	modelModule = "module"
	modelSet    = "set"
)

type Service interface {
	List(ctx context.Context, businessID uint64, targetModelUID, searchField, keyword string, limit, offset int) ([]types.DynamicGroupDetail, int64, error)
	Get(ctx context.Context, businessID uint64, groupID uuid.UUID) (*types.DynamicGroupDetail, error)
	Create(ctx context.Context, businessID uint64, input *CreateDynamicGroupInput) (*types.DynamicGroupDetail, error)
	Update(ctx context.Context, businessID uint64, groupID uuid.UUID, input *UpdateDynamicGroupInput) (*types.DynamicGroupDetail, error)
	Delete(ctx context.Context, businessID uint64, groupID uuid.UUID) error
	GetMeta(ctx context.Context) (map[string]interface{}, error)
	Preview(ctx context.Context, businessID uint64, targetModelUID string, condition []types.DynamicGroupConditionGroup, limit int) ([]types.DynamicGroupPreviewHost, int64, error)
	UpdatePreviewCount(ctx context.Context, businessID uint64, groupID uuid.UUID, count int64) error
}

type service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) Service {
	return &service{db: db}
}

type CreateDynamicGroupInput struct {
	Name           string
	TargetModelUID string
	Condition      []types.DynamicGroupConditionGroup
	Description    string
	CreatedBy      string
}

type UpdateDynamicGroupInput struct {
	Name           string
	TargetModelUID string
	Condition      []types.DynamicGroupConditionGroup
	Description    string
	UpdatedBy      string
}

func (s *service) List(ctx context.Context, businessID uint64, targetModelUID, searchField, keyword string, limit, offset int) ([]types.DynamicGroupDetail, int64, error) {
	query := s.db.WithContext(ctx).Model(&types.DynamicGroup{}).Where("business_id = ? AND deleted_at IS NULL", businessID)
	if targetModelUID != "" {
		query = query.Where("target_model_uid = ?", targetModelUID)
	}
	if strings.TrimSpace(keyword) != "" {
		query = applyListKeywordFilter(query, searchField, keyword)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var groups []types.DynamicGroup
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&groups).Error; err != nil {
		return nil, 0, err
	}

	items := make([]types.DynamicGroupDetail, 0, len(groups))
	for _, group := range groups {
		item, err := s.toDetail(group)
		if err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, nil
}

func applyListKeywordFilter(query *gorm.DB, searchField, keyword string) *gorm.DB {
	like := "%" + strings.TrimSpace(keyword) + "%"
	switch searchField {
	case "id":
		return query.Where("id::text ILIKE ?", like)
	case "bk_obj_id", "target_model_uid":
		return query.Where("target_model_uid ILIKE ?", like)
	case "modify_user":
		return query.Where("updated_by ILIKE ?", like)
	case "create_user":
		return query.Where("created_by ILIKE ?", like)
	case "name", "":
		return query.Where("name ILIKE ?", like)
	default:
		return query.Where("name ILIKE ?", like)
	}
}

func (s *service) Get(ctx context.Context, businessID uint64, groupID uuid.UUID) (*types.DynamicGroupDetail, error) {
	var group types.DynamicGroup
	if err := s.db.WithContext(ctx).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", groupID, businessID).
		First(&group).Error; err != nil {
		return nil, err
	}
	item, err := s.toDetail(group)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) Create(ctx context.Context, businessID uint64, input *CreateDynamicGroupInput) (*types.DynamicGroupDetail, error) {
	if err := s.validateInput(input.TargetModelUID, input.Condition); err != nil {
		return nil, err
	}
	group := types.DynamicGroup{
		ID:             uuid.New(),
		BusinessID:     businessID,
		Name:           strings.TrimSpace(input.Name),
		TargetModelUID: input.TargetModelUID,
		Condition:      mustMarshalJSON(input.Condition),
		Description:    strings.TrimSpace(input.Description),
		CreatedBy:      input.CreatedBy,
		UpdatedBy:      input.CreatedBy,
	}
	if err := s.db.WithContext(ctx).Create(&group).Error; err != nil {
		return nil, err
	}
	item, err := s.toDetail(group)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *service) Update(ctx context.Context, businessID uint64, groupID uuid.UUID, input *UpdateDynamicGroupInput) (*types.DynamicGroupDetail, error) {
	if err := s.validateInput(input.TargetModelUID, input.Condition); err != nil {
		return nil, err
	}

	var group types.DynamicGroup
	if err := s.db.WithContext(ctx).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", groupID, businessID).
		First(&group).Error; err != nil {
		return nil, err
	}

	updates := map[string]interface{}{
		"name":             strings.TrimSpace(input.Name),
		"target_model_uid": input.TargetModelUID,
		"condition":        mustMarshalJSON(input.Condition),
		"description":      strings.TrimSpace(input.Description),
		"updated_by":       input.UpdatedBy,
		"updated_at":       time.Now().UTC(),
	}
	if err := s.db.WithContext(ctx).Model(&group).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.Get(ctx, businessID, groupID)
}

func (s *service) Delete(ctx context.Context, businessID uint64, groupID uuid.UUID) error {
	res := s.db.WithContext(ctx).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", groupID, businessID).
		Delete(&types.DynamicGroup{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s *service) GetMeta(_ context.Context) (map[string]interface{}, error) {
	propertyMap := map[string][]types.DynamicGroupProperty{
		modelHost: {
			newProperty(101, modelHost, "bk_host_id", "主机 ID", "singlechar", "", true),
			newProperty(102, modelHost, "bk_host_name", "主机名", "singlechar", "", false),
			newProperty(103, modelHost, "bk_host_innerip", "内网 IP", "singlechar", "", true),
			newEnumProperty(104, modelHost, "bk_cloud_vendor", "云厂商", []string{"aws", "tencent_cloud", "aliyun", "custom"}),
			newProperty(105, modelHost, "bk_cloud_region", "地域", "singlechar", "", false),
			newProperty(106, modelHost, "bk_cpu", "CPU", "int", "", false),
			newProperty(107, modelHost, "bk_memory", "内存", "int", "MB", false),
			newProperty(108, modelHost, "bk_disk_size", "磁盘", "int", "GB", false),
			newEnumProperty(109, modelHost, "bk_os_type", "操作系统", []string{"linux", "windows"}),
			newEnumProperty(110, modelHost, "bk_status", "状态", []string{"running", "stopped", "terminated"}),
			newProperty(111, modelHost, "bk_created_at", "创建时间", "time", "", true),
			newProperty(112, modelHost, "bk_updated_at", "更新时间", "time", "", true),
		},
		modelModule: {
			newProperty(201, modelModule, "bk_module_id", "模块 ID", "singlechar", "", true),
			newProperty(202, modelModule, "bk_module_name", "模块名", "singlechar", "", true),
			newEnumProperty(203, modelModule, "bk_service_type", "服务类型", []string{"web", "api", "db", "cache", "mq", "other"}),
		},
		modelSet: {
			newProperty(301, modelSet, "bk_set_id", "集群 ID", "singlechar", "", true),
			newProperty(302, modelSet, "bk_set_name", "集群名", "singlechar", "", true),
			newEnumProperty(303, modelSet, "bk_env_type", "环境类型", []string{"prod", "staging", "dev", "test"}),
		},
	}

	return map[string]interface{}{
		"targets": []string{targetHost},
		"models": []types.DynamicGroupObjectMainline{
			{BKObjID: "biz", BKObjName: "业务", BKSupplierAccount: "0", BKNextObj: "set", BKNextName: "集群"},
			{BKObjID: modelSet, BKObjName: "集群", BKSupplierAccount: "0", BKNextObj: modelModule, BKNextName: "模块", BKPreObjID: "biz", BKPreObjName: "业务"},
			{BKObjID: modelModule, BKObjName: "模块", BKSupplierAccount: "0", BKNextObj: modelHost, BKNextName: "主机", BKPreObjID: modelSet, BKPreObjName: "集群"},
			{BKObjID: modelHost, BKObjName: "主机", BKSupplierAccount: "0", BKPreObjID: modelModule, BKPreObjName: "模块"},
		},
		"property_map": propertyMap,
		"fields":       propertyMap,
	}, nil
}

func (s *service) Preview(ctx context.Context, businessID uint64, targetModelUID string, condition []types.DynamicGroupConditionGroup, limit int) ([]types.DynamicGroupPreviewHost, int64, error) {
	if !isSupportedTargetModelUID(targetModelUID) {
		return nil, 0, fmt.Errorf("only host target is supported")
	}
	if err := s.validateInput(targetModelUID, condition); err != nil {
		return nil, 0, err
	}

	// 读切换：host_business_relations + host_module_relations 合一为 host_node_memberships(biz_module)，
	// 其冗余列 business_id 当业务过滤、node_id 当 module_id。别名 h/m/s/b 保留，条件映射(mapColumn)不变。
	query := s.db.WithContext(ctx).
		Table("hosts h").
		Joins("JOIN host_node_memberships hnm ON hnm.host_id = h.id AND hnm.node_kind = ?", types.NodeKindBizModule).
		Joins("LEFT JOIN modules m ON m.id = hnm.node_id AND m.deleted_at IS NULL").
		Joins("LEFT JOIN sets s ON s.id = m.set_id AND s.deleted_at IS NULL").
		Joins("LEFT JOIN businesses b ON b.id = hnm.business_id").
		Where("hnm.business_id = ? AND h.deleted_at IS NULL", businessID)

	for _, group := range condition {
		for _, rule := range group.Condition {
			var err error
			query, err = applyCondition(query, group.ObjectID, rule)
			if err != nil {
				return nil, 0, err
			}
		}
		if group.TimeCondition != nil {
			for _, rule := range group.TimeCondition.Rules {
				var err error
				query, err = applyTimeRule(query, group.ObjectID, rule)
				if err != nil {
					return nil, 0, err
				}
			}
		}
	}

	countQuery := query.Session(&gorm.Session{})
	var total int64
	if err := countQuery.Distinct("h.id").Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if limit <= 0 || limit > 200 {
		limit = 100
	}

	rows := make([]types.DynamicGroupPreviewHost, 0)
	if err := query.
		Select(previewHostSelectColumns()).
		Group("h.id, b.name").
		Order("h.created_at DESC").
		Limit(limit).
		Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	return rows, total, nil
}

func (s *service) UpdatePreviewCount(ctx context.Context, businessID uint64, groupID uuid.UUID, count int64) error {
	return s.db.WithContext(ctx).
		Model(&types.DynamicGroup{}).
		Where("id = ? AND business_id = ? AND deleted_at IS NULL", groupID, businessID).
		Update("last_preview_count", int(count)).Error
}

func (s *service) validateInput(targetModelUID string, condition []types.DynamicGroupConditionGroup) error {
	if !isSupportedTargetModelUID(targetModelUID) {
		return fmt.Errorf("only host target is supported")
	}
	for _, group := range condition {
		if group.ObjectID != modelHost && group.ObjectID != modelModule && group.ObjectID != modelSet {
			return fmt.Errorf("unsupported condition object: %s", group.ObjectID)
		}
		for _, item := range group.Condition {
			if strings.TrimSpace(item.Field) == "" || strings.TrimSpace(item.Operator) == "" {
				return fmt.Errorf("condition field and operator are required")
			}
		}
	}
	return nil
}

func isSupportedTargetModelUID(targetModelUID string) bool {
	return targetModelUID == targetHost
}

func (s *service) toDetail(group types.DynamicGroup) (types.DynamicGroupDetail, error) {
	detail := types.DynamicGroupDetail{
		ID:               group.ID,
		BusinessID:       group.BusinessID,
		BKObjID:          group.TargetModelUID,
		TargetModelUID:   group.TargetModelUID,
		Name:             group.Name,
		Description:      group.Description,
		CreateUser:       group.CreatedBy,
		ModifyUser:       group.UpdatedBy,
		CreateTime:       group.CreatedAt,
		LastTime:         group.UpdatedAt,
		LastPreviewCount: group.LastPreviewCount,
	}
	if len(group.Condition) > 0 {
		if err := json.Unmarshal(group.Condition, &detail.Info.Condition); err != nil {
			return detail, err
		}
	}
	if detail.Info.Condition == nil {
		detail.Info.Condition = []types.DynamicGroupConditionGroup{}
	}
	return detail, nil
}

func mustMarshalJSON(v interface{}) datatypes.JSON {
	if v == nil {
		return datatypes.JSON([]byte("[]"))
	}
	data, _ := json.Marshal(v)
	return datatypes.JSON(data)
}

func newProperty(id int64, objID, propertyID, propertyName, propertyType, unit string, system bool) types.DynamicGroupProperty {
	return types.DynamicGroupProperty{
		ID:                  id,
		BKObjID:             objID,
		BKPropertyID:        propertyID,
		BKPropertyName:      propertyName,
		BKPropertyType:      propertyType,
		BKPropertyGroup:     "default",
		BKPropertyGroupName: "基础信息",
		Editable:            true,
		IsPre:               true,
		IsReadOnly:          false,
		IsRequired:          false,
		IsOnly:              false,
		BKIsSystem:          system,
		BKIsAPI:             false,
		Description:         "",
		Placeholder:         "",
	}
}

func newEnumProperty(id int64, objID, propertyID, propertyName string, values []string) types.DynamicGroupProperty {
	options := make([]map[string]string, 0, len(values))
	for _, value := range values {
		options = append(options, map[string]string{
			"id":   value,
			"name": value,
			"type": "text",
		})
	}
	data, _ := json.Marshal(options)
	property := newProperty(id, objID, propertyID, propertyName, "enum", "", true)
	property.Option = string(data)
	return property
}

func previewHostSelectColumns() []string {
	return []string{
		"h.id::text AS id",
		"host(h.primary_ip) AS internal_ipv4",
		"COALESCE(h.cloud_region, '') AS region",
		"COALESCE(h.cloud_vendor, '') AS cloud_vendor",
		"COALESCE(h.cloud_instance_id, '') AS cloud_vendor_id",
		"COALESCE(b.name, '') AS cloud_business",
		"TO_CHAR(h.created_at, 'YYYY-MM-DD HH24:MI:SS') AS create_time",
		"COALESCE(h.created_by::text, '') AS creator",
	}
}

func applyCondition(query *gorm.DB, objectID string, rule types.DynamicGroupCondition) (*gorm.DB, error) {
	column, err := mapColumn(objectID, rule.Field)
	if err != nil {
		return nil, err
	}
	switch rule.Operator {
	case "$eq":
		return query.Where(column+" = ?", rule.Value), nil
	case "$ne":
		return query.Where(column+" <> ?", rule.Value), nil
	case "$gt":
		return query.Where(column+" > ?", rule.Value), nil
	case "$gte":
		return query.Where(column+" >= ?", rule.Value), nil
	case "$lt":
		return query.Where(column+" < ?", rule.Value), nil
	case "$lte":
		return query.Where(column+" <= ?", rule.Value), nil
	case "$in":
		values := normalizeSlice(rule.Value)
		if len(values) == 0 {
			return query.Where("1 = 0"), nil
		}
		return query.Where(column+" IN ?", values), nil
	case "$nin":
		values := normalizeSlice(rule.Value)
		if len(values) == 0 {
			return query, nil
		}
		return query.Where(column+" NOT IN ?", values), nil
	case "$regex":
		return query.Where(column+" ILIKE ?", "%"+fmt.Sprint(rule.Value)+"%"), nil
	case "$contains":
		return query.Where("LOWER("+column+") LIKE ?", "%"+strings.ToLower(fmt.Sprint(rule.Value))+"%"), nil
	case "$contains_s":
		return query.Where(column+" LIKE ?", "%"+fmt.Sprint(rule.Value)+"%"), nil
	case "$range":
		values := normalizeSlice(rule.Value)
		if len(values) > 0 && values[0] != nil && fmt.Sprint(values[0]) != "" {
			query = query.Where(column+" >= ?", values[0])
		}
		if len(values) > 1 && values[1] != nil && fmt.Sprint(values[1]) != "" {
			query = query.Where(column+" <= ?", values[1])
		}
		return query, nil
	default:
		return nil, fmt.Errorf("unsupported operator: %s", rule.Operator)
	}
}

func applyTimeRule(query *gorm.DB, objectID string, rule types.DynamicGroupTimeFilterRule) (*gorm.DB, error) {
	column, err := mapColumn(objectID, rule.Field)
	if err != nil {
		return nil, err
	}
	if rule.Start != "" {
		query = query.Where(column+" >= ?", rule.Start)
	}
	if rule.End != "" {
		query = query.Where(column+" <= ?", rule.End)
	}
	return query, nil
}

func mapColumn(objectID, field string) (string, error) {
	columns := map[string]map[string]string{
		modelHost: {
			"bk_host_id":      "h.id::text",
			"bk_host_name":    "h.host_name",
			"bk_host_innerip": "host(h.primary_ip)",
			"bk_cloud_vendor": "COALESCE(h.cloud_vendor, '')",
			"bk_cloud_region": "COALESCE(h.cloud_region, '')",
			"bk_cpu":          "COALESCE(h.cpu, 0)",
			"bk_memory":       "COALESCE(h.memory, 0)",
			"bk_disk_size":    "COALESCE(h.disk_size, 0)",
			"bk_os_type":      "COALESCE(h.os_type, '')",
			"bk_status":       "h.status",
			"bk_created_at":   "h.created_at",
			"bk_updated_at":   "h.updated_at",
		},
		modelModule: {
			"bk_module_id":        "m.id",
			"bk_module_name":      "m.name",
			"service_template_id": "m.service_template_id",
			"bk_service_type":     "COALESCE(m.service_type, '')",
		},
		modelSet: {
			"bk_set_id":   "s.id",
			"bk_set_name": "s.name",
			"bk_env_type": "COALESCE(s.env_type, '')",
		},
	}
	objectColumns, ok := columns[objectID]
	if !ok {
		return "", fmt.Errorf("unsupported object: %s", objectID)
	}
	column, ok := objectColumns[field]
	if !ok {
		return "", fmt.Errorf("unsupported field %s for object %s", field, objectID)
	}
	return column, nil
}

func normalizeSlice(value interface{}) []interface{} {
	switch typed := value.(type) {
	case []interface{}:
		return typed
	case []string:
		result := make([]interface{}, 0, len(typed))
		for _, item := range typed {
			result = append(result, item)
		}
		return result
	default:
		if value == nil {
			return nil
		}
		return []interface{}{value}
	}
}
