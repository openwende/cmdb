import React, { useEffect } from 'react';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { useBusinessStore } from '@/store/BusinessStore';

const { Option } = Select;

export interface BusinessSelectorProps {
  value?: string | null;
  onChange?: (value: string) => void;
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
  const { t } = useTranslation();
  const { businessList, initialized, loading, loadBusinessData } = useBusinessStore();

  useEffect(() => {
    if (!initialized && !loading) {
      void loadBusinessData();
    }
  }, [initialized, loading, loadBusinessData]);

  const handleChange = (val: string) => {
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
      placeholder={t('common.components.businessSelector.selectBusiness')}
      style={{ width: '100%' }}
      allowClear={allowClear}
      showSearch={showSearch}
      disabled={disabled}
      size={size}
      className={className}
      filterOption={showSearch ? filterOption : false}
    >
      {businessList.map((biz) => (
        <Option key={biz.id} value={biz.id}>
          {`[${biz.displayId || biz.id}] ${biz.name}`}
        </Option>
      ))}
    </Select>
  );
};

export default BusinessSelector;
