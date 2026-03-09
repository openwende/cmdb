import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import Pagination from '@/components/common/Pagination';
import {
  createModelInstance,
  createModelInstanceRelation,
  deleteModelInstanceRelation,
  getAvailableRelations,
  getModelInstanceDetail,
  getModelInstanceTopology,
  listModelInstanceHistory,
  listModelInstanceRelations,
  listModelInstances,
} from '@/api';
import {
  CreateModelInstancePayload,
  ModelInstance,
} from '@/api/types/model';
import { ModelAssociation } from '@/api/types/modelRelation';
import {
  DynamicModelInstanceDetail,
  InstanceHistoryItem,
  InstanceRelationItem,
  InstanceTopologyGraph,
} from '@/api/types/modelInstance';
import { useTranslation } from 'react-i18next';
import CreateInstanceDrawer from '../CreateInstanceDrawer';
import { useModelPageContext } from '../../context';

const DEFAULT_PAGE_SIZE = 20;
const DETAIL_HISTORY_PAGE_SIZE = 10;

type DrawerTabKey = 'detail' | 'relations' | 'history' | 'topology';

type WorkspaceMode = 'instances' | 'history';

interface InstanceWorkspaceProps {
  mode?: WorkspaceMode;
  defaultDrawerTab?: DrawerTabKey;
}

const HEALTH_STATUS_COLORS: Record<number, string> = {
  0: 'green',
  1: 'orange',
  2: 'red',
};

const HEALTH_STATUS_LABELS: Record<number, string> = {
  0: 'OK',
  1: 'Warn',
  2: 'Error',
};

const renderJSONPreview = (value?: Record<string, unknown> | null) => {
  if (!value || Object.keys(value).length === 0) {
    return '--';
  }

  return <pre className="properties-preview">{JSON.stringify(value, null, 2)}</pre>;
};

const getInstanceName = (record: ModelInstance) => {
  const nameFromProperties = record.properties?.name;
  if (typeof nameFromProperties === 'string' && nameFromProperties.trim()) {
    return nameFromProperties;
  }

  return String(record.id);
};

const buildRelationDefinitionKey = (definition: ModelAssociation) => {
  return `${definition.target_model_uid}::${definition.association_uid}`;
};

