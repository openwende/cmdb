import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import {
  Button,
  Table,
  Collapse,
  Tabs,
  TabsProps,
  Space,
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useTransferHostStore } from '@/store/TransferHostStore';
import AddHostModal from '../components/AddHostModal';
import AddProcessModal, { ListenInfo } from '../components/AddProcessModal';
import './style.css';
import {
  AppendMenuItemKey,
  TransferHostItem,
  TransferMenuItemType,
  TreeData,
  RemoveMenuItemKey,
} from '@/pages/Business/Types';
import { useNavigate } from 'react-router-dom';
import { getBusinessTopologyPath, getBusinessIdFromUrl } from '../../../../utils/routes';
import TransferHostModal from '../components/TransferHostModal';
import { transferTopologyHosts, transferTopologyHostsToPool } from '@/api/services/business';

export interface ProcessItem {
  id: string;
  processName: string;
  processAlias: string;
  startupParams?: string;
  bindInfo: ListenInfo[];
  [key: string]: any;
}

interface ServiceInstanceItem {
  id: string;
  name: string;
  bk_module_id?: string | number;
}

const TransferHost: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedHosts, targetModules, transferHostType, sourceModuleId, setTransferHostData } =
    useTransferHostStore();
  const [showEditHostModal, setShowEditHostModal] = useState(false);
  const [showAddProcessModal, setShowAddProcessModal] = useState(false);
  const [hostProcessMap, setHostProcessMap] = useState<Record<string, ProcessItem[]>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingProcess, setEditingProcess] = useState<ProcessItem | null>(null);
  const [processModalMode, setProcessModalMode] = useState<'add' | 'edit'>('add');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [optionsSticky, setOptionsSticky] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const isRemoveFromCurrent = transferHostType === RemoveMenuItemKey.CurrentModule;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    // Track if the sentinelRef element enters/leaves the viewport
    // Determine whether the bottom button is in a sticky/pinned state based on this
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      setOptionsSticky(!entry.isIntersecting);
    });
    observer.observe(sentinel);
    // Disconnect the observer on component unmount to avoid memory leaks
    return () => observer.disconnect();
  }, []);

  const selectedTopoPaths = useMemo(
    () =>
      targetModules.map((module) =>
        [...(module.parentPath || []), String(module.title)].join(' / '),
      ),
    [targetModules],
  );

  const formatBindInfoText = (bindInfo: ListenInfo[]) =>
    bindInfo
      .filter((i) => i.protocol && i.ip && i.port)
      .map((i) => `${i.protocol} ${i.ip}:${i.port}`);

  const assertTransferResult = (response: any) => {
    const result = response?.data?.data;
    if (result?.failed > 0) {
      throw new Error(
        result.errors?.[0] || t('business.topology.transferHost.messages.transferFailed'),
      );
    }
  };

  const getTransferErrorMessage = (error: unknown) => {
    const fallback = t('business.topology.transferHost.messages.transferFailed');
    if (typeof error === 'object' && error !== null && 'response' in error) {
      const response = (error as { response?: { data?: { error?: string } } }).response;
      if (response?.data?.error) {
        return response.data.error;
      }
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  };

  const handleConfirm = async () => {
    const hostIDs = selectedHosts.map((host) => String(host.id));

    if (hostIDs.length === 0) {
      backToPrePage();
      return;
    }

    try {
      if (
        transferHostType === TransferMenuItemType.idlePool ||
        transferHostType === RemoveMenuItemKey.CurrentModule
      ) {
        const response = await transferTopologyHostsToPool({ host_ids: hostIDs });
        assertTransferResult(response);
        message.success(t('business.topology.transferHost.messages.transferSuccess'));
        backToPrePage();
        return;
      }

      const transferGroups = selectedHosts.reduce((groups, host) => {
        const hostSourceModuleId = host.sourceModuleId || sourceModuleId;
        const groupKey =
          transferHostType === TransferMenuItemType.businessModule && hostSourceModuleId
            ? hostSourceModuleId
            : 0;
        const nextHosts = groups.get(groupKey) || [];
        nextHosts.push(String(host.id));
        groups.set(groupKey, nextHosts);
        return groups;
      }, new Map<number, string[]>());

      for (const module of targetModules) {
        const targetModuleID = Number(module.nodeId || module.key.split('-')[1]);
        if (!targetModuleID) {
          continue;
        }

        for (const [groupSourceModuleId, groupHostIDs] of transferGroups) {
          const payload: {
            host_ids: string[];
            target_module_id: number;
            source_module_id?: number;
          } = {
            host_ids: groupHostIDs,
            target_module_id: targetModuleID,
          };
          if (transferHostType === TransferMenuItemType.businessModule && groupSourceModuleId) {
            payload.source_module_id = groupSourceModuleId;
          }

          const response = await transferTopologyHosts(payload);
          assertTransferResult(response);
        }
      }

      message.success(t('business.topology.transferHost.messages.transferSuccess'));
      backToPrePage();
    } catch (error) {
      console.error('Failed to confirm topology host transfer:', error);
      message.error(getTransferErrorMessage(error));
    }
  };

  const handleCancel = () => {
    backToPrePage();
  };

  const backToPrePage = () => {
    // Navigate back to the previous page
    const businessId = getBusinessIdFromUrl();
    if (businessId) {
      const topoPath = getBusinessTopologyPath(businessId);
      navigate(topoPath + window.location.search, { replace: true });
    }
  };

  const handleEditHosts = () => {
    setShowEditHostModal(true);
  };

  const handleConfirmEditHosts = useCallback(
    (hosts: TransferHostItem[]) => {
      const sourceModuleByHost = new Map(
        selectedHosts.map((host) => [String(host.id), host.sourceModuleId]),
      );
      const hostsWithSource = hosts.map((host) => ({
        ...host,
        sourceModuleId: host.sourceModuleId || sourceModuleByHost.get(String(host.id)),
      }));
      setTransferHostData(hostsWithSource, targetModules, transferHostType, sourceModuleId);
      setShowEditHostModal(false);
    },
    [selectedHosts, sourceModuleId, targetModules, transferHostType],
  );

  const getProcessKey = useCallback(
    (moduleKey: React.Key, hostId: string) => `${moduleKey}-${hostId}`,
    [],
  );

  const handleAddProcess = (moduleKey: React.Key, hostId: string) => {
    setEditingKey(getProcessKey(moduleKey, hostId));
    setEditingProcess(null);
    setProcessModalMode('add');
    setShowAddProcessModal(true);
  };

  const handleEditProcess = (moduleKey: React.Key, hostId: string, process: ProcessItem) => {
    setEditingKey(getProcessKey(moduleKey, hostId));
    setEditingProcess(process);
    setProcessModalMode('edit');
    setShowAddProcessModal(true);
  };

  const handleDeleteProcess = (moduleKey: React.Key, hostId: string, process: ProcessItem) => {
    setHostProcessMap((prev) => {
      const key = getProcessKey(moduleKey, hostId);
      const list = prev[key] || [];
      return { ...prev, [key]: list.filter((item) => item.id !== process.id) };
    });
  };

  const handleConfirmAddProcess = useCallback(
    (process: ProcessItem) => {
      if (!editingKey) return;
      const mapKey = editingKey;
      setHostProcessMap((prev) => {
        const list = prev[mapKey] || [];
        if (processModalMode === 'add') {
          return { ...prev, [mapKey]: [...list, { ...process, id: Date.now().toString() }] };
        }
        // edit mode
        return {
          ...prev,
          [mapKey]: list.map((item) => (item.id === process.id ? process : item)),
        };
      });
      setShowAddProcessModal(false);
    },
    [editingKey, processModalMode],
  );

  const handleTransferNode = useCallback(
    (selectedNodes: TreeData[]) => {
      setTransferHostData(selectedHosts, selectedNodes, transferHostType, sourceModuleId);
    },
    [selectedHosts, sourceModuleId, transferHostType],
  );

  const handleServiceInstances = (): ServiceInstanceItem[] => {
    return [];
  };

  // Calculate the list of hosts to be added for each target module
  const hostsToAddByModule = useMemo(() => {
    const map: Record<string, TransferHostItem[]> = {};
    targetModules.forEach((mod) => {
      map[mod.key] = selectedHosts;
    });
    return map;
  }, [targetModules, selectedHosts]);

  const hasChanges = useMemo(() => {
    return Object.values(hostsToAddByModule).some((list) => list.length > 0);
  }, [hostsToAddByModule]);

  const shouldShowDelTab = useMemo(() => {
    return (
      transferHostType !== AppendMenuItemKey.AppendToBusinessModule &&
      handleServiceInstances().length > 0
    );
  }, [transferHostType, handleServiceInstances]);

  // Hosts that will be moved to idle (only exist in current module)
  const hostsCanMoveToIdle = useMemo(() => {
    if (!isRemoveFromCurrent || targetModules.length === 0) return [] as TransferHostItem[];
    return selectedHosts;
  }, [isRemoveFromCurrent, targetModules, selectedHosts]);

  const shouldShowMoveIdleTab = isRemoveFromCurrent && hostsCanMoveToIdle.length > 0;
  const isConfirmBtnAvailable =
    transferHostType === TransferMenuItemType.idlePool ||
    transferHostType === RemoveMenuItemKey.CurrentModule
      ? true
      : hasChanges;
  const availableListenIpOptions = useMemo(
    () => selectedHosts.map((host) => host.ip),
    [selectedHosts],
  );

  const columns = [
    {
      title: t('business.topology.transferHost.columns.processName'),
      dataIndex: 'processName',
      key: 'processName',
    },
    {
      title: t('business.topology.transferHost.columns.processAlias'),
      dataIndex: 'processAlias',
      key: 'processAlias',
    },
    {
      title: t('business.topology.transferHost.columns.startupParams'),
      dataIndex: 'startupParams',
      key: 'startupParams',
      render: (val: string) => {
        return val || '--';
      },
    },
    {
      title: t('business.topology.transferHost.columns.bindInfo'),
      dataIndex: 'bindInfo',
      key: 'bindInfo',
      render: (bindInfo: ListenInfo[]) => {
        if (!Array.isArray(bindInfo) || bindInfo.length === 0) return '--';
        const items = formatBindInfoText(bindInfo);
        if (items.length === 0) return '--';
        return (
          <Tooltip
            title={<div style={{ whiteSpace: 'pre-line' }}>{items.join('\n')}</div>}
            placement="top"
          >
            <span>
              {items.join(', ')}
              <span className="bind-number">{items.length}</span>
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: t('business.topology.transferHost.columns.action'),
      key: 'action',
    },
  ];

  const renderAddInst = () => {
    return (
      <div className="add-inst-wrapper">
        <Space className="tip-text">
          <InfoCircleOutlined />
          {t('business.topology.transferHost.tips.addInstanceTip')}
        </Space>
        {targetModules.map((module) => {
          const hostsForModule = hostsToAddByModule[module.key] || [];
          if (hostsForModule.length === 0) return null;
          const topoPath = [...(module.parentPath || []), String(module.title)].join(' / ');
          return (
            <div key={module.key} className="module-section">
              {hostsForModule.map((host: TransferHostItem, index: number) => (
                <Collapse
                  className={index !== 0 ? 'inst-panel' : undefined}
                  key={`${module.key}-${host.id}`}
                  items={[
                    {
                      key: `${module.key}-${host.id}`,
                      label: (
                        <div className="host-header">
                          <span>{host.ip}</span>
                          <span className="status-text">
                            {(hostProcessMap[getProcessKey(module.key, String(host.id))]?.length ||
                              0) === 0
                              ? t('business.topology.transferHost.status.noProcessAdded')
                              : null}
                          </span>
                        </div>
                      ),
                      extra: topoPath,
                      children: (
                        <div className="host-content">
                          <Table
                            columns={columns.map((col) =>
                              col.key === 'action'
                                ? {
                                    ...col,
                                    render: (_: any, record: ProcessItem) => (
                                      <>
                                        <Button
                                          type="link"
                                          size="small"
                                          onClick={() =>
                                            handleEditProcess(module.key, String(host.id), record)
                                          }
                                        >
                                          {t('common.edit')}
                                        </Button>
                                        <Popconfirm
                                          title={t(
                                            'business.topology.transferHost.confirmDelete.title',
                                          )}
                                          onConfirm={() =>
                                            handleDeleteProcess(module.key, String(host.id), record)
                                          }
                                          okText={t('common.confirm')}
                                          cancelText={t('common.cancel')}
                                        >
                                          <Button type="link" danger size="small">
                                            {t('common.delete')}
                                          </Button>
                                        </Popconfirm>
                                      </>
                                    ),
                                  }
                                : col,
                            )}
                            dataSource={
                              hostProcessMap[getProcessKey(module.key, String(host.id))] || []
                            }
                            pagination={false}
                            size="small"
                            rowKey="id"
                          />
                          <div className="add-button">
                            <Button
                              type="link"
                              onClick={() => handleAddProcess(module.key, String(host.id))}
                            >
                              + {t('business.topology.transferHost.buttons.addProcess')}
                            </Button>
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />
              ))}
            </div>
          );
        })}
      </div>
    );
  };

  const renderDelInst = () => {
    const serviceInstances = handleServiceInstances();
    const tableData = serviceInstances.map((inst) => ({
      id: inst.id,
      name: inst.name,
      module: '',
    }));
    return (
      <>
        <Space className="tip-text">
          <InfoCircleOutlined />
          {t('business.topology.transferHost.tips.deleteInstanceTip')}
        </Space>
        <Table
          columns={[
            {
              title: t('business.topology.transferHost.columns.action'),
              dataIndex: 'action',
              render: () => <span className="del-action">{t('common.delete')}</span>,
            },
            {
              title: t('business.topology.transferHost.columns.serviceInstance'),
              dataIndex: 'name',
            },
            {
              title: t('business.topology.transferHost.columns.belongingModule'),
              dataIndex: 'module',
            },
          ]}
          dataSource={tableData}
          rowKey="id"
          pagination={false}
        />
      </>
    );
  };

  const renderMoveIdleHosts = () => {
    const tableData = hostsCanMoveToIdle.map((h) => ({
      id: h.id,
      ip: h.ip,
      region: h.cloudInfo || '',
    }));
    return (
      <>
        <Space className="tip-text">
          <InfoCircleOutlined />
          {t('business.topology.transferHost.tips.moveToIdleTip')}
        </Space>
        <Table
          columns={[
            {
              title: t('business.topology.transferHost.columns.action'),
              dataIndex: 'action',
              render: () => <span>{t('business.topology.transferHost.actions.moveToIdle')}</span>,
            },
            { title: 'IP', dataIndex: 'ip' },
            { title: t('business.topology.transferHost.columns.cloudArea'), dataIndex: 'region' },
          ]}
          dataSource={tableData}
          rowKey="id"
          pagination={false}
        />
      </>
    );
  };

  const renderEmpty = () => {
    return (
      <div className="empty-wrapper">
        <Space className="tip-text">
          <InfoCircleOutlined />
          &nbsp;
          {t('business.topology.transferHost.messages.noChangeInfo')}
        </Space>
      </div>
    );
  };

  const delTabItems: TabsProps['items'] = [
    {
      key: 'delInst',
      label: (
        <span className="del-label">
          {t('business.topology.transferHost.tabs.deleteServiceInstance')}
          <span className="inst-count">{handleServiceInstances().length}</span>
        </span>
      ),
      children: renderDelInst(),
    },
    ...(shouldShowMoveIdleTab
      ? [
          {
            key: 'moveIdle',
            label: (
              <span className="del-label">
                {t('business.topology.transferHost.tabs.moveToIdleHost')}
                <span className={`inst-count red-count`}>{hostsCanMoveToIdle.length}</span>
              </span>
            ),
            children: renderMoveIdleHosts(),
          },
        ]
      : []),
  ];

  const addTabItems: TabsProps['items'] = [
    {
      key: 'addInst',
      label: t('business.topology.transferHost.tabs.addServiceInstance'),
      children: hasChanges ? renderAddInst() : renderEmpty(),
    },
    ...(shouldShowDelTab ? delTabItems : []),
  ];

  const tabItems =
    transferHostType === TransferMenuItemType.idlePool ||
    transferHostType === RemoveMenuItemKey.CurrentModule
      ? delTabItems
      : addTabItems;

  const initialKeys = useMemo(() => targetModules.map((m) => m.key), [targetModules]);

  return (
    <div className="transfer-container">
      <div className="info-item first-item">
        <label className="info-label">
          {t('business.topology.transferHost.labels.selectedHosts')}：
        </label>
        <div className="info-content">
          <span className="info-number">{selectedHosts.length}</span>
          &nbsp;
          {t('business.topology.transferHost.labels.units')}
          <EditOutlined className="edit-icon" onClick={handleEditHosts} />
        </div>
      </div>

      {!isRemoveFromCurrent && (
        <div className="info-item">
          <label className="info-label">
            {t('business.topology.transferHost.labels.transferTo')}：
          </label>
          <div className="info-content">
            {targetModules.map((module, idx) => (
              <Tooltip title={selectedTopoPaths[idx]} key={module.key}>
                <Button
                  color="default"
                  variant="outlined"
                  className={`info-button ${idx !== 0 ? 'info-button-right' : ''}`}
                >
                  {module.title}
                </Button>
              </Tooltip>
            ))}
            {transferHostType && (
              <EditOutlined className="edit-icon" onClick={() => setShowTransferModal(true)} />
            )}
          </div>
        </div>
      )}

      <div className="info-item">
        <label className="info-label">
          {t('business.topology.transferHost.labels.changeConfirmation')}：
        </label>
        <div className="info-content">
          <Tabs defaultActiveKey="1" items={tabItems} />
          <div className={`options${optionsSticky ? ' sticky-active' : ''}`} ref={optionsRef}>
            <Button type="primary" onClick={handleConfirm} disabled={!isConfirmBtnAvailable}>
              {t('business.topology.transferHost.buttons.confirmChange')}
            </Button>
            <Button onClick={handleCancel}>{t('common.cancel')}</Button>
          </div>
          <div ref={sentinelRef} style={{ height: 1 }} />
        </div>
      </div>

      {/* Edit hosts modal */}
      <AddHostModal
        visible={showEditHostModal}
        onClose={() => setShowEditHostModal(false)}
        onConfirm={handleConfirmEditHosts}
        initialSelectedHosts={selectedHosts}
        transferHostType={transferHostType}
      />

      {/* Add process modal */}
      <AddProcessModal
        visible={showAddProcessModal}
        onClose={() => setShowAddProcessModal(false)}
        onSubmit={handleConfirmAddProcess}
        mode={processModalMode}
        initialValues={editingProcess}
        listenIpOptions={availableListenIpOptions}
      />

      {/* Transfer host modal */}
      <TransferHostModal
        visible={showTransferModal}
        transferType={transferHostType as TransferMenuItemType}
        selectedHosts={selectedHosts}
        onClose={() => setShowTransferModal(false)}
        onConfirm={handleTransferNode}
        initialExpandedKeys={initialKeys}
        initialSelectedKeys={initialKeys}
      />
    </div>
  );
};

export default TransferHost;
