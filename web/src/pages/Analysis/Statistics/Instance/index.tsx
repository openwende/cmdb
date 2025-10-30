import { useState, useEffect } from 'react';
import { Row, Col, message } from 'antd';
import { PlusSquareOutlined } from '@ant-design/icons';
import {
  ChartContainer,
  BarChart,
} from '../components/Charts';
import StatisticsDialog from '../components/StatisticsDialog';
import { mockChartData, mockChartDetailData } from '@/mock/Analysis';
import type { ChartItem, ChartConfig } from '../components/Charts';
import './style.css';

const InstanceStatistics: React.FC = () => {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [editingChart, setEditingChart] = useState<ChartItem | undefined>();

  useEffect(() => {
    // Initialize chart list based on mockChartData.inst
    const instCharts: ChartItem[] = mockChartData.inst.map((config, index) => ({
      id: `inst-chart-${config.config_id}`,
      configId: config.config_id,
      type: 'bar', // All instance statistics are bar charts
      title: config.name,
      name: config.name,
      xAxisCount: config.x_axis_count,
      order: index + 1,
      width: parseInt(config.width),
      stacked: config.config_id === 8, // Instance change statistics is stacked chart
    }));
    setCharts(instCharts);
  }, []);

  // Handle add chart
  const handleAdd = () => {
    setDialogMode('add');
    setEditingChart(undefined);
    setDialogVisible(true);
  };

  // Handle chart move
  const handleChartMove = (chartId: string, direction: 'up' | 'down') => {
    const currentIndex = charts.findIndex(chart => chart.id === chartId);
    if (currentIndex === -1) return;

    const newCharts = [...charts];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

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

  const handleChartEdit = (chartId: string) => {
    const chart = charts.find(c => c.id === chartId);
    if (chart) {
      setEditingChart(chart);
      setDialogMode('edit');
      setDialogVisible(true);
    }
  };

  const handleChartDelete = (chartId: string) => {
    const newCharts = charts.filter(c => c.id !== chartId);
    // Re-order
    newCharts.forEach((chart, index) => {
      chart.order = index + 1;
    });
    setCharts(newCharts);
    message.success('删除成功');
  };

  const handleDialogClose = () => {
    setDialogVisible(false);
    setEditingChart(undefined);
  };

  const handleDialogSubmit = (formData: ChartConfig) => {
    if (dialogMode === 'add') {
      // Add new chart
      const newChart: ChartItem = {
        id: `inst-chart-${Date.now()}`,
        configId: formData.configId || Date.now(),
        type: 'bar', // All instance statistics are bar charts
        title: formData.name,
        name: formData.name,
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
    setDialogVisible(false);
    setEditingChart(undefined);
  };

  // Get chart data by configId
  const getChartData = (configId: number) => {
    return mockChartDetailData[configId] || [];
  };

  return (
    <div className="instance-statistics">
      <div className="section-header">
        <h3>实例统计</h3>
        <PlusSquareOutlined className="add-icon" onClick={handleAdd} />
      </div>

      <Row gutter={[24, 24]}>
        {charts.map((chart, index) => (
          <Col 
            key={chart.id} 
            span={chart.width === 50 ? 12 : 24}
          >
            <ChartContainer
              id={chart.id}
              title={chart.title}
              canMoveUp={index > 0}
              canMoveDown={index < charts.length - 1}
              onMoveUp={() => handleChartMove(chart.id, 'up')}
              onMoveDown={() => handleChartMove(chart.id, 'down')}
              onEdit={() => handleChartEdit(chart.id)}
              onDelete={() => handleChartDelete(chart.id)}
            >
              <BarChart data={getChartData(chart.configId)} stacked={chart.stacked} />
            </ChartContainer>
          </Col>
        ))}
      </Row>

      <StatisticsDialog
        visible={dialogVisible}
        mode={dialogMode}
        type="instance"
        editData={editingChart}
        existingCharts={charts}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
};

export default InstanceStatistics;