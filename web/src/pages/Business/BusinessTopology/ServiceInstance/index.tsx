import React, { useState, useMemo } from 'react';
import { Radio, Button, Dropdown, Checkbox, Input, message, Empty, Typography } from 'antd';
import { InstanceMenuItemKey, TreeData } from '../../Types';
import { getSelectedNodeStatus } from '../../utils';
import Instance from './Instance';
import Process from './Process';
import { DownOutlined } from '@ant-design/icons';

interface Props {
    selectedNodes: TreeData[];
    view?: 'instance' | 'process';
    setView?: (v: 'instance' | 'process') => void;
}

const dropdownMenuItems = {
    items: [
        { key: InstanceMenuItemKey.BatchDelete, label: '批量删除' },
        { key: InstanceMenuItemKey.CopyIP, label: '复制IP' },
        { key: InstanceMenuItemKey.EditLabel, label: '编辑标签' }
    ]
};

const ServiceInstance: React.FC<Props> = ({ selectedNodes, view = 'instance', setView }) => {
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [expandAll, setExpandAll] = useState(false);

    const selectedNodeStatus = useMemo(() => {
        return getSelectedNodeStatus(selectedNodes);
    }, [selectedNodes]);

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

    return (
        <>
            {
                selectedNodeStatus.isModule ? (
                    <div style={{ background: '#fff', padding: 16 }}>
                        {/* Top action bar */}
                        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                            {view === 'instance' ? (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Button type="primary">新增</Button>
                                    <Dropdown
                                        menu={{
                                            ...dropdownMenuItems,
                                            disabled: selectedRowKeys.length === 0,
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
                                    onChange={(e) => setExpandAll(e.target.checked)}
                                >
                                    全部展开
                                </Checkbox>
                                <Input.Search
                                    placeholder="请输入关键字"
                                    style={{ width: 200 }}
                                    onSearch={(value) => message.info(`搜索: ${value}`)}
                                />
                                <Radio.Group value={view} onChange={(e) => setView && setView(e.target.value)}>
                                    <Radio.Button value="instance">实例</Radio.Button>
                                    <Radio.Button value="process">进程</Radio.Button>
                                </Radio.Group>
                            </div>
                        </div>

                        {/* Render the corresponding component based on the view type */}
                        {view === 'instance' ? (
                            <Instance
                                selectedNode={selectedNodes[0]}
                                selectedRowKeys={selectedRowKeys}
                                setSelectedRowKeys={setSelectedRowKeys}
                                expandAll={expandAll}
                                setExpandAll={setExpandAll}
                            />
                        ) : (
                            <Process
                                selectedNode={selectedNodes[0]}
                                selectedRowKeys={selectedRowKeys}
                                setSelectedRowKeys={setSelectedRowKeys}
                                expandAll={expandAll}
                                setExpandAll={setExpandAll}
                            />
                        )}
                    </div>
                ) : (
                    <Empty
                        className='empty-wrapper'
                        description={<Typography.Text>非业务模块，无服务实例，请选择业务模块查看</Typography.Text>}
                    />
                )
            }
        </>
    );
};

export default ServiceInstance; 