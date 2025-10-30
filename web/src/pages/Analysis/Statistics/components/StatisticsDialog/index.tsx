import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, Select, InputNumber } from 'antd';
import { mockChartData, mockStatisticsObjectData, instanceStatisticsDimensions } from '@/mock/Analysis';
import { dynamicGroupCondition } from '@/mock/business';
import type { ChartConfig, ChartItem, StatisticsDimension, ChartType } from '../Charts/types';
import { ChartSourceType, ChartSourceLabels } from '../Charts/types';
import './style.css';

interface StatisticsDialogProps {
  visible: boolean;
  mode: 'add' | 'edit';
  type: 'host' | 'instance';
  editData?: ChartItem;
  existingCharts: ChartItem[];
  onClose: () => void;
  onSubmit: (data: ChartConfig) => void;
}

const StatisticsDialog: React.FC<StatisticsDialogProps> = ({
  visible,
  mode,
  type,
  editData,
  existingCharts,
  onClose,
  onSubmit,
}) => {
  const [form] = Form.useForm();
  const [source, setSource] = useState<ChartSourceType>(ChartSourceType.Custom);
  const [chartType, setChartType] = useState<ChartType>('pie');
  
  // Get host statistics dimensions (filter enum type, exclude specific ids)
  const getHostStatisticsDimensions = (): StatisticsDimension[] => {
    return dynamicGroupCondition
      .filter(item => 
        item.bk_property_type === 'enum' && 
        ![13, 14, 23, 40].includes(item.id)
      )
      .map(item => ({
        id: item.id,
        name: item.bk_property_name,
        propertyId: item.bk_property_id
      }));
  };

  // Get built-in chart options
  const getBuiltInChartOptions = () => {
    const charts = type === 'host' ? mockChartData.host : mockChartData.inst;
    return charts.map(chart => ({
      value: chart.config_id,
      label: chart.name,
      // Check if already exists
      disabled: existingCharts.some(c => c.configId === chart.config_id),
      chartData: chart
    }));
  };

  // Initialize form data
  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && editData) {
        const currentChartType = editData.type === 'bar' ? 'bar' : 'pie';
        form.setFieldsValue({
          source: ChartSourceType.Builtin,
          name: editData.name,
          chartType: currentChartType,
          width: editData.width.toString(),
          xAxisCount: editData.xAxisCount || 10,
        });
        setSource(ChartSourceType.Builtin);
        setChartType(currentChartType);
      } else {
        // Default values for add mode
        form.setFieldsValue({
          source: ChartSourceType.Custom,
          chartType: 'pie',
          width: '50',
          xAxisCount: 10,
        });
        setSource(ChartSourceType.Custom);
        setChartType('pie');
      }
    }
  }, [visible, mode, editData, form]);

  // Handle source change
  const handleSourceChange = (e: any) => {
    const value = e.target.value;
    setSource(value);

    // Clear chart name when switching to built-in
    if (value === ChartSourceType.Builtin) {
      form.setFieldsValue({ name: undefined });
    }
  };

  // Handle chart type change
  const handleChartTypeChange = (e: any) => {
    const value = e.target.value;
    setChartType(value);
  };

  // Handle built-in chart selection
  const handleBuiltInChartSelect = (configId: number) => {
    const builtInOptions = getBuiltInChartOptions();
    const selected = builtInOptions.find(opt => opt.value === configId);
    
    if (selected && selected.chartData) {
      const chart = selected.chartData;
      form.setFieldsValue({
        chartType: chart.chart_type || 'pie',
        width: chart.width,
        xAxisCount: chart.x_axis_count || 10,
      });
    }
  };

  // Handle submit
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      const formData: ChartConfig = {
        ...values,
      };

      onSubmit(formData);
      form.resetFields();
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={mode === 'add' ? `新增${type === 'host' ? '主机' : '实例'}统计图表` : `编辑【${editData?.name}】`}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={600}
      okText="提交"
      cancelText="取消"
      className="statistics-dialog"
    >
      <Form
        form={form}
        layout="horizontal"
        labelCol={{ style: { width: 100 } }}
        wrapperCol={{ flex: 1 }}
        labelAlign="left"
        colon={false}
        initialValues={{
            source: ChartSourceType.Custom,
            chartType: 'pie',
            width: '50',
            xAxisCount: 10,
          }}
      >
          {/* Chart source (Custom/Built-in) - Always shown but disabled in edit mode */}
          <Form.Item 
            name="source" 
            label="图表来源"
          >
            <Radio.Group onChange={handleSourceChange} disabled={mode === 'edit'}>
              <Radio value={ChartSourceType.Custom}>{ChartSourceLabels[ChartSourceType.Custom]}</Radio>
              <Radio value={ChartSourceType.Builtin}>{ChartSourceLabels[ChartSourceType.Builtin]}</Radio>
            </Radio.Group>
          </Form.Item>

        {/* Built-in chart selection - Only shown when adding and built-in is selected */}
        {mode === 'add' && source === ChartSourceType.Builtin && (
          <Form.Item 
            name="builtInChart" 
            label="选择图表"
          >
            <Select
              placeholder="请选择"
              options={getBuiltInChartOptions()}
              onChange={handleBuiltInChartSelect}
            />
          </Form.Item>
        )}

        {/* Chart name - Input for custom, always disabled in edit mode */}
        {(mode === 'edit' || source === ChartSourceType.Custom) && (
          <Form.Item 
            name="name" 
            label="图表名称"
          >
            <Input 
              placeholder="请输入图表名称" 
              disabled={mode === 'edit'}
            />
          </Form.Item>
        )}

        {/* Statistics object - Only shown when adding instance statistics */}
        {type === 'instance' && mode === 'add' && (
          <Form.Item 
            name="statisticsObject" 
            label="统计对象"
          >
            <Select
              placeholder="请选择"
              options={mockStatisticsObjectData.map(obj => ({
                value: obj.bk_obj_id,
                label: obj.bk_obj_name
              }))}
            />
          </Form.Item>
        )}

        {/* Statistics dimension - Only shown when adding and custom is selected */}
        {mode === 'add' && source === ChartSourceType.Custom && (
          <Form.Item 
            name="statisticsDimension" 
            label="统计维度"
          >
            <Select
              placeholder="请选择"
              options={
                type === 'host'
                  ? getHostStatisticsDimensions().map(dim => ({
                      value: dim.propertyId,
                      label: dim.name
                    }))
                  : instanceStatisticsDimensions.map(dim => ({
                      value: dim.propertyId,
                      label: dim.name
                    }))
              }
            />
          </Form.Item>
        )}

        {/* Chart type (Pie/Bar) - Only shown when adding and custom is selected */}
        {mode === 'add' && source === ChartSourceType.Custom && (
          <Form.Item 
            name="chartType" 
            label="图表类型"
          >
            <Radio.Group 
              onChange={handleChartTypeChange}
            >
              <Radio value="pie">饼图</Radio>
              <Radio value="bar">柱状图</Radio>
            </Radio.Group>
          </Form.Item>
        )}

        {/* Chart width */}
        <Form.Item 
          name="width" 
          label="图表宽度"
        >
          <Radio.Group>
            <Radio value="50">50%</Radio>
            <Radio value="100">100%</Radio>
          </Radio.Group>
        </Form.Item>

        {/* X-axis count - Shown for bar charts (custom when adding, always when editing) */}
        {((mode === 'add' && source === ChartSourceType.Custom && chartType === 'bar') || 
          (mode === 'edit' && chartType === 'bar')) && (
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

export default StatisticsDialog;
