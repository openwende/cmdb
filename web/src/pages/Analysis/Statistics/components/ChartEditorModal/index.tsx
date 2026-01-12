import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Select, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { ChartConfig, ChartItem, ChartSourceType } from '../../../Types';
import { ModalMode, ChartType } from '@/pages/Analysis/Types';
import { X_AXIS_COUNT_MIN, X_AXIS_COUNT_MAX, X_AXIS_COUNT_DEFAULT } from '../Charts/constants';
import './style.css';

const DEFAULT_WIDTH = 50;

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
    maxXAxisCount: number;
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
    maxXAxisCount,
    onClose,
    onSubmit,
}) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [source, setSource] = useState<ChartSourceType>(ChartSourceType.Custom);
    const [chartType, setChartType] = useState<ChartType>(ChartType.Pie);

    const SOURCE_OPTIONS = [
        {
            value: ChartSourceType.Custom,
            label: t('analysis.statistics.chart.source.custom'),
        },
        {
            value: ChartSourceType.Builtin,
            label: t('analysis.statistics.chart.source.builtin'),
        },
    ];

    useEffect(() => {
        if (visible) {
            // Calculate the valid xAxisCount value
            const currentXAxisCount = editData?.xAxisCount || X_AXIS_COUNT_DEFAULT;
            const validXAxisCount = Math.min(currentXAxisCount, maxXAxisCount);

            form.setFieldsValue({
                source: editData?.source || ChartSourceType.Custom,
                name: editData?.name,
                chartType: editData?.type || ChartType.Pie,
                width: editData?.width || DEFAULT_WIDTH,
                xAxisCount: validXAxisCount,
            });
            setSource(editData?.source || ChartSourceType.Custom);
            setChartType(editData?.type || ChartType.Pie);
        }
    }, [visible, mode, editData, form, maxXAxisCount]);

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
            ? type === 'host' 
                ? t('analysis.statistics.modal.addHostChart')
                : t('analysis.statistics.modal.addInstanceChart')
            : t('analysis.statistics.modal.editChart', { name: editData?.name });

    return (
        <Modal
            title={dialogTitle}
            open={visible}
            onOk={handleSubmit}
            onCancel={handleCancel}
            width={600}
            okText={t('analysis.statistics.modal.submit')}
            cancelText={t('analysis.statistics.modal.cancel')}
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
                    xAxisCount: X_AXIS_COUNT_DEFAULT,
                }}
            >
                {/* Chart source (Custom / Built-in).
                   Always visible. Disabled in Edit mode. */}
                <Form.Item
                    name="source"
                    label={t('analysis.statistics.form.chartSource')}
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
                        label={t('analysis.statistics.form.selectChart')}
                        rules={[{ required: true, message: t('analysis.statistics.form.required') }]}
                    >
                        <Select
                            placeholder={t('analysis.statistics.form.pleaseSelect')}
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
                        label={t('analysis.statistics.form.chartName')}
                        rules={[{ required: true, message: t('analysis.statistics.form.required') }]}
                    >
                        <Input
                            placeholder={t('analysis.statistics.form.enterChartName')}
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
                        label={t('analysis.statistics.form.statisticsObject')}
                        rules={[{ required: true, message: t('analysis.statistics.form.required') }]}
                    >
                        <Select
                            placeholder={t('analysis.statistics.form.pleaseSelect')}
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
                        label={t('analysis.statistics.form.statisticsDimension')}
                        rules={[{ required: true, message: t('analysis.statistics.form.required') }]}
                    >
                        <Select
                            placeholder={t('analysis.statistics.form.pleaseSelect')}
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
                        label={t('analysis.statistics.form.chartType')}
                    >
                        <Radio.Group onChange={handleChartTypeChange}>
                            <Radio value={ChartType.Pie}>{t('analysis.statistics.chart.type.pie')}</Radio>
                            <Radio value={ChartType.Bar}>{t('analysis.statistics.chart.type.bar')}</Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                {/* Chart width.
                   Always visible. */}
                <Form.Item
                    name="width"
                    label={t('analysis.statistics.form.chartWidth')}
                >
                    <Radio.Group>
                        <Radio value={50}>{t('analysis.statistics.chart.width.half')}</Radio>
                        <Radio value={100}>{t('analysis.statistics.chart.width.full')}</Radio>
                    </Radio.Group>
                </Form.Item>

                {/* X-axis count.
                   Visible only for Bar charts:
                   - Add+Custom+Bar
                   - OR Edit+Bar */}
                {visibleFields.xAxisCountInput && (
                    <Form.Item
                        name="xAxisCount"
                        label={t('analysis.statistics.form.xAxisCount')}
                    >
                        <InputNumber
                            min={X_AXIS_COUNT_MIN}
                            max={maxXAxisCount || X_AXIS_COUNT_MAX}
                            style={{ width: '100%' }}
                            placeholder={t('analysis.statistics.form.pleaseEnter')}
                        />
                    </Form.Item>
                )}
            </Form>
        </Modal>
    );
};

export default ChartEditorModal;
