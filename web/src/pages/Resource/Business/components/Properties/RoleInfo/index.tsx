import React from 'react';
import PropertyForm from '../PropertyForm';
import type { BusinessDetail } from '@/api/types/resource';
import { FieldConfig } from '../PropertyForm';

interface RoleInfoProps {
  data: BusinessDetail | null;
  isEditing: boolean;
  editValues: BusinessDetail | null;
  onValueChange: (key: string, value: string) => void;
  errorFields?: string[];
}

const RoleInfo: React.FC<RoleInfoProps> = ({
  data,
  isEditing = false,
  editValues,
  onValueChange,
  errorFields = [],
}) => {
  // Field configuration for role info
  const roleInfoFields: FieldConfig[] = [
    {
      label: '运维人员',
      field: 'maintainers',
      type: 'objuser',
      editable: true,
      required: true,
    },
    {
      label: '产品人员',
      field: 'productManagers',
      type: 'objuser',
      editable: true,
    },
    {
      label: '测试人员',
      field: 'testers',
      type: 'objuser',
      editable: true,
    },
    {
      label: '开发人员',
      field: 'developers',
      type: 'objuser',
      editable: true,
    },
    {
      label: '操作人员',
      field: 'operators',
      type: 'objuser',
      editable: true,
    },
  ];

  return (
    <PropertyForm
      data={data}
      fields={roleInfoFields}
      isEditing={isEditing}
      editValues={editValues}
      onValueChange={onValueChange}
      errorFields={errorFields}
    />
  );
};

export default RoleInfo;
