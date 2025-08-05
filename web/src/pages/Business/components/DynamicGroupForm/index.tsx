import { forwardRef, useImperativeHandle, useState } from 'react';
import {
    Drawer,
    Form,
    Input,
    Button,
    message,
    Space,
    Row,
    Col,
    Card,
    Empty,
    Collapse,
    Tooltip
} from 'antd';
import { DynamicGroupFormData } from '../../Types';
import FormTarget from './FormTarget';
import ConditionPicker from './ConditionPicker';
import FormPropertyList from './FormPropertyList';
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
    const [form] = Form.useForm();
    const [isShow, setIsShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [target, setTarget] = useState<'host' | 'set'>('host');

    // 条件类型配置
    const conditionTypes = [
        {
            key: 'variable',
            title: '可变条件',
            desc: '在使用动态分组时，操作符和条件值可修改'
        },
        {
            key: 'fixed',
            title: '锁定条件',
            desc: '在使用动态分组时，条件及条件值均不可修改'
        }
    ];

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
                                            propertyMap={{}}
                                            models={[]}
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
                                            properties={[]}
                                            modelMap={{}}
                                            searchObjId={target}
                                            condition={{}}
                                            onConditionChange={(condition) => {
                                                console.log('条件变化', condition);
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