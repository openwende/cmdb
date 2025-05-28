import React, { useState } from 'react';
import { Radio, Button, Dropdown, Checkbox, Input, message } from 'antd';
import { InstanceMenuItemKey } from '../../Types';
import Instance from './Instance';
import Process from './Process';
import { DownOutlined } from '@ant-design/icons';

interface Props {
    selectedNode?: any;
}

const ServiceInstance: React.FC<Props> = ({ selectedNode }) => {
    const [viewType, setViewType] = useState<'instance' | 'process'>('instance');
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [expandAll, setExpandAll] = useState(false);

    // 实例操作菜单
    const getInstanceMenu = () => ({
        items: [
            { key: InstanceMenuItemKey.BatchDelete, label: '批量删除', disabled: selectedRowKeys.length === 0 },
            { key: InstanceMenuItemKey.CopyIP, label: '复制IP', disabled: selectedRowKeys.length === 0 },
            { key: InstanceMenuItemKey.EditLabel, label: '编辑标签', disabled: selectedRowKeys.length === 0 }
        ]
    });

    const handleInstanceMenuClick = ({ key }: { key: string }) => {
        switch (key) {
            case InstanceMenuItemKey.BatchDelete:
                message.info('批量删除功能');
                break;
            case InstanceMenuItemKey.CopyIP:
                message.info('复制IP功能');
                break;
            case InstanceMenuItemKey.EditLabel:
                message.info('编辑标签功能');
                break;
        }
    };

    const handleExpandAllChange = (checked: boolean) => {
        setExpandAll(checked);
        // 这里可以通过props传递给子组件或使用context
    };

    return (
        <div style={{ background: '#fff', padding: 16 }}>
            {/* 顶部操作栏 */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                {viewType === 'instance' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button type="primary">新增</Button>
                        <Dropdown
                            menu={{
                                ...getInstanceMenu(),
                                onClick: handleInstanceMenuClick
                            }}
                            trigger={['click']}
                        >
                            <Button>
                                实例操作 <DownOutlined />
                            </Button>
                        </Dropdown>
                    </div>) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        <Button type="primary" disabled={selectedRowKeys.length === 0}>编辑</Button>
                        <Button type="primary" disabled={selectedRowKeys.length === 0}>删除</Button>
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <Checkbox
                        checked={expandAll}
                        onChange={(e) => handleExpandAllChange(e.target.checked)}
                    >
                        全部展开
                    </Checkbox>
                    <Input.Search
                        placeholder="请输入关键字"
                        style={{ width: 200 }}
                        onSearch={(value) => message.info(`搜索: ${value}`)}
                    />
                    <Radio.Group value={viewType} onChange={(e) => setViewType(e.target.value)}>
                        <Radio.Button value="instance">实例</Radio.Button>
                        <Radio.Button value="process">进程</Radio.Button>
                    </Radio.Group>
                </div>
            </div>

            {/* 根据视图类型渲染对应组件 */}
            {viewType === 'instance' ? (
                <Instance
                    selectedNode={selectedNode}
                    selectedRowKeys={selectedRowKeys}
                    setSelectedRowKeys={setSelectedRowKeys}
                    expandAll={expandAll}
                    setExpandAll={setExpandAll}
                />
            ) : (
                <Process
                    selectedNode={selectedNode}
                    selectedRowKeys={selectedRowKeys}
                    setSelectedRowKeys={setSelectedRowKeys}
                    expandAll={expandAll}
                    setExpandAll={setExpandAll}
                />
            )}
        </div>
    );
};

export default ServiceInstance; 