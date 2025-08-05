import React from 'react';
import { Button, Select, Input, InputNumber, Space, Tag } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { PropertyCondition } from '../../Types';
import { DYNAMIC_GROUP_OPERATORS, OPERATOR_LABELS } from '../../constants';
import { getOperatorsByPropertyType } from '../../utils';

interface ConditionFormProps {
    conditions: PropertyCondition[];
    variableConditions: PropertyCondition[];
    onRemoveCondition: (index: number, isVariable: boolean) => void;
}

const ConditionForm: React.FC<ConditionFormProps> = ({
    conditions,
    variableConditions,
    onRemoveCondition
}) => {

    // 渲染条件值输入组件
    const renderValueInput = (condition: PropertyCondition, onChange: (value: any) => void) => {
        const { property, operator, value } = condition;
        
        switch (property.bk_property_type) {
            case 'int':
                if (operator === DYNAMIC_GROUP_OPERATORS.RANGE) {
                    return (
                        <Space.Compact>
                            <InputNumber
                                placeholder="最小值"
                                value={value?.min}
                                onChange={(val) => onChange({ ...value, min: val })}
                                style={{ width: '50%' }}
                            />
                            <InputNumber
                                placeholder="最大值"
                                value={value?.max}
                                onChange={(val) => onChange({ ...value, max: val })}
                                style={{ width: '50%' }}
                            />
                        </Space.Compact>
                    );
                } else if ([DYNAMIC_GROUP_OPERATORS.IN, DYNAMIC_GROUP_OPERATORS.NIN].includes(operator as any)) {
                    return (
                        <Select
                            mode="tags"
                            placeholder="请输入数值，按回车分隔"
                            value={Array.isArray(value) ? value : []}
                            onChange={onChange}
                            tokenSeparators={[',']}
                            style={{ width: '100%' }}
                        />
                    );
                } else {
                    return (
                        <InputNumber
                            placeholder="请输入数值"
                            value={value}
                            onChange={onChange}
                            style={{ width: '100%' }}
                        />
                    );
                }

            case 'enum':
                if ([DYNAMIC_GROUP_OPERATORS.IN, DYNAMIC_GROUP_OPERATORS.NIN].includes(operator as any)) {
                    return (
                        <Select
                            mode="multiple"
                            placeholder="请选择"
                            value={Array.isArray(value) ? value : []}
                            onChange={onChange}
                            style={{ width: '100%' }}
                        >
                            {property.option?.map((option: any) => (
                                <Select.Option key={option.id} value={option.id}>
                                    {option.name}
                                </Select.Option>
                            ))}
                        </Select>
                    );
                } else {
                    return (
                        <Select
                            placeholder="请选择"
                            value={value}
                            onChange={onChange}
                            style={{ width: '100%' }}
                        >
                            {property.option?.map((option: any) => (
                                <Select.Option key={option.id} value={option.id}>
                                    {option.name}
                                </Select.Option>
                            ))}
                        </Select>
                    );
                }

            case 'bool':
                return (
                    <Select
                        placeholder="请选择"
                        value={value}
                        onChange={onChange}
                        style={{ width: '100%' }}
                    >
                        <Select.Option value={true}>是</Select.Option>
                        <Select.Option value={false}>否</Select.Option>
                    </Select>
                );

            default:
                if ([DYNAMIC_GROUP_OPERATORS.IN, DYNAMIC_GROUP_OPERATORS.NIN].includes(operator as any)) {
                    return (
                        <Select
                            mode="tags"
                            placeholder="请输入值，按回车分隔"
                            value={Array.isArray(value) ? value : []}
                            onChange={onChange}
                            tokenSeparators={[',']}
                            style={{ width: '100%' }}
                        />
                    );
                } else {
                    return (
                        <Input
                            placeholder={property.placeholder || "请输入值"}
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                        />
                    );
                }
        }
    };

    // 渲染条件组
    const renderConditionGroup = (conditionList: PropertyCondition[], isVariable: boolean, title: string) => {
        if (conditionList.length === 0) return null;

        return (
            <div className="condition-section">
                <div className="condition-header">
                    <span>{title}</span>
                    <span className="condition-count">{conditionList.length}</span>
                    {isVariable && <Tag color="orange">变量条件</Tag>}
                </div>
                
                {conditionList.map((condition, index) => {
                    const availableOperators = getOperatorsByPropertyType(condition.property.bk_property_type);
                    
                    return (
                        <div key={condition.id} className="condition-item">
                            <div className="condition-property">
                                <div>{condition.property.bk_property_name}</div>
                                <div style={{ fontSize: '12px', color: '#999' }}>
                                    {condition.property.bk_obj_id}
                                </div>
                            </div>
                            
                            <div className="condition-operator">
                                <Select
                                    value={condition.operator}
                                    onChange={(operator) => {
                                        // TODO: 更新条件操作符
                                        console.log('Update operator:', operator);
                                    }}
                                    style={{ width: '100%' }}
                                >
                                    {availableOperators.map(op => (
                                        <Select.Option key={op} value={op}>
                                            {OPERATOR_LABELS[op as keyof typeof OPERATOR_LABELS] || op}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </div>
                            
                            <div className="condition-value">
                                {renderValueInput(condition, (value) => {
                                    // TODO: 更新条件值
                                    console.log('Update value:', value);
                                })}
                            </div>
                            
                            <div className="condition-actions">
                                <Button
                                    type="text"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => onRemoveCondition(index, isVariable)}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="condition-form">
            {renderConditionGroup(conditions, false, '锁定条件')}
            {renderConditionGroup(variableConditions, true, '变量条件')}
            
            {conditions.length === 0 && variableConditions.length === 0 && (
                <div style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>
                    请从左侧选择属性添加查询条件
                </div>
            )}
        </div>
    );
};

export default ConditionForm;
