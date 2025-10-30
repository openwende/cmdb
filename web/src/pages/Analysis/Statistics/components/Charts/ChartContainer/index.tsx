import React from 'react';
import { Card, Button, Tooltip, Spin } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  EditOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { ChartContainerProps } from '../types';
import './style.css';

const ChartContainer: React.FC<ChartContainerProps> = ({
  id,
  title,
  children,
  showFilters,
  filters,
  canMoveUp = true,
  canMoveDown = true,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  loading = false,
  className,
}) => {
  return (
    <Card className={`chart-container ${className || ''}`}>
      {/* Chart header: title + action buttons + filters */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h4 className="chart-title">{title}</h4>
          <div className="chart-actions">
            <Tooltip title={!canMoveUp ? "已置顶，无法上移" : undefined}>
              <Button
                type="text"
                size="small"
                disabled={!canMoveUp}
                icon={<ArrowUpOutlined style={{ color: canMoveUp ? '#1677ff' : undefined }} />}
                onClick={() => onMoveUp?.(id)}
              />
            </Tooltip>
            <Tooltip title={!canMoveDown ? "已置底，无法下移" : undefined}>
              <Button
                type="text"
                size="small"
                disabled={!canMoveDown}
                icon={<ArrowDownOutlined style={{ color: canMoveDown ? '#1677ff' : undefined }} />}
                onClick={() => onMoveDown?.(id)}
              />
            </Tooltip>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined style={{ color: '#1677ff' }} />}
              onClick={() => onEdit?.(id)}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined style={{ color: '#1677ff' }} />}
              onClick={() => onDelete?.(id)}
            />
          </div>
        </div>
        
        {/* Filters on the right */}
        {showFilters && filters && (
          <div className="chart-filters-right">
            {filters}
          </div>
        )}
      </div>

      {/* Chart content area */}
      <div className="chart-content">
        <Spin spinning={loading}>{children}</Spin>
      </div>
    </Card>
  );
};

export default ChartContainer;