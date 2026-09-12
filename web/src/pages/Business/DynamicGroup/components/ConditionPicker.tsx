import React, { useState, useMemo } from 'react';
import { Button, Popover, Input, Checkbox } from 'antd';
import { PlusCircleOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ObjectMainLine, PropertyMap, Property } from '../../Types';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import './style.css';

interface ConditionPickerProps {
  text?: string;
  placement?: string;
  disabled?: boolean;
  selected: Property[];
  propertyMap: PropertyMap;
  models: readonly ObjectMainLine[];
  onPropertyChange: (properties: Property[]) => void;
}

const ConditionPicker: React.FC<ConditionPickerProps> = ({
  text,
  placement = 'bottom',
  selected,
  propertyMap,
  disabled = false,
  models = [],
  onPropertyChange,
}) => {
  const { t } = useTranslation();
  const [isShow, setIsShow] = useState(false);
  const [searchText, setSearchText] = useState('');
  const addText = text || t('business.dynamicGroupForm.conditionPicker.addText');

  // Check if a property is already selected
  const isSelected = (property: Property) => {
    return selected.some((p: Property) => p.id === property.id);
  };

  const filteredPropertyMap = useMemo(() => {
    if (!searchText) return propertyMap;

    const filtered: PropertyMap = {};
    Object.keys(propertyMap).forEach((modelId) => {
      const properties = propertyMap[modelId].filter(
        (property) =>
          property.bk_property_name.toLowerCase().includes(searchText.toLowerCase()) ||
          property.bk_property_id.toLowerCase().includes(searchText.toLowerCase()),
      );
      if (properties.length > 0) {
        filtered[modelId] = properties;
      }
    });
    return filtered;
  }, [propertyMap, searchText]);

  const handlePropertySelect = (property: Property) => {
    if (isSelected(property)) {
      // Remove property
      onPropertyChange(selected.filter((p: Property) => p.id !== property.id));
    } else {
      // Add property
      onPropertyChange([...selected, { ...property }]);
    }
  };

  const handleCategorySelectAll = (modelId: string, checked: boolean) => {
    const modelProperties = filteredPropertyMap[modelId] || [];

    if (checked) {
      // Add all unselected properties from this category
      const newProperties = modelProperties
        .filter((p: Property) => !isSelected(p))
        .map((property: Property) => ({ ...property }));
      onPropertyChange([...selected, ...newProperties]);
    } else {
      // Remove all selected properties from this category
      const modelPropertyIds = modelProperties.map((p: Property) => p.id);
      onPropertyChange(selected.filter((p: Property) => !modelPropertyIds.includes(p.id)));
    }
  };

  const getCategorySelectState = (modelId: string) => {
    const modelProperties = filteredPropertyMap[modelId] || [];
    const selectedCount = modelProperties.filter((p: Property) => isSelected(p)).length;

    if (selectedCount === 0 || modelProperties.length === 0) {
      return { checked: false, indeterminate: false };
    }
    if (selectedCount === modelProperties.length) {
      return { checked: true, indeterminate: false };
    }
    return { checked: false, indeterminate: true };
  };

  // Check if there are filtered results
  const hasFilteredResults = Object.keys(filteredPropertyMap).length > 0;

  const renderProperties = (
    <div className="content-section">
      {Object.keys(filteredPropertyMap).map((modelId) => {
        const properties = filteredPropertyMap[modelId];
        const modelName = models.find((m) => m.bk_obj_id === modelId)?.bk_obj_name || modelId;
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
                {t('business.dynamicGroupForm.conditionPicker.selectAll')}
              </div>
            </div>

            {/* Property section */}
            <div className="properties-grid">
              {properties.map((property) => {
                const selectedItem = isSelected(property);

                return (
                  <div
                    key={property.id}
                    className={`property-item ${selectedItem ? 'selected' : ''}`}
                    onClick={() => handlePropertySelect(property)}
                  >
                    <span className="property-name">{property.bk_property_name}</span>
                    {selectedItem && <CheckOutlined className="check-icon" />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderContent = (
    <div
      className="condition-picker-popover"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Search section */}
      <div className="search-section">
        <Input.Search
          placeholder={t('business.dynamicGroupForm.conditionPicker.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchText}
          allowClear
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      {hasFilteredResults ? (
        renderProperties
      ) : (
        <EmptySearchResult onClearFilter={() => setSearchText('')} />
      )}
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
        {addText}
      </Button>
    </Popover>
  );
};

export default ConditionPicker;
