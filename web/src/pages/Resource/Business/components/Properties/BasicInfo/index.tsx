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
        name: t(option.label),
      })),
    [t],
  );

  // Field configuration for basic info
  const basicInfoFields: FieldConfig[] = [
    {
      label: t('resource.business.modify.fields.name'),
      field: 'name',
      type: 'singlechar',
      editable: true,
      required: true,
    },
    {
      label: t('resource.business.modify.fields.createdAt'),
      field: 'created_at',
      type: 'time',
      editable: false,
    },
    {
      label: t('resource.business.modify.fields.createdBy'),
      field: 'created_by',
      type: 'objuser',
      editable: false,
    },
    {
      label: t('resource.business.modify.fields.updatedAt'),
      field: 'updated_at',
      type: 'time',
      editable: false,
    },
    {
      label: t('resource.business.modify.fields.updatedBy'),
      field: 'updated_by',
      type: 'objuser',
      editable: false,
    },
    {
      label: t('resource.business.modify.fields.lifecycle'),
      field: 'lifecycle',
      type: 'enum',
      editable: true,
      options: lifecycleOptions,
    },
    {
      label: t('resource.business.modify.fields.timezone'),
      field: 'timezone',
      type: 'enum',
      editable: false,
    },
    {
      label: t('resource.business.modify.fields.language'),
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
