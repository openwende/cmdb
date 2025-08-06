import React, { useState } from 'react';
import { Button, Popover } from 'antd';
import { PlusCircleOutlined } from '@ant-design/icons';
import { DynamicGroupConditionType, DGProperty } from '../../Types';
import { ObjectMainLine } from '../../Types';

interface ConditionPickerProps {
  text?: string;
  placement?: string;
  icon?: string;
  selected?: DGProperty[];
  propertyMap: Record<string, DGProperty[]>;
  handler: (properties: DGProperty[]) => void;
  disabled?: boolean;
  conditionType?: DynamicGroupConditionType;
  models?: readonly ObjectMainLine[];
}

const ConditionPicker: React.FC<ConditionPickerProps> = ({
  text = '添加',
  placement = 'bottomLeft',
  selected = [],
  propertyMap,
  handler,
  disabled = false,
  conditionType,
  models = []
}) => {
  const [isShow, setIsShow] = useState(false);

  const handlePropertySelect = (property: DGProperty) => {
    const newProperty = { ...property, conditionType };
    handler([...selected, newProperty]);
    setIsShow(false);
  };

  const content = (
    <div style={{ maxWidth: 300, maxHeight: 400, overflow: 'auto' }}>
      {Object.keys(propertyMap).map(modelId => {
        const properties = propertyMap[modelId];
        const modelName = models.find(m => m.bk_obj_id === modelId)?.bk_obj_name || modelId;
        
        return (
          <div key={modelId} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>{modelName}</div>
            {properties.map(property => (
              <div
                key={property.id}
                style={{ 
                  padding: '4px 8px', 
                  cursor: 'pointer',
                  borderRadius: 4,
                  margin: '2px 0'
                }}
                onClick={() => handlePropertySelect(property)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f0f0f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {property.bk_property_name}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement={placement as any}
      open={isShow}
      onOpenChange={setIsShow}
    >
      <Button
        type="link"
        size="small"
        disabled={disabled}
        icon={<PlusCircleOutlined />}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        {text}
      </Button>
    </Popover>
  );
};

export default ConditionPicker;
