/**
 * ObjName - Object name autocomplete component for set/module selection
 * Based on BluKing CMDB's set.vue and module.vue implementation
 * A remote searchable select component for object names
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Select, Spin, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormComponentProps, SelectOption } from './index';
import { Property, OperatorType } from '../../../pages/Business/Types';
import { QUERY_OPERATOR } from '../../../pages/Business/constants';

const mockResults = [
  {
    id: 1,
    name: 'module',
  },
  {
    id: 2,
    name: 'set',
  },
];

interface ObjNameProps extends FormComponentProps {
  property: Property;
  operator: OperatorType;
  bizId: number | string;
}

const ObjName: React.FC<ObjNameProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  operator,
  bizId,
  property,
}) => {
  const [searchOptions, setSearchOptions] = useState<Array<SelectOption>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { t } = useTranslation();

  const isInputMode = useMemo(() => {
    return operator === QUERY_OPERATOR.LIKE;
  }, [operator]);

  useEffect(() => {
    if (isInputMode && !Array.isArray(value) && typeof value !== 'string') {
      onChange('');
    } else if (!isInputMode && typeof value === 'string') {
      onChange([]);
    }
  }, [isInputMode, value, onChange]);

  const getProcessedValue = () => {
    if (isInputMode) {
      // Input mode: value should be string
      return typeof value === 'string' ? value : '';
    } else {
      // Select mode: value should be array of IDs
      const idArray = Array.isArray(value) ? value : [];
      return idArray;
    }
  };

  const getDisplayOptions = () => {
    if (!isInputMode && Array.isArray(value)) {
      const selectedOptions = value.map((id) => {
        const found = mockResults.find((item) => item.id === id);
        return {
          label: found ? found.name : '',
          value: id,
        };
      });

      // Combine selected options with search options, avoid duplicates
      const allOptions = [...selectedOptions];
      searchOptions.forEach((option) => {
        if (!allOptions.find((item) => item.value === option.value)) {
          allOptions.push(option);
        }
      });

      return allOptions;
    }
    return searchOptions;
  };

  const handleSearch = useCallback(
    async (_searchValue: string) => {
      setIsSearching(true);
      try {
        // TODO: Replace with actual API call
        // const response = await api, {
        //   bk_obj_id: property.bk_obj_id,
        //   bk_biz_id: bizId,
        //   name: searchValue
        // });
        const options = mockResults.map((item) => ({
          label: item.name,
          value: item.id,
        }));
        setSearchOptions(options);
      } catch (error) {
        console.error(error);
        setSearchOptions([]);
      } finally {
        setIsSearching(false);
      }
    },
    [property, bizId],
  );

  // If operator is LIKE, render Input component
  if (isInputMode) {
    const inputValue = getProcessedValue() as string;
    return (
      <Input
        value={inputValue}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: '100%' }}
      />
    );
  }

  // Otherwise, render Select component
  const selectValue = getProcessedValue() as number[];
  const displayOptions = getDisplayOptions();

  return (
    <Select
      mode="multiple"
      value={selectValue}
      onChange={onChange}
      placeholder={placeholder}
      showSearch
      filterOption={false}
      onSearch={handleSearch}
      options={displayOptions}
      disabled={disabled}
      style={{ width: '100%' }}
      notFoundContent={
        isSearching ? <Spin size="small" /> : t('common.components.formComponents.noMatchData')
      }
    />
  );
};

export default ObjName;
