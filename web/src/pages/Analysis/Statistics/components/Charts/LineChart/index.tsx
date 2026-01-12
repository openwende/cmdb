import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart } from '@antv/g2';
import {
  DEFAULT_CHART_HEIGHT,
  AXIS_LINE_STYLE,
  AXIS_TICK_STYLE,
  AXIS_LABEL_STYLE,
} from '../constants';
import './style.css';

interface LineChartData {
  date: string;
  value: number;
}

interface LineChartProps {
  data: LineChartData[];
  loading?: boolean;
  height?: number;
}

const LineChart: React.FC<LineChartProps> = ({
  data,
  height = DEFAULT_CHART_HEIGHT,
  loading = false,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!containerRef.current || loading || !data.length) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Create new chart
    const chart = new Chart({
      container: containerRef.current,
      autoFit: true,
      height,
    });

    chart.data(data);

    chart
      .line()
      .encode('x', 'date')
      .encode('y', 'value')
      .style('lineWidth', 2)
      .tooltip((d: any) => ({
        name: 'value',
        value: d.value,
      }));

    // Add points
    chart
      .point()
      .encode('x', 'date')
      .encode('y', 'value')
      .style('r', 3)
      .tooltip((d: any) => ({
        name: 'value',
        value: d.value,
      }));

    chart.axis('x', {
      title: false,
      line: AXIS_LINE_STYLE,
      tick: AXIS_TICK_STYLE,
      label: AXIS_LABEL_STYLE,
    });
    chart.axis('y', { title: false });

    chart.render();
    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, height, loading]);

  if (loading) {
    return <div className="chart-loading">{t('analysis.statistics.chart.loading')}</div>;
  }

  if (!data || !data.length) {
    return <div className="chart-empty">{t('analysis.statistics.chart.noData')}</div>;
  }

  return <div ref={containerRef} className="line-chart-container" />;
};

export default LineChart;
