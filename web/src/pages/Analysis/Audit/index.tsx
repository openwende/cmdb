import React, { useState } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import Business from './Business';
import Host from './Host';
import Resource from './Resource';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { AuditTabKey } from '@/pages/Analysis/Types';
import './style.css';

const Audit: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<AuditTabKey>(AUDIT_TAB_KEYS.HOST);

    const onTabChange = (key: string) => {
        setActiveTab(key as AuditTabKey);
    };

    const tabItems = [
        {
            key: AUDIT_TAB_KEYS.HOST,
            label: t('analysis.audit.tabs.host'),
            children: <Host />,
        },
        {
            key: AUDIT_TAB_KEYS.BUSINESS,
            label: t('analysis.audit.tabs.business'),
            children: <Business />,
        },
        {
            key: AUDIT_TAB_KEYS.RESOURCE,
            label: t('analysis.audit.tabs.resource'),
            children: <Resource />,
        },
    ];

    return (
        <div className="audit-page">
            <Tabs
                activeKey={activeTab}
                onChange={onTabChange}
                items={tabItems}
            />
        </div>
    );
};

export default Audit;