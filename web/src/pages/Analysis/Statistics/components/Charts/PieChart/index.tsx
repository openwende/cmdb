import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart } from '@antv/g2';
import { DEFAULT_CHART_HEIGHT } from '../constants';
import './style.css';

interface PieChartData {
  type: string;
  value: number;
}

interface PieChartProps {
  data: PieChartData[];
  loading?: boolean;
  height?: number;
}

const PieChart: React.FC<PieChartProps> = ({
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
      .interval()
      .transform({ type: 'stackY' })
      .coordinate({ type: 'theta', outerRadius: 0.8 })
      .encode('y', 'value')
      .encode('color', 'type')
      .legend('color', {
        position: 'right',
        layout: { justifyContent: 'center' },
      })
      .label({
        position: 'outside',
        text: (d: any) => `${d.type}: ${d.value}`,
      })
      .tooltip((d: any) => ({
        name: d.type,
        value: d.value,
      }));

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

  return <div ref={containerRef} className="pie-chart-container" />;
};

export default PieChart;
