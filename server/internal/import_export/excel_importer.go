package import_export

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/types"
)

// ExcelImporter Excel 导入器
type ExcelImporter struct {
	dynamicService *dynamic_model.Service
}

// NewExcelImporter 创建导入器
func NewExcelImporter(dynamicService *dynamic_model.Service) *ExcelImporter {
	return &ExcelImporter{
		dynamicService: dynamicService,
	}
}

// ImportResult 导入结果
type ImportResult struct {
	Total          int           `json:"total"`           // 总行数
	Successful     int           `json:"successful"`      // 成功数
	Failed         int           `json:"failed"`          // 失败数
	Skipped        int           `json:"skipped"`         // 跳过数（空行）
	Errors         []ImportError `json:"errors"`          // 错误详情
	CreatedIDs     []uint64      `json:"created_ids"`     // 成功创建的资源ID列表
	TemplateValid  bool          `json:"template_valid"`  // 模板是否有效
	TemplateHash   string        `json:"template_hash"`   // 模板哈希值
	FieldsChanged  bool          `json:"fields_changed"`  // 字段是否变更
	MissingFields  []string      `json:"missing_fields"`  // 缺失的字段
	ObsoleteFields []string      `json:"obsolete_fields"` // 废弃的字段
}

// ImportError 导入错误
type ImportError struct {
	Row       int               `json:"row"`        // 行号（Excel中的实际行号）
	RowData   map[string]string `json:"row_data"`   // 该行的数据
	Field     string            `json:"field"`      // 出错字段
	Error     string            `json:"error"`      // 错误信息
	ErrorType string            `json:"error_type"` // 错误类型：validation, duplicate, system
}

// ImportOptions 导入选项
type ImportOptions struct {
	SkipErrors      bool   `json:"skip_errors"`       // 遇到错误是否继续导入
	UpdateExisting  bool   `json:"update_existing"`   // 是否更新已存在的记录
	ValidateOnly    bool   `json:"validate_only"`     // 仅验证，不实际导入
	UserID          string `json:"user_id"`           // 操作用户ID
	ClientIP        string `json:"client_ip"`         // 客户端IP
	BatchSize       int    `json:"batch_size"`        // 批量处理大小（默认100）
	IgnoreEmptyRows bool   `json:"ignore_empty_rows"` // 忽略空行（默认true）
}

// ImportFromExcel 从 Excel 文件导入数据
func (imp *ExcelImporter) ImportFromExcel(ctx context.Context, filePath string, modelUID string, opts *ImportOptions) (*ImportResult, error) {
	// 设置默认选项
	if opts == nil {
		opts = &ImportOptions{
			SkipErrors:      true,
			UpdateExisting:  true,
			ValidateOnly:    false,
			BatchSize:       100,
			IgnoreEmptyRows: true,
		}
	}

	result := &ImportResult{
		Errors:     make([]ImportError, 0),
		CreatedIDs: make([]uint64, 0),
	}

	// 1. 打开 Excel 文件
	f, err := excelize.OpenFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	// 2. 验证模板有效性
	if err := imp.validateTemplate(f, modelUID, result); err != nil {
		return result, fmt.Errorf("模板验证失败: %w", err)
	}

	// 如果字段已变更，提示用户重新下载模板
	if result.FieldsChanged {
		return result, fmt.Errorf("字段定义已变更，请重新下载最新模板。缺失字段: %v, 废弃字段: %v",
			result.MissingFields, result.ObsoleteFields)
	}

	// 3. 获取当前模型的字段定义
	attributes, err := imp.dynamicService.ListAttributes(ctx, modelUID)
	if err != nil {
		return result, fmt.Errorf("获取字段定义失败: %w", err)
	}

	// 4. 读取数据
	dataSheetName := "数据导入"
	rows, err := f.GetRows(dataSheetName)
	if err != nil {
		return result, fmt.Errorf("读取数据表失败: %w", err)
	}

	if len(rows) < 4 {
		return result, fmt.Errorf("数据表为空，至少需要4行（表头+说明+示例+数据）")
	}

	// 5. 解析表头（第1行）
	headers := rows[0]
	fieldMapping := imp.buildFieldMapping(headers, attributes)

	// 6. 逐行导入数据（从第4行开始）
	auditCtx := &dynamic_model.AuditContext{
		UserID:    opts.UserID,
		ClientIP:  opts.ClientIP,
		UserAgent: "Excel Batch Import",
	}

	for rowIndex := 3; rowIndex < len(rows); rowIndex++ {
		row := rows[rowIndex]
		excelRowNum := rowIndex + 1 // Excel 行号（从1开始）

		// 跳过空行
		if opts.IgnoreEmptyRows && imp.isEmptyRow(row) {
			result.Skipped++
			continue
		}

		result.Total++

		// 解析行数据
		data, rowData, err := imp.parseRow(row, headers, fieldMapping, attributes)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Row:       excelRowNum,
				RowData:   rowData,
				Error:     err.Error(),
				ErrorType: "validation",
			})

			if !opts.SkipErrors {
				break
			}
			continue
		}

		// 仅验证模式，跳过实际导入
		if opts.ValidateOnly {
			result.Successful++
			continue
		}

		// 执行导入
		resourceID, err := imp.dynamicService.UpsertInstance(ctx, modelUID, nil, data, auditCtx)
		if err != nil {
			result.Failed++

			// 判断错误类型
			errorType := "system"
			if _, ok := err.(*dynamic_model.ValidationError); ok {
				errorType = "validation"
			} else if _, ok := err.(*dynamic_model.DuplicateError); ok {
				errorType = "duplicate"
			}

			result.Errors = append(result.Errors, ImportError{
				Row:       excelRowNum,
				RowData:   rowData,
				Error:     err.Error(),
				ErrorType: errorType,
			})

			if !opts.SkipErrors {
				break
			}
			continue
		}

		result.Successful++
		result.CreatedIDs = append(result.CreatedIDs, resourceID)
	}

	return result, nil
}

