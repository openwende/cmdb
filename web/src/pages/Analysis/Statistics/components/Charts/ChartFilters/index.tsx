import React from 'react';
import { DatePicker, Select } from 'antd';
import type { ChartFiltersProps } from '../types';
import './style.css';

const { RangePicker } = DatePicker;

const ChartFilters: React.FC<ChartFiltersProps> = ({
  type,
  value,
  onChange,
  placeholder,
  options = [],
  dateFormat = 'YYYY-MM-DD',
  showTime = false,
  style,
}) => {
  // Render date range picker
  const renderDateRange = () => (
    <RangePicker
      value={value}
      onChange={onChange}
      format={dateFormat}
      showTime={showTime}
      placeholder={['开始日期', '结束日期']}
      style={{ width: 240, ...style }}
      className="chart-date-picker"
    />
  );

  // Render dropdown selector
  const renderSelect = () => (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: 180, ...style }}
      options={options}
      className="chart-select"
    />
  );

  // Render different filters based on type
  switch (type) {
    case 'dateRange':
      return renderDateRange();
    case 'select':
      return renderSelect();
    default:
      return null;
  }
};

export default ChartFilters;