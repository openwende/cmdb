import React, { useState } from 'react';
import { Form, Input, Select, Button, Collapse, message, CollapseProps } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { nodeInfo } from '@/mock/business';
import ServiceCategorySelector from '../components/ServiceCategory';
import { TreeData } from '../../Types';

const { Option } = Select;

interface Props {
    selectedNodes: TreeData[];
}

const NodeInfo: React.FC<Props> = ({ selectedNodes }) => {
    const [form] = Form.useForm();
    const [isEditing, setIsEditing] = useState(false);
    const [serviceCategory, setServiceCategory] = useState<number[]>([]);

    // 获取当前节点信息
    const currentNodeInfo = nodeInfo[0] || {};

    // 复制功能
    const handleCopy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            message.success(`${label}复制成功`);
        } catch (error) {
            message.error('复制失败');
        }
    };

    const handleEdit = () => {
        setIsEditing(true);
        form.setFieldsValue({
            bk_module_name: currentNodeInfo.bk_module_name,
            module_type: '普通',
            operator: currentNodeInfo.operator,
            bk_bak_operator: currentNodeInfo.bk_bak_operator
        });
        // 设置默认的服务分类值
        setServiceCategory([1, 2]); // Default -> Default
    };

    const handleDelete = () => {
        message.success('删除成功')
    }

    const handleSave = async () => {
        try {
            const values = await form.validateFields();
            console.log('保存数据:', { ...values, serviceCategory });
            message.success('保存成功');
            setIsEditing(false);
        } catch (error) {
            console.error('表单验证失败:', error);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        form.resetFields();
        setServiceCategory([]);
    };

    // The component of the information item, support hover to show the copy icon
    const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => {
        const [isHovered, setIsHovered] = useState(false);

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ color: '#666', marginBottom: 4 }}>{label}：</div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        position: 'relative'
                    }}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <span>{value}</span>
                    {isHovered && (
                        <CopyOutlined
                            style={{
                                cursor: 'pointer',
                                color: '#1890ff',
                                fontSize: 12
                            }}
                            onClick={() => handleCopy(value, label)}
                        />
                    )}
                </div>
            </div>
        );
    };

    const normalCollapseItems: CollapseProps['items'] = [
        {
            key: '1',
            label: '基础信息',
            children: <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px 32px' }}>
                    <InfoItem
                        label="创建时间"
                        value={new Date(currentNodeInfo.create_time).toLocaleString()}
                    />
                    <InfoItem
                        label="创建人"
                        value={currentNodeInfo.bk_created_by}
                    />
                    <InfoItem
                        label="更新时间"
                        value={new Date(currentNodeInfo.last_time).toLocaleString()}
                    />
                    <InfoItem
                        label="更新人"
                        value={currentNodeInfo.bk_updated_by || '--'}
                    />
                    <InfoItem
                        label="ID"
                        value={currentNodeInfo.bk_module_id?.toString() || '15'}
                    />
                    <InfoItem
                        label="主要维护人"
                        value={currentNodeInfo.operator || '--'}
                    />
                    <InfoItem
                        label="模块名"
                        value={currentNodeInfo.bk_module_name}
                    />
                    <InfoItem
                        label="模块类型"
                        value="普通"
                    />
                    <InfoItem
                        label="备份维护人"
                        value={currentNodeInfo.bk_bak_operator || '--'}
                    />
                </div>
            </>
        }
    ]

    const editCollapseItems: CollapseProps['items'] = [
        {
            key: '1',
            label: '基础信息',
            children: <>
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
                                <Option value="普通">普通</Option>
                                <Option value="数据库">数据库</Option>
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
            </>,
        }
    ]

    if (isEditing) {
        return (
            <div style={{ background: '#fff', padding: 24 }}>
                <div style={{ marginBottom: 60 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>服务分类</div>
                    <ServiceCategorySelector
                        value={serviceCategory}
                        onChange={(value) => setServiceCategory(value)}
                        style={{ width: 400 }}
                    />
                </div>
                <Collapse defaultActiveKey={['1']} ghost items={editCollapseItems} />
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
                <div style={{ marginBottom: 8 }}>服务模板：无</div>
                <div style={{ marginBottom: 8 }}>服务分类：Default / Default</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span>主机属性自动应用：</span>
                    <Button type="link" style={{ padding: 0 }}>未启用</Button>
                </div>
            </div>
            <Collapse defaultActiveKey={['1']} ghost items={normalCollapseItems} />
            <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
                <Button type="primary" onClick={handleEdit}>
                    编辑
                </Button>
                <Button type="primary" danger onClick={handleDelete}>
                    删除节点
                </Button>
            </div>
        </div>
    );
};

export default NodeInfo;
