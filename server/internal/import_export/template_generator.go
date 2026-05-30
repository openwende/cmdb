package import_export

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/xuri/excelize/v2"

	"github.com/wend/cmdb-backend/internal/core/dynamic_model"
	"github.com/wend/cmdb-backend/internal/types"
)

// TemplateGenerator 模板生成器
type TemplateGenerator struct {
	dynamicService dynamic_model.Service
}

// NewTemplateGenerator 创建模板生成器
func NewTemplateGenerator(dynamicService dynamic_model.Service) *TemplateGenerator {
	return &TemplateGenerator{
		dynamicService: dynamicService,
	}
}

// TemplateMetadata 模板元数据
type TemplateMetadata struct {
	ModelUID      string    `json:"model_uid"`
	ModelName     string    `json:"model_name"`
	GeneratedAt   time.Time `json:"generated_at"`
	Version       string    `json:"version"`       // 模板版本，如 "v1"
	FieldsHash    string    `json:"fields_hash"`   // 字段配置的哈希值，用于检测变更
	TotalFields   int       `json:"total_fields"`
	RequiredFields int      `json:"required_fields"`
}

// FieldTemplateInfo 字段模板信息
type FieldTemplateInfo struct {
	FieldUID     string   `json:"field_uid"`
	FieldName    string   `json:"field_name"`
	FieldType    string   `json:"field_type"`
	Category     string   `json:"category"`
	IsRequired   bool     `json:"is_required"`
	DefaultValue string   `json:"default_value"`
	Placeholder  string   `json:"placeholder"`
	Unit         string   `json:"unit"`
	EnumValues   []string `json:"enum_values,omitempty"`
	MinValue     *float64 `json:"min_value,omitempty"`
	MaxValue     *float64 `json:"max_value,omitempty"`
	Pattern      string   `json:"pattern,omitempty"`
	Description  string   `json:"description"`
}

// GenerateExcelTemplate 生成 Excel 导入模板
func (g *TemplateGenerator) GenerateExcelTemplate(ctx context.Context, modelUID string) (*excelize.File, error) {
	// 1. 获取模型信息
	model, err := g.dynamicService.GetModel(ctx, modelUID)
	if err != nil {
		return nil, fmt.Errorf("获取模型失败: %w", err)
	}

	// 2. 获取字段定义
	attributes, err := g.dynamicService.ListAttributes(ctx, modelUID)
	if err != nil {
		return nil, fmt.Errorf("获取字段定义失败: %w", err)
	}

	// 3. 创建 Excel 文件
	f := excelize.NewFile()

	// 4. 创建数据表（Sheet1）
	dataSheetName := "数据导入"
	f.SetSheetName("Sheet1", dataSheetName)

	if err := g.createDataSheet(f, dataSheetName, attributes); err != nil {
		return nil, fmt.Errorf("创建数据表失败: %w", err)
	}

	// 5. 创建说明表（Sheet2）
	instructionSheetName := "导入说明"
	f.NewSheet(instructionSheetName)
	if err := g.createInstructionSheet(f, instructionSheetName, model, attributes); err != nil {
		return nil, fmt.Errorf("创建说明表失败: %w", err)
	}

	// 6. 创建字段配置表（Sheet3，隐藏）
	configSheetName := "字段配置"
	f.NewSheet(configSheetName)
	if err := g.createConfigSheet(f, configSheetName, model, attributes); err != nil {
		return nil, fmt.Errorf("创建配置表失败: %w", err)
	}

	// 隐藏配置表
	f.SetSheetVisible(configSheetName, false)

	// 7. 设置活动表为数据导入
	sheetIndex, _ := f.GetSheetIndex(dataSheetName)
	f.SetActiveSheet(sheetIndex)

	return f, nil
}

