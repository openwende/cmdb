import React, { useEffect, useRef } from 'react';
import { Chart } from '@antv/g2';
import type { PieChartProps } from '../types';
import './style.css';

const PieChart: React.FC<PieChartProps> = ({
  data,
  height = 300,
  loading = false,
}) => {
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
      .legend('color', { position: 'right', layout: { justifyContent: 'center' } })
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
    return <div className="chart-loading">加载中...</div>;
  }

  if (!data.length) {
    return <div className="chart-empty">暂无数据</div>;
  }

  return <div ref={containerRef} className="pie-chart-container" />;
};

export default PieChart;