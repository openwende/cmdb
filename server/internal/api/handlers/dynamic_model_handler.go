package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/gorm"
)

// DynamicModelHandler 动态模型 HTTP Handler
type DynamicModelHandler struct {
	service *dynamic_model.Service
}

// NewDynamicModelHandler 创建 Handler
func NewDynamicModelHandler(service *dynamic_model.Service) *DynamicModelHandler {
	return &DynamicModelHandler{
		service: service,
	}
}

// ========== 模型管理 API ==========

// CreateModelRequest 创建模型请求
type CreateModelRequest struct {
	UID          string                   `json:"uid" binding:"required"`
	Name         string                   `json:"name" binding:"required"`
	Description  string                   `json:"description"`
	Icon         string                   `json:"icon"`
	UniqueFields *types.UniqueFieldConfig `json:"unique_fields"`
}

// CreateModel 创建模型
// POST /api/v1/dynamic-models
func (h *DynamicModelHandler) CreateModel(c *gin.Context) {
	var req CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	model := &types.DynamicModel{
		UID:         req.UID,
		Name:        req.Name,
		Description: req.Description,
		Icon:        req.Icon,
	}

	if req.UniqueFields != nil {
		model.UniqueFields = marshalJSON(req.UniqueFields)
	}

	if err := h.service.CreateModel(c.Request.Context(), model); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": model,
	})
}

// ListModels 列出所有模型
// GET /api/v1/dynamic-models
func (h *DynamicModelHandler) ListModels(c *gin.Context) {
	models, err := h.service.ListModels(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": models,
	})
}

// GetModel 获取模型详情
// GET /api/v1/dynamic-models/:uid
func (h *DynamicModelHandler) GetModel(c *gin.Context) {
	uid := c.Param("uid")

	model, err := h.service.GetModel(c.Request.Context(), uid)
	if err != nil {
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": model,
	})
}

// UpdateModel 更新模型
// PUT /api/v1/dynamic-models/:uid
func (h *DynamicModelHandler) UpdateModel(c *gin.Context) {
	uid := c.Param("uid")

	var req CreateModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"name":        req.Name,
		"description": req.Description,
		"icon":        req.Icon,
	}

	if req.UniqueFields != nil {
		updates["unique_fields"] = marshalJSON(req.UniqueFields)
	}

	if err := h.service.UpdateModel(c.Request.Context(), uid, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "更新成功"},
	})
}

// DeleteModel 删除模型
// DELETE /api/v1/dynamic-models/:uid
func (h *DynamicModelHandler) DeleteModel(c *gin.Context) {
	uid := c.Param("uid")

	if err := h.service.DeleteModel(c.Request.Context(), uid); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "删除成功"},
	})
}

// ========== 属性管理 API ==========

// CreateAttributeRequest 创建属性请求
type CreateAttributeRequest struct {
	FieldUID     string                 `json:"field_uid" binding:"required"`
	FieldName    string                 `json:"field_name" binding:"required"`
	FieldType    string                 `json:"field_type" binding:"required"`
	Category     string                 `json:"category" binding:"required"`
	IsRequired   bool                   `json:"is_required"`
	IsUnique     bool                   `json:"is_unique"`
	UniqueGroup  string                 `json:"unique_group"`
	IsReadOnly   bool                   `json:"is_read_only"`
	DefaultValue string                 `json:"default_value"`
	Placeholder  string                 `json:"placeholder"`
	Unit         string                 `json:"unit"`
	Validators   *types.FieldValidators `json:"validators"`
}

// CreateAttribute 创建属性
// POST /api/v1/dynamic-models/:uid/attributes
func (h *DynamicModelHandler) CreateAttribute(c *gin.Context) {
	modelUID := c.Param("uid")

	var req CreateAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	attr := &types.DynamicAttribute{
		ModelUID:     modelUID,
		FieldUID:     req.FieldUID,
		FieldName:    req.FieldName,
		FieldType:    req.FieldType,
		Category:     req.Category,
		IsRequired:   req.IsRequired,
		IsUnique:     req.IsUnique,
		UniqueGroup:  req.UniqueGroup,
		IsReadOnly:   req.IsReadOnly,
		DefaultValue: req.DefaultValue,
		Placeholder:  req.Placeholder,
		Unit:         req.Unit,
	}

	if req.Validators != nil {
		attr.Validators = marshalJSON(req.Validators)
	}

	if err := h.service.CreateAttribute(c.Request.Context(), attr); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": attr,
	})
}

