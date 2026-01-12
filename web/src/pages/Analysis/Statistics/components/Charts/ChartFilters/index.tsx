import React from 'react';
import { DatePicker, Select } from 'antd';
import { useTranslation } from 'react-i18next';

interface ChartFiltersProps {
  type: 'dateRange' | 'select' | 'custom';
  value?: any;
  placeholder?: string;
  options?: Array<{ label: string, value: any }>;
  dateFormat?: string;
  showTime?: boolean;
  style?: React.CSSProperties;
  onChange?: (value: any) => void;
}

const { RangePicker } = DatePicker;
const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';
const DATE_RANGE_WIDTH = 240;
const SELECT_WIDTH = 180;

const ChartFilters: React.FC<ChartFiltersProps> = ({
  type,
  value,
  onChange,
  placeholder,
  options = [],
  dateFormat = DEFAULT_DATE_FORMAT,
  showTime = false,
  style,
}) => {
  const { t } = useTranslation();
  // Render date range picker
  const renderDateRange = () => (
    <RangePicker
      value={value}
      onChange={onChange}
      format={dateFormat}
      showTime={showTime}
      placeholder={[t('analysis.statistics.chart.startDate'), t('analysis.statistics.chart.endDate')]}
      style={{ width: DATE_RANGE_WIDTH, ...style }}
    />
  );

  // Render dropdown selector
  const renderSelect = () => (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ width: SELECT_WIDTH, ...style }}
      options={options}
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