import React from 'react';
import { Form, Row, Col, Button, Space } from 'antd';
import dayjs from 'dayjs';
import './style.css';

interface AuditFiltersProps {
    onSearch: (values: any) => void;
    onReset: (values: any) => void;
    loading: boolean;
    children: React.ReactNode[];
}

const AuditFilters: React.FC<AuditFiltersProps> = ({ onSearch, onReset, loading, children }) => {
    const [form] = Form.useForm();

    const handleSearch = () => {
        const values = form.getFieldsValue();
        // Format time range
        if (values.timeRange && values.timeRange.length === 2) {
            const [startTime, endTime] = values.timeRange;
            values.timeRange = [
                dayjs(startTime).format('YYYY-MM-DD'),
                dayjs(endTime).format('YYYY-MM-DD')
            ];
        }
        onSearch(values);
    };

    const handleReset = () => {
        form.resetFields();
        const values = form.getFieldsValue();
        onReset(values);
    };

    return (
        <div className="audit-filters">
            <Form 
                form={form} 
                layout="inline"
                labelCol={{ flex: '70px' }}
                labelAlign="right"
                colon={false}
            >
                <Row gutter={280}>
                    {/* Wrappered child components */}
                    {children.map((child, index) => (
                        <Col span={8} key={index}>
                            {child}
                        </Col>
                    ))}


                    {/* Action bottons */}
                    <Col span={8}>
                        <Form.Item>
                            <Space>
                                <Button type="primary" onClick={handleSearch} loading={loading}>
                                    查询
                                </Button>
                                <Button onClick={handleReset}>
                                    清空
                                </Button>
                            </Space>
                        </Form.Item>
                    </Col>
                </Row>
            </Form>
        </div>
    );
};

export default AuditFilters;