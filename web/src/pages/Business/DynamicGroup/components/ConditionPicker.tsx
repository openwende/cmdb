import React, { useState, useMemo } from 'react';
import { Button, Popover, Input, Checkbox, Tooltip } from 'antd';
import { PlusCircleOutlined, SearchOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ObjectMainLine, PropertyMap, Property, ConditionType } from '../../Types';
import { getConditionName } from '../../utils';
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
  text,
  placement = 'bottom',
  selected,
  propertyMap,
  disabled = false,
  models = [],
  conditionType,
  onPropertyChange,
}) => {
  const { t } = useTranslation();
  const [isShow, setIsShow] = useState(false);
  const [searchText, setSearchText] = useState('');
  const addText = text || t('business.dynamicGroupForm.conditionPicker.addText');

  // Check if a property is selected in other condition types
  const isSelectedInOtherType = (property: Property) => {
    return selected.some(
      (p: Property) => p.id === property.id && p.conditionType !== conditionType,
    );
  };

  // Check if a property is selected in current condition type
  const isSelectedInCurrentType = (property: Property) => {
    return selected.some(
      (p: Property) => p.id === property.id && p.conditionType === conditionType,
    );
  };

  const getTooltipText = (property: Property) => {
    const otherProperty = selected.find(
      (p: Property) => p.id === property.id && p.conditionType !== conditionType,
    );
    if (otherProperty) {
      const typeName = getConditionName(otherProperty.conditionType!, t);
      return t('business.dynamicGroupForm.conditionPicker.alreadyAdded', { typeName });
    }
    return '';
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
    // Don't allow selection if property is already selected in other condition type
    if (isSelectedInOtherType(property)) {
      return;
    }

    const isSelected = isSelectedInCurrentType(property);
    if (isSelected) {
      // Remove property
      onPropertyChange(selected.filter((p: Property) => p.id !== property.id));
    } else {
      // Add property with conditionType
      const propertyWithConditionType = { ...property, conditionType };
      onPropertyChange([...selected, propertyWithConditionType]);
    }
  };

  const handleCategorySelectAll = (modelId: string, checked: boolean) => {
    const modelProperties = filteredPropertyMap[modelId] || [];
    // Filter out properties that are already selected in other condition types
    const availableProperties = modelProperties.filter((p) => !isSelectedInOtherType(p));

    if (checked) {
      // Add all unselected available properties from this category with conditionType
      const newProperties = availableProperties
        .filter((p: Property) => !isSelectedInCurrentType(p))
        .map((property: Property) => ({ ...property, conditionType }));
      onPropertyChange([...selected, ...newProperties]);
    } else {
      // Remove all selected properties from this category
      const modelPropertyIds = availableProperties.map((p: Property) => p.id);
      onPropertyChange(selected.filter((p: Property) => !modelPropertyIds.includes(p.id)));
    }
  };

  const getCategorySelectState = (modelId: string) => {
    const modelProperties = filteredPropertyMap[modelId] || [];
    // Only consider properties that are not disabled (not selected in other condition types)
    const availableProperties = modelProperties.filter((p) => !isSelectedInOtherType(p));
    const selectedCount = availableProperties.filter((p: Property) =>
      isSelectedInCurrentType(p),
    ).length;

    if (selectedCount === 0 || availableProperties.length === 0) {
      return { checked: false, indeterminate: false };
    }
    if (selectedCount === availableProperties.length) {
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
                const isSelected = isSelectedInCurrentType(property);
                const isDisabled = isSelectedInOtherType(property);
                const tooltipText = getTooltipText(property);

                const propertyItem = (
                  <div
                    key={property.id}
                    className={`property-item ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                    onClick={() => !isDisabled && handlePropertySelect(property)}
                  >
                    <span className="property-name">{property.bk_property_name}</span>
                    {isSelected && <CheckOutlined className="check-icon" />}
                  </div>
                );

                return isDisabled ? (
                  <Tooltip key={property.id} title={tooltipText}>
                    {propertyItem}
                  </Tooltip>
                ) : (
                  propertyItem
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