// validateTemplate 验证模板有效性
func (imp *ExcelImporter) validateTemplate(f *excelize.File, modelUID string, result *ImportResult) error {
	configSheetName := "字段配置"

	// 检查配置表是否存在
	sheetIndex, _ := f.GetSheetIndex(configSheetName)
	if sheetIndex == -1 {
		result.TemplateValid = false
		return fmt.Errorf("模板无效：缺少【字段配置】工作表，请使用系统生成的标准模板")
	}

	// 读取元数据
	metadataCell, err := f.GetCellValue(configSheetName, "B1")
	if err != nil {
		result.TemplateValid = false
		return fmt.Errorf("读取模板元数据失败: %w", err)
	}

	var metadata TemplateMetadata
	if err := json.Unmarshal([]byte(metadataCell), &metadata); err != nil {
		result.TemplateValid = false
		return fmt.Errorf("解析模板元数据失败: %w", err)
	}

	// 验证模型UID是否匹配
	if metadata.ModelUID != modelUID {
		result.TemplateValid = false
		return fmt.Errorf("模板模型不匹配：期望 %s，实际 %s", modelUID, metadata.ModelUID)
	}

	result.TemplateHash = metadata.FieldsHash
	result.TemplateValid = true

	// 获取当前字段定义
	ctx := context.Background()
	currentAttrs, err := imp.dynamicService.ListAttributes(ctx, modelUID)
	if err != nil {
		return fmt.Errorf("获取当前字段定义失败: %w", err)
	}

	// 读取模板中的字段定义
	rows, err := f.GetRows(configSheetName)
	if err != nil {
		return fmt.Errorf("读取字段配置失败: %w", err)
	}

	templateFields := make(map[string]bool)
	for i := 3; i < len(rows); i++ { // 从第4行开始
		if len(rows[i]) > 0 {
			templateFields[rows[i][0]] = true
		}
	}

	currentFields := make(map[string]bool)
	for _, attr := range currentAttrs {
		currentFields[attr.FieldUID] = true
	}

	// 检测字段变更
	missingFields := make([]string, 0)
	obsoleteFields := make([]string, 0)

	// 检查缺失的字段（当前有但模板没有）
	for _, attr := range currentAttrs {
		if attr.IsRequired && !templateFields[attr.FieldUID] {
			missingFields = append(missingFields, attr.FieldName)
		}
	}

	// 检查废弃的字段（模板有但当前没有）
	for fieldUID := range templateFields {
		if !currentFields[fieldUID] {
			obsoleteFields = append(obsoleteFields, fieldUID)
		}
	}

	if len(missingFields) > 0 || len(obsoleteFields) > 0 {
		result.FieldsChanged = true
		result.MissingFields = missingFields
		result.ObsoleteFields = obsoleteFields
	}

	return nil
}

// buildFieldMapping 构建字段映射（表头名称 -> 字段定义）
func (imp *ExcelImporter) buildFieldMapping(headers []string, attributes []types.DynamicAttribute) map[int]*types.DynamicAttribute {
	mapping := make(map[int]*types.DynamicAttribute)

	// 创建字段名称到定义的映射
	nameToAttr := make(map[string]*types.DynamicAttribute)
	for i := range attributes {
		nameToAttr[attributes[i].FieldName] = &attributes[i]
	}

	// 根据表头顺序建立映射
	for colIndex, header := range headers {
		if attr, exists := nameToAttr[header]; exists {
			mapping[colIndex] = attr
		}
	}

	return mapping
}

