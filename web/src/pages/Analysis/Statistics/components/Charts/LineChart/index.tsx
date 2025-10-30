import React, { useEffect, useRef } from 'react';
import { Chart } from '@antv/g2';
import type { LineChartProps } from '../types';
import './style.css';

const LineChart: React.FC<LineChartProps> = ({
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
      line: { stroke: '#d9d9d9', lineWidth: 1 },
      tick: { stroke: '#d9d9d9', lineWidth: 1 },
      label: { fill: '#666', fontSize: 12 }
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
    return <div className="chart-loading">加载中...</div>;
  }

  if (!data.length) {
    return <div className="chart-empty">暂无数据</div>;
  }

  return <div ref={containerRef} className="line-chart-container" />;
};

export default LineChart;