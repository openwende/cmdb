import React, { useState, useEffect } from 'react';
import { Cascader } from 'antd';
import { useTranslation } from 'react-i18next';
import { getBusinessIdFromUrl } from '@/utils/routes';
import { listServiceCategories, ServiceCategoryRecord } from '@/api/services/business';

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

export const buildServiceCategoryOptions = (
  categories: ServiceCategoryRecord[],
): CascaderOption[] => {
  const byParent = new Map<number | null, ServiceCategoryRecord[]>();

  categories.forEach((item) => {
    const key = item.parent_id ?? null;
    const siblings = byParent.get(key) || [];
    siblings.push(item);
    byParent.set(key, siblings);
  });

  return (byParent.get(null) || []).map((parent) => ({
    value: parent.id,
    label: parent.name,
    children: (byParent.get(parent.id) || []).map((child) => ({
      value: child.id,
      label: child.name,
    })),
  }));
};

const findOptionPath = (options: CascaderOption[], leafValue: number): number[] | undefined => {
  for (const option of options) {
    if (option.value === leafValue) {
      return [option.value];
    }
    for (const child of option.children || []) {
      if (child.value === leafValue) {
        return [option.value, child.value];
      }
    }
  }
  return undefined;
};

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
    const businessId = getBusinessIdFromUrl();
    if (!businessId) {
      setCascaderOptions([]);
      return;
    }

    let active = true;
    const loadCategories = async () => {
      try {
        const response = await listServiceCategories(businessId);
        if (!active) {
          return;
        }
        setCascaderOptions(buildServiceCategoryOptions(response.data || []));
      } catch (error) {
        console.error('Failed to load service categories:', error);
        if (active) {
          setCascaderOptions([]);
        }
      }
    };

    loadCategories();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (selectedValue: (string | number)[], selectedOptions?: any[]) => {
    const numericValue = selectedValue.map((v) => Number(v));
    onChange?.(numericValue, selectedOptions);
  };

  const cascaderValue =
    value && value.length === 1 && cascaderOptions.length > 0
      ? findOptionPath(cascaderOptions, value[0]) || value
      : value;

  return (
    <Cascader
      value={cascaderValue}
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