// parseRow 解析行数据
func (imp *ExcelImporter) parseRow(
	row []string,
	headers []string,
	fieldMapping map[int]*types.DynamicAttribute,
	attributes []types.DynamicAttribute,
) (map[string]interface{}, map[string]string, error) {
	data := make(map[string]interface{})
	rowData := make(map[string]string) // 用于错误报告

	// 遍历每一列
	for colIndex, cellValue := range row {
		if colIndex >= len(headers) {
			break
		}

		headerName := headers[colIndex]
		rowData[headerName] = cellValue

		attr, exists := fieldMapping[colIndex]
		if !exists {
			continue // 跳过未映射的列
		}

		// 处理空值
		cellValue = strings.TrimSpace(cellValue)
		if cellValue == "" {
			if attr.IsRequired {
				return nil, rowData, fmt.Errorf("必填字段 [%s] 不能为空", attr.FieldName)
			}
			continue
		}

		// 根据字段类型转换值
		convertedValue, err := imp.convertValue(cellValue, attr)
		if err != nil {
			return nil, rowData, fmt.Errorf("字段 [%s] 格式错误: %w", attr.FieldName, err)
		}

		data[attr.FieldUID] = convertedValue
	}

	// 检查是否缺少必填字段
	for _, attr := range attributes {
		if attr.IsRequired {
			if _, exists := data[attr.FieldUID]; !exists {
				return nil, rowData, fmt.Errorf("缺少必填字段 [%s]", attr.FieldName)
			}
		}
	}

	return data, rowData, nil
}

// convertValue 转换单元格值为正确的类型
func (imp *ExcelImporter) convertValue(cellValue string, attr *types.DynamicAttribute) (interface{}, error) {
	cellValue = strings.TrimSpace(cellValue)

	switch attr.FieldType {
	case "string":
		return cellValue, nil

	case "int":
		val, err := strconv.ParseInt(cellValue, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("无法转换为整数: %s", cellValue)
		}
		return val, nil

	case "float":
		val, err := strconv.ParseFloat(cellValue, 64)
		if err != nil {
			return nil, fmt.Errorf("无法转换为浮点数: %s", cellValue)
		}
		return val, nil

	case "bool":
		lower := strings.ToLower(cellValue)
		if lower == "true" || lower == "1" || lower == "是" || lower == "yes" {
			return true, nil
		}
		if lower == "false" || lower == "0" || lower == "否" || lower == "no" {
			return false, nil
		}
		return nil, fmt.Errorf("无法转换为布尔值: %s（请使用 true/false）", cellValue)

	case "enum":
		// 验证是否在枚举值列表中
		if attr.Validators != nil {
			var validators types.FieldValidators
			json.Unmarshal(attr.Validators, &validators)

			if len(validators.EnumValues) > 0 {
				for _, enumValue := range validators.EnumValues {
					if cellValue == enumValue {
						return cellValue, nil
					}
				}
				return nil, fmt.Errorf("不在允许的枚举值中: %s，可选值: %v", cellValue, validators.EnumValues)
			}
		}
		return cellValue, nil

	case "date":
		// TODO: 添加日期格式验证
		return cellValue, nil

	default:
		return cellValue, nil
	}
}

// isEmptyRow 判断是否为空行
func (imp *ExcelImporter) isEmptyRow(row []string) bool {
	for _, cell := range row {
		if strings.TrimSpace(cell) != "" {
			return false
		}
	}
	return true
}

// ExportToExcel 导出数据到 Excel
func (imp *ExcelImporter) ExportToExcel(ctx context.Context, modelUID string, filters map[string]interface{}) (*excelize.File, error) {
	// 1. 获取模型和字段定义
	model, err := imp.dynamicService.GetModel(ctx, modelUID)
	if err != nil {
		return nil, err
	}

	attributes, err := imp.dynamicService.ListAttributes(ctx, modelUID)
	if err != nil {
		return nil, err
	}

	// 2. 查询数据
	resources, _, err := imp.dynamicService.ListInstances(ctx, modelUID, filters, 1, 10000) // 最多导出10000条
	if err != nil {
		return nil, err
	}

	// 3. 创建 Excel
	f := excelize.NewFile()
	sheetName := "导出数据"
	f.SetSheetName("Sheet1", sheetName)

	// 4. 写入表头
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font:      &excelize.Font{Bold: true, Size: 12},
		Fill:      excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center"},
	})

	for i, attr := range attributes {
		col, _ := excelize.ColumnNumberToName(i + 1)
		cell := fmt.Sprintf("%s1", col)
		f.SetCellValue(sheetName, cell, attr.FieldName)
		f.SetCellStyle(sheetName, cell, cell, headerStyle)
	}

	// 5. 写入数据
	for rowIndex, resource := range resources {
		var configs map[string]interface{}
		json.Unmarshal(resource.Configs, &configs)

		for colIndex, attr := range attributes {
			col, _ := excelize.ColumnNumberToName(colIndex + 1)
			cell := fmt.Sprintf("%s%d", col, rowIndex+2)

			if value, exists := configs[attr.FieldUID]; exists {
				f.SetCellValue(sheetName, cell, value)
			}
		}
	}

	// 6. 添加导出信息
	infoSheet := "导出信息"
	f.NewSheet(infoSheet)
	f.SetCellValue(infoSheet, "A1", "模型名称")
	f.SetCellValue(infoSheet, "B1", model.Name)
	f.SetCellValue(infoSheet, "A2", "导出时间")
	f.SetCellValue(infoSheet, "B2", time.Now().Format("2006-01-02 15:04:05"))
	f.SetCellValue(infoSheet, "A3", "记录数量")
	f.SetCellValue(infoSheet, "B3", len(resources))

	return f, nil
}
