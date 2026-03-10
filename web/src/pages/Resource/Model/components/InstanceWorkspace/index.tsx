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
  getModelInstanceTopology,
  listAggregateInstances,
  listModelInstanceHistory,
  listModelInstanceRelations,
} from '@/api';
import { CreateModelInstancePayload } from '@/api/types/model';
import {
  AggregateInstanceListItem,
  InstanceHistoryItem,
  InstanceRelationItem,
  InstanceTopologyGraph,
} from '@/api/services/modelInstance';
import { useTranslation } from 'react-i18next';
import CreateInstanceDrawer from '../CreateInstanceDrawer';
import { useModelPageContext } from '../../context';
import { useInstanceSceneStore } from '@/store/InstanceSceneStore';
import { useInstanceRelationStore } from '@/store/InstanceRelationStore';

const DEFAULT_PAGE_SIZE = 20;
const DETAIL_HISTORY_PAGE_SIZE = 10;

type DrawerTabKey = 'detail' | 'relations' | 'history' | 'topology';

type WorkspaceMode = 'instances' | 'history';

interface InstanceWorkspaceProps {
  mode?: WorkspaceMode;
  defaultDrawerTab?: DrawerTabKey;
}

const renderJSONPreview = (value?: Record<string, unknown> | null) => {
  if (!value || Object.keys(value).length === 0) {
    return '--';
  }

  return <pre className="properties-preview">{JSON.stringify(value, null, 2)}</pre>;
};

const getInstanceName = (record: AggregateInstanceListItem) => {
  const nameFromProperties = record.properties?.name;
  if (typeof nameFromProperties === 'string' && nameFromProperties.trim()) {
    return nameFromProperties;
  }

  return record.instance_key;
};

const getInstanceIdentifier = (record: AggregateInstanceListItem) => {
  const raw = record.instance_key.split(':').slice(1).join(':');
  return raw || record.instance_key;
};

const getInstanceBusinessLabel = (record: AggregateInstanceListItem) => {
  const directBusinessID = record.binding_context?.business_id;
  if (typeof directBusinessID === 'string' && directBusinessID.trim()) {
    return directBusinessID;
  }

  const businessIDs = record.binding_context?.business_ids;
  if (Array.isArray(businessIDs) && businessIDs.length > 0) {
    return businessIDs.join(', ');
  }

  return '--';
};

