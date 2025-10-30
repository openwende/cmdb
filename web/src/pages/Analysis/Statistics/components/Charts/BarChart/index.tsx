import React, { useEffect, useRef } from 'react';
import { Chart } from '@antv/g2';
import type { BarChartProps } from '../types';
import './style.css';

const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 300,
  loading = false,
  stacked = false,
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

    if (stacked) {
      // Stacked bar chart
      chart
        .interval()
        .transform({ type: 'stackY' })
        .encode('x', 'category')
        .encode('y', 'value')
        .encode('color', 'type')
        .axis('x', { 
          title: false,
          line: { stroke: '#d9d9d9', lineWidth: 1 },
          tick: { stroke: '#d9d9d9', lineWidth: 1 },
          label: { fill: '#666', fontSize: 12 }
        })
        .axis('y', { title: false })
        .legend('color', { position: 'bottom', layout: { justifyContent: 'center' } })
        .tooltip((d: any) => {
          // Calculate total value for this category
          const categoryData = data.filter((item: any) => item.category === d.category);
          const totalValue = categoryData.reduce((sum: any, item: any) => sum + item.value, 0);
          
          return {
            title: `${d.category} ${totalValue}`,
            name: d.type,
            value: d.value
          };
        });
    } else {
      // Normal bar chart
      chart
        .interval()
        .encode('x', 'category')
        .encode('y', 'value')
        .axis('x', { 
          title: false,
          line: { stroke: '#d9d9d9', lineWidth: 1 },
          tick: { stroke: '#d9d9d9', lineWidth: 1 },
          label: { fill: '#666', fontSize: 12 }
        })
        .axis('y', { title: false });
    }

    chart.render();
    chartRef.current = chart;

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, height, loading, stacked]);

  if (loading) {
    return <div className="chart-loading">加载中...</div>;
  }

  if (!data.length) {
    return <div className="chart-empty">暂无数据</div>;
  }

  return <div ref={containerRef} className="bar-chart-container" />;
};

export default BarChart;