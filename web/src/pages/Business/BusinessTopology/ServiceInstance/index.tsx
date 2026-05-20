import React, { useEffect, useMemo, useState } from 'react';
import { Radio, Button, Dropdown, Checkbox, Input, message, Empty, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { InstanceMenuItemKey, TreeData } from '../../Types';
import { getSelectedNodeStatus } from '../../utils';
import Instance from './Instance';
import Process from './Process';
import { DownOutlined } from '@ant-design/icons';
import { useInstanceSceneStore } from '@/store/InstanceSceneStore';
import './style.css';

interface Props {
  selectedNode: TreeData;
  view?: 'instance' | 'process';
  setView?: (v: 'instance' | 'process') => void;
}

const ServiceInstance: React.FC<Props> = ({ selectedNode, view = 'instance', setView }) => {
  const { t } = useTranslation();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [expandAll, setExpandAll] = useState(false);
  const resetInstanceScene = useInstanceSceneStore((state) => state.reset);

  const dropdownMenuItems = {
    items: [
      {
        key: InstanceMenuItemKey.BatchDelete,
        label: t('business.topology.serviceInstance.menu.batchDelete'),
      },
      {
        key: InstanceMenuItemKey.CopyIP,
        label: t('business.topology.serviceInstance.menu.copyIP'),
      },
      {
        key: InstanceMenuItemKey.EditLabel,
        label: t('business.topology.serviceInstance.menu.editLabel'),
      },
    ],
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

  useEffect(() => {
    resetInstanceScene();
  }, [resetInstanceScene, selectedNode?.key]);

  return (
    <div className="service-instance-wrapper">
      <div className="service-instance-surface">
        {selectedNodeStatus.isModule ? (
          <>
            {/* Top action bar */}
            <div className="service-instance-toolbar">
              {view === 'instance' ? (
                <div className="service-instance-actions">
                  <Button type="primary">
                    {t('business.topology.serviceInstance.buttons.add')}
                  </Button>
                  <Dropdown
                    menu={{
                      ...dropdownMenuItems,
                      disabled: selectedRowKeys.length === 0,
                      onClick: handleInstanceMenuClick,
                    }}
                    trigger={['click']}
                  >
                    <Button>
                      {t('business.topology.serviceInstance.buttons.instanceOperation')}{' '}
                      <DownOutlined />
                    </Button>
                  </Dropdown>
                </div>
              ) : (
                <div className="service-instance-actions">
                  <Button type="primary" disabled={selectedRowKeys.length === 0}>
                    {t('business.topology.serviceInstance.buttons.edit')}
                  </Button>
                  <Button type="primary" disabled={selectedRowKeys.length === 0}>
                    {t('business.topology.serviceInstance.buttons.delete')}
                  </Button>
                </div>
              )}

              <div className="service-instance-controls">
                <Checkbox checked={expandAll} onChange={(e) => setExpandAll(e.target.checked)}>
                  {t('business.topology.serviceInstance.controls.expandAll')}
                </Checkbox>
                <Input.Search
                  placeholder={t('business.topology.serviceInstance.controls.searchPlaceholder')}
                  style={{ width: 200 }}
                  onSearch={(value) =>
                    message.info(
                      t('business.topology.serviceInstance.messages.searchKeyword', {
                        keyword: value,
                      }),
                    )
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
          </>
        ) : (
          <Empty
            className="service-instance-empty"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <Typography.Text>
                {t('business.topology.serviceInstance.empty.nonBusinessModule')}
              </Typography.Text>
            }
          />
        )}
      </div>
    </div>
  );
};

export default ServiceInstance;
