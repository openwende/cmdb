import React from 'react';
import { Form, Row, Col, Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import './style.css';

interface AuditFiltersProps {
  onSearch: (values: any) => void;
  loading: boolean;
  children: React.ReactNode[];
}

const AuditFilters: React.FC<AuditFiltersProps> = ({ onSearch, loading, children }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const handleSearch = () => {
    const values = form.getFieldsValue();
    // Format time range
    if (values.timeRange && values.timeRange.length === 2) {
      const [startTime, endTime] = values.timeRange;
      values.timeRange = [
        dayjs(startTime).format('YYYY-MM-DD'),
        dayjs(endTime).format('YYYY-MM-DD'),
      ];
    }
    onSearch(values);
  };

  const handleReset = () => {
    const fieldNames = Object.keys(form.getFieldsValue(true));
    const emptyValues = fieldNames.reduce<Record<string, undefined>>((acc, fieldName) => {
      acc[fieldName] = undefined;
      return acc;
    }, {});
    form.setFieldsValue(emptyValues);
    onSearch({});
  };

  const renderActionButtons = () => (
    <Form.Item style={{ marginBottom: 0 }}>
      <Space>
        <Button type="primary" onClick={handleSearch} loading={loading}>
          {t('analysis.audit.buttons.search')}
        </Button>
        <Button onClick={handleReset}>{t('analysis.audit.buttons.reset')}</Button>
      </Space>
    </Form.Item>
  );

  return (
    <div className="audit-filters">
      <Form
        form={form}
        layout="inline"
        labelCol={{ flex: '70px' }}
        labelAlign="right"
        colon={false}
      >
        <Row gutter={[16, 8]}>
          {children.map((child, index) => (
            <Col xs={24} md={12} xl={8} key={index}>
              {child}
            </Col>
          ))}
          <Col xs={24} md={12} xl={8}>
            <div className="action-buttons">{renderActionButtons()}</div>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default AuditFilters;
