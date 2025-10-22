import React from 'react';
import { Select } from 'antd';
import { bizListMock } from '@/mock/resource';

const { Option } = Select;

export interface BusinessSelectorProps {
  value?: number | null;
  onChange?: (value: number) => void;
  allowClear?: boolean;
  showSearch?: boolean;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  className?: string;
}

const BusinessSelector: React.FC<BusinessSelectorProps> = ({
  value,
  onChange,
  allowClear = true,
  showSearch = true,
  disabled = false,
  size = 'middle',
  className,
}) => {
  const handleChange = (val: number) => {
    onChange?.(val);
  };

  const filterOption = (input: string, option: any) => {
    const children = option?.children as string;
    return children?.toLowerCase().includes(input.toLowerCase());
  };

  return (
    <Select
      value={value}
      onChange={handleChange}
      placeholder="请选择业务"
      style={{ width: "100%" }}
      allowClear={allowClear}
      showSearch={showSearch}
      disabled={disabled}
      size={size}
      className={className}
      filterOption={showSearch ? filterOption : false}
    >
      {bizListMock.map(biz => (
        <Option key={biz.bk_biz_id} value={biz.bk_biz_id}>
          {`[${biz.bk_biz_id}] ${biz.bk_biz_name}`}
        </Option>
      ))}
    </Select>
  );
};

export default BusinessSelector;