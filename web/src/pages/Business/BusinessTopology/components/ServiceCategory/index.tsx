import React, { useState, useEffect } from 'react';
import { Cascader } from 'antd';
import { serviceCategoryMock } from '@/mock/business';
import { useTranslation } from 'react-i18next';

interface ServiceCategoryProps {
  value?: number[];
  onChange?: (value: number[], selectedOptions?: any[]) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

interface CascaderOption {
  value: number;
  label: string;
  children?: CascaderOption[];
}

const ServiceCategory: React.FC<ServiceCategoryProps> = ({
  value,
  onChange,
  placeholder,
  style,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [cascaderOptions, setCascaderOptions] = useState<CascaderOption[]>([]);

  useEffect(() => {
    const buildCascaderOptions = () => {
      return serviceCategoryMock
        .filter((item) => item.category.bk_parent_id === 0)
        .map((parent) => ({
          value: parent.category.id,
          label: parent.category.name,
          children: serviceCategoryMock
            .filter((child) => child.category.bk_parent_id === parent.category.id)
            .map((child) => ({
              value: child.category.id,
              label: child.category.name,
            })),
        }));
    };

    setCascaderOptions(buildCascaderOptions());
  }, []);

  const handleChange = (selectedValue: (string | number)[], selectedOptions?: any[]) => {
    const numericValue = selectedValue.map((v) => Number(v));
    onChange?.(numericValue, selectedOptions);
  };

  return (
    <Cascader
      value={value}
      options={cascaderOptions}
      onChange={handleChange}
      style={style}
      disabled={disabled}
      showSearch
      changeOnSelect={false}
      placeholder={placeholder || t('business.topology.tree.create.form.placeholder5')}
    />
  );
};

export default ServiceCategory;