// createDataSheet 创建数据导入表
func (g *TemplateGenerator) createDataSheet(f *excelize.File, sheetName string, attributes []types.DynamicAttribute) error {
	// 样式定义
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 12, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"4472C4"}, Pattern: 1},
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
		},
	})

	requiredStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 12, Color: "FFFFFF"},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"E74C3C"}, Pattern: 1}, // 红色背景
		Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		Border: []excelize.Border{
			{Type: "top", Color: "000000", Style: 1},
			{Type: "bottom", Color: "000000", Style: 1},
			{Type: "left", Color: "000000", Style: 1},
			{Type: "right", Color: "000000", Style: 1},
		},
	})

	exampleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Color: "7F7F7F", Italic: true},
		Alignment: &excelize.Alignment{Horizontal: "left"},
	})

	// 第1行：字段显示名称（表头）
	// 第2行：字段说明（类型、必填、枚举值等）
	// 第3行：示例数据
	col := 0
	for _, attr := range attributes {
		col++
		colName, _ := excelize.ColumnNumberToName(col)

		// 表头（字段名称）
		cellAddr := fmt.Sprintf("%s1", colName)
		f.SetCellValue(sheetName, cellAddr, attr.FieldName)

		// 根据是否必填设置不同样式
		if attr.IsRequired {
			f.SetCellStyle(sheetName, cellAddr, cellAddr, requiredStyle)
		} else {
			f.SetCellStyle(sheetName, cellAddr, cellAddr, headerStyle)
		}

		// 第2行：字段说明
		descAddr := fmt.Sprintf("%s2", colName)
		description := g.buildFieldDescription(attr)
		f.SetCellValue(sheetName, descAddr, description)

		// 第3行：示例数据
		exampleAddr := fmt.Sprintf("%s3", colName)
		example := g.buildFieldExample(attr)
		f.SetCellValue(sheetName, exampleAddr, example)
		f.SetCellStyle(sheetName, exampleAddr, exampleAddr, exampleStyle)

		// 设置列宽
		width := g.calculateColumnWidth(attr)
		f.SetColWidth(sheetName, colName, colName, width)

		// 为枚举类型添加数据验证（下拉列表）
		if attr.FieldType == "enum" {
			if err := g.addEnumValidation(f, sheetName, colName, attr); err != nil {
				return err
			}
		}
	}

	// 冻结前3行
	f.SetPanes(sheetName, &excelize.Panes{
		Freeze:      true,
		XSplit:      0,
		YSplit:      3,
		TopLeftCell: "A4",
		ActivePane:  "bottomLeft",
	})

	return nil
}

// createInstructionSheet 创建导入说明表
func (g *TemplateGenerator) createInstructionSheet(f *excelize.File, sheetName string, model *types.DynamicModel, attributes []types.DynamicAttribute) error {
	// 标题样式
	titleStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 16, Color: "2C3E50"},
	})

	headingStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 13, Color: "34495E"},
	})

	// 统计必填字段和可选字段
	requiredCount := 0
	optionalCount := 0
	for _, attr := range attributes {
		if attr.IsRequired {
			requiredCount++
		} else {
			optionalCount++
		}
	}

	row := 1

	// 标题
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("【%s】批量导入模板使用说明", model.Name))
	f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), titleStyle)
	row += 2

	// 基本信息
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), "📋 基本信息")
	f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), headingStyle)
	row++
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("模型名称: %s", model.Name))
	row++
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("模型标识: %s", model.UID))
	row++
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("字段总数: %d（必填: %d，可选: %d）", len(attributes), requiredCount, optionalCount))
	row++
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("生成时间: %s", time.Now().Format("2006-01-02 15:04:05")))
	row += 2

	// 使用步骤
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), "📝 使用步骤")
	f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), headingStyle)
	row++
	steps := []string{
		"1. 切换到【数据导入】工作表",
		"2. 从第4行开始填写数据（前3行为模板说明，请勿删除）",
		"3. 红色表头为必填字段，蓝色表头为可选字段",
		"4. 参考第2行的字段说明和第3行的示例数据填写",
		"5. 枚举类型字段请从下拉列表中选择",
		"6. 填写完成后，保存文件并通过API上传",
	}
	for _, step := range steps {
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), step)
		row++
	}
	row++

	// 必填字段列表
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), "⚠️  必填字段")
	f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), headingStyle)
	row++
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), "字段名称")
	f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), "类型")
	f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), "说明")
	row++
	for _, attr := range attributes {
		if attr.IsRequired {
			f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), attr.FieldName)
			f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), attr.FieldType)
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), g.buildFieldDescription(attr))
			row++
		}
	}
	row++

	// 注意事项
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), "⚠️  注意事项")
	f.SetCellStyle(sheetName, fmt.Sprintf("A%d", row), fmt.Sprintf("A%d", row), headingStyle)
	row++
	notes := []string{
		"• 请勿修改表头（第1行）的字段名称",
		"• 请勿删除或隐藏【字段配置】工作表（系统验证用）",
		"• IP地址格式：192.168.1.100",
		"• 数值类型：请填写纯数字，不要带单位",
		"• 布尔类型：填写 true 或 false",
		"• 枚举类型：必须从下拉列表中选择",
		"• 如遇到导入失败，请检查错误报告中的详细信息",
	}
	for _, note := range notes {
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), note)
		row++
	}

	// 设置列宽
	f.SetColWidth(sheetName, "A", "A", 60)
	f.SetColWidth(sheetName, "B", "B", 15)
	f.SetColWidth(sheetName, "C", "C", 50)

	return nil
}

// createConfigSheet 创建字段配置表（隐藏，用于导入时验证）
func (g *TemplateGenerator) createConfigSheet(f *excelize.File, sheetName string, model *types.DynamicModel, attributes []types.DynamicAttribute) error {
	// 元数据
	metadata := TemplateMetadata{
		ModelUID:       model.UID,
		ModelName:      model.Name,
		GeneratedAt:    time.Now(),
		Version:        "v1",
		FieldsHash:     g.calculateFieldsHash(attributes),
		TotalFields:    len(attributes),
		RequiredFields: g.countRequiredFields(attributes),
	}

	metadataJSON, _ := json.Marshal(metadata)
	f.SetCellValue(sheetName, "A1", "METADATA")
	f.SetCellValue(sheetName, "B1", string(metadataJSON))

	// 字段配置列表
	row := 3
	f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), "FieldUID")
	f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), "FieldName")
	f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), "FieldType")
	f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), "Category")
	f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), "IsRequired")
	f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), "Validators")
	row++

	for _, attr := range attributes {
		f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), attr.FieldUID)
		f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), attr.FieldName)
		f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), attr.FieldType)
		f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), attr.Category)
		f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), attr.IsRequired)
		f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), string(attr.Validators))
		row++
	}

	return nil
}

