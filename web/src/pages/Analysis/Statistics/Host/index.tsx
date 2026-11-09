import { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, message, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusSquareOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { ChartContainer, PieChart, BarChart, LineChart, ChartFilters } from '../components/Charts';
import EditorModal, { SelectOption } from '../components/ChartEditorModal';
import ConfirmModal from '@/components/common/ConfirmModal';
import { mockChartData, mockChartDetailData } from '@/mock/Analysis';
import { getHostStatistics } from '@/api/services/resource';
import { dynamicGroupCondition } from '@/mock/business';
import { ChartConfig, ChartItem, ChartSourceType } from '../../Types';
import { ModalMode, ChartType, ChartMoveDirection } from '@/pages/Analysis/Types';
import { PROPERTY_TYPES } from '@/pages/Business/constants';
import { X_AXIS_COUNT_MAX } from '../components/Charts/constants';
import './style.css';

// Built-in chart IDs for host statistics
const BUILTIN_CHART_IDS = [3, 4, 5, 6];
const HOST_CHART_NAME_KEYS: Record<number, string> = {
  3: 'analysis.statistics.chartNames.host.osType',
  4: 'analysis.statistics.chartNames.host.business',
  5: 'analysis.statistics.chartNames.host.cloudArea',
  6: 'analysis.statistics.chartNames.host.hostCountTrend',
};
const HOST_SAMPLE_CATEGORY_KEYS: Record<number, Record<string, string>> = {
  4: {
    蓝鲸: 'analysis.statistics.sampleData.hostBusiness.blueking',
    财务系统: 'analysis.statistics.sampleData.hostBusiness.financeSystem',
    官网业务: 'analysis.statistics.sampleData.hostBusiness.officialSiteBusiness',
    人力资源业务: 'analysis.statistics.sampleData.hostBusiness.hrBusiness',
    小程序业务: 'analysis.statistics.sampleData.hostBusiness.miniProgramBusiness',
    电商渠道系统: 'analysis.statistics.sampleData.hostBusiness.ecommerceChannelSystem',
    人力资源系统: 'analysis.statistics.sampleData.hostBusiness.hrSystem',
  },
  5: {
    未分配: 'analysis.statistics.sampleData.cloudArea.unassigned',
  },
};
// Excluded dimension IDs for host statistics
const EXCLUDED_DIMENSION_IDS = [13, 14, 23, 40];

const HostStatistics: React.FC = () => {
  const { t } = useTranslation();
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [chartDatas, setChartDatas] = useState<Record<number, any[]>>({});
  const [timeRange, setTimeRange] = useState(() => {
    const end = dayjs();
    const start = end.subtract(6, 'day');
    return [start, end];
  });
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(ModalMode.Add);
  const [editingChart, setEditingChart] = useState<ChartItem>();
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [deletingChartId, setDeletingChartId] = useState<string>();

  useEffect(() => {
    // TODO: api
    const hostCharts: ChartItem[] = mockChartData.host.map((config, index) => ({
      id: `host-chart-${config.config_id}`,
      configId: config.config_id,
      type: (config.chart_type || ChartType.Line) as ChartType,
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
    setCharts(hostCharts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadChartData = async () => {
      // 内置主机分布图(OS/业务/管控区域)接真实聚合统计；趋势(6)与自定义图暂用示例数据
      const next: Record<number, any[]> = { ...mockChartDetailData };
      try {
        const { data } = await getHostStatistics();
        if (data) {
          next[3] = (data.by_os_type || []).map((b) => ({ type: b.name, value: b.count }));
          next[4] = (data.by_business || []).map((b) => ({ category: b.name, value: b.count }));
          next[5] = (data.by_cloud_area || []).map((b) => ({ category: b.name, value: b.count }));
        }
      } catch (error) {
        console.error('Failed to load host statistics:', error);
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
      const nameKey = HOST_CHART_NAME_KEYS[chart.configId];
      return nameKey ? t(nameKey) : chart.name;
    },
    [t],
  );

  const translateChartData = useCallback(
    (configId: number, data: any[] = []) =>
      data.map((item) => {
        const categoryKey = HOST_SAMPLE_CATEGORY_KEYS[configId]?.[item.category];

        return {
          ...item,
          category: categoryKey ? t(categoryKey) : item.category,
        };
      }),
    [t],
  );

  // Host statistics object options Built-in options
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

  // Host statistics dimension options
  const statDimsOptions = useMemo((): SelectOption[] => {
    // TODO: api
    return dynamicGroupCondition
      .filter(
        (item) =>
          item.bk_property_type === PROPERTY_TYPES.ENUM &&
          !EXCLUDED_DIMENSION_IDS.includes(item.id),
      )
      .map((item) => ({
        value: item.bk_property_id,
        label: item.bk_property_name,
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

  const handleTimeRangeChange = (dates: any) => {
    // TODO: api
    setTimeRange(dates);
  };

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
        id: `host-chart-${Date.now()}`,
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
    const data = translateChartData(chart.configId, chartDatas[chart.configId] || []);

    switch (chart.type) {
      case ChartType.Pie:
        return <PieChart data={data} />;
      case ChartType.Bar:
        return <BarChart data={data} stacked={chart.stacked} />;
      case ChartType.Line:
        return <LineChart data={data} />;
      default:
        return <div>{t('analysis.statistics.chart.unknownType')}</div>;
    }
  };

  return (
    <div className="host-statistics">
      <div className="section-header">
        <h3>{t('analysis.statistics.host.title')}</h3>
        <Tooltip title={t('analysis.statistics.modal.addHostChart')}>
          <PlusSquareOutlined className="add-icon" onClick={handleAdd} />
        </Tooltip>
      </div>

      <div className="sample-data-notice">
        <span className="sample-data-badge">{t('analysis.statistics.sampleDataBadge')}</span>
        <span className="sample-data-tip">{t('analysis.statistics.sampleDataTipHost')}</span>
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
              showFilters={chart.type === ChartType.Line}
              filters={
                chart.type === ChartType.Line ? (
                  <ChartFilters
                    type="dateRange"
                    value={timeRange}
                    onChange={handleTimeRangeChange}
                  />
                ) : undefined
              }
            >
              {renderChart(chart)}
            </ChartContainer>
          </Col>
        ))}
      </Row>

      <EditorModal
        visible={modalVisible}
        mode={modalMode}
        type="host"
        editData={
          editingChart
            ? {
                ...editingChart,
                name: getChartDisplayName(editingChart),
              }
            : undefined
        }
        builtInOptions={builtInOptions}
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

export default HostStatistics;
