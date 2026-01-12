import React, { useState, useEffect } from 'react';
import { Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    AppstoreOutlined,
    BlockOutlined,
    DatabaseOutlined,
    ClusterOutlined,
} from '@ant-design/icons';
import StatisticsCard from '../components/Card';
import { mockStatisticsData } from '@/mock/Analysis';
import './style.css';

// Define icon mapping
const STATISTICS_ICON_MAP = {
    biz: <AppstoreOutlined />,
    host: <DatabaseOutlined />,
    model: <BlockOutlined />,
    inst: <ClusterOutlined />,
};

// Define color mapping
const STATISTICS_COLOR_MAP = {
    biz: '#1677ff',
    host: '#13c2c2',
    model: '#52c41a',
    inst: '#fa8c16',
};

// Define route mapping
const STATISTICS_ROUTE_MAP = {
    biz: '/resource/business',
    host: '/resource/host',
};

interface StatisticsData {
    id: string;
    name: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    tooltip?: string;
}

const Overview: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [statisticsData, setStatisticsData] = useState<StatisticsData[]>([]);

    useEffect(() => {
        // Define name mapping with i18n
        const STATISTICS_NAME_MAP = {
            biz: t('analysis.statistics.overview.businessTotal'),
            host: t('analysis.statistics.overview.hostTotal'),
            model: t('analysis.statistics.overview.modelTotal'),
            inst: t('analysis.statistics.overview.instanceTotal'),
        };

        // Define tooltip mapping with i18n
        const STATISTICS_TOOLTIP_MAP = {
            inst: t('analysis.statistics.overview.instanceTooltip'),
        };

        // Format data on mount
        const formattedData = mockStatisticsData.map((item) => ({
            id: item.id,
            name: STATISTICS_NAME_MAP[item.id as keyof typeof STATISTICS_NAME_MAP],
            value: item.count,
            icon: STATISTICS_ICON_MAP[item.id as keyof typeof STATISTICS_ICON_MAP],
            color: STATISTICS_COLOR_MAP[item.id as keyof typeof STATISTICS_COLOR_MAP],
            tooltip: STATISTICS_TOOLTIP_MAP[item.id as keyof typeof STATISTICS_TOOLTIP_MAP],
        }));
        setStatisticsData(formattedData);
    }, [t]);

    const handleCardClick = (id: string) => {
        const route = STATISTICS_ROUTE_MAP[id as keyof typeof STATISTICS_ROUTE_MAP];
        if (route) {
            navigate(route);
        }
    };

    const getCardClickHandler = (id: string) => {
        return STATISTICS_ROUTE_MAP[id as keyof typeof STATISTICS_ROUTE_MAP]
            ? () => handleCardClick(id)
            : undefined;
    };

    return (
        <div className="statistics-overview">
            <Row gutter={[24, 24]}>
                {statisticsData.map((data, index) => (
                    <Col key={index} span={6}>
                        <StatisticsCard
                            name={data.name}
                            value={data.value}
                            icon={data.icon}
                            color={data.color}
                            tooltip={data.tooltip}
                            onClick={getCardClickHandler(data.id)}
                        />
                    </Col>
                ))}
            </Row>
        </div>
    );
};

export default Overview;