// ListAttributes 列出模型的所有属性
// GET /api/v1/dynamic-models/:uid/attributes
func (h *DynamicModelHandler) ListAttributes(c *gin.Context) {
	modelUID := c.Param("uid")

	attributes, err := h.service.ListAttributes(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": attributes,
	})
}

// UpdateAttribute 更新属性
// PUT /api/v1/dynamic-models/:uid/attributes/:field_uid
func (h *DynamicModelHandler) UpdateAttribute(c *gin.Context) {
	modelUID := c.Param("uid")
	fieldUID := c.Param("field_uid")

	var req CreateAttributeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"field_name":    req.FieldName,
		"is_required":   req.IsRequired,
		"is_read_only":  req.IsReadOnly,
		"default_value": req.DefaultValue,
		"placeholder":   req.Placeholder,
		"unit":          req.Unit,
	}

	if req.Validators != nil {
		updates["validators"] = marshalJSON(req.Validators)
	}

	if err := h.service.UpdateAttribute(c.Request.Context(), modelUID, fieldUID, updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "更新成功"},
	})
}

// DeleteAttribute 删除属性
// DELETE /api/v1/dynamic-models/:uid/attributes/:field_uid
func (h *DynamicModelHandler) DeleteAttribute(c *gin.Context) {
	modelUID := c.Param("uid")
	fieldUID := c.Param("field_uid")

	if err := h.service.DeleteAttribute(c.Request.Context(), modelUID, fieldUID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "删除成功"},
	})
}

// ========== 唯一规则 API ==========

type CreateUniqueRuleRequest struct {
	Name             string   `json:"name" binding:"required"`
	IsDefault        bool     `json:"is_default"`
	IsAuxiliary      bool     `json:"is_auxiliary"`
	Enabled          bool     `json:"enabled"`
	IgnoreIfAllEmpty bool     `json:"ignore_if_all_empty"`
	Description      string   `json:"description"`
	Fields           []string `json:"fields" binding:"required"`
}

type UpdateUniqueRuleRequest struct {
	Name             string   `json:"name" binding:"required"`
	IsAuxiliary      bool     `json:"is_auxiliary"`
	Enabled          bool     `json:"enabled"`
	IgnoreIfAllEmpty bool     `json:"ignore_if_all_empty"`
	Description      string   `json:"description"`
	Fields           []string `json:"fields" binding:"required"`
}

type ValidateUniqueRequest struct {
	ResourceID *uint64                `json:"resource_id,omitempty"`
	Data       map[string]interface{} `json:"data" binding:"required"`
}

func (h *DynamicModelHandler) ListUniqueRules(c *gin.Context) {
	uid := c.Param("uid")
	items, err := h.service.ListUniqueRules(c.Request.Context(), uid)
	if err != nil {
		status := http.StatusInternalServerError
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"items": items}})
}

func (h *DynamicModelHandler) CreateUniqueRule(c *gin.Context) {
	uid := c.Param("uid")
	var req CreateUniqueRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.service.CreateUniqueRule(c.Request.Context(), &types.ModelUniqueRule{
		ModelUID:         uid,
		Name:             req.Name,
		IsDefault:        req.IsDefault,
		IsAuxiliary:      req.IsAuxiliary,
		Enabled:          req.Enabled,
		IgnoreIfAllEmpty: req.IgnoreIfAllEmpty,
		Description:      req.Description,
		CreatedBy:        c.GetHeader("X-User-ID"),
		UpdatedBy:        c.GetHeader("X-User-ID"),
	}, req.Fields)
	if err != nil {
		status := http.StatusBadRequest
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": rule})
}

func (h *DynamicModelHandler) UpdateUniqueRule(c *gin.Context) {
	uid := c.Param("uid")
	ruleID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则 ID"})
		return
	}
	var req UpdateUniqueRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	rule, err := h.service.UpdateUniqueRule(c.Request.Context(), uid, ruleID, &types.ModelUniqueRule{
		Name:             req.Name,
		IsAuxiliary:      req.IsAuxiliary,
		Enabled:          req.Enabled,
		IgnoreIfAllEmpty: req.IgnoreIfAllEmpty,
		Description:      req.Description,
		UpdatedBy:        c.GetHeader("X-User-ID"),
	}, req.Fields)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": rule})
}

func (h *DynamicModelHandler) DeleteUniqueRule(c *gin.Context) {
	uid := c.Param("uid")
	ruleID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的规则 ID"})
		return
	}
	if err := h.service.DeleteUniqueRule(c.Request.Context(), uid, ruleID); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
}

