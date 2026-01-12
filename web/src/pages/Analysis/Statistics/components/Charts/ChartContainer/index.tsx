import React from 'react';
import { Card, Button, Tooltip, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { ArrowUpOutlined, ArrowDownOutlined, EditOutlined, CloseOutlined } from '@ant-design/icons';
import './style.css';

interface ChartContainerProps {
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
  const { t } = useTranslation();

  return (
    <Card className={`chart-container ${className || ''}`}>
      {/* Chart header: title + action buttons + filters */}
      <div className="chart-header">
        <div className="chart-title-section">
          <h4 className="chart-title">{title}</h4>
          <div className="chart-actions">
            <Tooltip title={!canMoveUp ? t('analysis.statistics.container.moveUpDisabled') : undefined}>
              <Button
                type="text"
                size="small"
                disabled={!canMoveUp}
                icon={<ArrowUpOutlined className={canMoveUp ? 'icon-active' : ''} />}
                onClick={() => onMoveUp?.(id)}
              />
            </Tooltip>
            <Tooltip title={!canMoveDown ? t('analysis.statistics.container.moveDownDisabled') : undefined}>
              <Button
                type="text"
                size="small"
                disabled={!canMoveDown}
                icon={<ArrowDownOutlined className={canMoveDown ? 'icon-active' : ''} />}
                onClick={() => onMoveDown?.(id)}
              />
            </Tooltip>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined className="icon-active" />}
              onClick={() => onEdit?.(id)}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined className="icon-active" />}
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