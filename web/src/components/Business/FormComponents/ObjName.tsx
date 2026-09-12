/**
 * ObjName - Object name autocomplete component for set/module selection
 * Loads real topology set/module names for the current business.
 * Condition values use names (not IDs) because backend maps bk_set_name/bk_module_name to s.name/m.name.
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Select, Spin, Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { FormComponentProps, SelectOption } from './index';
import { Property, OperatorType } from '../../../pages/Business/Types';
import { QUERY_OPERATOR } from '../../../pages/Business/constants';
import {
  listTopologyModules,
  listTopologySets,
  TopologyModuleItem,
  TopologySetItem,
} from '@/api/services/business';

interface ObjNameProps extends FormComponentProps {
  property: Property;
  operator: OperatorType;
  bizId: number | string;
}

const normalizeKeyword = (value: string) => value.trim().toLowerCase();

const toOptions = (items: Array<{ id: number; name: string }>): SelectOption[] => {
  const seen = new Set<string>();
  const options: SelectOption[] = [];
  for (const item of items) {
    const name = (item.name || '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    options.push({ label: name, value: name });
  }
  return options;
};

const ObjName: React.FC<ObjNameProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
  operator,
  bizId,
  property,
}) => {
  const [allOptions, setAllOptions] = useState<SelectOption[]>([]);
  const [searchOptions, setSearchOptions] = useState<SelectOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const loadedBizRef = useRef<string | null>(null);
  const allOptionsRef = useRef<SelectOption[]>([]);
  const { t } = useTranslation();

  const isInputMode = useMemo(() => {
    return operator === QUERY_OPERATOR.LIKE;
  }, [operator]);

  const objectType = property?.bk_obj_id;

  useEffect(() => {
    allOptionsRef.current = allOptions;
  }, [allOptions]);

  useEffect(() => {
    if (isInputMode && !Array.isArray(value) && typeof value !== 'string') {
      onChange('');
    } else if (!isInputMode && typeof value === 'string') {
      onChange([]);
    }
  }, [isInputMode, value, onChange]);

  // Reload when business or object type changes
  useEffect(() => {
    loadedBizRef.current = null;
    allOptionsRef.current = [];
    setAllOptions([]);
    setSearchOptions([]);
  }, [bizId, objectType]);

  const fetchOptions = useCallback(async () => {
    if (bizId === undefined || bizId === null || bizId === '') {
      setAllOptions([]);
      setSearchOptions([]);
      return [] as SelectOption[];
    }

    const cacheKey = `${bizId}:${objectType || ''}`;
    if (loadedBizRef.current === cacheKey && allOptionsRef.current.length > 0) {
      return allOptionsRef.current;
    }

    setIsSearching(true);
    try {
      let options: SelectOption[] = [];
      if (objectType === 'set') {
        const response = await listTopologySets(bizId);
        const items: TopologySetItem[] = response?.data || [];
        options = toOptions(items);
      } else if (objectType === 'module') {
        const response = await listTopologyModules(bizId);
        const items: TopologyModuleItem[] = response?.data || [];
        options = toOptions(items);
      }

      loadedBizRef.current = cacheKey;
      allOptionsRef.current = options;
      setAllOptions(options);
      setSearchOptions(options);
      return options;
    } catch (error) {
      console.error('Failed to load topology name options:', error);
      allOptionsRef.current = [];
      setAllOptions([]);
      setSearchOptions([]);
      return [] as SelectOption[];
    } finally {
      setIsSearching(false);
    }
  }, [bizId, objectType]);

  const filterOptions = useCallback((options: SelectOption[], keyword: string) => {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) return options;
    return options.filter((option) => String(option.label).toLowerCase().includes(normalized));
  }, []);

  const handleSearch = useCallback(
    async (searchValue: string) => {
      const options =
        allOptionsRef.current.length > 0 ? allOptionsRef.current : await fetchOptions();
      setSearchOptions(filterOptions(options, searchValue));
    },
    [fetchOptions, filterOptions],
  );

  const handleDropdownVisibleChange = useCallback(
    (open: boolean) => {
      if (open) {
        void fetchOptions().then((options) => {
          setSearchOptions(options);
        });
      }
    },
    [fetchOptions],
  );

  const getProcessedValue = () => {
    if (isInputMode) {
      return typeof value === 'string' ? value : '';
    }
    // Select mode: array of names (string)
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item));
  };

  const getDisplayOptions = (): SelectOption[] => {
    if (!isInputMode && Array.isArray(value)) {
      const selectedOptions: SelectOption[] = value
        .map((item) => String(item))
        .filter(Boolean)
        .map((name) => {
          const found = allOptions.find((option) => String(option.value) === name);
          return {
            label: found ? String(found.label) : name,
            value: name,
          };
        });

      const allDisplay: SelectOption[] = [...selectedOptions];
      searchOptions.forEach((option) => {
        if (!allDisplay.find((item) => String(item.value) === String(option.value))) {
          allDisplay.push(option);
        }
      });
      return allDisplay;
    }
    return searchOptions;
  };

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

  const selectValue = getProcessedValue() as string[];
  const displayOptions = getDisplayOptions();

  return (
    <Select
      mode="multiple"
      value={selectValue}
      onChange={onChange}
      placeholder={placeholder}
      showSearch
      filterOption={false}
      onSearch={(keyword) => {
        void handleSearch(keyword);
      }}
      onDropdownVisibleChange={handleDropdownVisibleChange}
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
