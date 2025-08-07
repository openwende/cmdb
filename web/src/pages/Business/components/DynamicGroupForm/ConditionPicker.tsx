import React, { useState, useMemo } from 'react';
import { Button, Popover, Input, Checkbox } from 'antd';
import { PlusCircleOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { DynamicGroupConditionType, ObjectMainLine, PropertyMap, Property } from '../../Types';
import EmptySearchResult from '../../../../components/common/EmptySearchResult';
import './style.css';

interface ConditionPickerProps {
  text?: string;
  placement?: string;
  icon?: string;
  selected?: Property[];
  propertyMap: PropertyMap;
  handler: (properties: Property[]) => void;
  disabled?: boolean;
  conditionType?: DynamicGroupConditionType;
  models?: readonly ObjectMainLine[];
}

const ConditionPicker: React.FC<ConditionPickerProps> = ({
  text = '添加',
  placement = 'bottom',
  selected = [],
  propertyMap,
  handler,
  disabled = false,
  conditionType,
  models = []
}) => {
  const [isShow, setIsShow] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedProperties, setSelectedProperties] = useState<Property[]>(selected);

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
    const propertyWithCondition = { ...property, conditionType };
    const isSelected = selectedProperties.some(p => p.id === property.id);

    if (isSelected) {
      setSelectedProperties(prev => prev.filter(p => p.id !== property.id));
    } else {
      setSelectedProperties(prev => [...prev, propertyWithCondition]);
    }
  };

  // Handle category select all
  const handleCategorySelectAll = (modelId: string, checked: boolean) => {
    const modelProperties = filteredPropertyMap[modelId] || [];
    const propertiesWithCondition = modelProperties.map(p => ({ ...p, conditionType }));

    if (checked) {
      // Add all unselected properties from this category
      const newProperties = propertiesWithCondition.filter(p =>
        !selectedProperties.some(selected => selected.id === p.id)
      );
      setSelectedProperties(prev => [...prev, ...newProperties]);
    } else {
      // Remove all selected properties from this category
      const modelPropertyIds = modelProperties.map(p => p.id);
      setSelectedProperties(prev => prev.filter(p => !modelPropertyIds.includes(p.id)));
    }
  };

  // Check category selection state
  const getCategorySelectState = (modelId: string) => {
    const modelProperties = filteredPropertyMap[modelId] || [];
    const selectedCount = modelProperties.filter(p =>
      selectedProperties.some(selected => selected.id === p.id)
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
                const isSelected = selectedProperties.some(p => p.id === property.id);
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
          setSelectedProperties(selected);
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
