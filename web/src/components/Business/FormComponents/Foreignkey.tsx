/**
 * Enum - Single select dropdown component
 * Corresponds to bk-cmdb's enum type (single selection from predefined options)
 */

import React, { useEffect } from 'react';
import { Select } from 'antd';
import { FormComponentProps } from './index';
import { dynamicCloudArea } from '@/mock/business';
import './styles.css';

interface Option {
  bk_account_id: number;
  bk_cloud_id: number;
  bk_cloud_name: string;
  bk_cloud_vendor: string;
  bk_created_at: string;
  bk_creator: string;
  bk_last_editor: string;
  bk_region: string;
  bk_status: string;
  bk_status_detail?: string;
  bk_supplier_account: string;
  bk_updated_at: string;
  bk_vpc_id: string;
  bk_vpc_name: string;
  create_time: string;
  default: number;
  last_time: string;
}

const { Option } = Select;

const Foreignkey: React.FC<FormComponentProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const [options, setOptions] = React.useState<Option[]>([]);

  useEffect(() => {
    getCloudArea();
  }, []);

  const getCloudArea = async () => {
    try {
      // const { info } = await $store.dispatch('cloud/area/findMany', {
      //   params: {
      //     condition: {},
      //     page: {
      //       sort: 'bk_cloud_name'
      //     }
      //   },
      //   config: {
      //     requestId: 'searchForeignkey'
      //   }
      // })
      const info = dynamicCloudArea;
      setOptions(info);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      allowClear
      mode="multiple"
      optionFilterProp="children"
      style={{ width: '100%' }}
    >
      {options.map((option) => (
        <Option key={option.bk_cloud_id} value={option.bk_cloud_id}>
          {option.bk_cloud_name}[{option.bk_cloud_id}]
        </Option>
      ))}
    </Select>
  );
};

export default Foreignkey;
