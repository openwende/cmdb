/**
 * ObjUser - User selector component
 * Corresponds to bk-cmdb's objuser type (user selection)
 */

import React, { useState, useCallback } from 'react';
import { Select, Spin } from 'antd';
import { FormComponentProps, SelectOption } from './index';
import { userListMock } from '@/mock/resource';
import './styles.css';

const ObjUser: React.FC<FormComponentProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const [searchOptions, setSearchOptions] = useState<Array<SelectOption>>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Handle search when user types
  const handleSearch = useCallback(async (searchValue: string) => {
    if (!searchValue || searchValue.length < 1) {
      setSearchOptions([]);
      return;
    }

    setIsSearching(true);
    try {
      // await new Promise(resolve => setTimeout(resolve, 300));
      
      // Filter users based on search value (search both chinese and english names)
      const filteredUsers = userListMock.filter(user => 
        user.chinese_name.toLowerCase().includes(searchValue.toLowerCase()) ||
        user.english_name.toLowerCase().includes(searchValue.toLowerCase())
      );

      const options = filteredUsers.map(user => ({
        label: user.chinese_name,
        value: user.chinese_name
      }));
      
      setSearchOptions(options);
    } catch (error) {
      console.error(error);
      setSearchOptions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      showSearch
      filterOption={false}
      onSearch={handleSearch}
      options={searchOptions}
      disabled={disabled}
      style={{ width: '100%' }}
      notFoundContent={isSearching ? <Spin size="small" /> : '无匹配数据'}
    />
  );
};

export default ObjUser;