func (h *DynamicModelHandler) ValidateUnique(c *gin.Context) {
	uid := c.Param("uid")
	var req ValidateUniqueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	violations, err := h.service.ValidateUnique(c.Request.Context(), uid, req.ResourceID, req.Data)
	if err != nil {
		status := http.StatusInternalServerError
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	if len(violations) > 0 {
		c.JSON(http.StatusConflict, gin.H{
			"error": "唯一校验冲突",
			"code":  "UNIQUE_RULE_VIOLATION",
			"details": gin.H{
				"violations": violations,
			},
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"valid": true, "violations": []interface{}{}}})
}

// ========== 关联类型与模型关系 API ==========

type CreateAssociationTypeRequest struct {
	UID              string `json:"uid" binding:"required"`
	Name             string `json:"name" binding:"required"`
	SourceToDestDesc string `json:"source_to_dest_desc"`
	DestToSourceDesc string `json:"dest_to_source_desc"`
	Description      string `json:"description"`
}

type UpdateAssociationTypeRequest struct {
	Name             *string `json:"name,omitempty"`
	SourceToDestDesc *string `json:"source_to_dest_desc,omitempty"`
	DestToSourceDesc *string `json:"dest_to_source_desc,omitempty"`
	Description      *string `json:"description,omitempty"`
}

type CreateModelAssociationRequest struct {
	TargetModelUID string `json:"target_model_uid" binding:"required"`
	AssociationUID string `json:"association_uid" binding:"required"`
	Mapping        string `json:"mapping"`
	OnDelete       string `json:"on_delete"`
	Description    string `json:"description"`
}

type UpdateModelAssociationRequest struct {
	TargetModelUID *string `json:"target_model_uid,omitempty"`
	AssociationUID *string `json:"association_uid,omitempty"`
	Mapping        *string `json:"mapping,omitempty"`
	OnDelete       *string `json:"on_delete,omitempty"`
	Description    *string `json:"description,omitempty"`
}

func (h *DynamicModelHandler) ListAssociationTypes(c *gin.Context) {
	items, err := h.service.ListAssociationTypes(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"items": items}})
}

func (h *DynamicModelHandler) CreateAssociationType(c *gin.Context) {
	var req CreateAssociationTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item := &types.AssociationType{
		UID:              req.UID,
		Name:             req.Name,
		SourceToDestDesc: req.SourceToDestDesc,
		DestToSourceDesc: req.DestToSourceDesc,
		Description:      req.Description,
	}
	if err := h.service.CreateAssociationType(c.Request.Context(), item); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": item})
}

func (h *DynamicModelHandler) UpdateAssociationType(c *gin.Context) {
	uid := c.Param("uid")
	var req UpdateAssociationTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.SourceToDestDesc != nil {
		updates["source_to_dest_desc"] = *req.SourceToDestDesc
	}
	if req.DestToSourceDesc != nil {
		updates["dest_to_source_desc"] = *req.DestToSourceDesc
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	item, err := h.service.UpdateAssociationType(c.Request.Context(), uid, updates)
	if err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": item})
}

func (h *DynamicModelHandler) DeleteAssociationType(c *gin.Context) {
	uid := c.Param("uid")
	if err := h.service.DeleteAssociationType(c.Request.Context(), uid); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
}

func (h *DynamicModelHandler) ListModelAssociations(c *gin.Context) {
	uid := c.Param("uid")
	items, err := h.service.ListModelAssociations(c.Request.Context(), uid)
	if err != nil {
		status := http.StatusInternalServerError
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"items": items}})
}

func (h *DynamicModelHandler) CreateModelAssociation(c *gin.Context) {
	uid := c.Param("uid")
	var req CreateModelAssociationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	item := &types.DynamicModelAssociation{
		SourceModelUID: uid,
		TargetModelUID: req.TargetModelUID,
		AssociationUID: req.AssociationUID,
		Mapping:        req.Mapping,
		OnDelete:       req.OnDelete,
		Description:    req.Description,
	}
	if err := h.service.CreateModelAssociation(c.Request.Context(), item); err != nil {
		status := http.StatusBadRequest
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"code": 0, "data": item})
}

