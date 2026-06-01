import { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, message, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusSquareOutlined } from '@ant-design/icons';
import { ChartContainer, PieChart, BarChart } from '../components/Charts';
import EditorModal, { SelectOption } from '../components/ChartEditorModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import {
  mockChartData,
  mockChartDetailData,
  mockStatisticsObjectData,
  instanceStatsDims,
} from '@/mock/Analysis';
import { getInstanceStatistics } from '@/api/services/resource';
import { ChartConfig, ChartItem, ChartSourceType } from '../../Types';
import { ModalMode, ChartType, ChartMoveDirection } from '@/pages/Analysis/Types';
import { X_AXIS_COUNT_MAX } from '../components/Charts/constants';
import './style.css';

// Built-in chart IDs for instance statistics
const BUILTIN_CHART_IDS = [7, 8];
const INSTANCE_CHART_NAME_KEYS: Record<number, string> = {
  7: 'analysis.statistics.chartNames.instance.instanceCount',
  8: 'analysis.statistics.chartNames.instance.instanceChange',
};
const INSTANCE_SAMPLE_CATEGORY_KEYS: Record<string, string> = {
  业务集: 'analysis.statistics.sampleData.instanceCategory.businessSet',
  交换机: 'analysis.statistics.sampleData.instanceCategory.switch',
  负载均衡: 'analysis.statistics.sampleData.instanceCategory.loadBalance',
  路由器: 'analysis.statistics.sampleData.instanceCategory.router',
  防火墙: 'analysis.statistics.sampleData.instanceCategory.firewall',
  项目: 'analysis.statistics.sampleData.instanceCategory.project',
};
const INSTANCE_SAMPLE_TYPE_KEYS: Record<string, string> = {
  新增: 'analysis.statistics.sampleData.changeType.create',
  更新: 'analysis.statistics.sampleData.changeType.update',
  删除: 'analysis.statistics.sampleData.changeType.delete',
};

const InstanceStatistics: React.FC = () => {
  const { t } = useTranslation();
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
    let cancelled = false;
    const loadChartData = async () => {
      // 内置"实例数量统计"(按模型类型, config 7)接真实聚合；变更趋势(8)暂用示例数据
      const next: Record<number, any[]> = { ...mockChartDetailData };
      try {
        const { data } = await getInstanceStatistics();
        if (data) {
          next[7] = (data.by_model || []).map((b) => ({ category: b.name, value: b.count }));
        }
      } catch (error) {
        console.error('Failed to load instance statistics:', error);
      }
      if (!cancelled) {
        setChartDatas(next);
      }
    };
    void loadChartData();
    return () => {
      cancelled = true;
    };
  }, [charts]);

  const getChartDisplayName = useCallback(
    (chart: Pick<ChartItem, 'configId' | 'name'>) => {
      const nameKey = INSTANCE_CHART_NAME_KEYS[chart.configId];
      return nameKey ? t(nameKey) : chart.name;
    },
    [t],
  );

  const translateChartData = useCallback(
    (data: any[] = []) =>
      data.map((item) => {
        const categoryKey = INSTANCE_SAMPLE_CATEGORY_KEYS[item.category];
        const typeKey = INSTANCE_SAMPLE_TYPE_KEYS[item.type];

        return {
          ...item,
          category: categoryKey ? t(categoryKey) : item.category,
          type: typeKey ? t(typeKey) : item.type,
        };
      }),
    [t],
  );

  // Instance statistics object options Built-in options
  const builtInOptions = useMemo(() => {
    return charts
      .filter((chart) => BUILTIN_CHART_IDS.includes(chart.configId))
      .map((chart) => ({
        value: chart.configId,
        label: getChartDisplayName(chart),
        // Check if already exists
        disabled: charts.some((c) => c.configId === chart.configId),
        chartData: chart,
      }));
  }, [charts, getChartDisplayName]);

  // Instance statistics object options
  const statObjOptions = useMemo((): SelectOption[] => {
    // TODO: api
    return mockStatisticsObjectData.map((obj) => ({
      value: obj.bk_obj_id,
      label: obj.bk_obj_name,
    }));
  }, []);

  // Instance statistics dimension options
  const statDimsOptions = useMemo((): SelectOption[] => {
    // TODO: api
    return instanceStatsDims.map((dim) => ({
      value: dim.bk_property_id,
      label: dim.bk_property_name,
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
    const chart = charts.find((c) => c.id === chartId);
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
      const newCharts = charts.filter((c) => c.id !== deletingChartId);
      // Re-order
      newCharts.forEach((chart, index) => {
        chart.order = index + 1;
      });
      setCharts(newCharts);
      message.success(t('analysis.statistics.messages.deleteSuccess'));
      setDeleteConfirmVisible(false);
      setDeletingChartId(undefined);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmVisible(false);
    setDeletingChartId(undefined);
  };

  const handleChartMove = (chartId: string, direction: ChartMoveDirection) => {
    const currentIndex = charts.findIndex((chart) => chart.id === chartId);
    if (currentIndex === -1) return;

    const newCharts = [...charts];
    const targetIndex = direction === ChartMoveDirection.Up ? currentIndex - 1 : currentIndex + 1;

    if (targetIndex >= 0 && targetIndex < charts.length) {
      // Swap positions
      [newCharts[currentIndex], newCharts[targetIndex]] = [
        newCharts[targetIndex],
        newCharts[currentIndex],
      ];

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
      message.success(t('analysis.statistics.messages.addSuccess'));
    } else {
      // Edit chart
      const newCharts = charts.map((chart) => {
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
      message.success(t('analysis.statistics.messages.editSuccess'));
    }
    setModalVisible(false);
    setEditingChart(undefined);
  };

  const renderChart = (chart: ChartItem) => {
    const data = translateChartData(chartDatas[chart.configId] || []);

    switch (chart.type) {
      case ChartType.Pie:
        return <PieChart data={data} />;
      case ChartType.Bar:
        return <BarChart data={data} stacked={chart.stacked} />;
      default:
        return <div>{t('analysis.statistics.chart.unknownType')}</div>;
    }
  };

  return (
    <div className="instance-statistics">
      <div className="section-header">
        <h3>{t('analysis.statistics.instance.title')}</h3>
        <Tooltip title={t('analysis.statistics.modal.addInstanceChart')}>
          <PlusSquareOutlined className="add-icon" onClick={handleAdd} />
        </Tooltip>
      </div>

      <div className="sample-data-notice">
        <span className="sample-data-badge">{t('analysis.statistics.sampleDataBadge')}</span>
        <span className="sample-data-tip">{t('analysis.statistics.sampleDataTipInstance')}</span>
      </div>

      <Row gutter={[24, 24]}>
        {charts.map((chart, index) => (
          <Col key={chart.id} xs={24} xl={chart.width === 50 ? 12 : 24}>
            <ChartContainer
              id={chart.id}
              title={getChartDisplayName(chart)}
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
        editData={
          editingChart
            ? {
                ...editingChart,
                name: getChartDisplayName(editingChart),
              }
            : undefined
        }
        builtInOptions={builtInOptions}
        statObjOptions={statObjOptions}
        statDimsOptions={statDimsOptions}
        maxXAxisCount={maxXAxisCount}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
      />

      <ConfirmModal
        visible={deleteConfirmVisible}
        title={t('analysis.statistics.confirm.deleteTitle')}
        description={t('analysis.statistics.confirm.deleteContent')}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        onOk={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
};

export default InstanceStatistics;
