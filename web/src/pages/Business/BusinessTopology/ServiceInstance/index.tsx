import React, { useState, useMemo } from 'react';
import { Radio, Button, Dropdown, Checkbox, Input, message, Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { InstanceMenuItemKey, TreeData } from '../../Types';
import { getSelectedNodeStatus } from '../../utils';
import Instance from './Instance';
import Process from './Process';
import { DownOutlined } from '@ant-design/icons';

interface Props {
    selectedNode: TreeData;
    view?: 'instance' | 'process';
    setView?: (v: 'instance' | 'process') => void;
}

const ServiceInstance: React.FC<Props> = ({ selectedNode, view = 'instance', setView }) => {
    const { t } = useTranslation();
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [expandAll, setExpandAll] = useState(false);

    const dropdownMenuItems = {
        items: [
            {
                key: InstanceMenuItemKey.BatchDelete,
                label: t('business.topology.serviceInstance.menu.batchDelete')
            },
            {
                key: InstanceMenuItemKey.CopyIP,
                label: t('business.topology.serviceInstance.menu.copyIP')
            },
            {
                key: InstanceMenuItemKey.EditLabel,
                label: t('business.topology.serviceInstance.menu.editLabel')
            }
        ]
    };

    const selectedNodeStatus = useMemo(() => {
        return getSelectedNodeStatus([selectedNode]);
    }, [selectedNode]);

    const handleInstanceMenuClick = ({ key }: { key: string }) => {
        switch (key) {
            case InstanceMenuItemKey.BatchDelete:
                message.info(t('business.topology.serviceInstance.messages.batchDelete'));
                break;
            case InstanceMenuItemKey.CopyIP:
                message.info(t('business.topology.serviceInstance.messages.copyIP'));
                break;
            case InstanceMenuItemKey.EditLabel:
                message.info(t('business.topology.serviceInstance.messages.editLabel'));
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
                                    <Button type="primary">
                                        {t('business.topology.serviceInstance.buttons.add')}
                                    </Button>
                                    <Dropdown
                                        menu={{
                                            ...dropdownMenuItems,
                                            disabled: selectedRowKeys.length === 0,
                                            onClick: handleInstanceMenuClick
                                        }}
                                        trigger={['click']}
                                    >
                                        <Button>
                                            {t('business.topology.serviceInstance.buttons.instanceOperation')} <DownOutlined />
                                        </Button>
                                    </Dropdown>
                                </div>) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <Button type="primary" disabled={selectedRowKeys.length === 0}>
                                        {t('business.topology.serviceInstance.buttons.edit')}
                                    </Button>
                                    <Button type="primary" disabled={selectedRowKeys.length === 0}>
                                        {t('business.topology.serviceInstance.buttons.delete')}
                                    </Button>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <Checkbox
                                    checked={expandAll}
                                    onChange={(e) => setExpandAll(e.target.checked)}
                                >
                                    {t('business.topology.serviceInstance.controls.expandAll')}
                                </Checkbox>
                                <Input.Search
                                    placeholder={t('business.topology.serviceInstance.controls.searchPlaceholder')}
                                    style={{ width: 200 }}
                                    onSearch={
                                        (value) => message.info(t('business.topology.serviceInstance.messages.searchKeyword',
                                            { keyword: value }))
                                    }
                                />
                                <Radio.Group value={view} onChange={(e) => setView && setView(e.target.value)}>
                                    <Radio.Button value="instance">
                                        {t('business.topology.serviceInstance.views.instance')}
                                    </Radio.Button>
                                    <Radio.Button value="process">
                                        {t('business.topology.serviceInstance.views.process')}
                                    </Radio.Button>
                                </Radio.Group>
                            </div>
                        </div>

                        {/* Render the corresponding component based on the view type */}
                        {view === 'instance' ? (
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
                ) : (
                    <Empty
                        className='empty-wrapper'
                        description={
                            <Typography.Text>
                                {t('business.topology.serviceInstance.empty.nonBusinessModule')}
                            </Typography.Text>
                        }
                    />
                )
            }
        </>
    );
};

export default ServiceInstance; 