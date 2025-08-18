import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Drawer, Form, Input, Button, Space, Row, Col, Card, Empty, Collapse, Tooltip } from 'antd';
import { DynamicGroupFormData, ObjectMainLine, PropertyMap, Property, ConditionType, ConditionName } from '../../Types';
import { availableModelIds, requestConfig, PROPERTY_TYPES, BUILTIN_MODELS } from '../../constants';
import { createServiceTemplateProperty } from '../../utils';
import FormTarget from './FormTarget';
import ConditionPicker from './ConditionPicker';
import FormPropertyList from './FormPropertyList';
import { getAvailableModels, batchSearchObjectAttribute } from '@/api';
import { useBusinessStore } from '@/store/BusinessStore';
import './style.css';

export const conditionTypes = [
    {
        key: ConditionType.VARIABLE,
        title: ConditionName.VARIABLE,
        desc: '在使用动态分组时，操作符和条件值可修改'
    },
    {
        key: ConditionType.IMMUTABLE,
        title: ConditionName.IMMUTABLE,
        desc: '在使用动态分组时，条件及条件值均不可修改'
    }
];
const exchangeType = {
    [ConditionType.VARIABLE]: ConditionType.IMMUTABLE,
    [ConditionType.IMMUTABLE]: ConditionType.VARIABLE
}

interface DynamicGroupFormRef {
    show: () => void;
    hide: () => void;
}
interface DynamicGroupFormProps {
    id?: string | number;
    title?: string;
    isPreview?: boolean;
    onClose?: () => void;
    onSave?: (data: DynamicGroupFormData) => void;
}

