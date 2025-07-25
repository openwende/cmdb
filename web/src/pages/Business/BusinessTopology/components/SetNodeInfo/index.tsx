import React, { useState } from 'react';
import { Collapse, Button, message, Form, Input, Select } from 'antd';
import { setNodeInfo } from '@/mock/business';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import ConfirmModal from '@/components/common/ConfirmModal';
import './style.css';

const { Option } = Select;

interface Props {
    selectedNode: TreeData;
}

const SetNodeInfo: React.FC<Props> = ({ selectedNode }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();
    const [formChanged, setFormChanged] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

    const setData = setNodeInfo[0];

    const handleEdit = () => {
        form.setFieldsValue({
            bkSetName: setData.bk_set_name,
            setDesc: setData.bk_set_desc || '',
            bkServiceStatus: setData.bk_service_status,
            bkSetEnv: setData.bk_set_env || '3',
            bkCapacity: setData.bk_capacity,
            bkSetDesc: setData.bk_set_desc || ''
        });
        setFormChanged(false);
        setIsEditing(true);
    };

    const handleDelete = () => {
        setIsDeleteModalVisible(true);
    };

    const confirmDelete = () => {
        // 这里添加实际删除节点的逻辑
        message.success('删除集群节点成功');
        setIsDeleteModalVisible(false);
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            const setProcessedValues = {
                ...values
            };

            console.log(setProcessedValues);
            message.success('保存成功');
            setIsEditing(false);
        } catch (error) {
            console.error('Form validation failed:', error);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setIsEditing(false);
    };

    // Render edit form
    const renderEditForm = () => {
        return (
            <>
                <Collapse
                    defaultActiveKey={['1']}
                    ghost
                    items={[{
                        key: '1',
                        label: <span style={{ fontWeight: 'bold', color: '#000' }}>基础信息</span>,
                        children: (
                            <Form form={form} layout="vertical">
                                <div className="form-row">
                                    <Form.Item
                                        label="集群名称"
                                        name="bkSetName"
                                        rules={[{ required: true, message: '请输入集群名称' }]}
                                        className="flex-item"
                                    >
                                        <Input
                                            placeholder="请输入集群名称"
                                            onChange={() => setFormChanged(true)}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label="集群描述"
                                        name="setDesc"
                                        className="flex-item"
                                    >
                                        <Input
                                            placeholder="请输入集群描述"
                                            onChange={() => setFormChanged(true)}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label="环境类型"
                                        name="bkSetEnv"
                                        className="flex-item"
                                    >
                                        <Select
                                            placeholder="请选择环境类型"
                                            onChange={() => setFormChanged(true)}
                                        >
                                            <Option value="1">测试</Option>
                                            <Option value="2">体验</Option>
                                            <Option value="3">正式</Option>
                                        </Select>
                                    </Form.Item>
                                </div>
                                <div className="form-row">
                                    <Form.Item
                                        label="服务状态"
                                        name="bkServiceStatus"
                                        className="flex-item"
                                    >
                                        <Select
                                            placeholder="请选择服务状态"
                                            onChange={() => setFormChanged(true)}
                                        >
                                            <Option value="1">开放</Option>
                                            <Option value="2">关闭</Option>
                                        </Select>
                                    </Form.Item>
                                    <Form.Item
                                        label="设计容量"
                                        name="bkCapacity"
                                        className="flex-item"
                                    >
                                        <Input
                                            placeholder="请输入设计容量"
                                            onChange={() => setFormChanged(true)}
                                        />
                                    </Form.Item>
                                </div>
                                <Form.Item
                                    label="备注"
                                    name="bkSetDesc"
                                    className="description-item"
                                >
                                    <Input.TextArea
                                        placeholder="请输入备注"
                                        onChange={() => setFormChanged(true)}
                                    />
                                </Form.Item>
                            </Form>
                        ),
                    }]}
                />

                <div className="action-buttons">
                    <Button
                        type="primary"
                        onClick={handleSave}
                        disabled={!formChanged}
                    >
                        保存
                    </Button>
                    <Button onClick={handleCancel}>
                        取消
                    </Button>
                </div>
            </>
        );
    };

    // Return edit form if in editing mode
    if (isEditing) {
        return <div className="node-info-container">{renderEditForm()}</div>;
    }

    // Otherwise, return info view
    return (
        <>
            <ConfirmModal
                visible={isDeleteModalVisible}
                onOk={confirmDelete}
                onCancel={() => setIsDeleteModalVisible(false)}
                title="确定删除 set?"
            />
        
            <div className="info-header">
                <div>集群模板：无</div>
            </div>

            <Collapse
                defaultActiveKey={['1']}
                ghost
                items={[
                    {
                        key: '1',
                        label: <span style={{ fontWeight: 'bold', color: '#000' }}>基础信息</span>,
                        children: (
                            <div className="info-grid">
                                <InfoItem label="创建时间" value={new Date(setData.create_time).toLocaleString()} />
                                <InfoItem label="创建人" value={setData.bk_created_by} />
                                <InfoItem label="更新时间" value={new Date(setData.last_time).toLocaleString()} />
                                <InfoItem label="更新人" value={setData.bk_updated_by} />
                                <InfoItem label="ID" value={setData.bk_set_id} />
                                <InfoItem label="集群名" value={setData.bk_set_name} />
                                <InfoItem label="集群描述" value={setData.bk_set_desc} />
                                <InfoItem label="环境类型" value={setData.bk_set_env === "3" ? "正式" : "测试"} />
                                <InfoItem label="服务状态" value={setData.bk_service_status === "1" ? "开放" : "关闭"} />
                                <InfoItem label="备注" value={setData.description} />
                                <InfoItem label="设计容量" value={setData.bk_capacity} />
                            </div>
                        )
                    }
                ]}
            />

            <div className="action-buttons">
                <Button type="primary" onClick={handleEdit}>
                    编辑
                </Button>
                <Button type="primary" danger onClick={handleDelete}>
                    删除节点
                </Button>
            </div>
        </>
    );
};

export default SetNodeInfo;
