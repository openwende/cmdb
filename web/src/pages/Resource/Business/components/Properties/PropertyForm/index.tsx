import React, { useState } from 'react';
import { CopyOutlined } from '@ant-design/icons';
import { Popover, message } from 'antd';
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
  hasError
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const { t } = useTranslation();

  const handleCopy = async () => {
    if (value && value !== '--') {
      try {
        await navigator.clipboard.writeText(String(value));
        message.success('复制成功');
      } catch (error) {
        const textArea = document.createElement('textarea');
        textArea.value = String(value);
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        message.success('复制成功');
      }
    }
  };

  const getPopoverContent = () => {
    return (
      <div style={{ padding: '8px' }}>
        <div style={{ marginBottom: '4px' }}>
          <span>唯一标识 :</span> {field}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <span>字段名称 :</span> {label}
        </div>
        <div>
          <span>字段类型 :</span> {type}
        </div>
      </div>
    );
  };

  const getPopoverTitle = () => {
    return label;
  };

  const displayValue = value || '--';

  return (
    <div className="form-item">
      <Popover
        content={getPopoverContent()}
        title={getPopoverTitle()}
        trigger="hover"
        placement="topRight"
      >
        <div className="item-label">{label}&nbsp;:</div>
      </Popover>
      <div className="item-value-container">
        <div
          className="item-value"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
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
              {isHovered && value && (
                <CopyOutlined
                  className="copy-icon"
                  onClick={handleCopy}
                  title="复制"
                />
              )}
            </>
          )}
        </div>
        {hasError && (
          <div className="error-message">
            {t('common.form.rules_message')}
          </div>
        )}
      </div>
    </div>
  );
};

const PropertyGrid: React.FC<PropertyGridProps> = ({
  data,
  fields,
  isEditing = false,
  editValues,
  onValueChange,
  errorFields = []
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
      {fields.map((config) => {
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