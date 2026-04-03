import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Drawer, Form, Input, message, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import {
  deleteProcess,
  getProcess,
  listProcesses,
  ProcessBindInfo,
  ProcessRecord,
  updateProcess,
} from '@/api/services/business';

interface Props {
  selectedNode?: any;
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  expandAll: boolean;
  setExpandAll: (expand: boolean) => void;
}

interface ProcessGroupRow {
  key: string;
  bk_process_name: string;
  process_ids: number[];
  items: ProcessRecord[];
}

interface ProcessDraft {
  processName: string;
  processAlias: string;
  startupParams: string;
  description: string;
}

const formatBindInfoText = (bindInfo?: ProcessBindInfo[]) => {
  if (!Array.isArray(bindInfo) || bindInfo.length === 0) {
    return '--';
  }

  return bindInfo
    .filter((item) => item.protocol && item.ip && item.port)
    .map((item) => `${item.protocol} ${item.ip}:${item.port}`)
    .join(', ');
};

const createDraftFromProcess = (process: ProcessRecord | null): ProcessDraft => ({
  processName: process?.process_name || '',
  processAlias: process?.process_name || '',
  startupParams: process?.start_command || process?.process_template?.start_param_regex || '',
  description: process?.description || '',
});

const groupProcesses = (items: ProcessRecord[]): ProcessGroupRow[] => {
  const groups = new Map<string, ProcessGroupRow>();

  items.forEach((item) => {
    const groupKey = item.process_name || `process-${item.id}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.items.push(item);
      existing.process_ids.push(item.id);
      return;
    }

    groups.set(groupKey, {
      key: groupKey,
      bk_process_name: groupKey,
      process_ids: [item.id],
      items: [item],
    });
  });

  return Array.from(groups.values());
};

const Process: React.FC<Props> = ({ selectedNode, selectedRowKeys, setSelectedRowKeys, expandAll }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'view' | 'edit'>('view');
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [processGroups, setProcessGroups] = useState<ProcessGroupRow[]>([]);
  const [activeProcess, setActiveProcess] = useState<ProcessRecord | null>(null);
  const [draft, setDraft] = useState<ProcessDraft>(createDraftFromProcess(null));
  const [total, setTotal] = useState(0);

  const moduleId = useMemo(() => {
    const rawID = Number.parseInt(String(selectedNode?.nodeId ?? ''), 10);
    return Number.isNaN(rawID) ? null : rawID;
  }, [selectedNode?.nodeId]);

  const loadProcesses = useCallback(async () => {
    if (moduleId === null) {
      setProcessGroups([]);
      setTotal(0);
      return;
    }

    const response = await listProcesses({
      module_id: moduleId,
      page: current,
      page_size: pageSize,
    });
    const items = response?.data?.items ?? [];
    const grouped = groupProcesses(items);

    setProcessGroups(grouped);
    setTotal(response?.data?.pagination?.total ?? items.length);
  }, [current, moduleId, pageSize]);

  useEffect(() => {
    void loadProcesses();
  }, [loadProcesses]);

  useEffect(() => {
    if (!expandAll) {
      setExpandedRowKeys([]);
      return;
    }

    setExpandedRowKeys(processGroups.map((group) => group.key));
  }, [expandAll, processGroups]);

  const processColumns = [
    {
      title: t('business.topology.serviceInstance.process.columns.processAlias'),
      dataIndex: 'bk_process_name',
      key: 'bk_process_name',
    },
    {
      title: t('business.topology.serviceInstance.process.columns.instanceCount'),
      dataIndex: 'process_ids',
      key: 'process_ids',
      render: (ids: number[]) => ids?.length ?? 0,
    },
  ];

  const processExpandedRowRender = (group: ProcessGroupRow) => {
    const columns = [
      {
        title: t('business.topology.serviceInstance.process.columns.serviceInstance'),
        dataIndex: 'process_name',
        key: 'service_instance_name',
        render: (value: string, record: any) => (
          <Button type="link" onClick={() => handleViewProcess(record)}>
            {selectedNode?.title || value || group.bk_process_name}
          </Button>
        ),
      },
      {
        title: t('business.topology.serviceInstance.process.columns.processName'),
        dataIndex: 'process_name',
        key: 'func_name',
      },
      {
        title: t('business.topology.serviceInstance.process.columns.startupParams'),
        dataIndex: 'start_command',
        key: 'start_param',
        render: (value: string, record: ProcessRecord) =>
          value || record.process_template?.start_param_regex || '--',
      },
      {
        title: t('business.topology.serviceInstance.process.columns.bindInfo'),
        dataIndex: 'bind_info',
        key: 'bind_info',
        render: (value: ProcessBindInfo[]) => formatBindInfoText(value),
      },
      {
        title: t('business.topology.serviceInstance.process.columns.action'),
        key: 'action',
        render: (processRecord: ProcessRecord) => (
          <Space>
            <Button type="link" onClick={() => handleEditProcess(processRecord)}>
              {t('common.edit')}
            </Button>
            <Popconfirm
              title={t('business.topology.serviceInstance.process.confirm.deleteProcess')}
              onConfirm={() => handleDeleteProcess(processRecord)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" danger>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={group.items}
        pagination={false}
        size="small"
        rowKey={(record) => record.id}
      />
    );
  };

  const openProcessDrawer = async (record: ProcessRecord, type: 'view' | 'edit') => {
    const response = await getProcess(record.id);
    const detail = response?.data ?? record;
    setActiveProcess(detail);
    setDraft(createDraftFromProcess(detail));
    setDrawerType(type);
    setDrawerVisible(true);
  };

  const handleViewProcess = (record: ProcessRecord) => {
    setDrawerType('view');
    void openProcessDrawer(record, 'view');
  };

  const handleEditProcess = (record: ProcessRecord) => {
    setDrawerType('edit');
    void openProcessDrawer(record, 'edit');
  };

  const handleDeleteProcess = async (record: ProcessRecord) => {
    await deleteProcess(record.id);
    message.success(t('business.topology.serviceInstance.process.messages.deleteSuccess'));
    await loadProcesses();
    if (activeProcess?.id === record.id) {
      setDrawerVisible(false);
      setActiveProcess(null);
    }
  };

  const handleSaveProcess = async () => {
    if (!activeProcess) {
      return;
    }

    const response = await updateProcess(activeProcess.id, {
      process_name: draft.processName,
      start_command: draft.startupParams,
      description: draft.description,
      bind_info: activeProcess.bind_info || [],
    });
    setActiveProcess(response?.data ?? activeProcess);
    setDraft(createDraftFromProcess(response?.data ?? activeProcess));
    message.success(t('common.save'));
    await loadProcesses();
    setDrawerVisible(false);
  };

  const renderDrawerContent = () => {
    if (drawerType === 'view') {
      return (
        <div>
          <h3>{t('business.topology.serviceInstance.process.sections.basicInfo')}</h3>
          <div style={{ marginBottom: 16 }}>
            <div>
              {t('business.topology.serviceInstance.process.fields.createTime')}：
              {activeProcess?.created_at || '--'}
            </div>
            <div>
              {t('business.topology.serviceInstance.process.fields.creator')}：--
            </div>
            <div>
              {t('business.topology.serviceInstance.process.form.processName')}：
              {activeProcess?.process_name || '--'}
            </div>
            <div>
              {t('business.topology.serviceInstance.process.fields.updateTime')}：
              {activeProcess?.updated_at || '--'}
            </div>
            <div>
              {t('business.topology.serviceInstance.process.form.processAlias')}：
              {activeProcess?.process_name || '--'}
            </div>
            <div>
              {t('business.topology.serviceInstance.process.fields.description')}：
              {activeProcess?.description || '--'}
            </div>
          </div>

          <h3>{t('business.topology.serviceInstance.process.sections.listenInfo')}</h3>
          <Table
            columns={[
              { title: 'IP', dataIndex: 'ip', key: 'ip' },
              { title: 'Port', dataIndex: 'port', key: 'port' },
              { title: 'Protocol', dataIndex: 'protocol', key: 'protocol' },
              { title: 'Enable', dataIndex: 'enable', key: 'enable' },
            ]}
            dataSource={activeProcess?.bind_info || []}
            pagination={false}
            size="small"
            locale={{ emptyText: t('business.topology.serviceInstance.process.table.noData') }}
          />

          <div style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => setDrawerType('edit')}>
              {t('common.edit')}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <Form layout="vertical">
        <h3>{t('business.topology.serviceInstance.process.sections.basicInfo')}</h3>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.processName')}
            style={{ flex: 1 }}
          >
            <Input
              value={draft.processName}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  processName: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.processAlias')}
            style={{ flex: 1 }}
          >
            <Input
              value={draft.processAlias}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  processAlias: event.target.value,
                }))
              }
            />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.startupParams')}
            style={{ flex: 1 }}
          >
            <Input
              value={draft.startupParams}
              placeholder={t('business.topology.serviceInstance.process.form.placeholders.startupParams')}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  startupParams: event.target.value,
                }))
              }
            />
          </Form.Item>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.description')}
            style={{ flex: 1 }}
          >
            <Input
              value={draft.description}
              placeholder={t('business.topology.serviceInstance.process.form.placeholders.description')}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  description: event.target.value,
                }))
              }
            />
          </Form.Item>
        </div>

        <div style={{ marginTop: 16 }}>
          <Button type="primary" style={{ marginRight: 8 }} onClick={handleSaveProcess}>
            {t('common.save')}
          </Button>
          <Button onClick={() => setDrawerVisible(false)}>{t('common.cancel')}</Button>
        </div>
      </Form>
    );
  };

  return (
    <div>
      {/* Table */}
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        columns={processColumns}
        dataSource={processGroups}
        rowKey={(record) => record.key}
        expandable={{
          expandedRowRender: processExpandedRowRender,
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
          defaultExpandAllRows: false,
        }}
        pagination={false}
        bordered
        locale={{ emptyText: t('business.topology.serviceInstance.process.table.noData') }}
      />

      {/* Pagination */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {t('business.topology.serviceInstance.process.pagination.selected')}
          &nbsp;{selectedRowKeys.length}
          &nbsp;{t('business.topology.serviceInstance.process.pagination.items')}
        </span>
        <Pagination
          total={total}
          pageSize={pageSize}
          current={current}
          onChange={(page, size) => {
            setCurrent(page);
            setPageSize(size);
          }}
          onSizeChange={(_, size) => {
            setPageSize(size);
            setCurrent(1);
          }}
        />
      </div>

      {/* Drawer */}
      <Drawer
        title={
          drawerType === 'view'
            ? t('business.topology.serviceInstance.process.drawer.viewTitle')
            : t('business.topology.serviceInstance.process.drawer.editTitle')
        }
        placement="right"
        width={800}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
};

export default Process;
