/**
 * Time - DateTime range picker component
 * Corresponds to bk-cmdb's time type (datetime range selection)
 */

import React from 'react';
import { DatePicker } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { FormComponentProps } from './index';
import './styles.css';

const FORMAT = 'YYYY-MM-DD HH:mm:ss';
const { RangePicker } = DatePicker;

const Time: React.FC<FormComponentProps> = ({ value, onChange, placeholder, disabled = false }) => {
  const handleChange = (_: any, dateStrings: [string, string]) => {
    if (dateStrings[0] && dateStrings[1]) {
      const startTime = dateStrings[0];
      const endTime = dayjs(dateStrings[1]).endOf('day').format(FORMAT);
      onChange([startTime, endTime]);
    } else {
      onChange(dateStrings);
    }
  };

  const getValue = (): [Dayjs | null, Dayjs | null] | null => {
    if (!value) return null;
    try {
      if (Array.isArray(value) && value.length === 2) {
        return [value[0] ? dayjs(value[0]) : null, value[1] ? dayjs(value[1]) : null];
      }
      return null;
    } catch (error) {
      console.warn(value);
      return null;
    }
  };

  return (
    <RangePicker
      value={getValue()}
      onChange={handleChange}
      placeholder={[placeholder, placeholder]}
      disabled={disabled}
      format={FORMAT}
      style={{ width: '100%' }}
      allowClear
    />
  );
};

export default Time;
