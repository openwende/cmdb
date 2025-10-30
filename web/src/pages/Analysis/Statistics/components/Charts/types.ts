import React from 'react';

// Base chart data type
export interface BaseChartData {
  [key: string]: any;
}

// Pie chart data type
export interface PieChartData {
  type: string;
  value: number;
}

// Bar chart data type
export interface BarChartData {
  category: string;
  value: number;
  type?: string; // For stacked charts
}

// Line chart data type
export interface LineChartData {
  date: string;
  value: number;
}

// Base chart component Props
export interface BaseChartProps {
  data: BaseChartData[];
  loading?: boolean;
  height?: number;
  config?: any;
}

// Pie chart component Props
export interface PieChartProps extends BaseChartProps {
  data: PieChartData[];
}

// Bar chart component Props
export interface BarChartProps extends BaseChartProps {
  data: BarChartData[];
  stacked?: boolean; // Whether it's a stacked chart
}

// Line chart component Props
export interface LineChartProps extends BaseChartProps {
  data: LineChartData[];
}

// Chart container component Props
export interface ChartContainerProps {
  id: string;
  title: string;
  children: React.ReactNode;
  
  // Filter related
  showFilters?: boolean;
  filters?: React.ReactNode;
  
  // Chart sorting related
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: (chartId: string) => void;
  onMoveDown?: (chartId: string) => void;
  onEdit?: (chartId: string) => void;
  onDelete?: (chartId: string) => void;
  
  loading?: boolean;
  className?: string;
}

// Chart filters component Props
export interface ChartFiltersProps {
  type: 'dateRange' | 'select' | 'custom';
  value?: any;
  onChange?: (value: any) => void;
  placeholder?: string;
  options?: Array<{label: string, value: any}>;
  dateFormat?: string;
  showTime?: boolean;
  style?: React.CSSProperties;
}

// Chart configuration type
export interface ChartConfigRaw {
  config_id: number;
  report_type: string;
  name: string;
  chart_type: string;
  width: string;
  field: string;
  x_axis_count: number;
}

// Chart type enum
export type ChartType = 'pie' | 'bar' | 'line';

// Chart item type (stored in state.charts)
export interface ChartItem {
  id: string;
  configId: number;
  type: ChartType;
  title: string;
  order: number;
  width: number;
  name: string;
  xAxisCount: number;
  stacked?: boolean;
}

// Chart source enum
export enum ChartSourceType {
  Custom = 'custom',
  Builtin = 'builtin'
}

// Chart source label mapping
export const ChartSourceLabels: Record<ChartSourceType, string> = {
  [ChartSourceType.Custom]: '自定义',
  [ChartSourceType.Builtin]: '内置'
};

// Dialog configuration type (for add/edit)
export interface ChartConfig {
  configId?: number;
  name: string;
  width: string;
  chartType: string;
  xAxisCount: number;
  source?: ChartSourceType;
  statisticsObject?: string;
  statisticsDimension?: string;
}

// Statistics dimension type
export interface StatisticsDimension {
  id: number | string;
  name: string;
  propertyId: string;
}

// Action type enum
export enum ChartActionType {
  MOVE_UP = 'move_up',
  MOVE_DOWN = 'move_down',
  EDIT = 'edit',
  DELETE = 'delete'
}