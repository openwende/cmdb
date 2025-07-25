import React, { useState } from 'react';
import { Collapse, Button, message, Form, Input, Select, Spin } from 'antd';
import { moduleNodeInfo } from '@/mock/business';
import { userListMock } from '@/mock/resource';
import ServiceCategorySelector from '../../components/ServiceCategory';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import ConfirmModal from '@/components/common/ConfirmModal';
import './style.css';

const { Option } = Select;

interface Props {
    selectedNode: TreeData;
}

const ModuleNodeInfo: React.FC<Props> = ({ selectedNode }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [form] = Form.useForm();
    const [serviceCategory, setServiceCategory] = useState<number[]>([1, 2]); // Default -> Default
    const [formChanged, setFormChanged] = useState(false);
    const [userOptions, setUserOptions] = useState<{ label: string, value: string }[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    
    const moduleData = moduleNodeInfo[0];    // Initialize form when editing starts
    const handleEdit = () => {
        // Convert operator strings to arrays for Select components
        let operators: string[] = [];
        if (moduleData.operator) {
            const opStr = String(moduleData.operator);
            operators = opStr.split(',').filter((op: string) => op.trim() !== '');
        }

        let backupOperators: string[] = [];
        if (moduleData.bk_bak_operator) {
            const backupOpStr = String(moduleData.bk_bak_operator);
            backupOperators = backupOpStr.split(',').filter((op: string) => op.trim() !== '');
        }

        form.setFieldsValue({
            bkModuleName: moduleData.bk_module_name,
            bkModuleType: moduleData.bk_module_type,
            operator: operators,
            bkBakOperator: backupOperators
        });

        setFormChanged(false);
        setIsEditing(true);
    };

    const handleDelete = () => {
        setIsDeleteModalVisible(true);
    };
    
    const confirmDelete = () => {
        // 这里添加实际删除节点的逻辑
        message.success('删除模块节点成功');
        setIsDeleteModalVisible(false);
    };

    // Debounce function for search
    const debounce = (fn: Function, delay: number) => {
        let timer: NodeJS.Timeout;
        return (...args: any[]) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                fn(...args);
            }, delay);
        };
    };

    // Search users with debounce
    const searchUsers = debounce((value: string) => {
        setIsSearching(true);
        // Simulate API call with timeout
        setTimeout(() => {
            if (value.trim() === '') {
                setUserOptions([]);
            } else {
                const filteredUsers = userListMock.filter(
                    user =>
                        user.english_name.toLowerCase().includes(value.toLowerCase()) ||
                        user.chinese_name.includes(value)
                ).map(user => ({
                    label: `${user.chinese_name} (${user.english_name})`,
                    value: user.english_name
                }));
                setUserOptions(filteredUsers);
            }
            setIsSearching(false);
        }, 300);
    }, 300);

    const handleSearch = (value: string) => {
        if (value) {
            searchUsers(value);
        } else {
            setUserOptions([]);
        }
    };

    const handleSave = async () => {
        try {
            const values = await form.validateFields();

            // Join array values into comma-separated strings if needed
            const processedValues = {
                ...values,
                operator: Array.isArray(values.operator) ? values.operator.join(',') : values.operator,
                bkBakOperator: Array.isArray(values.bkBakOperator) ? values.bkBakOperator.join(',') : values.bkBakOperator,
                serviceCategory
            };

            console.log(values, processedValues);
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
                <div className="service-category-wrapper">
                    <div className="category-label">服务分类</div>
                    <ServiceCategorySelector
                        value={serviceCategory}
                        onChange={(value: number[]) => {
                            setServiceCategory(value);
                            setFormChanged(true);
                        }}
                        style={{ width: 400 }}
                    />
                </div>

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
                                        label="模块名称"
                                        name="bkModuleName"
                                        rules={[{ required: true, message: '请输入模块名称' }]}
                                        className="flex-item"
                                    >
                                        <Input
                                            placeholder="请输入模块名称"
                                            onChange={() => setFormChanged(true)}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label="模块类型"
                                        name="bkModuleType"
                                        className="flex-item"
                                    >
                                        <Select
                                            placeholder="请选择模块类型"
                                            onChange={() => setFormChanged(true)}
                                        >
                                            <Option value="1">普通</Option>
                                            <Option value="2">数据库</Option>
                                        </Select>
                                    </Form.Item>
                                </div>
                                <div className="form-row">
                                    <Form.Item
                                        label="主要维护人"
                                        name="operator"
                                        className="flex-item"
                                    >
                                        <Select
                                            mode="multiple"
                                            placeholder="请输入主要维护人"
                                            options={userOptions}
                                            filterOption={false}
                                            showSearch
                                            onSearch={handleSearch}
                                            onChange={() => setFormChanged(true)}
                                            notFoundContent={isSearching ? <Spin size="small" /> : null}
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label="备份维护人"
                                        name="bkBakOperator"
                                        className="flex-item"
                                    >
                                        <Select
                                            mode="multiple"
                                            placeholder="请输入备份维护人"
                                            options={userOptions}
                                            filterOption={false}
                                            showSearch
                                            onSearch={handleSearch}
                                            onChange={() => setFormChanged(true)}
                                            notFoundContent={isSearching ? <Spin size="small" /> : null}
                                            style={{ width: '100%' }}
                                        />
                                    </Form.Item>
                                </div>
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
                title="确定删除 module?"
            />
            
            <div className="info-header">
                <div>服务模板：无</div>
                <div>服务分类：Default / Default</div>
                <div>
                    <span>主机属性自动应用：</span>
                    <Button type="link" className="disabled-link">未启用</Button>
                </div>
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
                                <InfoItem label="创建时间" value={new Date(moduleData.create_time).toLocaleString()} />
                                <InfoItem label="创建人" value={moduleData.bk_created_by} />
                                <InfoItem label="更新时间" value={new Date(moduleData.last_time).toLocaleString()} />
                                <InfoItem label="更新人" value={moduleData.bk_updated_by} />
                                <InfoItem label="ID" value={moduleData.bk_module_id} />
                                <InfoItem label="模块名" value={moduleData.bk_module_name} />
                                <InfoItem label="模块类型" value={moduleData.bk_module_type === "1" ? "普通" : "数据库"} />
                                <InfoItem label="主要维护人" value={moduleData.operator} />
                                <InfoItem label="备份维护人" value={moduleData.bk_bak_operator} />
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

export default ModuleNodeInfo;
