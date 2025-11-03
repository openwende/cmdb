import React from 'react';
import { Card as AntdCard, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import './style.css';

export interface StatisticsCardProps {
    name: string;
    value: number;
    icon: React.ReactNode;
    color: string;
    tooltip?: string;
    onClick?: () => void;
}

const StatisticsCard: React.FC<StatisticsCardProps> = ({
    name,
    value,
    icon,
    color,
    tooltip,
    onClick,
}) => {
    const nameElement = (
        <div className="card-name">
            <span>{name}</span>
            {tooltip && (
                <Tooltip title={tooltip}>
                    <InfoCircleOutlined className="tooltip-icon" />
                </Tooltip>
            )}
        </div>
    );

    return (
        <AntdCard
            className="statistics-card"
            onClick={onClick}
            styles={{
                body: {
                    padding: 20,
                    background: `linear-gradient(135deg, ${color}22 0%, #ffffff 55%, #ffffff 100%)`
                }
            }}
        >
            <div className="card-content">
                <div className="card-info">
                    {nameElement}
                    <div
                        className="card-value"
                        style={{ color }}
                    >
                        {value}
                    </div>
                </div>
                <div className="card-icon" style={{ color }}>
                    {icon}
                </div>
            </div>
        </AntdCard>
    );
};

export default StatisticsCard;