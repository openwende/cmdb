package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/import_export"
	"github.com/wend/cmdb-backend/internal/types"
)

// ImportExportHandler 导入导出处理器
type ImportExportHandler struct {
	dynamicService *dynamic_model.Service
	templateGen    *import_export.TemplateGenerator
	importer       *import_export.ExcelImporter
	uploadDir      string // 上传文件临时目录
}

// NewImportExportHandler 创建处理器
func NewImportExportHandler(dynamicService *dynamic_model.Service, uploadDir string) *ImportExportHandler {
	// 确保上传目录存在
	if uploadDir == "" {
		uploadDir = "/tmp/cmdb-uploads"
	}
	os.MkdirAll(uploadDir, 0755)

	return &ImportExportHandler{
		dynamicService: dynamicService,
		templateGen:    import_export.NewTemplateGenerator(dynamicService),
		importer:       import_export.NewExcelImporter(dynamicService),
		uploadDir:      uploadDir,
	}
}

// DownloadTemplate 下载导入模板
// GET /api/v1/dynamic-models/:uid/template
func (h *ImportExportHandler) DownloadTemplate(c *gin.Context) {
	modelUID := c.Param("uid")

	// 生成模板
	f, err := h.templateGen.GenerateExcelTemplate(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()

	// 获取模型名称
	model, err := h.dynamicService.GetModel(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 设置响应头
	filename := fmt.Sprintf("%s_导入模板_%s.xlsx", model.Name, time.Now().Format("20060102"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", filename))
	c.Header("Content-Transfer-Encoding", "binary")

	// 写入响应
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入文件失败"})
		return
	}
}

// UploadAndImport 上传并导入 Excel 文件
// POST /api/v1/dynamic-models/:uid/import
func (h *ImportExportHandler) UploadAndImport(c *gin.Context) {
	modelUID := c.Param("uid")

	// 1. 接收文件上传
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未找到上传文件"})
		return
	}

	// 验证文件类型
	ext := filepath.Ext(file.Filename)
	if ext != ".xlsx" && ext != ".xls" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "仅支持 Excel 文件（.xlsx 或 .xls）"})
		return
	}

	// 2. 保存上传文件
	timestamp := time.Now().Format("20060102150405")
	filename := fmt.Sprintf("%s_%s_%s", modelUID, timestamp, file.Filename)
	filepath := filepath.Join(h.uploadDir, filename)

	if err := c.SaveUploadedFile(file, filepath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
		return
	}

	// 确保函数结束时删除临时文件
	defer os.Remove(filepath)

	// 3. 解析导入选项
	var opts import_export.ImportOptions
	opts.SkipErrors = c.DefaultQuery("skip_errors", "true") == "true"
	opts.UpdateExisting = c.DefaultQuery("update_existing", "true") == "true"
	opts.ValidateOnly = c.DefaultQuery("validate_only", "false") == "true"
	opts.UserID = c.GetHeader("X-User-ID")
	opts.ClientIP = c.ClientIP()

	// 4. 执行导入
	result, err := h.importer.ImportFromExcel(c.Request.Context(), filepath, modelUID, &opts)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  err.Error(),
			"result": result,
		})
		return
	}

	// 5. 返回结果
	statusCode := http.StatusOK
	if result.Failed > 0 && !opts.SkipErrors {
		statusCode = http.StatusPartialContent
	}

	c.JSON(statusCode, gin.H{
		"code": 0,
		"data": result,
		"message": fmt.Sprintf("导入完成。成功: %d, 失败: %d, 跳过: %d",
			result.Successful, result.Failed, result.Skipped),
	})
}

// ValidateTemplate 验证上传的模板是否有效
// POST /api/v1/dynamic-models/:uid/validate-template
func (h *ImportExportHandler) ValidateTemplate(c *gin.Context) {
	modelUID := c.Param("uid")

	// 接收文件
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "未找到上传文件"})
		return
	}

	// 保存临时文件
	timestamp := time.Now().Format("20060102150405")
	filename := fmt.Sprintf("validate_%s_%s", timestamp, file.Filename)
	filepath := filepath.Join(h.uploadDir, filename)

	if err := c.SaveUploadedFile(file, filepath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "保存文件失败"})
		return
	}
	defer os.Remove(filepath)

	// 仅验证模式
	opts := &import_export.ImportOptions{
		ValidateOnly: true,
		SkipErrors:   true,
	}

	result, err := h.importer.ImportFromExcel(c.Request.Context(), filepath, modelUID, opts)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":  err.Error(),
			"result": result,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"valid":           result.TemplateValid,
			"fields_changed":  result.FieldsChanged,
			"missing_fields":  result.MissingFields,
			"obsolete_fields": result.ObsoleteFields,
			"total_rows":      result.Total,
			"validation_errors": result.Errors,
		},
		"message": "验证完成",
	})
}

