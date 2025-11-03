import { useState, useEffect, useMemo } from 'react';
import { Row, Col, message, Tooltip } from 'antd';
import { PlusSquareOutlined } from '@ant-design/icons';
import { ChartContainer, PieChart, BarChart } from '../components/Charts';
import EditorModal, { SelectOption } from '../components/ChartEditorModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { mockChartData, mockChartDetailData, mockStatisticsObjectData, instanceStatsDims } from '@/mock/Analysis';
import { ChartConfig, ChartItem, ChartSourceType } from '../../Types';
import { ModalMode, ChartType, ChartMoveDirection } from '@/pages/Analysis/Types';
import { X_AXIS_COUNT_MAX } from '../components/Charts/constants';
import './style.css';

// Built-in chart IDs for instance statistics
const BUILTIN_CHART_IDS = [7, 8];

const InstanceStatistics: React.FC = () => {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [chartDatas, setChartDatas] = useState<Record<number, any[]>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(ModalMode.Add);
  const [editingChart, setEditingChart] = useState<ChartItem | undefined>();
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingChartId, setDeletingChartId] = useState<string>();

  useEffect(() => {
    // TODO: api
    const instCharts: ChartItem[] = mockChartData.inst.map((config, index) => ({
      id: `inst-chart-${config.config_id}`,
      configId: config.config_id,
      type: config.chart_type as ChartType,
      name: config.name,
      source: BUILTIN_CHART_IDS.includes(config.config_id)
        ? ChartSourceType.Builtin
        : ChartSourceType.Custom,
      xAxisCount: config.x_axis_count,
      order: index + 1,
      width: parseInt(config.width),
      // Instance change statistics is stacked chart
      stacked: config.config_id === 8,
    }));
    setCharts(instCharts);
  }, []);

  useEffect(() => {
    // TODO: api
    setChartDatas(mockChartDetailData);
  }, [charts]);

  // Instance statistics object options Built-in options
  const builtInOptions = useMemo(() => {
    return charts
      .filter(chart => BUILTIN_CHART_IDS.includes(chart.configId))
      .map(chart => ({
        value: chart.configId,
        label: chart.name,
        // Check if already exists
        disabled: charts.some(c => c.configId === chart.configId),
        chartData: chart
      }));
  }, [charts]);

  // Instance statistics object options
  const statObjOptions = useMemo((): SelectOption[] => {
    // TODO: api
    return mockStatisticsObjectData.map(obj => ({
      value: obj.bk_obj_id,
      label: obj.bk_obj_name
    }));
  }, []);

  // Instance statistics dimension options
  const statDimsOptions = useMemo((): SelectOption[] => {
    // TODO: api
    return instanceStatsDims.map(dim => ({
      value: dim.bk_property_id,
      label: dim.bk_property_name
    }));
  }, []);

  // Calculate max x-axis count for editing
  const maxXAxisCount = useMemo(() => {
    if (modalMode === ModalMode.Edit && editingChart) {
      const actualDataLength = chartDatas[editingChart.configId]?.length || 0;
      return Math.min(actualDataLength, X_AXIS_COUNT_MAX);
    }
    return X_AXIS_COUNT_MAX;
  }, [modalMode, editingChart, chartDatas]);

  const handleAdd = () => {
    setModalMode(ModalMode.Add);
    setEditingChart(undefined);
    setModalVisible(true);
  };

  const handleChartEdit = (chartId: string) => {
    const chart = charts.find(c => c.id === chartId);
    if (chart) {
      setEditingChart(chart);
      setModalMode(ModalMode.Edit);
      setModalVisible(true);
    }
  };

  const handleChartDelete = (chartId: string) => {
    setDeletingChartId(chartId);
    setDeleteConfirmVisible(true);
  };

  const handleConfirmDelete = () => {
    if (deletingChartId) {
      const newCharts = charts.filter(c => c.id !== deletingChartId);
      // Re-order
      newCharts.forEach((chart, index) => {
        chart.order = index + 1;
      });
      setCharts(newCharts);
      message.success('删除成功');
      setDeleteConfirmVisible(false);
      setDeletingChartId(undefined);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setDeletingChartId(undefined);
  };

  const handleChartMove = (chartId: string, direction: ChartMoveDirection) => {
    const currentIndex = charts.findIndex(chart => chart.id === chartId);
    if (currentIndex === -1) return;

    const newCharts = [...charts];
    const targetIndex = direction === ChartMoveDirection.Up ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex >= 0 && targetIndex < charts.length) {
      // Swap positions
      [newCharts[currentIndex], newCharts[targetIndex]] =
        [newCharts[targetIndex], newCharts[currentIndex]];

      // Update order
      newCharts.forEach((chart, index) => {
        chart.order = index + 1;
      });

      setCharts(newCharts);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setEditingChart(undefined);
  };

  const handleModalSubmit = (formData: ChartConfig) => {
    // TODO: api
    if (modalMode === ModalMode.Add) {
      // Add new chart
      const newChart: ChartItem = {
        id: `inst-chart-${Date.now()}`,
        configId: formData.configId || Date.now(),
        type: formData.chartType as ChartType,
        name: formData.name,
        source: formData.source,
        xAxisCount: formData.xAxisCount,
        order: charts.length + 1,
        width: parseInt(formData.width),
        stacked: false,
      };
      setCharts([...charts, newChart]);
      message.success('添加成功');
    } else {
      // Edit chart
      const newCharts = charts.map(chart => {
        if (chart.id === editingChart?.id) {
          return {
            ...chart,
            width: parseInt(formData.width),
            xAxisCount: formData.xAxisCount,
          };
        }
        return chart;
      });
      setCharts(newCharts);
      message.success('编辑成功');
    }
    setModalVisible(false);
    setEditingChart(undefined);
  };

  const renderChart = (chart: ChartItem) => {
    const data = chartDatas[chart.configId];

    switch (chart.type) {
      case ChartType.Pie:
        return <PieChart data={data} />;
      case ChartType.Bar:
        return <BarChart data={data} stacked={chart.stacked} />;
      default:
        return <div>Unknown chart type</div>;
    }
  };

  const deletingChartName = charts.find(c => c.id === deletingChartId)?.name;

  return (
    <div className="instance-statistics">
      <div className="section-header">
        <h3>实例统计</h3>
        <Tooltip title="添加实例图表">
          <PlusSquareOutlined className="add-icon" onClick={handleAdd} />
        </Tooltip>
      </div>

      <Row gutter={[24, 24]}>
        {charts.map((chart, index) => (
          <Col
            key={chart.id}
            span={chart.width === 50 ? 12 : 24}
          >
            <ChartContainer
              id={chart.id}
              title={chart.name}
              canMoveUp={index > 0}
              canMoveDown={index < charts.length - 1}
              onMoveUp={() => handleChartMove(chart.id, ChartMoveDirection.Up)}
              onMoveDown={() => handleChartMove(chart.id, ChartMoveDirection.Down)}
              onEdit={() => handleChartEdit(chart.id)}
              onDelete={() => handleChartDelete(chart.id)}
            >
              {renderChart(chart)}
            </ChartContainer>
          </Col>
        ))}
      </Row>

      <EditorModal
        visible={modalVisible}
        mode={modalMode}
        type="instance"
        editData={editingChart}
        builtInOptions={builtInOptions}
        statObjOptions={statObjOptions}
        statDimsOptions={statDimsOptions}
        maxXAxisCount={maxXAxisCount}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
      />

      <ConfirmModal
        visible={deleteConfirmVisible}
        title="是否确认删除?"
        description={`确定要删除【${deletingChartName}】`}
        okText="确定"
        cancelText="取消"
        onOk={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default InstanceStatistics;
