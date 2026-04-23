import React from 'react';
import { Form, DatePicker } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const TimeFilter: React.FC = () => {
  const { t } = useTranslation();
  // Default to last 30 days — more useful for audit queries
  const defaultValue: [any, any] = [dayjs().subtract(30, 'day'), dayjs()];

  return (
    <Form.Item
      name="timeRange"
      label={t('analysis.audit.filters.time')}
      initialValue={defaultValue}
      style={{ minWidth: 0 }}
    >
      <DatePicker.RangePicker
        style={{ width: '100%', minWidth: 240 }}
        format="YYYY-MM-DD"
        placeholder={[
          t('analysis.audit.placeholders.selectStartDate'),
          t('analysis.audit.placeholders.selectEndDate'),
        ]}
      />
    </Form.Item>
  );
};

export default TimeFilter;
