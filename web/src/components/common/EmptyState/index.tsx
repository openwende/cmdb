import React from 'react';
import { Button } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import './style.css';

interface EmptyStateProps {
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Primary action button text */
  actionText?: string;
  /** Primary action handler */
  onAction?: () => void;
  /** Compact size */
  compact?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
  compact = false,
}) => {
  return (
    <div className={`empty-state ${compact ? 'empty-state--compact' : ''}`}>
      <div className="empty-state__icon">{icon || <InboxOutlined />}</div>
      {title && <div className="empty-state__title">{title}</div>}
      {description && <div className="empty-state__description">{description}</div>}
      {actionText && onAction && (
        <Button type="primary" onClick={onAction} className="empty-state__action">
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
