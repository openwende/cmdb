import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Space, Spin, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { UnorderedListOutlined, AppstoreOutlined, ApartmentOutlined } from '@ant-design/icons';
import Pagination from '@/components/common/Pagination';
import { createModel, listModelGroups, listModels } from '@/api';
import { CreateModelPayload, ModelDefinition, ModelGroup } from '@/api/types/model';
import CreateModelDrawer from '../components/CreateModelDrawer';
import { buildModelDetailPath } from '..';
import { useAuthStore } from '@/store/AuthStore';
import './style.css';

const DEFAULT_PAGE_SIZE = 20;
const ALL_GROUP_KEY = 'all';

const ModelList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canWrite = useAuthStore((state) => state.canWrite());
  const [models, setModels] = useState<ModelDefinition[]>([]);
  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [activeGroup, setActiveGroup] = useState(ALL_GROUP_KEY);
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [modelData, groupData] = await Promise.all([listModels(), listModelGroups()]);
      setModels(modelData);
      setGroups(groupData);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredModels = useMemo(() => {
    const keyword = searchValue.trim().toLowerCase();
    const baseModels =
      activeGroup === ALL_GROUP_KEY
        ? models
        : models.filter((model) => model.group_id === activeGroup);
    if (!keyword) {
      return baseModels;
    }

    return baseModels.filter((model) => {
      return (
        model.name.toLowerCase().includes(keyword) ||
        model.display_name.toLowerCase().includes(keyword) ||
        model.classification.toLowerCase().includes(keyword) ||
        String(model.group_display_name || '').toLowerCase().includes(keyword)
      );
    });
  }, [models, activeGroup, searchValue]);

  const pagedModels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredModels.slice(start, start + pageSize);
  }, [filteredModels, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchValue, activeGroup]);

  const handleCreate = async (payload: CreateModelPayload) => {
    if (!canWrite) {
      return;
    }
    try {
      await createModel(payload);
      message.success(t('common.message.createSuccess'));
      setDrawerVisible(false);
      await fetchData();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.createFailed'));
      throw error;
    }
  };

  const columns: ColumnsType<ModelDefinition> = [
    {
      title: t('resource.model.columns.displayName'),
      dataIndex: 'display_name',
      width: 220,
      render: (_value, record) => (
        <Button type="link" className="table-link-button" onClick={() => navigate(buildModelDetailPath(record.name, 'basic'))}>
          {record.display_name}
        </Button>
      ),
    },
    {
      title: t('resource.model.columns.name'),
      dataIndex: 'name',
      width: 220,
    },
    {
      title: t('resource.model.columns.classification'),
      dataIndex: 'classification',
      width: 140,
      render: (value: string) => (
        <Tag>{t(`resource.model.options.classification.${value}`, { defaultValue: value })}</Tag>
      ),
    },
    {
      title: t('resource.model.columns.group'),
      dataIndex: 'group_display_name',
      width: 180,
      render: (value: string, record) => value || record.group_name || '--',
    },
    {
      title: t('resource.model.columns.icon'),
      dataIndex: 'icon',
      width: 120,
      render: (value: string) => value || '--',
    },
    {
      title: t('resource.model.columns.mainline'),
      dataIndex: 'is_mainline',
      width: 120,
      render: (value: boolean) =>
        value ? <Tag color="blue">{t('resource.model.options.boolean.yes')}</Tag> : '--',
    },
    {
      title: t('resource.model.columns.scope'),
      dataIndex: 'mainline_scope',
      width: 120,
      render: (value: string) => (value ? t(`resource.model.options.scope.${value}`, { defaultValue: value }) : '--'),
    },
    {
      title: t('resource.model.columns.level'),
      dataIndex: 'mainline_level',
      width: 100,
      render: (value?: number | null) => (value ?? '--'),
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
      width: 120,
      render: (_value, record) => (
        <Button type="link" className="table-link-button" onClick={() => navigate(buildModelDetailPath(record.name, 'basic'))}>
          {t('resource.model.actions.viewDetail')}
        </Button>
      ),
    },
  ];

  const groupItems: Array<{ key: string; label: string; count: number }> = [
    { key: ALL_GROUP_KEY, label: t('resource.model.groups.all'), count: models.length },
    ...groups.map((group) => ({
      key: group.id,
      label: group.display_name,
      count: group.model_count || 0,
    })),
  ];

  return (
    <div className="model-list">
      <aside className="model-group-sidebar">
        <div className="sidebar-title">{t('resource.model.sections.modelGroups')}</div>
        {groupItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`group-item ${activeGroup === item.key ? 'is-active' : ''}`}
            onClick={() => setActiveGroup(item.key)}
          >
            <span>{item.label}</span>
            <Tag>{item.count}</Tag>
          </button>
        ))}
      </aside>

      <div className="model-list-content">
        <div className="list-header">
          <div>
            <div className="list-title">{t('resource.model.sections.modelOverview')}</div>
            <div className="list-subtitle">{t('resource.model.helper.listOverview')}</div>
          </div>
          <Space className="list-operation">
            <div className="view-toggle">
              <button
                className={`view-toggle__btn ${viewMode === 'card' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setViewMode('card')}
              >
                <AppstoreOutlined />
              </button>
              <button
                className={`view-toggle__btn ${viewMode === 'list' ? 'view-toggle__btn--active' : ''}`}
                onClick={() => setViewMode('list')}
              >
                <UnorderedListOutlined />
              </button>
            </div>
            <Button type="primary" onClick={() => setDrawerVisible(true)} disabled={!canWrite}>
              {t('resource.model.actions.create')}
            </Button>
            <Button onClick={() => navigate('/model/groups')} disabled={!canWrite}>
              {t('resource.model.actions.manageGroups')}
            </Button>
          </Space>
        </div>
        <Input.Search
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder={t('resource.model.placeholders.search')}
          allowClear
          className="search-input"
        />

        {loading ? (
          <div className="table-spin">
            <Spin />
          </div>
        ) : viewMode === 'card' ? (
          <>
            <div className="model-card-grid">
              {pagedModels.map((model) => (
                <div
                  key={model.id}
                  className="model-card"
                  onClick={() => navigate(buildModelDetailPath(model.name, 'basic'))}
                >
                  <div className="model-card__header">
                    <div className="model-card__icon">
                      <ApartmentOutlined />
                    </div>
                    <div>
                      <div className="model-card__title">{model.display_name}</div>
                      <div className="model-card__subtitle">{model.name}</div>
                    </div>
                  </div>
                  <div className="model-card__desc">
                    {model.description || t('resource.model.empty.noDescription')}
                  </div>
                  <div className="model-card__footer">
                    <div>
                      <Tag className="model-card__tag">
                        {t(`resource.model.options.classification.${model.classification}`, {
                          defaultValue: model.classification,
                        })}
                      </Tag>
                      {model.is_mainline && (
                        <Tag color="blue" className="model-card__tag">
                          {t('resource.model.options.boolean.yes')}
                        </Tag>
                      )}
                    </div>
                    <span className="model-card__time">
                      {model.updated_at
                        ? dayjs(model.updated_at).format('MM-DD HH:mm')
                        : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {pagedModels.length === 0 && !loading && (
              <div className="model-card-empty">
                <ApartmentOutlined className="model-card-empty__icon" />
                <div className="model-card-empty__text">
                  {searchValue || activeGroup !== ALL_GROUP_KEY
                    ? t('resource.model.empty.noSearchResult', { defaultValue: '没有找到匹配的模型' })
                    : t('resource.model.empty.noModels', { defaultValue: '暂无模型，请先创建' })}
                </div>
              </div>
            )}
            <Pagination
              total={filteredModels.length}
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
          </>
        ) : (
          <>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={pagedModels}
              pagination={false}
              scroll={{ x: 1200 }}
            />
            <Pagination
              total={filteredModels.length}
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
          </>
        )}
      </div>

      <CreateModelDrawer
        visible={drawerVisible}
        parentModels={models}
        groups={groups}
        onClose={() => setDrawerVisible(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
};

export default ModelList;