// ExportData 导出数据为 Excel
// GET /api/v1/dynamic-models/:uid/export
func (h *ImportExportHandler) ExportData(c *gin.Context) {
	modelUID := c.Param("uid")

	// 解析过滤条件
	filters := make(map[string]interface{})
	for key, values := range c.Request.URL.Query() {
		if key != "page" && key != "page_size" {
			filters[key] = values[0]
		}
	}

	// 导出数据
	f, err := h.importer.ExportToExcel(c.Request.Context(), modelUID, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer f.Close()

	// 获取模型名称
	model, err := h.dynamicService.GetModel(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 设置响应头
	filename := fmt.Sprintf("%s_导出数据_%s.xlsx", model.Name, time.Now().Format("20060102_150405"))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename*=UTF-8''%s", filename))

	// 写入响应
	if err := f.Write(c.Writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "写入文件失败"})
		return
	}
}

// GetTemplateInfo 获取模板信息（用于前端判断是否需要重新下载）
// GET /api/v1/dynamic-models/:uid/template-info
func (h *ImportExportHandler) GetTemplateInfo(c *gin.Context) {
	modelUID := c.Param("uid")

	// 获取模型和字段
	model, err := h.dynamicService.GetModel(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	attributes, err := h.dynamicService.ListAttributes(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 计算字段哈希
	gen := import_export.NewTemplateGenerator(h.dynamicService)
	fieldsHash := gen.CalculateFieldsHash(attributes)

	// 统计字段
	requiredCount := 0
	for _, attr := range attributes {
		if attr.IsRequired {
			requiredCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": gin.H{
			"model_uid":       model.UID,
			"model_name":      model.Name,
			"fields_hash":     fieldsHash,
			"total_fields":    len(attributes),
			"required_fields": requiredCount,
			"version":         "v1",
		},
	})
}

// DownloadImportGuide 下载导入指南（PDF或Markdown）
// GET /api/v1/dynamic-models/:uid/import-guide
func (h *ImportExportHandler) DownloadImportGuide(c *gin.Context) {
	modelUID := c.Param("uid")

	model, err := h.dynamicService.GetModel(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "模型不存在"})
		return
	}

	attributes, err := h.dynamicService.ListAttributes(c.Request.Context(), modelUID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// 生成 Markdown 格式的导入指南
	guide := h.generateImportGuide(model, attributes)

	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s_导入指南.md", model.Name))
	c.String(http.StatusOK, guide)
}

// generateImportGuide 生成导入指南内容
func (h *ImportExportHandler) generateImportGuide(model *types.DynamicModel, attributes []types.DynamicAttribute) string {
	guide := fmt.Sprintf("# %s 批量导入指南\n\n", model.Name)
	guide += fmt.Sprintf("**生成时间**: %s\n\n", time.Now().Format("2006-01-02 15:04:05"))

	guide += "## 📋 导入步骤\n\n"
	guide += "1. 下载导入模板\n"
	guide += "2. 按照模板填写数据\n"
	guide += "3. 上传文件进行导入\n"
	guide += "4. 查看导入结果报告\n\n"

	guide += "## 📊 字段说明\n\n"
	guide += "| 字段名称 | 字段类型 | 是否必填 | 说明 |\n"
	guide += "|---------|---------|---------|------|\n"

	for _, attr := range attributes {
		required := "否"
		if attr.IsRequired {
			required = "✅ 是"
		}

		description := attr.Placeholder
		if description == "" {
			description = "-"
		}

		guide += fmt.Sprintf("| %s | %s | %s | %s |\n",
			attr.FieldName, attr.FieldType, required, description)
	}

	guide += "\n## ⚠️ 注意事项\n\n"
	guide += "- 必填字段不能为空\n"
	guide += "- 枚举类型必须从下拉列表中选择\n"
	guide += "- 数值类型不要包含单位\n"
	guide += "- IP地址格式：192.168.1.100\n"
	guide += "- 布尔类型：填写 true 或 false\n"

	return guide
}
