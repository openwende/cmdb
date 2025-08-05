import React from 'react';
import { Tabs, Button, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { DynamicGroupProperty, PropertyCondition } from '../../Types';
import { DYNAMIC_GROUP_OPERATORS } from '../../constants';
import { getOperatorsByPropertyType } from '../../utils';

interface PropertySelectorProps {
    properties: Record<string, DynamicGroupProperty[]>;
    onAddCondition: (condition: PropertyCondition) => void;
    conditions: PropertyCondition[];
    variableConditions: PropertyCondition[];
}

const PropertySelector: React.FC<PropertySelectorProps> = ({
    properties,
    onAddCondition,
    conditions,
    variableConditions
}) => {

    // 检查属性是否已被使用
    const isPropertyUsed = (property: DynamicGroupProperty) => {
        const allConditions = [...conditions, ...variableConditions];
        return allConditions.some(condition => 
            condition.property.bk_property_id === property.bk_property_id &&
            condition.property.bk_obj_id === property.bk_obj_id
        );
    };

    // 获取已使用的条件数量
    const getConditionCount = (objId: string) => {
        const allConditions = [...conditions, ...variableConditions];
        return allConditions.filter(condition => condition.property.bk_obj_id === objId).length;
    };

    // 添加普通条件
    const handleAddCondition = (property: DynamicGroupProperty) => {
        if (isPropertyUsed(property)) {
            message.warning('该属性已被使用');
            return;
        }

        const operators = getOperatorsByPropertyType(property.bk_property_type);
        const defaultOperator = operators[0] || DYNAMIC_GROUP_OPERATORS.EQ;

        const newCondition: PropertyCondition = {
            id: `${property.bk_obj_id}_${property.bk_property_id}_${Date.now()}`,
            property,
            operator: defaultOperator,
            value: '',
            conditionType: 'condition'
        };

        onAddCondition(newCondition);
    };

    // 添加变量条件
    const handleAddVariableCondition = (property: DynamicGroupProperty) => {
        if (isPropertyUsed(property)) {
            message.warning('该属性已被使用');
            return;
        }

        const operators = getOperatorsByPropertyType(property.bk_property_type);
        const defaultOperator = operators[0] || DYNAMIC_GROUP_OPERATORS.EQ;

        const newCondition: PropertyCondition = {
            id: `${property.bk_obj_id}_${property.bk_property_id}_${Date.now()}_var`,
            property,
            operator: defaultOperator,
            value: '',
            conditionType: 'variable_condition'
        };

        onAddCondition(newCondition);
    };

    const objectLabels = {
        host: '主机',
        module: '模块',
        set: '集群'
    };

    const tabItems = Object.keys(properties).map(objId => {
        const objProperties = properties[objId] || [];
        const conditionCount = getConditionCount(objId);
        
        return {
            key: objId,
            label: (
                <span className={conditionCount > 0 ? 'has-conditions' : ''}>
                    {objectLabels[objId as keyof typeof objectLabels] || objId}
                    {conditionCount > 0 && ` (${conditionCount})`}
                </span>
            ),
            children: (
                <div className="property-list">
                    {objProperties.map(property => {
                        const isUsed = isPropertyUsed(property);
                        return (
                            <div
                                key={`${property.bk_obj_id}_${property.bk_property_id}`}
                                className={`property-item ${isUsed ? 'disabled' : ''}`}
                            >
                                <div>
                                    <div className="property-name">{property.bk_property_name}</div>
                                    <div className="property-type">
                                        {property.bk_property_type} • {property.bk_property_id}
                                    </div>
                                </div>
                                <Space>
                                    <Button
                                        size="small"
                                        icon={<PlusOutlined />}
                                        disabled={isUsed}
                                        onClick={() => handleAddCondition(property)}
                                    >
                                        锁定条件
                                    </Button>
                                    <Button
                                        size="small"
                                        icon={<PlusOutlined />}
                                        disabled={isUsed}
                                        onClick={() => handleAddVariableCondition(property)}
                                    >
                                        变量条件
                                    </Button>
                                </Space>
                            </div>
                        );
                    })}
                    {objProperties.length === 0 && (
                        <div className="property-item disabled">
                            <div className="property-name">暂无可用属性</div>
                        </div>
                    )}
                </div>
            )
        };
    });

    return (
        <div className="property-selector">
            <h4>选择属性</h4>
            <Tabs
                items={tabItems}
                className="property-tabs"
                size="small"
            />
        </div>
    );
};

export default PropertySelector;