func (h *DynamicModelHandler) UpdateModelAssociation(c *gin.Context) {
	uid := c.Param("uid")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的关联 ID"})
		return
	}

	var req UpdateModelAssociationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.TargetModelUID != nil {
		updates["target_model_uid"] = *req.TargetModelUID
	}
	if req.AssociationUID != nil {
		updates["association_uid"] = *req.AssociationUID
	}
	if req.Mapping != nil {
		updates["mapping"] = *req.Mapping
	}
	if req.OnDelete != nil {
		updates["on_delete"] = *req.OnDelete
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}

	item, err := h.service.UpdateModelAssociation(c.Request.Context(), uid, id, updates)
	if err != nil {
		status := http.StatusBadRequest
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": item})
}

func (h *DynamicModelHandler) DeleteModelAssociation(c *gin.Context) {
	uid := c.Param("uid")
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的关联 ID"})
		return
	}

	if err := h.service.DeleteModelAssociation(c.Request.Context(), uid, id); err != nil {
		status := http.StatusBadRequest
		if errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": gin.H{"message": "删除成功"}})
}

func (h *DynamicModelHandler) GetAvailableRelations(c *gin.Context) {
	uid := c.Param("uid")
	data, err := h.service.GetAvailableRelations(c.Request.Context(), uid)
	if err != nil {
		status := http.StatusInternalServerError
		if _, ok := err.(*dynamic_model.ModelNotFoundError); ok || errors.Is(err, gorm.ErrRecordNotFound) {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"code": 0, "data": data})
}

// ========== 资源实例管理 API ==========

// UpsertInstanceRequest 创建/更新实例请求
type UpsertInstanceRequest struct {
	ResourceID *uint64                `json:"resource_id,omitempty"`
	Data       map[string]interface{} `json:"data" binding:"required"`
}

// UpsertInstance 创建或更新资源实例
// POST /api/v1/dynamic-models/:uid/instances
func (h *DynamicModelHandler) UpsertInstance(c *gin.Context) {
	modelUID := c.Param("uid")

	var req UpsertInstanceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 构建审计上下文
	auditCtx := &dynamic_model.AuditContext{
		UserID:    c.GetHeader("X-User-ID"),
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	}

	resourceID, err := h.service.UpsertInstance(c.Request.Context(), modelUID, req.ResourceID, req.Data, auditCtx)
	if err != nil {
		// 处理特定错误
		switch e := err.(type) {
		case *dynamic_model.ValidationError:
			c.JSON(http.StatusBadRequest, gin.H{"error": e.Error(), "details": e.Details})
			return
		case *dynamic_model.DuplicateError:
			c.JSON(http.StatusConflict, gin.H{"error": e.Error(), "details": e.Details})
			return
		case *dynamic_model.ModelNotFoundError:
			c.JSON(http.StatusNotFound, gin.H{"error": e.Error()})
			return
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": gin.H{
			"resource_id": resourceID,
			"message":     "操作成功",
		},
	})
}

// GetInstance 获取资源实例
// GET /api/v1/dynamic-models/:uid/instances/:id
func (h *DynamicModelHandler) GetInstance(c *gin.Context) {
	modelUID := c.Param("uid")
	resourceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的资源 ID"})
		return
	}

	resource, err := h.service.GetInstanceView(c.Request.Context(), modelUID, resourceID)
	if err != nil {
		if _, ok := err.(*dynamic_model.ResourceNotFoundError); ok {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": resource,
	})
}

// ListInstances 查询资源实例列表
// GET /api/v1/dynamic-models/:uid/instances
func (h *DynamicModelHandler) ListInstances(c *gin.Context) {
	modelUID := c.Param("uid")

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 过滤条件（从 query string 中提取）
	filters := make(map[string]interface{})
	for key, values := range c.Request.URL.Query() {
		if key != "page" && key != "page_size" {
			filters[key] = values[0]
		}
	}

	resources, total, err := h.service.ListInstances(c.Request.Context(), modelUID, filters, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": resources,
			"pagination": gin.H{
				"page":       page,
				"page_size":  pageSize,
				"total":      total,
				"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
			},
		},
	})
}

// DeleteInstance 删除资源实例
// DELETE /api/v1/dynamic-models/:uid/instances/:id
func (h *DynamicModelHandler) DeleteInstance(c *gin.Context) {
	resourceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的资源 ID"})
		return
	}

	auditCtx := &dynamic_model.AuditContext{
		UserID:    c.GetHeader("X-User-ID"),
		ClientIP:  c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	}

	if err := h.service.DeleteInstance(c.Request.Context(), resourceID, auditCtx); err != nil {
		if _, ok := err.(*dynamic_model.ResourceNotFoundError); ok {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "删除成功"},
	})
}