const DynamicGroupForm = forwardRef<DynamicGroupFormRef, DynamicGroupFormProps>(({
    title = '动态分组',
    onClose,
    onSave
}, ref) => {
    const { currentBusiness } = useBusinessStore();

    const [form] = Form.useForm();
    const [isShow, setIsShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [groupObject, setGroupObject] = useState<BUILTIN_MODELS>(BUILTIN_MODELS.HOST);
    const [availableModels, setAvailableModels] = useState<readonly ObjectMainLine[]>([]);
    const [propertyMap, setPropertyMap] = useState<PropertyMap>({});
    const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);

    const [disabledPropertyMap, setDisabledPropertyMap] = useState<PropertyMap>({});
    const [variableConditions, setVariableConditions] = useState<Record<string, any>>({});
    const [fixedConditions, setFixedConditions] = useState<Record<string, any>>({});
    // 条件缓存存储 - 用于临时保存和恢复条件状态
    const [storageCondition, setStorageCondition] = useState<Record<string, any>>({});

    useEffect(() => {
        getMainLineModels();
    }, [])

    useEffect(() => {
        if (availableModels.length) {
            getModelProperties();
        }
    }, [availableModels]);

    const getMainLineModels = async () => {
        try {
            // TODO: api
            const models = await getAvailableModels();
            // eslint-disable-next-line max-len
            const availableModels = availableModelIds.map(modelId => {
                return models.find(model => model.bk_obj_id === modelId);
            });
            setAvailableModels(Object.freeze(availableModels) as readonly ObjectMainLine[]);
        } catch (error) {
            console.error(error);
        }
    }

    const getModelProperties = async () => {
        try {
            // TODO: api
            const propertyMap = await batchSearchObjectAttribute({
                params: {
                    bk_biz_id: currentBusiness?.id,
                    bk_obj_id: { $in: availableModels.map(model => model.bk_obj_id) },
                    // TODO: Get from windown supplier
                    bk_supplier_account: '0'
                },
                config: {
                    requestId: requestConfig.property,
                    fromCache: true
                }
            })
            propertyMap.module.unshift(createServiceTemplateProperty());
            setPropertyMap(Object.freeze(propertyMap));

            const disabledPropertyMap: any = {};
            Object.keys(propertyMap).forEach((objId) => {
                disabledPropertyMap[objId] = propertyMap[objId]
                    .filter((item: Property) => item.bk_property_type === PROPERTY_TYPES.INNER_TABLE)
                    .map((item: Property) => item.bk_property_id)
            })
            setDisabledPropertyMap(disabledPropertyMap);
        } catch (error) {
            console.error(error)
            setPropertyMap({});
        }
    }

    const handlePropertyChange = (newProperties: Property[]) => {
        setSelectedProperties(newProperties);
        // if (!newProperties.length) { setSelectedProperties([]); }

        // const { addSelect, deleteSelect } = getConditionSelect(newProperties, selectedProperties);
        // updatePropertySelect(selectedProperties, addSelect, deleteSelect, setSelectedProperties, 'unshift');
    }

    const handleRemoveProperty = (property: Property) => {
        const newSelectedProperties = selectedProperties.filter(p => p.id !== property.id);
        setSelectedProperties(newSelectedProperties);
    }

    const handleToggleProperty = (property: Property, conditionType: ConditionType) => {
        // Remove the property from selectedProperties
        handleRemoveProperty(property);

        // Set the new condition type
        const newConditionType = exchangeType[conditionType];
        // Create a new property object with the new condition type
        const updatedProperty = { ...property, conditionType: newConditionType };

        // Update the propertyMap with the new condition type
        setPropertyMap(prevPropertyMap => {
            const newPropertyMap = { ...prevPropertyMap };
            const modelProperties = newPropertyMap[property.bk_obj_id];

            if (modelProperties) {
                const targetIdx = modelProperties.findIndex(
                    p => p.bk_property_id === property.bk_property_id
                );
                if (targetIdx > -1) {
                    newPropertyMap[property.bk_obj_id] = [...modelProperties];
                    newPropertyMap[property.bk_obj_id][targetIdx] = {
                        ...modelProperties[targetIdx],
                        conditionType: newConditionType
                    };
                }
            }
            return newPropertyMap;
        });

        // Add the updated property to selectedProperties
        setSelectedProperties(prev => [...prev, updatedProperty]);
    };

    useImperativeHandle(ref, () => ({
        show: () => {
            setIsShow(true);
        },
        hide: () => {
            setIsShow(false);
        }
    }));

    const handleClose = () => {
        setIsShow(false);
        form.resetFields();
        form.setFieldsValue({ groupObject: BUILTIN_MODELS.HOST });
        setVariableConditions({});
        setFixedConditions({});
        setStorageCondition({});
        onClose?.();
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            const formData: DynamicGroupFormData = {
                name: values.groupName,
                bk_obj_id: values.groupObject,
                condition: [],
                variable_condition: []
            };

            console.log('表单数据:', formData);

            onSave?.(formData);
            handleClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer
            title={title}
            open={isShow}
            onClose={handleClose}
            width={1200}
            className="dynamic-group-drawer"
            footer={
                <div style={{ textAlign: 'right' }}>
                    <Space>
                        <Button onClick={handleClose}>取消</Button>
                        <Button type="primary" onClick={handleSubmit} loading={loading}>
                            保存
                        </Button>
                    </Space>
                </div>
            }
        >
            <Row gutter={24}>
                <Col span={14}>
                    <Form
                        form={form}
                        layout="vertical"
                        initialValues={{
                            groupName: '',
                            groupObject
                        }}
                    >
                        <h4>基础信息</h4>
                        <Form.Item
                            label="分组名称"
                            name="groupName"
                            rules={[
                                { required: true, message: '请输入分组名称' },
                                { max: 256 }
                            ]}
                        >
                            <Input placeholder="请输入分组名称" />
                        </Form.Item>

                        <Form.Item
                            label="查询对象"
                            name="groupObject"
                            rules={[{ required: true }]}
                        >
                            <FormTarget
                                value={groupObject}
                                onChange={(value) => { setGroupObject(value) }}
                            />
                        </Form.Item>

                        {conditionTypes.map(conditionType => (
                            <Collapse
                                key={conditionType.key}
                                ghost
                                defaultActiveKey={[conditionType.key]}
                                style={{ marginBottom: 16 }}
                                items={[{
                                    key: conditionType.key,
                                    label: (
                                        <Tooltip title={conditionType.desc} styles={{ root: { maxWidth: 'none' } }}>
                                            <span>{conditionType.title}</span>
                                        </Tooltip>
                                    ),
                                    extra: (
                                        <ConditionPicker
                                            propertyMap={propertyMap!}
                                            models={availableModels}
                                            selected={selectedProperties}
                                            conditionType={conditionType.key}
                                            onPropertyChange={handlePropertyChange}
                                        />
                                    ),
                                    children: (
                                        <FormPropertyList
                                            conditionType={conditionType.key}
                                            models={availableModels}
                                            selectedProperties={selectedProperties}
                                            storageCondition={storageCondition}
                                            onConditionChange={setStorageCondition}
                                            onRemove={handleRemoveProperty}
                                            onToggle={handleToggleProperty}
                                        />
                                    )
                                }]}
                            />
                        ))}
                    </Form>
                </Col>

                <Col span={10}>
                    <Card title="结果预览" size="small" style={{ height: '100%', minHeight: '600px' }}>
                        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                            <Empty
                                description="请先在左侧设置分组条件"
                                style={{ color: '#999' }}
                            />
                        </div>
                    </Card>
                </Col>
            </Row>
        </Drawer>
    );
});

DynamicGroupForm.displayName = 'DynamicGroupForm';

export default DynamicGroupForm;
export type { DynamicGroupFormRef };