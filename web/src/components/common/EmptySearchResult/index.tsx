import React from 'react';
import { Button } from 'antd';
import './style.css';

interface Props {
    onClearFilter: () => void;
}

const EmptySearchResult: React.FC<Props> = ({ onClearFilter }) => {
    return (
        <div className="empty-search-result">
            <div className="empty-icon">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                    <rect x="8" y="8" width="48" height="48" rx="4" stroke="#D1D5DB" strokeWidth="2" fill="#F9FAFB"/>
                    <circle cx="32" cy="32" r="12" stroke="#D1D5DB" strokeWidth="2" fill="none"/>
                    <path d="M40 40l8 8" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
                </svg>
            </div>
            <div className="empty-title">搜索结果为空</div>
            <div className="empty-description">
                可以尝试 调整关键词 或 <Button type="link" onClick={onClearFilter} className="clear-filter-btn">清空筛选条件</Button>
            </div>
        </div>
    );
};

export default EmptySearchResult; 