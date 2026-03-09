import React from 'react';
import { Breadcrumb, Button, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import './style.css';

interface PageContainerProps {
  /** Page title */
  title?: React.ReactNode;
  /** Subtitle / description */
  subtitle?: React.ReactNode;
  /** Right-side actions (buttons, etc.) */
  extra?: React.ReactNode;
  /** Breadcrumb items */
  breadcrumb?: Array<{ title: string; path?: string }>;
  /** Show back button */
  onBack?: () => void;
  /** Tab bar content */
  tabBar?: React.ReactNode;
  /** Page body */
  children: React.ReactNode;
  /** Additional CSS class */
  className?: string;
  /** Compact mode (less padding) */
  compact?: boolean;
}

const PageContainer: React.FC<PageContainerProps> = ({
  title,
  subtitle,
  extra,
  breadcrumb,
  onBack,
  tabBar,
  children,
  className = '',
  compact = false,
}) => {
  const navigate = useNavigate();

  const hasTitleBar = title || subtitle || extra || onBack;

  return (
    <div className={`page-container ${compact ? 'page-container--compact' : ''} ${className}`}>
      {hasTitleBar && (
        <div className="page-container__header">
          {breadcrumb && breadcrumb.length > 0 && (
            <Breadcrumb
              className="page-container__breadcrumb"
              items={breadcrumb.map((item) => ({
                title: item.path ? (
                  <Button type="link" size="small" style={{ padding: 0 }} onClick={() => navigate(item.path!)}>
                    {item.title}
                  </Button>
                ) : (
                  item.title
                ),
              }))}
            />
          )}
          <div className="page-container__title-row">
            <div className="page-container__title-area">
              {onBack && (
                <ArrowLeftOutlined className="page-container__back" onClick={onBack} />
              )}
              {title && <h1 className="page-container__title">{title}</h1>}
            </div>
            {extra && <Space className="page-container__extra">{extra}</Space>}
          </div>
          {subtitle && <div className="page-container__subtitle">{subtitle}</div>}
          {tabBar && <div className="page-container__tabs">{tabBar}</div>}
        </div>
      )}
      <div className="page-container__body">{children}</div>
    </div>
  );
};

export default PageContainer;
