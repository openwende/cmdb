import React from 'react';
import { Form, DatePicker } from 'antd';
import dayjs from 'dayjs';

const TimeFilter: React.FC = () => {
    // Default to today's date range
    const today = dayjs();
    const defaultValue: [any, any] = [today, today];

    return (
        <Form.Item
            name="timeRange"
            label="时间"
            initialValue={defaultValue}
        >
            <DatePicker.RangePicker
                style={{ width: '100%' }}
                placeholder={['请选择开始日期', '请选择结束日期']}
            />
        </Form.Item>
    );
};

export default TimeFilter;