// ========== 关联关系管理 API ==========

// CreateRelationRequest 创建关联请求
type CreateRelationRequest struct {
	SourceID       uint64 `json:"source_id" binding:"required"`
	TargetID       uint64 `json:"target_id" binding:"required"`
	AssociationUID string `json:"association_uid" binding:"required"`
}

// CreateRelation 创建关联关系
// POST /api/v1/dynamic-models/relations
func (h *DynamicModelHandler) CreateRelation(c *gin.Context) {
	var req CreateRelationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.CreateRelation(c.Request.Context(), req.SourceID, req.TargetID, req.AssociationUID); err != nil {
		switch e := err.(type) {
		case *dynamic_model.ResourceNotFoundError:
			c.JSON(http.StatusNotFound, gin.H{"error": e.Error()})
			return
		case *dynamic_model.AssociationNotAllowedError:
			c.JSON(http.StatusBadRequest, gin.H{"error": e.Error(), "details": e.Details})
			return
		case *dynamic_model.CardinalityViolationError:
			c.JSON(http.StatusConflict, gin.H{"error": e.Error(), "details": e.Details})
			return
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"code": 0,
		"data": gin.H{"message": "创建关联成功"},
	})
}

// ListRelations 查询资源的关联关系
// GET /api/v1/dynamic-models/instances/:id/relations
func (h *DynamicModelHandler) ListRelations(c *gin.Context) {
	modelUID := c.Param("uid")
	resourceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的资源 ID"})
		return
	}

	direction := c.DefaultQuery("direction", "both") // source, target, both
	if direction != "source" && direction != "target" && direction != "both" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的 direction，只允许 source、target、both"})
		return
	}
	associationUID := c.Query("association_uid")

	relations, err := h.service.ListInstanceRelations(c.Request.Context(), modelUID, resourceID, direction, associationUID)
	if err != nil {
		if _, ok := err.(*dynamic_model.ResourceNotFoundError); ok {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": relations,
		},
	})
}

// DeleteRelation 删除关联关系
// DELETE /api/v1/dynamic-models/relations/:id
func (h *DynamicModelHandler) DeleteRelation(c *gin.Context) {
	relationID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的关联 ID"})
		return
	}

	if err := h.service.DeleteRelation(c.Request.Context(), relationID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{"message": "删除成功"},
	})
}

// ========== 拓扑查询 API ==========

// GetTopology 查询拓扑关系
// GET /api/v1/dynamic-models/instances/:id/topology
func (h *DynamicModelHandler) GetTopology(c *gin.Context) {
	modelUID := c.Param("uid")
	startID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的资源 ID"})
		return
	}

	maxDepth, _ := strconv.Atoi(c.DefaultQuery("max_depth", "5"))
	reverse := c.Query("reverse") == "true"

	var associationUIDs []string
	if assocStr := c.Query("association_uids"); assocStr != "" {
		// 解析逗号分隔的关联类型
		associationUIDs = splitAndTrim(assocStr, ",")
	}

	graph, err := h.service.GetTopologyGraph(c.Request.Context(), modelUID, startID, maxDepth, associationUIDs, reverse)
	if err != nil {
		if _, ok := err.(*dynamic_model.ResourceNotFoundError); ok {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": graph,
	})
}

// ========== 审计日志 API ==========

// GetResourceHistory 获取资源变更历史
// GET /api/v1/dynamic-models/instances/:id/history
func (h *DynamicModelHandler) GetResourceHistory(c *gin.Context) {
	modelUID := c.Param("uid")
	resourceID, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的资源 ID"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	histories, total, err := h.service.GetResourceHistoryView(c.Request.Context(), modelUID, resourceID, page, pageSize)
	if err != nil {
		if _, ok := err.(*dynamic_model.ResourceNotFoundError); ok {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"items": histories,
			"pagination": gin.H{
				"page":       page,
				"page_size":  pageSize,
				"total":      total,
				"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
			},
		},
	})
}

// ========== 辅助函数 ==========

func marshalJSON(v interface{}) []byte {
	b, _ := json.Marshal(v)
	return b
}

func parsePaginationParams(c *gin.Context, defaultPageSize, maxPageSize int) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", strconv.Itoa(defaultPageSize)))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > maxPageSize {
		pageSize = defaultPageSize
	}

	return page, pageSize
}

func splitAndTrim(s, sep string) []string {
	parts := strings.Split(s, sep)
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
