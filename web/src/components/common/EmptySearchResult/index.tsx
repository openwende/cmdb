import React from 'react';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import './style.css';

interface Props {
    onClearFilter: () => void;
}

const EmptySearchResult: React.FC<Props> = ({ onClearFilter }) => {
    const { t } = useTranslation();

    return (
        <div className="empty-search-result">
            <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="8" y="8" width="48" height="48" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB" />
                    <circle cx="32" cy="32" r="12" stroke="#D1D5DB" strokeWidth="2" fill="none" />
                    <path d="M40 40l8 8" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                </svg>
            </div>
            <div className="empty-title">
                {t('common.components.emptySearchResult.title')}
            </div>
            <div className="empty-description">
                {t('common.components.emptySearchResult.description')}
                &nbsp;
                <Button type="link" onClick={onClearFilter} className="clear-filter-btn">
                    {t('common.components.emptySearchResult.clearFilter')}
                </Button>
            </div>
        </div>
    );
};

export default EmptySearchResult; 