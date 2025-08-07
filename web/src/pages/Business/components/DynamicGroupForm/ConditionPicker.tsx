import React, { useState, useMemo } from 'react';
import { Button, Popover, Input, Checkbox } from 'antd';
import { PlusCircleOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { ObjectMainLine, PropertyMap, Property, ConditionType } from '../../Types';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import './style.css';

interface ConditionPickerProps {
  text?: string;
  placement?: string;
  disabled?: boolean;
  selected: Property[];
  propertyMap: PropertyMap;
  models: readonly ObjectMainLine[];
  conditionType: ConditionType;
  onPropertyChange: (properties: Property[]) => void;
}

const ConditionPicker: React.FC<ConditionPickerProps> = ({
  text = '添加',
  placement = 'bottom',
  selected,
  propertyMap,
  disabled = false,
  models = [],
  conditionType,
  onPropertyChange
}) => {
  const [isShow, setIsShow] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Filter properties based on search text
  const filteredPropertyMap = useMemo(() => {
    if (!searchText) return propertyMap;

    const filtered: PropertyMap = {};
    Object.keys(propertyMap).forEach(modelId => {
      const properties = propertyMap[modelId].filter(property =>
        property.bk_property_name.toLowerCase().includes(searchText.toLowerCase()) ||
        property.bk_property_id.toLowerCase().includes(searchText.toLowerCase())
      );
      if (properties.length > 0) {
        filtered[modelId] = properties;
      }
    });
    return filtered;
  }, [propertyMap, searchText]);

  // Handle property selection
  const handlePropertySelect = (property: Property) => {
    const isSelected = selected.some((p: Property) => p.id === property.id);

    if (isSelected) {
      // Remove property
      onPropertyChange(selected.filter((p: Property) => p.id !== property.id));
    } else {
      // Add property with conditionType
      const propertyWithConditionType = { ...property, conditionType };
      onPropertyChange([...selected, propertyWithConditionType]);
    }
  };

  // Handle category select all
  const handleCategorySelectAll = (modelId: string, checked: boolean) => {
    const modelProperties = filteredPropertyMap[modelId] || [];

    if (checked) {
      // Add all unselected properties from this category with conditionType
      const newProperties = modelProperties
        .filter((p: Property) => !selected.some((selectedProp: Property) => selectedProp.id === p.id))
        .map((property: Property) => ({ ...property, conditionType }));
      onPropertyChange([...selected, ...newProperties]);
    } else {
      // Remove all selected properties from this category
      const modelPropertyIds = modelProperties.map((p: Property) => p.id);
      onPropertyChange(selected.filter((p: Property) => !modelPropertyIds.includes(p.id)));
    }
  };

  // Check category selection state
  const getCategorySelectState = (modelId: string) => {
    const modelProperties = filteredPropertyMap[modelId] || [];
    const selectedCount = modelProperties.filter((p: Property) =>
      selected.some((selectedProp: Property) => selectedProp.id === p.id)
    ).length;

    if (selectedCount === 0) return { checked: false, indeterminate: false };
    if (selectedCount === modelProperties.length) return { checked: true, indeterminate: false };
    return { checked: false, indeterminate: true };
  };

  // Check if there are filtered results
  const hasFilteredResults = Object.keys(filteredPropertyMap).length > 0;

  const renderProperties = (
    <div className="content-section">
      {Object.keys(filteredPropertyMap).map(modelId => {
        const properties = filteredPropertyMap[modelId];
        const modelName = models.find(m => m.bk_obj_id === modelId)?.bk_obj_name || modelId;
        const selectState = getCategorySelectState(modelId);

        return (
          <div key={modelId} className="category-section">
            {/* Category section */}
            <div className="category-header">
              <span>
                <span className="category-title">{modelName}</span> ({properties.length})
              </span>
              <div className="select-all-section">
                <Checkbox
                  checked={selectState.checked}
                  indeterminate={selectState.indeterminate}
                  onChange={(e) => handleCategorySelectAll(modelId, e.target.checked)}
                />
                全选
              </div>
            </div>

            {/* Property section */}
            <div className="properties-grid">
              {properties.map(property => {
                const isSelected = selected.some((p: Property) => p.id === property.id);
                return (
                  <div
                    key={property.id}
                    className={`property-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handlePropertySelect(property)}
                  >
                    <span className="property-name">
                      {property.bk_property_name}
                    </span>
                    {isSelected && (
                      <CheckOutlined className="check-icon" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  )

  const renderContent = (
    <div className="condition-picker-popover" onClick={(e) => { e.stopPropagation() }}>
      {/* Search section */}
      <div className="search-section">
        <Input.Search
          placeholder="请输入字段名称或唯一标识"
          prefix={<SearchOutlined />}
          value={searchText}
          allowClear
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {
        hasFilteredResults
          ? renderProperties
          : (
            <EmptySearchResult
              onClearFilter={() => setSearchText('')}
            />
          )
      }
    </div>
  );

  return (
    <Popover
      content={renderContent}
      trigger="click"
      placement={placement as any}
      open={isShow}
      onOpenChange={(open) => {
        setIsShow(open);
        if (open) {
          setSearchText('');
        }
      }}
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
