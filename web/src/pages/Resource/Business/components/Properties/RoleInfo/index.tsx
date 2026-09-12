import React from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();

  // Field configuration for role info
  const roleInfoFields: FieldConfig[] = [
    {
      label: t('resource.business.modify.fields.sres'),
      field: 'sres',
      type: 'objuser',
      editable: true,
      required: true,
    },
    {
      label: t('resource.business.modify.fields.bizops'),
      field: 'bizops',
      type: 'objuser',
      editable: true,
    },
    {
      label: t('resource.business.modify.fields.testers'),
      field: 'testers',
      type: 'objuser',
      editable: true,
    },
    {
      label: t('resource.business.modify.fields.developers'),
      field: 'developers',
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
