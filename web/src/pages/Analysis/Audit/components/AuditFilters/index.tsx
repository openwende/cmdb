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
    form.resetFields();
    handleSearch();
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

  const isMultipleOfThree = children.length % 3 === 0;

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
          {/* Form items */}
          {children.map((child, index) => {
            const isLastChild = index === children.length - 1;
            const shouldCombineWithButtons = isMultipleOfThree && isLastChild;

            return (
              <Col span={8} key={index}>
                {shouldCombineWithButtons ? (
                  <div className="filter-with-actions">
                    {child}
                    <div
                      style={{
                        position: 'absolute',
                        left: '100%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        marginLeft: '32px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {renderActionButtons()}
                    </div>
                  </div>
                ) : (
                  child
                )}
              </Col>
            );
          })}

          {/* Action buttons - only when not combined with last child */}
          {!isMultipleOfThree && (
            <Col span={8}>
              <div className="action-buttons">{renderActionButtons()}</div>
            </Col>
          )}
        </Row>
      </Form>
    </div>
  );
};

export default AuditFilters;
