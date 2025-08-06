import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { Drawer, Form, Input, Button, message, Space, Row, Col, Card, Empty, Collapse, Tooltip } from 'antd';
import { DynamicGroupFormData, ObjectMainLine, DGProperty } from '../../Types';
import { availableModelIds, conditionTypes, requestConfig } from '../../constants';
import { PROPERTY_TYPES } from '../../constants';
import FormTarget from './FormTarget';
import ConditionPicker from './ConditionPicker';
import FormPropertyList from './FormPropertyList';
import { getAvailableModels, batchSearchObjectAttribute } from '@/api';
import { useBusinessStore } from '@/store/BusinessStore';
import './style.css';

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
    const [target, setTarget] = useState<'host' | 'set'>('host');
    const [availableModels, setAvailableModels] = useState<readonly ObjectMainLine[]>([]);
    const [propertyMap, setPropertyMap] = useState<Record<string, DGProperty[]>>({});
    const [disabledPropertyMap, setDisabledPropertyMap] = useState<Record<string, string[]>>({});
    // 添加条件状态管理
    const [variableConditions, setVariableConditions] = useState<Record<string, any>>({});
    const [fixedConditions, setFixedConditions] = useState<Record<string, any>>({});

    useEffect(() => {
        getMainLineModels();
        getModelProperties();
    }, [])

    const getMainLineModels = async () => {
        try {
            // TODO: api
            const models = await getAvailableModels();
            // eslint-disable-next-line max-len
            const availableModels = availableModelIds.map(modelId => models.find(model => model.bk_obj_id === modelId));
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
                    bk_supplier_account: 0
                },
                config: {
                    requestId: requestConfig.property,
                    fromCache: true
                }
            })
            propertyMap.module.unshift(getServiceTemplateProperty());
            setPropertyMap(Object.freeze(propertyMap) as any);

            const disabledPropertyMap: any = {};
            Object.keys(propertyMap).forEach((objId) => {
                disabledPropertyMap[objId] = propertyMap[objId]
                    .filter(item => item.bk_property_type === PROPERTY_TYPES.INNER_TABLE)
                    .map(item => item.bk_property_id)
            })
            setDisabledPropertyMap(disabledPropertyMap);
        } catch (error) {
            console.error(error)
            setPropertyMap({});
        }
    }

    const getServiceTemplateProperty = () => {
        return {
            id: Date.now(),
            bk_obj_id: 'module',
            bk_property_id: 'service_template_id',
            bk_property_name: '服务模板',
            bk_property_index: -1,
            bk_property_type: 'service-template',
            isonly: true,
            ispre: true,
            bk_isapi: true,
            bk_issystem: true,
            isreadonly: true,
            editable: false,
            bk_property_group: null,
            _is_inject_: true
        }
    }

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
        setTarget('host');
        form.setFieldsValue({ bk_obj_id: 'host' });
        // 重置条件状态
        setVariableConditions({});
        setFixedConditions({});
        onClose?.();
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const values = await form.validateFields();

            const formData: DynamicGroupFormData = {
                name: values.name,
                bk_obj_id: values.bk_obj_id,
                condition: [],
                variable_condition: []
            };

            console.log('=== 蓝鲸CMDB动态分组保存 ===');
            console.log('表单数据:', formData);

            onSave?.(formData);
            message.success('动态分组保存成功');
            handleClose();
        } catch (error) {
            console.error('提交失败:', error);
            message.error('保存失败');
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
                            name: '',
                            bk_obj_id: target
                        }}
                    >
                        <h4>基础信息</h4>
                        <Form.Item
                            label="分组名称"
                            name="name"
                            rules={[
                                { required: true, message: '请输入分组名称' },
                                { max: 256 }
                            ]}
                        >
                            <Input placeholder="请输入分组名称" />
                        </Form.Item>

                        <Form.Item
                            label="查询对象"
                            name="bk_obj_id"
                            rules={[
                                { required: true, message: '请选择查询对象' }
                            ]}
                            initialValue={target}
                        >
                            <FormTarget
                                value={target}
                                onChange={(value) => {
                                    setTarget(value as 'host' | 'set');
                                    form.setFieldsValue({ bk_obj_id: value });
                                }}
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
                                        <Tooltip title={conditionType.desc} placement="topLeft">
                                            <span>{conditionType.title}</span>
                                        </Tooltip>
                                    ),
                                    extra: (
                                        <ConditionPicker
                                            propertyMap={propertyMap}
                                            models={availableModels}
                                            selected={[]}
                                            conditionType={conditionType.key as any}
                                            handler={(properties) => {
                                                console.log(`添加${conditionType.title}`, properties);
                                            }}
                                        />
                                    ),
                                    children: (
                                        <FormPropertyList
                                            conditionType={conditionType.key as any}
                                            propertyMap={propertyMap}
                                            searchObjId={target}
                                            condition={conditionType.key === 'variable' ? variableConditions : fixedConditions}
                                            onConditionChange={(condition) => {
                                                console.log('条件变化', condition);
                                                if (conditionType.key === 'variable') {
                                                    setVariableConditions(condition);
                                                } else {
                                                    setFixedConditions(condition);
                                                }
                                            }}
                                            onRemove={(property) => {
                                                console.log('移除属性', property);
                                            }}
                                            onToggle={(property, type) => {
                                                console.log('切换条件类型', property, type);
                                            }}
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