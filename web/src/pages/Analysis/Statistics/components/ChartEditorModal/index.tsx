import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Select, InputNumber } from 'antd';
import { ChartConfig, ChartItem, ChartSourceType } from '../../../Types';
import { ModalMode, ChartType } from '@/pages/Analysis/Types';
import './style.css';

const DEFAULT_WIDTH = 50;
const DEFAULT_X_AXIS_COUNT = 10;
const ChartSourceLabels: Record<ChartSourceType, string> = {
    [ChartSourceType.Custom]: '自定义',
    [ChartSourceType.Builtin]: '内置'
};
const SOURCE_OPTIONS = [
    {
        value: ChartSourceType.Custom,
        label: ChartSourceLabels[ChartSourceType.Custom],
    },
    {
        value: ChartSourceType.Builtin,
        label: ChartSourceLabels[ChartSourceType.Builtin],
    },
];

interface BuiltInOption {
    value: number;
    label: string;
    disabled: boolean;
    chartData: any;
}
export interface SelectOption {
    value: string | number;
    label: string;
}
interface EditorModalProps {
    visible: boolean;
    mode: ModalMode;
    type: 'host' | 'instance';
    editData?: ChartItem;
    builtInOptions: BuiltInOption[];
    statObjOptions?: SelectOption[];
    statDimsOptions?: SelectOption[];
    onClose: () => void;
    onSubmit: (data: ChartConfig) => void;
}

