import { AUDIT_TAB_KEYS } from './constants';

// Audit tab keys
export type AuditTabKey = (typeof AUDIT_TAB_KEYS)[keyof typeof AUDIT_TAB_KEYS];

// Operation detail structure
export interface OperationDetail {
  id: number;
  business: string;
  object: string;
  action: string;
  modelType: string;
  instance: string;
  description: string;
  time: string;
  account: string;
  details: {
    preData: Record<string, any> | null;
    curData: Record<string, any> | null;
    updateFields: string[] | null;
  };
}

// Statistics dialog modes
export enum ModalMode {
  Add = 'add',
  Edit = 'edit',
}

// Chart types
export enum ChartType {
  Pie = 'pie',
  Bar = 'bar',
  Line = 'line',
}

// Chart move direction
export enum ChartMoveDirection {
  Up = 'up',
  Down = 'down',
}

// Chart source enum
export enum ChartSourceType {
  Custom = 'custom',
  Builtin = 'builtin',
}

// Chart item type (stored in state.charts)
export interface ChartItem {
  id: string;
  configId: number;
  type: ChartType;
  name: string;
  source: ChartSourceType;
  order: number;
  width: number;
  xAxisCount: number;
  stacked?: boolean;
}

// Modal configuration type (for add/edit)
export interface ChartConfig {
  configId?: number;
  name: string;
  width: string;
  chartType: string;
  xAxisCount: number;
  source: ChartSourceType;
  statisticsObject?: string;
  statisticsDimension?: string;
}