// 辅助方法

func (g *TemplateGenerator) buildFieldDescription(attr types.DynamicAttribute) string {
	desc := fmt.Sprintf("[%s]", attr.FieldType)

	if attr.IsRequired {
		desc += " 必填"
	}

	if attr.Unit != "" {
		desc += fmt.Sprintf(" 单位:%s", attr.Unit)
	}

	// 解析 validators
	if attr.Validators != nil {
		var validators types.FieldValidators
		json.Unmarshal(attr.Validators, &validators)

		if len(validators.EnumValues) > 0 {
			desc += fmt.Sprintf(" 可选值:%v", validators.EnumValues)
		}

		if validators.Min != nil && validators.Max != nil {
			desc += fmt.Sprintf(" 范围:%.0f-%.0f", *validators.Min, *validators.Max)
		}

		if validators.Pattern != nil {
			desc += fmt.Sprintf(" 格式:%s", *validators.Pattern)
		}
	}

	if attr.Placeholder != "" {
		desc += fmt.Sprintf(" 提示:%s", attr.Placeholder)
	}

	return desc
}

func (g *TemplateGenerator) buildFieldExample(attr types.DynamicAttribute) string {
	if attr.Placeholder != "" {
		return attr.Placeholder
	}

	if attr.DefaultValue != "" {
		return attr.DefaultValue
	}

	// 根据类型生成示例
	switch attr.FieldType {
	case "string":
		if attr.FieldUID == "host_name" {
			return "web-server-01"
		}
		if attr.FieldUID == "primary_ip" {
			return "192.168.1.100"
		}
		return "示例文本"
	case "int":
		if attr.FieldUID == "cpu" {
			return "16"
		}
		if attr.FieldUID == "memory" {
			return "32768"
		}
		return "100"
	case "float":
		return "99.5"
	case "bool":
		return "true"
	case "enum":
		// 解析枚举值
		if attr.Validators != nil {
			var validators types.FieldValidators
			json.Unmarshal(attr.Validators, &validators)
			if len(validators.EnumValues) > 0 {
				return validators.EnumValues[0]
			}
		}
		return "请选择"
	case "date":
		return "2026-02-07"
	default:
		return ""
	}
}

func (g *TemplateGenerator) calculateColumnWidth(attr types.DynamicAttribute) float64 {
	// 根据字段名称长度和类型计算列宽
	baseWidth := float64(len(attr.FieldName)) * 1.5

	if attr.FieldType == "string" {
		return max(baseWidth, 20)
	}
	if attr.FieldType == "int" || attr.FieldType == "float" {
		return max(baseWidth, 12)
	}
	if attr.FieldType == "bool" {
		return max(baseWidth, 10)
	}
	if attr.FieldType == "enum" {
		return max(baseWidth, 15)
	}

	return max(baseWidth, 15)
}

func (g *TemplateGenerator) addEnumValidation(f *excelize.File, sheetName, colName string, attr types.DynamicAttribute) error {
	if attr.Validators == nil {
		return nil
	}

	var validators types.FieldValidators
	if err := json.Unmarshal(attr.Validators, &validators); err != nil {
		return err
	}

	if len(validators.EnumValues) == 0 {
		return nil
	}

	// 创建数据验证（下拉列表）
	dvRange := excelize.NewDataValidation(true)
	dvRange.Sqref = fmt.Sprintf("%s4:%s1048576", colName, colName) // 从第4行到最后
	dvRange.SetDropList(validators.EnumValues)
	dvRange.SetError(excelize.DataValidationErrorStyleStop, "无效值", fmt.Sprintf("请从列表中选择: %v", validators.EnumValues))

	return f.AddDataValidation(sheetName, dvRange)
}

// CalculateFieldsHash 计算字段哈希（公开方法）
func (g *TemplateGenerator) CalculateFieldsHash(attributes []types.DynamicAttribute) string {
	return g.calculateFieldsHash(attributes)
}

func (g *TemplateGenerator) calculateFieldsHash(attributes []types.DynamicAttribute) string {
	// 简单的哈希：字段UID列表的拼接
	hash := ""
	for _, attr := range attributes {
		hash += attr.FieldUID + "|"
	}
	return fmt.Sprintf("%x", hash)
}

func (g *TemplateGenerator) countRequiredFields(attributes []types.DynamicAttribute) int {
	count := 0
	for _, attr := range attributes {
		if attr.IsRequired {
			count++
		}
	}
	return count
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}