const ChartEditorModal: React.FC<EditorModalProps> = ({
    visible,
    mode,
    type,
    editData,
    builtInOptions,
    statObjOptions = [],
    statDimsOptions = [],
    onClose,
    onSubmit,
}) => {
    const [form] = Form.useForm();
    const [source, setSource] = useState<ChartSourceType>(ChartSourceType.Custom);
    const [chartType, setChartType] = useState<ChartType>(ChartType.Pie);

    useEffect(() => {
        if (visible) {
            form.setFieldsValue({
                source: editData?.source || ChartSourceType.Custom,
                name: editData?.name,
                chartType: editData?.type || ChartType.Pie,
                width: editData?.width || DEFAULT_WIDTH,
                xAxisCount: editData?.xAxisCount || DEFAULT_X_AXIS_COUNT,
            });
            setSource(editData?.source || ChartSourceType.Custom);
            setChartType(editData?.type || ChartType.Pie);
        }
    }, [visible, mode, editData, form]);

    const handleSourceChange = (e: any) => {
        const value = e.target.value;
        setSource(value);

        // Clear chart name when switching to built-in
        if (value === ChartSourceType.Builtin) {
            form.setFieldsValue({ name: undefined });
        }
    };

    const handleChartTypeChange = (e: any) => {
        const value = e.target.value;
        setChartType(value);
    };

    const handleBuiltInChartSelect = (configId: number) => {
        const selected = builtInOptions.find(opt => opt.value === configId);

        if (selected && selected.chartData) {
            const chart = selected.chartData;
            form.setFieldsValue({
                chartType: chart.chart_type,
                width: chart.width,
                xAxisCount: chart.x_axis_count,
            });
        }
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            console.log('Form values:', values);

            const formData: ChartConfig = {
                ...values,
            };

            onSubmit(formData);
            form.resetFields();
        } catch (error) {
            console.error('Form validation failed:', error);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    const visibleFields = React.useMemo(() => {
        const isAdd = mode === ModalMode.Add;
        const isEdit = mode === ModalMode.Edit;
        const isCustom = source === ChartSourceType.Custom;
        const isBuiltin = source === ChartSourceType.Builtin;
        const isInstance = type === 'instance';
        const isBar = chartType === ChartType.Bar;

        return {
            isEdit,
            builtInChartSelect: isAdd && isBuiltin,
            nameInput: isEdit || isCustom,
            statObjectSelect: isInstance && isAdd,
            statDimensionSelect: isAdd && isCustom,
            chartTypeSelect: isAdd && isCustom,
            xAxisCountInput: isBar && ((isAdd && isCustom) || isEdit),
        };
    }, [mode, source, type, chartType]);

    const dialogTitle =
        mode === ModalMode.Add
            ? `新增${type === 'host' ? '主机' : '实例'}统计图表`
            : `编辑【${editData?.name}】`;

    return (
        <Modal
            title={dialogTitle}
            open={visible}
            onOk={handleSubmit}
            onCancel={handleCancel}
            width={600}
            okText="提交"
            cancelText="取消"
            className="statistics-dialog"
        >
            <Form
                form={form}
                layout="horizontal"
                labelCol={{ style: { width: 100, marginRight: 20 } }}
                wrapperCol={{ flex: 1 }}
                labelAlign="right"
                colon={false}
                initialValues={{
                    source: ChartSourceType.Custom,
                    chartType: ChartType.Pie,
                    width: DEFAULT_WIDTH,
                    xAxisCount: DEFAULT_X_AXIS_COUNT,
                }}
            >
                {/* Chart source (Custom / Built-in).
                   Always visible. Disabled in Edit mode. */}
                <Form.Item
                    name="source"
                    label="图表来源"
                >
                    <Radio.Group
                        disabled={visibleFields.isEdit}
                        options={SOURCE_OPTIONS}
                        onChange={handleSourceChange}
                    />
                </Form.Item>

                {/* Built-in chart selector.
                   Only visible when:
                   - mode = Add
                   - source = Built-in */}
                {visibleFields.builtInChartSelect && (
                    <Form.Item
                        name="builtInChart"
                        label="选择图表"
                        rules={[{ required: true, message: '该字段是必填项' }]}
                    >
                        <Select
                            placeholder="请选择"
                            options={builtInOptions}
                            onChange={handleBuiltInChartSelect}
                        />
                    </Form.Item>
                )}

                {/* Chart name.
                   Visible when:
                   - Edit mode (read-only)
                   - OR Custom source (editable)
                   Disabled when editing an existing chart. */}
                {visibleFields.nameInput && (
                    <Form.Item
                        name="name"
                        label="图表名称"
                        rules={[{ required: true, message: '该字段是必填项' }]}
                    >
                        <Input
                            placeholder="请输入图表名称"
                            disabled={visibleFields.isEdit}
                        />
                    </Form.Item>
                )}

                {/* Statistics object.
                   Only visible when:
                   - instance-level chart
                   - Add mode */}
                {visibleFields.statObjectSelect && (
                    <Form.Item
                        name="statisticsObject"
                        label="统计对象"
                        rules={[{ required: true, message: '该字段是必填项' }]}
                    >
                        <Select
                            placeholder="请选择"
                            options={statObjOptions}
                        />
                    </Form.Item>
                )}

                {/* Statistics dimension.
                   Only visible when:
                   - Add mode
                   - Custom source */}
                {visibleFields.statDimensionSelect && (
                    <Form.Item
                        name="statisticsDimension"
                        label="统计维度"
                        rules={[{ required: true, message: '该字段是必填项' }]}
                    >
                        <Select
                            placeholder="请选择"
                            options={statDimsOptions}
                        />
                    </Form.Item>
                )}

                {/* Chart type (Pie / Bar).
                   Only visible when:
                   - Add mode
                   - Custom source */}
                {visibleFields.chartTypeSelect && (
                    <Form.Item
                        name="chartType"
                        label="图表类型"
                    >
                        <Radio.Group onChange={handleChartTypeChange}>
                            <Radio value={ChartType.Pie}>饼图</Radio>
                            <Radio value={ChartType.Bar}>柱状图</Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                {/* Chart width.
                   Always visible. */}
                <Form.Item
                    name="width"
                    label="图表宽度"
                >
                    <Radio.Group>
                        <Radio value={50}>50%</Radio>
                        <Radio value={100}>100%</Radio>
                    </Radio.Group>
                </Form.Item>

                {/* X-axis count.
                   Visible only for Bar charts:
                   - Add+Custom+Bar
                   - OR Edit+Bar */}
                {visibleFields.xAxisCountInput && (
                    <Form.Item
                        name="xAxisCount"
                        label="横轴坐标数量"
                    >
                        <InputNumber
                            min={1}
                            max={100}
                            style={{ width: '100%' }}
                            placeholder="请输入"
                        />
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};

export default ChartEditorModal;
