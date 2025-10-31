import React, { useState, useEffect } from 'react';
import { Row, Col } from 'antd';
import {
    AppstoreOutlined,
    BlockOutlined,
    DatabaseOutlined,
    ClusterOutlined,
} from '@ant-design/icons';
import StatisticsCard from '../components/Card';
import { mockStatisticsData } from '@/mock/Analysis';
import './style.css';

// Define name mapping
const STATISTICS_NAME_MAP = {
    biz: '业务总数',
    host: '主机总数',
    model: '模型总数',
    inst: '实例总数',
};

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

// Define tooltip mapping
const STATISTICS_TOOLTIP_MAP = {
    inst: '不包含业务、主机模型及实例',
};

interface StatisticsData {
    name: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    tooltip?: string;
}

const Overview: React.FC = () => {
    const [statisticsData, setStatisticsData] = useState<StatisticsData[]>([]);

    useEffect(() => {
        // Format data on mount
        const formattedData = mockStatisticsData.map((item) => ({
            name: STATISTICS_NAME_MAP[item.id as keyof typeof STATISTICS_NAME_MAP],
            value: item.count,
            icon: STATISTICS_ICON_MAP[item.id as keyof typeof STATISTICS_ICON_MAP],
            color: STATISTICS_COLOR_MAP[item.id as keyof typeof STATISTICS_COLOR_MAP],
            tooltip: STATISTICS_TOOLTIP_MAP[item.id as keyof typeof STATISTICS_TOOLTIP_MAP],
        }));
        setStatisticsData(formattedData);
    }, []);

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
                        />
                    </Col>
                ))}
            </Row>
        </div>
    );
};

export default Overview;