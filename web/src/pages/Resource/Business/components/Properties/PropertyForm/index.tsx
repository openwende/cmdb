import React, { useState } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Popover, message, Descriptions } from 'antd';
import { useTranslation } from 'react-i18next';
import DynamicComponent from '@/components/Business/FormComponents/DynamicComponent';
import type { BusinessDetail } from '@/api/types/resource';
import { PROPERTY_TYPES } from '@/pages/Business/constants';
import './style.css';

export interface FieldConfig {
  label: string;
  field: keyof BusinessDetail;
  type: string;
  editable?: boolean;
  required?: boolean;
  options?: { id: string; name: string }[];
}

interface PropertyGridProps {
  data: BusinessDetail | null;
  fields: FieldConfig[];
  isEditing: boolean;
  editValues: BusinessDetail | null;
  onValueChange?: (key: string, value: string) => void;
  errorFields?: string[];
}

interface PropertyItemProps {
  label: string;
  value: string | number | undefined;
  field: string;
  type: string;
  editable?: boolean;
  isEditing?: boolean;
  editValue?: string | string[];
  onValueChange?: (value: string) => void;
  options?: { [key: string]: string }[];
  hasError?: boolean;
}

const PropertyItem: React.FC<PropertyItemProps> = ({
  label,
  value,
  field,
  type,
  editable = true,
  isEditing = false,
  editValue,
  onValueChange,
  options,
  hasError,
}) => {
  const { t } = useTranslation();

  const handleCopy = async () => {
    if (value && value !== '--') {
      try {
        await navigator.clipboard.writeText(String(value));
        message.success(t('common.message.copySuccess'));
      } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = String(value);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        message.success(t('common.message.copySuccess'));
      }
    }
  };

  const getPopoverContent = () => {
    return (
      <Descriptions size="small" column={1} style={{ width: 180 }}>
        <Descriptions.Item label="唯一标识">{field}</Descriptions.Item>
        <Descriptions.Item label="字段名称">{label}</Descriptions.Item>
        <Descriptions.Item label="字段类型">{type}</Descriptions.Item>
      </Descriptions>
    );
  };

  const getPopoverTitle = () => {
    return label;
  };

  const displayValue = value || '--';

  return (
    <div className="form-item">
      <div className="form-item-content">
        <div className="item-label">
          <Popover content={getPopoverContent()} title={getPopoverTitle()} placement="topRight">
            <div className="label-content">{label}&nbsp;:</div>
          </Popover>
        </div>
        <div className="item-value-container">
          <div className="item-value">
            {isEditing && editable ? (
              <DynamicComponent
                componentType={type}
                value={editValue}
                onChange={onValueChange}
                placeholder={`请输入${label}`}
                mode={type === PROPERTY_TYPES.ENUM ? 'single' : undefined}
                options={options}
                disabled={!editable}
              />
            ) : (
              <>
                <span>{displayValue}</span>
                {value !== '--' && (
                  <CopyOutlined className="copy-icon" onClick={handleCopy} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {hasError && <div className="form-item-error">{t('common.form.rulesMessage')}</div>}
    </div>
  );
};

const PropertyGrid: React.FC<PropertyGridProps> = ({
  data,
  fields,
  isEditing = false,
  editValues,
  onValueChange,
  errorFields = [],
}) => {
  const getFieldValue = (config: FieldConfig): string => {
    if (!data) return '--';

    const value = data[config.field];
    if (value === null || value === undefined || value === '') {
      return '--';
    }

    return String(value);
  };

  const handleValueChange = (fieldKey: string, value: string) => {
    if (onValueChange) {
      onValueChange(fieldKey, value);
    }
  };

  return (
    <div className="form-container">
      {fields
        .filter((config) => {
          return isEditing ? config.editable : true;
        })
        .map((config) => {
          const value = getFieldValue(config);

          return (
            <PropertyItem
              key={config.field}
              label={config.label}
              value={value}
              field={config.field}
              type={config.type}
              editable={config.editable}
              isEditing={isEditing}
              editValue={editValues?.[config.field] || ''}
              onValueChange={(val) => handleValueChange(config.field, val)}
              options={config.options}
              hasError={errorFields.includes(config.field)}
            />
          );
        })}
    </div>
  );
};

export default PropertyGrid;
