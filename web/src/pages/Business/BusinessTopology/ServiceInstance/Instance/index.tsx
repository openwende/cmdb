import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Drawer,
  Form,
  Input,
  Modal,
  message,
  Popconfirm,
  Tag,
  Empty,
  Spin,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, MinusOutlined } from '@ant-design/icons';
import Pagination from '@/components/common/Pagination';
import TableEmpty from '@/components/common/TableEmpty';
import { useInstanceSceneStore } from '@/store/InstanceSceneStore';
import {
  deleteProcess,
  getModuleProcessSummary,
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

const Instance: React.FC<Props> = ({
  selectedNode,
  selectedRowKeys,
  setSelectedRowKeys,
  expandAll,
}) => {
  const { t } = useTranslation();
  const detail = useInstanceSceneStore((state) => state.detail);
  const loading = useInstanceSceneStore((state) => state.loading);
  const error = useInstanceSceneStore((state) => state.error);
  const openInstance = useInstanceSceneStore((state) => state.openInstance);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'view' | 'add' | 'edit'>('view');
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [editingInstanceName, setEditingInstanceName] = useState('');
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [labelList, setLabelList] = useState<Array<{ key: string; value: string }>>([]);
  const [processItems, setProcessItems] = useState<ProcessRecord[]>([]);
  const [processTotal, setProcessTotal] = useState(0);
  const [activeProcess, setActiveProcess] = useState<ProcessRecord | null>(null);
  const [draft, setDraft] = useState<ProcessDraft>(createDraftFromProcess(null));

  const dataSource = useMemo(() => {
    if (!detail) {
      return [];
    }

    return [
      {
        id: detail.instance_key,
        name:
          detail.properties && typeof detail.properties.name === 'string'
            ? detail.properties.name
            : detail.instance_key,
        process_count: processTotal,
        labels: detail.binding_context || {},
      },
    ];
  }, [detail, processTotal]);

  useEffect(() => {
    if (!selectedNode?.nodeId) {
      return;
    }

    const modelUID = selectedNode.backendType || selectedNode.type;
    void openInstance(`${modelUID}:${selectedNode.nodeId}`);
  }, [openInstance, selectedNode?.backendType, selectedNode?.nodeId, selectedNode?.type]);

  useEffect(() => {
    const moduleID = Number.parseInt(String(selectedNode?.nodeId ?? ''), 10);
    if (Number.isNaN(moduleID)) {
      setProcessItems([]);
      setProcessTotal(0);
      return;
    }

    const loadProcesses = async () => {
      try {
        const [summaryResponse, listResponse] = await Promise.all([
          getModuleProcessSummary(moduleID),
          listProcesses({
            module_id: moduleID,
            page: 1,
            page_size: 100,
          }),
        ]);
        setProcessTotal(summaryResponse?.data?.total ?? 0);
        setProcessItems(listResponse?.data?.items ?? []);
      } catch (processError) {
        console.error('Failed to load module processes:', processError);
        setProcessItems([]);
        setProcessTotal(0);
      }
    };

    void loadProcesses();
  }, [selectedNode?.nodeId]);

  useEffect(() => {
    if (expandAll) {
      const allKeys = detail ? [detail.instance_key] : [];
      setExpandedRowKeys(allKeys);
    } else {
      setExpandedRowKeys([]);
    }
  }, [detail, expandAll]);

  const instanceColumns = [
    {
      title: t('business.topology.serviceInstance.instance.columns.instanceName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {editingInstance === record.id ? (
            <Input
              value={editingInstanceName}
              onChange={(e) => setEditingInstanceName(e.target.value)}
              onPressEnter={() => {
                message.success(
                  t(
                    'business.topology.serviceInstance.instance.messages.instanceNameUpdateSuccess',
                  ),
                );
                setEditingInstance(null);
              }}
              onBlur={() => setEditingInstance(null)}
              autoFocus
            />
          ) : (
            <>
              <span>{text}</span>
              <EditOutlined
                style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
                onClick={() => {
                  setEditingInstance(record.id);
                  setEditingInstanceName(text);
                }}
              />
            </>
          )}
        </div>
      ),
    },
    {
      title: t('business.topology.serviceInstance.instance.columns.processCount'),
      dataIndex: 'process_count',
      key: 'process_count',
    },
    {
      title: t('business.topology.serviceInstance.instance.columns.labels'),
      dataIndex: 'labels',
      key: 'labels',
      render: (labels: any, record: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div>
            {labels && typeof labels === 'object'
              ? Object.entries(labels).map(([key, value]) => (
                  <Tag key={key}>
                    {key}: {value as string}
                  </Tag>
                ))
              : '--'}
          </div>
          <EditOutlined
            style={{ cursor: 'pointer', color: 'var(--color-primary)' }}
            onClick={() => handleEditLabel(record)}
          />
        </div>
      ),
    },
    {
      title: t('business.topology.serviceInstance.instance.columns.action'),
      key: 'action',
      render: (record: any) => (
        <Space>
          <Button type="link" onClick={() => handleAddProcess(record)}>
            {t('business.topology.serviceInstance.instance.actions.addProcess')}
          </Button>
          <Button type="link" onClick={() => handleCloneInstance(record)}>
            {t('business.topology.serviceInstance.instance.actions.clone')}
          </Button>
          <Popconfirm
            title={t('business.topology.serviceInstance.instance.confirm.deleteInstance')}
            onConfirm={() => handleDeleteInstance(record)}
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

  const expandedRowRender = () => {
    const columns = [
      {
        title: t('business.topology.serviceInstance.instance.columns.processName'),
        dataIndex: 'process_name',
        key: 'process_name',
        render: (text: string, processRecord: ProcessRecord) => (
          <Button type="link" onClick={() => handleViewProcess(processRecord)}>
            {text}
          </Button>
        ),
      },
      {
        title: t('business.topology.serviceInstance.instance.columns.processStart'),
        dataIndex: 'start_command',
        key: 'func_name',
        render: (value: string, processRecord: ProcessRecord) =>
          value || processRecord.process_template?.start_param_regex || '--',
      },
      {
        title: t('business.topology.serviceInstance.instance.columns.startupParams'),
        dataIndex: 'start_command',
        key: 'start_param',
        render: (value: string, processRecord: ProcessRecord) =>
          value || processRecord.process_template?.start_param_regex || '--',
      },
      {
        title: t('business.topology.serviceInstance.instance.columns.bindInfo'),
        dataIndex: 'bind_info',
        key: 'bind_info',
        render: (value: ProcessBindInfo[]) => formatBindInfoText(value),
      },
      {
        title: t('business.topology.serviceInstance.instance.columns.action'),
        key: 'action',
        render: (processRecord: ProcessRecord) => (
          <Space>
            <Button type="link" onClick={() => handleEditProcess(processRecord)}>
              {t('common.edit')}
            </Button>
            <Popconfirm
              title={t('business.topology.serviceInstance.instance.confirm.deleteProcess')}
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
        dataSource={processItems}
        pagination={false}
        size="small"
        rowKey={(record) => record.id}
      />
    );
  };

  const handleEditLabel = (record: any) => {
    const labels = record.labels || {};
    const labelArray = Object.entries(labels).map(([key, value]) => ({
      key,
      value: value as string,
    }));
    setLabelList(labelArray.length > 0 ? labelArray : [{ key: '', value: '' }]);
    setLabelModalVisible(true);
  };

  const handleAddLabelRow = () => {
    setLabelList([...labelList, { key: '', value: '' }]);
  };

  const handleRemoveLabelRow = (index: number) => {
    if (labelList.length > 1) {
      const newList = labelList.filter((_, i) => i !== index);
      setLabelList(newList);
    }
  };

  const handleLabelChange = (index: number, field: 'key' | 'value', value: string) => {
    const newList = [...labelList];
    newList[index][field] = value;
    setLabelList(newList);
  };

  const handleSaveLabels = () => {
    message.success(t('business.topology.serviceInstance.instance.messages.labelSaveSuccess'));
    setLabelModalVisible(false);
  };

  const openProcessDrawer = async (record: ProcessRecord, type: 'view' | 'add' | 'edit') => {
    if (type === 'add') {
      setActiveProcess(null);
      setDraft(createDraftFromProcess(null));
      setDrawerType(type);
      setDrawerVisible(true);
      return;
    }

    const response = await getProcess(record.id);
    const detailRecord = response?.data ?? record;
    setActiveProcess(detailRecord);
    setDraft(createDraftFromProcess(detailRecord));
    setDrawerType(type);
    setDrawerVisible(true);
  };

  const handleViewProcess = (record: ProcessRecord) => {
    setDrawerType('view');
    void openProcessDrawer(record, 'view');
  };

  const handleAddProcess = (_record: any) => {
    setDrawerType('add');
    void openProcessDrawer(_record, 'add');
  };

  const handleEditProcess = (record: ProcessRecord) => {
    setDrawerType('edit');
    void openProcessDrawer(record, 'edit');
  };

  const handleCloneInstance = (_record: any) => {
    message.info(t('business.topology.serviceInstance.instance.messages.cloneInstanceInfo'));
  };

  const handleDeleteInstance = (_record: any) => {
    message.success(t('business.topology.serviceInstance.instance.messages.deleteInstanceSuccess'));
  };

  const handleDeleteProcess = async (record: ProcessRecord) => {
    await deleteProcess(record.id);
    message.success(t('business.topology.serviceInstance.instance.messages.deleteProcessSuccess'));
    const moduleID = Number.parseInt(String(selectedNode?.nodeId ?? ''), 10);
    if (!Number.isNaN(moduleID)) {
      const [summaryResponse, listResponse] = await Promise.all([
        getModuleProcessSummary(moduleID),
        listProcesses({
          module_id: moduleID,
          page: 1,
          page_size: 100,
        }),
      ]);
      setProcessTotal(summaryResponse?.data?.total ?? 0);
      setProcessItems(listResponse?.data?.items ?? []);
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

    const moduleID = Number.parseInt(String(selectedNode?.nodeId ?? ''), 10);
    if (!Number.isNaN(moduleID)) {
      const [summaryResponse, listResponse] = await Promise.all([
        getModuleProcessSummary(moduleID),
        listProcesses({
          module_id: moduleID,
          page: 1,
          page_size: 100,
        }),
      ]);
      setProcessTotal(summaryResponse?.data?.total ?? 0);
      setProcessItems(listResponse?.data?.items ?? []);
    }

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
            <div>{t('business.topology.serviceInstance.process.fields.creator')}：--</div>
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
            locale={{ emptyText: <TableEmpty /> }}
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
              onChange={(event) =>
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
              onChange={(event) =>
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
              placeholder={t(
                'business.topology.serviceInstance.process.form.placeholders.startupParams',
              )}
              onChange={(event) =>
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
              placeholder={t(
                'business.topology.serviceInstance.process.form.placeholders.description',
              )}
              onChange={(event) =>
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
      {/* The table */}
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        loading={loading}
        columns={instanceColumns}
        dataSource={dataSource}
        rowKey="id"
        expandable={{
          expandedRowRender,
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
          defaultExpandAllRows: false,
        }}
        pagination={false}
        bordered
        locale={{
          emptyText: loading ? (
            <Spin />
          ) : error ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error} />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('business.topology.serviceInstance.process.table.noData')}
            />
          ),
        }}
      />

      {/* The pagination */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {t('business.topology.serviceInstance.instance.pagination.selected')}
          &nbsp;{selectedRowKeys.length}
          &nbsp;{t('business.topology.serviceInstance.instance.pagination.items')}
        </span>
        <Pagination
          total={dataSource.length}
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

      {/* The edit tag modal */}
      <Modal
        title={t('business.topology.serviceInstance.instance.modal.editLabel')}
        open={labelModalVisible}
        onOk={handleSaveLabels}
        onCancel={() => setLabelModalVisible(false)}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          {labelList.map((label, index) => (
            <div
              key={index}
              style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}
            >
              <Input
                placeholder={t('business.topology.serviceInstance.instance.form.placeholders.key')}
                value={label.key}
                onChange={(e) => handleLabelChange(index, 'key', e.target.value)}
                style={{ flex: 1 }}
              />
              <span>:</span>
              <Input
                placeholder={t(
                  'business.topology.serviceInstance.instance.form.placeholders.value',
                )}
                value={label.value}
                onChange={(e) => handleLabelChange(index, 'value', e.target.value)}
                style={{ flex: 1 }}
              />
              {index === labelList.length - 1 && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    type="text"
                    icon={<PlusOutlined />}
                    onClick={handleAddLabelRow}
                    size="small"
                  />
                  {labelList.length > 1 && (
                    <Button
                      type="text"
                      icon={<MinusOutlined />}
                      onClick={() => handleRemoveLabelRow(index)}
                      size="small"
                    />
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </Modal>

      {/* The drawer */}
      <Drawer
        title={
          drawerType === 'view'
            ? t('business.topology.serviceInstance.instance.drawer.viewProcess')
            : drawerType === 'add'
              ? t('business.topology.serviceInstance.instance.drawer.addProcess')
              : t('business.topology.serviceInstance.instance.drawer.editProcess')
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

export default Instance;
