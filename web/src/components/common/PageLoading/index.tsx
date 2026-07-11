import React from 'react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import './style.css';

interface PageLoadingProps {
  /** Fill the entire viewport (auth bootstrap, etc.) */
  fullScreen?: boolean;
  /** Optional custom tip text */
  tip?: string;
}

/**
 * Lightweight route/page loading placeholder.
 * Used as Suspense fallback and during auth initialization.
 */
const PageLoading: React.FC<PageLoadingProps> = ({ fullScreen = false, tip }) => {
  const { t } = useTranslation();
  const loadingTip = tip ?? t('common.loading');

  return (
    <div
      className={`page-loading${fullScreen ? ' page-loading--fullscreen' : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Spin size="large" />
      {loadingTip ? <div className="page-loading__tip">{loadingTip}</div> : null}
    </div>
  );
};

export default PageLoading;
