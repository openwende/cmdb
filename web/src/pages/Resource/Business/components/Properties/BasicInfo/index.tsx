import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import PropertyForm from '../PropertyForm';
import type { BusinessDetail } from '@/api/types/resource';
import { LIFECYCLE_OPTIONS, LANGUAGE_OPTIONS } from '@/pages/Resource/constants';
import { FieldConfig } from '../PropertyForm';

interface BasicInfoProps {
  data: BusinessDetail | null;
  isEditing: boolean;
  editValues: BusinessDetail | null;
  onValueChange: (key: string, value: string) => void;
  errorFields?: string[];
}

const BasicInfo: React.FC<BasicInfoProps> = ({
  data,
  isEditing = false,
  editValues,
  onValueChange,
  errorFields = [],
}) => {
  const { t } = useTranslation();

  const lifecycleOptions = useMemo(
    () =>
      LIFECYCLE_OPTIONS.map((option) => ({
        id: option.value,
        name: t(option.label),
      })),
    [t],
  );

  const languageOptions = useMemo(
    () =>
      LANGUAGE_OPTIONS.map((option) => ({
        id: option.value,
        name: option.label,
      })),
    [],
  );

  // Field configuration for basic info
  const basicInfoFields: FieldConfig[] = [
    {
      label: '业务名',
      field: 'name',
      type: 'singlechar',
      editable: true,
      required: true,
    },
    {
      label: '创建时间',
      field: 'created_at',
      type: 'time',
      editable: false,
    },
    {
      label: '创建人',
      field: 'created_by',
      type: 'objuser',
      editable: false,
    },
    {
      label: '更新时间',
      field: 'updated_at',
      type: 'time',
      editable: false,
    },
    {
      label: '更新人',
      field: 'updated_by',
      type: 'objuser',
      editable: false,
    },
    {
      label: '生命周期',
      field: 'lifecycle',
      type: 'enum',
      editable: true,
      options: lifecycleOptions,
    },
    {
      label: '时区',
      field: 'timezone',
      type: 'enum',
      editable: false,
    },
    {
      label: '语言',
      field: 'language',
      type: 'enum',
      editable: true,
      options: languageOptions,
    },
  ];

  return (
    <PropertyForm
      data={data}
      fields={basicInfoFields}
      isEditing={isEditing}
      editValues={editValues}
      onValueChange={onValueChange}
      errorFields={errorFields}
    />
  );
};

export default BasicInfo;
