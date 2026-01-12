import React from 'react';
import { Form, DatePicker } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const TimeFilter: React.FC = () => {
    const { t } = useTranslation();
    // Default to today's date range
    const today = dayjs();
    const defaultValue: [any, any] = [today, today];

    return (
        <Form.Item
            name="timeRange"
            label={t('analysis.audit.filters.time')}
            initialValue={defaultValue}
        >
            <DatePicker.RangePicker
                style={{ width: '100%' }}
                placeholder={[t('analysis.audit.placeholders.selectStartDate'), t('analysis.audit.placeholders.selectEndDate')]}
            />
        </Form.Item>
    );
};

export default TimeFilter;