const InstanceWorkspace: React.FC<InstanceWorkspaceProps> = ({
  mode = 'instances',
  defaultDrawerTab = 'detail',
}) => {
  const { t } = useTranslation();
  const { detailModel, attributes, businesses, parentModelName, allModels } = useModelPageContext();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTabKey>(defaultDrawerTab);
  const [instances, setInstances] = useState<ModelInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<ModelInstance | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false);

  const [instanceDetailLoading, setInstanceDetailLoading] = useState(false);
  const [instanceDetail, setInstanceDetail] = useState<DynamicModelInstanceDetail | null>(null);

  const [relationDefinitionsLoading, setRelationDefinitionsLoading] = useState(false);
  const [relationDefinitions, setRelationDefinitions] = useState<ModelAssociation[]>([]);
  const [instanceRelationsLoading, setInstanceRelationsLoading] = useState(false);
  const [instanceRelations, setInstanceRelations] = useState<InstanceRelationItem[]>([]);
  const [selectedRelationDefinitionKey, setSelectedRelationDefinitionKey] = useState<string>();
  const [targetInstanceLoading, setTargetInstanceLoading] = useState(false);
  const [targetInstances, setTargetInstances] = useState<ModelInstance[]>([]);
  const [selectedTargetInstanceID, setSelectedTargetInstanceID] = useState<number>();
  const [relationSubmitting, setRelationSubmitting] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<InstanceHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(DETAIL_HISTORY_PAGE_SIZE);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [topologyLoading, setTopologyLoading] = useState(false);
  const [topologyGraph, setTopologyGraph] = useState<InstanceTopologyGraph | null>(null);

  const modelDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allModels.forEach((model) => {
      map.set(model.name, model.display_name);
    });
    return map;
  }, [allModels]);

  const selectedRelationDefinition = useMemo(() => {
    return relationDefinitions.find(
      (item) => buildRelationDefinitionKey(item) === selectedRelationDefinitionKey,
    );
  }, [relationDefinitions, selectedRelationDefinitionKey]);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await listModelInstances(detailModel.name, {
        page,
        page_size: pageSize,
      });
      setInstances(response.data || []);
      setTotal(response.meta?.total || 0);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstancesFailed'));
    } finally {
      setLoading(false);
    }
  };

  const loadInstanceDetail = async (instanceID: string | number) => {
    try {
      setInstanceDetailLoading(true);
      const response = await getModelInstanceDetail(detailModel.name, instanceID);
      setInstanceDetail(response.data);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstanceDetailFailed'));
      setInstanceDetail(null);
    } finally {
      setInstanceDetailLoading(false);
    }
  };

  const loadRelationDefinitions = async () => {
    try {
      setRelationDefinitionsLoading(true);
      const response = await getAvailableRelations(detailModel.name);
      setRelationDefinitions(response.data.existing || []);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadRelationDefinitionsFailed'));
      setRelationDefinitions([]);
    } finally {
      setRelationDefinitionsLoading(false);
    }
  };

  const loadInstanceRelations = async (instanceID: string | number) => {
    try {
      setInstanceRelationsLoading(true);
      const response = await listModelInstanceRelations(detailModel.name, instanceID, {
        direction: 'both',
      });
      setInstanceRelations(response.data.items || []);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstanceRelationsFailed'));
      setInstanceRelations([]);
    } finally {
      setInstanceRelationsLoading(false);
    }
  };

  const loadTargetInstances = async (modelUID: string) => {
    try {
      setTargetInstanceLoading(true);
      const response = await listModelInstances(modelUID, {
        page: 1,
        page_size: 100,
      });
      setTargetInstances(response.data || []);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadTargetInstancesFailed'));
      setTargetInstances([]);
    } finally {
      setTargetInstanceLoading(false);
    }
  };

  const loadInstanceHistory = async (instanceID: string | number, currentPage = historyPage, currentPageSize = historyPageSize) => {
    try {
      setHistoryLoading(true);
      const response = await listModelInstanceHistory(detailModel.name, instanceID, {
        page: currentPage,
        page_size: currentPageSize,
      });
      setHistoryItems(response.data.items || []);
      setHistoryTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstanceHistoryFailed'));
      setHistoryItems([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadInstanceTopology = async (instanceID: string | number) => {
    try {
      setTopologyLoading(true);
      const response = await getModelInstanceTopology(detailModel.name, instanceID, {
        max_depth: 5,
      });
      setTopologyGraph(response.data);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstanceTopologyFailed'));
      setTopologyGraph(null);
    } finally {
      setTopologyLoading(false);
    }
  };

  useEffect(() => {
    fetchInstances();
  }, [detailModel.name, page, pageSize]);

  useEffect(() => {
    if (!drawerVisible || !selectedInstance) {
      return;
    }

    loadInstanceDetail(selectedInstance.id);
  }, [drawerVisible, selectedInstance?.id, detailModel.name]);

  useEffect(() => {
    if (!drawerVisible || !selectedInstance) {
      return;
    }

    if (drawerTab === 'relations') {
      loadRelationDefinitions();
      loadInstanceRelations(selectedInstance.id);
      return;
    }

    if (drawerTab === 'history') {
      loadInstanceHistory(selectedInstance.id);
      return;
    }

    if (drawerTab === 'topology') {
      loadInstanceTopology(selectedInstance.id);
    }
  }, [drawerVisible, drawerTab, selectedInstance?.id, historyPage, historyPageSize, detailModel.name]);

  useEffect(() => {
    if (!selectedRelationDefinition?.target_model_uid) {
      setTargetInstances([]);
      setSelectedTargetInstanceID(undefined);
      return;
    }

    loadTargetInstances(selectedRelationDefinition.target_model_uid);
  }, [selectedRelationDefinition?.target_model_uid]);

  const openInstanceDrawer = (record: ModelInstance, tab: DrawerTabKey = defaultDrawerTab) => {
    setSelectedInstance(record);
    setDrawerTab(tab);
    setDrawerVisible(true);
    setHistoryPage(1);
    setHistoryPageSize(DETAIL_HISTORY_PAGE_SIZE);
    setSelectedRelationDefinitionKey(undefined);
    setSelectedTargetInstanceID(undefined);
    setTargetInstances([]);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setSelectedInstance(null);
    setInstanceDetail(null);
    setInstanceRelations([]);
    setHistoryItems([]);
    setHistoryTotal(0);
    setTopologyGraph(null);
    setSelectedRelationDefinitionKey(undefined);
    setSelectedTargetInstanceID(undefined);
    setTargetInstances([]);
  };

  const handleCreateInstance = async (payload: CreateModelInstancePayload) => {
    try {
      setSubmitting(true);
      await createModelInstance(detailModel.name, payload);
      message.success(t('common.message.createSuccess'));
      setCreateDrawerVisible(false);
      await fetchInstances();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.instanceCreateFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateRelation = async () => {
    if (!selectedInstance || !selectedRelationDefinition || !selectedTargetInstanceID) {
      message.warning(t('resource.model.messages.relationTargetRequired'));
      return;
    }

    try {
      setRelationSubmitting(true);
      await createModelInstanceRelation({
        source_id: Number(selectedInstance.id),
        target_id: selectedTargetInstanceID,
        association_uid: selectedRelationDefinition.association_uid,
      });
      message.success(t('resource.model.messages.createInstanceRelationSuccess'));
      setSelectedRelationDefinitionKey(undefined);
      setSelectedTargetInstanceID(undefined);
      setTargetInstances([]);
      await loadInstanceRelations(selectedInstance.id);
      await loadInstanceTopology(selectedInstance.id);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.createInstanceRelationFailed'));
    } finally {
      setRelationSubmitting(false);
    }
  };

  const handleDeleteRelation = async (relationID: number) => {
    if (!selectedInstance) {
      return;
    }

    try {
      await deleteModelInstanceRelation(relationID);
      message.success(t('resource.model.messages.deleteInstanceRelationSuccess'));
      await loadInstanceRelations(selectedInstance.id);
      await loadInstanceTopology(selectedInstance.id);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.deleteInstanceRelationFailed'));
    }
  };

  const instanceColumns: ColumnsType<ModelInstance> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 220,
    },
    {
      title: t('resource.model.columns.instanceName'),
      key: 'name',
      width: 220,
      render: (_value, record) => getInstanceName(record),
    },
    {
      title: t('resource.model.columns.business'),
      dataIndex: 'business_id',
      width: 220,
      render: (value?: string | null) => value || '--',
    },
    {
      title: t('resource.model.columns.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('resource.model.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('resource.model.columns.actions'),
      key: 'actions',
      width: 260,
      render: (_value, record) => (
        <Space size="small" wrap>
          <Button type="link" onClick={() => openInstanceDrawer(record, 'detail')}>
            {t('resource.model.actions.viewInstanceDetail')}
          </Button>
          <Button type="link" onClick={() => openInstanceDrawer(record, 'relations')}>
            {t('resource.model.actions.viewInstanceRelations')}
          </Button>
          <Button type="link" onClick={() => openInstanceDrawer(record, 'history')}>
            {t('resource.model.actions.viewInstanceHistory')}
          </Button>
        </Space>
      ),
    },
  ];

  const relationColumns: ColumnsType<InstanceRelationItem> = [
    {
      title: t('resource.model.relations.columns.associationType'),
      dataIndex: 'association_name',
      width: 180,
      render: (_value, record) => `${record.association_name} (${record.association_uid})`,
    },
    {
      title: t('resource.model.columns.relationDirection'),
      dataIndex: 'direction',
      width: 120,
      render: (value: string) => <Tag color={value === 'source' ? 'blue' : 'purple'}>{value}</Tag>,
    },
    {
      title: t('resource.model.columns.relationLabel'),
      dataIndex: 'association_label',
      width: 160,
      render: (value?: string) => value || '--',
    },
    {
      title: t('resource.model.columns.relatedInstance'),
      dataIndex: 'related',
      width: 260,
      render: (value) => {
        if (!value) {
          return '--';
        }
        return `${value.name} (${value.model_uid}#${value.id})`;
      },
    },
    {
      title: t('resource.model.columns.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('resource.model.columns.actions'),
      key: 'actions',
      width: 120,
      render: (_value, record) => (
        <Popconfirm
          title={t('resource.model.relations.confirmDeleteInstanceRelation')}
          onConfirm={() => handleDeleteRelation(record.id)}
        >
          <Button type="link" danger>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const historyColumns: ColumnsType<InstanceHistoryItem> = [
    {
      title: t('resource.model.columns.changeType'),
      dataIndex: 'change_type',
      width: 120,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: t('resource.model.columns.changedFields'),
      dataIndex: 'changed_fields',
      render: (value?: string[]) =>
        value && value.length > 0
          ? value.map((field) => <Tag key={field}>{field}</Tag>)
          : '--',
    },
    {
      title: t('resource.model.columns.operator'),
      dataIndex: 'changed_by',
      width: 160,
      render: (value?: string) => value || '--',
    },
    {
      title: t('resource.model.columns.clientIp'),
      dataIndex: 'client_ip',
      width: 160,
      render: (value?: string) => value || '--',
    },
    {
      title: t('resource.model.columns.createdAt'),
      dataIndex: 'changed_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
  ];

  const topologyNodeColumns: ColumnsType<InstanceTopologyGraph['nodes'][number]> = [
    {
      title: 'ID',
      dataIndex: 'resource_id',
      width: 120,
    },
    {
      title: t('resource.model.columns.instanceName'),
      dataIndex: 'name',
      width: 220,
    },
    {
      title: t('resource.model.columns.modelName'),
      dataIndex: 'model_uid',
      width: 160,
      render: (value: string) => modelDisplayNameMap.get(value) || value,
    },
    {
      title: t('resource.model.columns.depth'),
      dataIndex: 'depth',
      width: 100,
    },
    {
      title: t('resource.model.columns.path'),
      dataIndex: 'path',
    },
  ];

  const topologyEdgeColumns: ColumnsType<InstanceTopologyGraph['edges'][number]> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 100,
    },
    {
      title: t('resource.model.relations.columns.associationType'),
      dataIndex: 'association_name',
      width: 180,
      render: (_value, record) => `${record.association_name} (${record.association_uid})`,
    },
    {
      title: t('resource.model.columns.sourceTarget'),
      key: 'sourceTarget',
      render: (_value, record) => `${record.source_model_uid}#${record.source_id} -> ${record.target_model_uid}#${record.target_id}`,
    },
  ];

  const drawerTitle = selectedInstance
    ? `${getInstanceName(selectedInstance)} (${selectedInstance.id})`
    : t('resource.model.tabs.instances');

  const relationDefinitionOptions = relationDefinitions.map((definition) => ({
    label: `${modelDisplayNameMap.get(definition.target_model_uid) || definition.target_model_uid} / ${definition.association_uid} / ${definition.mapping}`,
    value: buildRelationDefinitionKey(definition),
  }));

  const targetInstanceOptions = targetInstances
    .filter((item) => String(item.id) !== String(selectedInstance?.id))
    .map((item) => ({
      label: `${getInstanceName(item)} (${item.id})`,
      value: Number(item.id),
    }));

  return (
    <div className="model-page">
      {detailModel.is_mainline && detailModel.mainline_scope === 'business' ? (
        <Alert type="info" showIcon message={t('resource.model.helper.instanceBusinessScope')} />
      ) : null}

      <div className="model-page-toolbar">
        <div className="model-page-note">
          {mode === 'history'
            ? t('resource.model.helper.instanceHistoryPage')
            : t('resource.model.helper.instanceListNote')}
        </div>
        <div className="model-page-actions">
          <Button onClick={() => fetchInstances()}>{t('resource.model.actions.refresh')}</Button>
          {mode === 'instances' ? (
            <Button type="primary" onClick={() => setCreateDrawerVisible(true)}>
              {t('resource.model.actions.createInstance')}
            </Button>
          ) : null}
        </div>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 1280 }}
        dataSource={instances}
        columns={instanceColumns}
        expandable={{
          expandedRowRender: (record) => renderJSONPreview(record.properties || {}),
        }}
        locale={{
          emptyText: <Empty description={t('resource.model.empty.noInstances')} />,
        }}
      />

      <Pagination
        total={total}
        current={page}
        pageSize={pageSize}
        onChange={(nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
        }}
        onSizeChange={(_current, size) => {
          setPage(1);
          setPageSize(size);
        }}
      />

      <CreateInstanceDrawer
        visible={createDrawerVisible}
        loading={submitting}
        businesses={businesses}
        attributes={attributes}
        model={detailModel}
        parentModelName={parentModelName}
        onClose={() => setCreateDrawerVisible(false)}
        onSubmit={handleCreateInstance}
      />

      <Drawer
        title={drawerTitle}
        width={960}
        open={drawerVisible}
        onClose={closeDrawer}
        destroyOnClose
      >
        {!selectedInstance ? null : (
          <Tabs
            activeKey={drawerTab}
            onChange={(key) => setDrawerTab(key as DrawerTabKey)}
            items={[
              {
                key: 'detail',
                label: t('resource.model.tabs.instanceDetail'),
                children: instanceDetailLoading ? (
                  <Spin />
                ) : instanceDetail ? (
                  <Space direction="vertical" size="large" style={{ width: '100%' }}>
                    <Descriptions bordered column={2}>
                      <Descriptions.Item label="ID">{instanceDetail.id}</Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.fields.name')}>
                        {instanceDetail.name || '--'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.columns.modelName')}>
                        {modelDisplayNameMap.get(instanceDetail.model_uid) || instanceDetail.model_uid}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.fields.updatedAt')}>
                        {instanceDetail.updated_at
                          ? dayjs(instanceDetail.updated_at).format('YYYY-MM-DD HH:mm:ss')
                          : '--'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.fields.createdAt')}>
                        {instanceDetail.created_at
                          ? dayjs(instanceDetail.created_at).format('YYYY-MM-DD HH:mm:ss')
                          : '--'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.fields.healthStatus')}>
                        {instanceDetail.state ? (
                          <Tag color={HEALTH_STATUS_COLORS[instanceDetail.state.health_status || 0] || 'default'}>
                            {HEALTH_STATUS_LABELS[instanceDetail.state.health_status || 0]
                              || String(instanceDetail.state.health_status ?? '--')}
                          </Tag>
                        ) : (
                          '--'
                        )}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.fields.lastCheckTime')} span={2}>
                        {instanceDetail.state?.last_check_time
                          ? dayjs(instanceDetail.state.last_check_time).format('YYYY-MM-DD HH:mm:ss')
                          : '--'}
                      </Descriptions.Item>
                    </Descriptions>

                    <div>
                      <div className="model-page-note">{t('resource.model.helper.instanceConfigBlock')}</div>
                      {renderJSONPreview(instanceDetail.configs || {})}
                    </div>

                    <div>
                      <div className="model-page-note">{t('resource.model.helper.instanceMetricsBlock')}</div>
                      {renderJSONPreview(instanceDetail.state?.metrics || {})}
                    </div>
                  </Space>
                ) : (
                  <Empty description={t('resource.model.empty.noInstanceDetail')} />
                ),
              },
              {
                key: 'relations',
                label: t('resource.model.tabs.instanceRelations'),
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      message={t('resource.model.helper.instanceRelationsPage')}
                    />
                    <div className="model-page-toolbar">
                      <div className="model-page-note">{t('resource.model.helper.instanceRelationCreate')}</div>
                      <div className="model-page-actions">
                        <Button onClick={() => loadInstanceRelations(selectedInstance.id)}>
                          {t('resource.model.actions.refresh')}
                        </Button>
                      </div>
                    </div>
                    <Space wrap>
                      <Select
                        style={{ minWidth: 320 }}
                        value={selectedRelationDefinitionKey}
                        placeholder={t('resource.model.placeholders.relationDefinition')}
                        options={relationDefinitionOptions}
                        loading={relationDefinitionsLoading}
                        onChange={(value) => setSelectedRelationDefinitionKey(value)}
                        allowClear
                      />
                      <Select
                        style={{ minWidth: 260 }}
                        value={selectedTargetInstanceID}
                        placeholder={t('resource.model.placeholders.targetInstance')}
                        options={targetInstanceOptions}
                        loading={targetInstanceLoading}
                        onChange={(value) => setSelectedTargetInstanceID(value)}
                        allowClear
                        showSearch
                        optionFilterProp="label"
                      />
                      <Button
                        type="primary"
                        loading={relationSubmitting}
                        onClick={handleCreateRelation}
                        disabled={!selectedRelationDefinition || !selectedTargetInstanceID}
                      >
                        {t('resource.model.actions.createInstanceRelation')}
                      </Button>
                    </Space>
                    <Table
                      rowKey="id"
                      loading={instanceRelationsLoading}
                      pagination={false}
                      dataSource={instanceRelations}
                      columns={relationColumns}
                      expandable={{
                        expandedRowRender: (record) => renderJSONPreview(record.properties || {}),
                      }}
                      locale={{
                        emptyText: <Empty description={t('resource.model.empty.noInstanceRelations')} />,
                      }}
                    />
                  </Space>
                ),
              },
              {
                key: 'history',
                label: t('resource.model.tabs.instanceHistory'),
                children: (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      message={t('resource.model.helper.instanceHistoryPage')}
                    />
                    <Table
                      rowKey="id"
                      loading={historyLoading}
                      pagination={false}
                      dataSource={historyItems}
                      columns={historyColumns}
                      expandable={{
                        expandedRowRender: (record) => (
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <div>
                              <div className="model-page-note">Before</div>
                              {renderJSONPreview(record.before_data || {})}
                            </div>
                            <div>
                              <div className="model-page-note">After</div>
                              {renderJSONPreview(record.after_data || {})}
                            </div>
                          </Space>
                        ),
                      }}
                      locale={{
                        emptyText: <Empty description={t('resource.model.empty.noInstanceHistory')} />,
                      }}
                    />
                    <Pagination
                      total={historyTotal}
                      current={historyPage}
                      pageSize={historyPageSize}
                      onChange={(nextPage, nextPageSize) => {
                        setHistoryPage(nextPage);
                        setHistoryPageSize(nextPageSize);
                      }}
                      onSizeChange={(_current, size) => {
                        setHistoryPage(1);
                        setHistoryPageSize(size);
                      }}
                    />
                  </Space>
                ),
              },
              {
                key: 'topology',
                label: t('resource.model.tabs.instanceTopology'),
                children: topologyLoading ? (
                  <Spin />
                ) : topologyGraph ? (
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Alert
                      type="info"
                      showIcon
                      message={t('resource.model.helper.instanceTopologyPage', {
                        nodeCount: topologyGraph.nodes.length,
                        edgeCount: topologyGraph.edges.length,
                      })}
                    />
                    <Table
                      rowKey="resource_id"
                      pagination={false}
                      dataSource={topologyGraph.nodes}
                      columns={topologyNodeColumns}
                      expandable={{
                        expandedRowRender: (record) => renderJSONPreview(record.configs || {}),
                      }}
                      locale={{
                        emptyText: <Empty description={t('resource.model.empty.noInstanceTopology')} />,
                      }}
                    />
                    <Table
                      rowKey="id"
                      pagination={false}
                      dataSource={topologyGraph.edges}
                      columns={topologyEdgeColumns}
                      expandable={{
                        expandedRowRender: (record) => renderJSONPreview(record.properties || {}),
                      }}
                      locale={{
                        emptyText: <Empty description={t('resource.model.empty.noInstanceTopology')} />,
                      }}
                    />
                  </Space>
                ) : (
                  <Empty description={t('resource.model.empty.noInstanceTopology')} />
                ),
              },
            ]}
          />
        )}
      </Drawer>
    </div>
  );
};

export default InstanceWorkspace;