const buildRelationDefinitionKey = (definition: {
  target_model_uid: string;
  association_uid: string;
}) => {
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
  const [instances, setInstances] = useState<AggregateInstanceListItem[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<AggregateInstanceListItem | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [createDrawerVisible, setCreateDrawerVisible] = useState(false);

  const [instanceRelationsLoading, setInstanceRelationsLoading] = useState(false);
  const [instanceRelations, setInstanceRelations] = useState<InstanceRelationItem[]>([]);
  const [selectedRelationDefinitionKey, setSelectedRelationDefinitionKey] = useState<string>();
  const [selectedTargetInstanceID, setSelectedTargetInstanceID] = useState<number>();
  const [relationSubmitting, setRelationSubmitting] = useState(false);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<InstanceHistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(DETAIL_HISTORY_PAGE_SIZE);
  const [historyTotal, setHistoryTotal] = useState(0);

  const [topologyLoading, setTopologyLoading] = useState(false);
  const [topologyGraph, setTopologyGraph] = useState<InstanceTopologyGraph | null>(null);
  const instanceDetailLoading = useInstanceSceneStore((state) => state.loading);
  const instanceDetail = useInstanceSceneStore((state) => state.detail);
  const openInstance = useInstanceSceneStore((state) => state.openInstance);
  const resetInstanceScene = useInstanceSceneStore((state) => state.reset);
  const instanceRelationDetail = useInstanceRelationStore((state) => state.detail);
  const relationCapabilities = useInstanceRelationStore((state) => state.capabilities);
  const relationCapabilitiesLoading = useInstanceRelationStore((state) => state.loading);
  const loadInstanceCapabilities = useInstanceRelationStore((state) => state.loadCapabilities);
  const resetInstanceCapabilities = useInstanceRelationStore((state) => state.reset);

  const modelDisplayNameMap = useMemo(() => {
    const map = new Map<string, string>();
    allModels.forEach((model) => {
      map.set(model.name, model.display_name);
    });
    return map;
  }, [allModels]);

  const selectedRelationDefinition = useMemo(() => {
    return (instanceRelationDetail?.constraints?.associations || []).find(
      (item) => buildRelationDefinitionKey(item) === selectedRelationDefinitionKey,
    );
  }, [instanceRelationDetail?.constraints?.associations, selectedRelationDefinitionKey]);

  const fetchInstances = async () => {
    try {
      setLoading(true);
      const response = await listAggregateInstances(detailModel.name, {
        page,
        page_size: pageSize,
      });
      setInstances(response.data.items || []);
      setTotal(response.data.pagination?.total || 0);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstancesFailed'));
    } finally {
      setLoading(false);
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

    void openInstance(selectedInstance.instance_key);
  }, [drawerVisible, openInstance, selectedInstance]);

  useEffect(() => {
    if (!drawerVisible || !selectedInstance) {
      return;
    }

    if (drawerTab === 'relations') {
      void loadInstanceCapabilities(selectedInstance.instance_key);
      void loadInstanceRelations(getInstanceIdentifier(selectedInstance));
      return;
    }

    if (drawerTab === 'history') {
      loadInstanceHistory(getInstanceIdentifier(selectedInstance));
      return;
    }

    if (drawerTab === 'topology') {
      loadInstanceTopology(getInstanceIdentifier(selectedInstance));
    }
  }, [drawerVisible, drawerTab, selectedInstance?.instance_key, historyPage, historyPageSize, detailModel.name]);

  const openInstanceDrawer = (
    record: AggregateInstanceListItem,
    tab: DrawerTabKey = defaultDrawerTab,
  ) => {
    setSelectedInstance(record);
    setDrawerTab(tab);
    setDrawerVisible(true);
    setHistoryPage(1);
    setHistoryPageSize(DETAIL_HISTORY_PAGE_SIZE);
    setSelectedRelationDefinitionKey(undefined);
    setSelectedTargetInstanceID(undefined);
  };

  const closeDrawer = () => {
    setDrawerVisible(false);
    setSelectedInstance(null);
    setInstanceRelations([]);
    setHistoryItems([]);
    setHistoryTotal(0);
    setTopologyGraph(null);
    setSelectedRelationDefinitionKey(undefined);
    setSelectedTargetInstanceID(undefined);
    resetInstanceScene();
    resetInstanceCapabilities();
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
        source_id: Number(getInstanceIdentifier(selectedInstance)),
        target_id: selectedTargetInstanceID,
        association_uid: selectedRelationDefinition.association_uid,
      });
      message.success(t('resource.model.messages.createInstanceRelationSuccess'));
      setSelectedRelationDefinitionKey(undefined);
      setSelectedTargetInstanceID(undefined);
      await loadInstanceRelations(getInstanceIdentifier(selectedInstance));
      await loadInstanceTopology(getInstanceIdentifier(selectedInstance));
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
      await loadInstanceRelations(getInstanceIdentifier(selectedInstance));
      await loadInstanceTopology(getInstanceIdentifier(selectedInstance));
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.deleteInstanceRelationFailed'));
    }
  };

  const instanceColumns: ColumnsType<AggregateInstanceListItem> = [
    {
      title: 'ID',
      key: 'id',
      width: 220,
      render: (_value, record) => getInstanceIdentifier(record),
    },
    {
      title: t('resource.model.columns.instanceName'),
      key: 'name',
      width: 220,
      render: (_value, record) => getInstanceName(record),
    },
    {
      title: t('resource.model.columns.business'),
      key: 'business_id',
      width: 220,
      render: (_value, record) => getInstanceBusinessLabel(record),
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
    ? `${getInstanceName(selectedInstance)} (${getInstanceIdentifier(selectedInstance)})`
    : t('resource.model.tabs.instances');

  const relationDefinitionOptions = (instanceRelationDetail?.constraints?.associations || []).map((definition) => ({
    label: `${modelDisplayNameMap.get(definition.target_model_uid) || definition.target_model_uid} / ${definition.association_uid} / ${definition.mapping}`,
    value: buildRelationDefinitionKey(definition),
  }));

  const targetInstanceOptions = relationCapabilities
    .filter((item) => buildRelationDefinitionKey(item as { target_model_uid: string; association_uid: string }) === selectedRelationDefinitionKey)
    .filter((item) => item.relation_allowed !== false)
    .map((item) => ({
      label: `${item.name || item.resource_id} (${item.resource_id})`,
      value: Number(item.resource_id),
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
        rowKey="instance_key"
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
                      <Descriptions.Item label="Key">{instanceDetail.instance_key}</Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.fields.name')}>
                        {typeof instanceDetail.properties?.name === 'string'
                          ? instanceDetail.properties.name
                          : '--'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.columns.modelName')}>
                        {instanceDetail.model?.display_name
                          || modelDisplayNameMap.get(instanceDetail.model?.model_uid || '')
                          || instanceDetail.model?.model_uid
                          || '--'}
                      </Descriptions.Item>
                      <Descriptions.Item label="Model UID">
                        {instanceDetail.model?.model_uid || '--'}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.tabs.instanceRelations')}>
                        {instanceDetail.relation_summary?.total ?? 0}
                      </Descriptions.Item>
                      <Descriptions.Item label={t('resource.model.tabs.instanceHistory')}>
                        {instanceDetail.history_summary?.total ?? 0}
                      </Descriptions.Item>
                      <Descriptions.Item label="Allowed Actions" span={2}>
                        {(instanceDetail.allowed_actions || []).length > 0 ? (
                          <Space wrap>
                            {(instanceDetail.allowed_actions || []).map((action) => (
                              <Tag key={action}>{action}</Tag>
                            ))}
                          </Space>
                        ) : (
                          '--'
                        )}
                      </Descriptions.Item>
                    </Descriptions>

                    <div>
                      <div className="model-page-note">{t('resource.model.tabs.instanceDetail')}</div>
                      {renderJSONPreview(instanceDetail.properties || {})}
                    </div>

                    <div>
                      <div className="model-page-note">Binding Context</div>
                      {renderJSONPreview(instanceDetail.binding_context || {})}
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
                        <Button onClick={() => loadInstanceRelations(getInstanceIdentifier(selectedInstance))}>
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
                        loading={relationCapabilitiesLoading}
                        onChange={(value) => setSelectedRelationDefinitionKey(value)}
                        allowClear
                      />
                      <Select
                        style={{ minWidth: 260 }}
                        value={selectedTargetInstanceID}
                        placeholder={t('resource.model.placeholders.targetInstance')}
                        options={targetInstanceOptions}
                        loading={relationCapabilitiesLoading}
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
