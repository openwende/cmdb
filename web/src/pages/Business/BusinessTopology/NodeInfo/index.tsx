import React, { useState } from 'react';
import { Form, Input, Select, Button, Collapse, message } from 'antd';
import { nodeInfo, serviceTemplate, serviceCategoryMock } from '@/mock/business';

const { Panel } = Collapse;
const { Option } = Select;

interface Props {
    selectedNode?: any;
}

const NodeInfo: React.FC<Props> = ({ selectedNode }) => {
    const [form] = Form.useForm();
    const [isEditing, setIsEditing] = useState(false);
    const [selectedServiceCategory, setSelectedServiceCategory] = useState<number>();

    // 获取当前节点信息
    const currentNodeInfo = nodeInfo[0] || {};

    // 获取服务模板名称
    const getServiceTemplateName = (id: number) => {
        const template = serviceTemplate.find(t => t.id === id);
        return template?.name || '--';
    };

    // 获取服务分类名称
    const getServiceCategoryName = (id: number) => {
        const category = serviceCategoryMock.find(c => c.category.id === id);
        return category?.category.name || '--';
    };

    const handleEdit = () => {
        setIsEditing(true);
        form.setFieldsValue({
            bk_module_name: currentNodeInfo.bk_module_name,
            service_template_id: currentNodeInfo.service_template_id,
            service_category_id: currentNodeInfo.service_category_id,
            operator: currentNodeInfo.operator,
            bk_bak_operator: currentNodeInfo.bk_bak_operator
        });
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            console.log('保存数据:', values);
            message.success('保存成功');
            setIsEditing(false);
        } catch (error) {
            console.error('表单验证失败:', error);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        form.resetFields();
    };

    if (isEditing) {
        return (
            <div style={{ background: '#fff', padding: 24 }}>
                <h2>编辑节点</h2>

                <div style={{ marginBottom: 24 }}>
                    <h3>服务分类</h3>
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <Select
                            placeholder="请选择一级分类"
                            style={{ width: 200 }}
                            onChange={(value) => setSelectedServiceCategory(value)}
                        >
                            {serviceCategoryMock
                                .filter(item => item.category.bk_parent_id === 0)
                                .map(item => (
                                    <Option key={item.category.id} value={item.category.id}>
                                        {item.category.name}
                                    </Option>
                                ))
                            }
                        </Select>
                        <Select
                            placeholder="请选择二级分类"
                            style={{ width: 200 }}
                            disabled={!selectedServiceCategory}
                        >
                            {serviceCategoryMock
                                .filter(item => item.category.bk_parent_id === selectedServiceCategory)
                                .map(item => (
                                    <Option key={item.category.id} value={item.category.id}>
                                        {item.category.name}
                                    </Option>
                                ))
                            }
                        </Select>
                    </div>
                </div>

                <Collapse defaultActiveKey={['basic']} ghost>
                    <Panel header="基础信息" key="basic">
                        <Form form={form} layout="vertical">
                            <div style={{ display: 'flex', gap: 16 }}>
                                <Form.Item
                                    label="模块名称"
                                    name="bk_module_name"
                                    rules={[{ required: true, message: '请输入模块名称' }]}
                                    style={{ flex: 1 }}
                                >
                                    <Input placeholder="请输入模块名称" />
                                </Form.Item>
                                <Form.Item
                                    label="模块类型"
                                    name="module_type"
                                    style={{ flex: 1 }}
                                >
                                    <Select placeholder="请选择模块类型">
                                        <Option value="1">普通</Option>
                                        <Option value="2">数据库</Option>
                                    </Select>
                                </Form.Item>
                            </div>

                            <div style={{ display: 'flex', gap: 16 }}>
                                <Form.Item
                                    label="主要维护人"
                                    name="operator"
                                    style={{ flex: 1 }}
                                >
                                    <Input placeholder="请输入主要维护人" />
                                </Form.Item>
                                <Form.Item
                                    label="备份维护人"
                                    name="bk_bak_operator"
                                    style={{ flex: 1 }}
                                >
                                    <Input placeholder="请输入备份维护人" />
                                </Form.Item>
                            </div>
                        </Form>
                    </Panel>
                </Collapse>

                <div style={{ marginTop: 24 }}>
                    <Button type="primary" onClick={handleSave} style={{ marginRight: 8 }}>
                        保存
                    </Button>
                    <Button onClick={handleCancel}>
                        取消
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#fff', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h2>查看节点</h2>
                <Button type="primary" onClick={handleEdit}>
                    编辑
                </Button>
            </div>

            <Collapse defaultActiveKey={['basic']} ghost>
                <Panel header="基础信息" key="basic">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 32px' }}>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>创建时间：</div>
                            <div>{new Date(currentNodeInfo.create_time).toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>创建人：</div>
                            <div>{currentNodeInfo.bk_created_by}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>更新时间：</div>
                            <div>{new Date(currentNodeInfo.last_time).toLocaleString()}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>更新人：</div>
                            <div>{currentNodeInfo.bk_updated_by || '--'}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>模块名称：</div>
                            <div>{currentNodeInfo.bk_module_name}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>模块类型：</div>
                            <div>普通</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>主要维护人：</div>
                            <div>{currentNodeInfo.operator || '--'}</div>
                        </div>
                        <div>
                            <div style={{ color: '#666', marginBottom: 4 }}>备份维护人：</div>
                            <div>{currentNodeInfo.bk_bak_operator || '--'}</div>
                        </div>
                    </div>
                </Panel>
            </Collapse>

            <div style={{ marginTop: 32 }}>
                <h3>服务分类</h3>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    <Select
                        value={getServiceCategoryName(currentNodeInfo.service_category_id)}
                        style={{ width: 200 }}
                        disabled
                    >
                        <Option value="Default">Default</Option>
                    </Select>
                    <Select
                        value="Default"
                        style={{ width: 200 }}
                        disabled
                    >
                        <Option value="Default">Default</Option>
                    </Select>
                </div>

                <h3>服务模板</h3>
                <div style={{ marginBottom: 16 }}>
                    <span>{getServiceTemplateName(currentNodeInfo.service_template_id)}</span>
                </div>

                <div style={{ marginTop: 24 }}>
                    <Button type="primary" onClick={handleEdit}>编辑</Button>
                </div>
            </div>
        </div>
    );
};

export default NodeInfo;
