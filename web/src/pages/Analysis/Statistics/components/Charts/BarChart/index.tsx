import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Chart } from '@antv/g2';
import { DEFAULT_CHART_HEIGHT, AXIS_LINE_STYLE, AXIS_TICK_STYLE, AXIS_LABEL_STYLE } from '../constants';
import './style.css';

const BAR_MAX_WIDTH = 60;

interface BarChartData {
  category: string;
  value: number;
  type?: string;
}

interface BarChartProps {
  data: BarChartData[];
  loading?: boolean;
  height?: number;
  stacked?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  height = DEFAULT_CHART_HEIGHT,
  loading = false,
  stacked = false,
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

    if (stacked) {
      // Stacked bar chart
      chart
        .interval()
        .transform({ type: 'stackY' })
        .encode('x', 'category')
        .encode('y', 'value')
        .encode('color', 'type')
        .style('maxWidth', BAR_MAX_WIDTH)
        // .style('inset', BAR_INSET)
        .axis('x', {
          title: false,
          line: AXIS_LINE_STYLE,
          tick: AXIS_TICK_STYLE,
          label: AXIS_LABEL_STYLE
        })
        .axis('y', { title: false })
        .legend('color', {
          position: 'bottom',
          layout: { justifyContent: 'center' }
        })
        .tooltip((d: any) => {
          return {
            title: d.category,
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
        .style('maxWidth', BAR_MAX_WIDTH)
        .axis('x', {
          title: false,
          line: AXIS_LINE_STYLE,
          tick: AXIS_TICK_STYLE,
          label: AXIS_LABEL_STYLE
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
    return <div className="chart-loading">{t('analysis.statistics.chart.loading')}</div>;
  }

  if (!data || !data.length) {
    return <div className="chart-empty">{t('analysis.statistics.chart.noData')}</div>;
  }

  return <div ref={containerRef} className="bar-chart-container" />;
};

export default BarChart;