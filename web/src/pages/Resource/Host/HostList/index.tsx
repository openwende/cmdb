import React, { useCallback, useEffect, useState } from 'react';
import { Table, Button, Dropdown, Modal, Tooltip, Checkbox, Empty, Input } from 'antd';
import { useAppMessage } from '@/utils/message';
import { DownOutlined, ExclamationCircleFilled, HistoryOutlined } from '@ant-design/icons';
import {
  resourceAssignMenuItems,
  resourceCopyMenuItems,
  resourceMoreMenuItems,
} from '../../constants';
import { ResourceCopyKey, ResourceMoreKey } from '../../Types';
import Pagination from '@/components/common/Pagination';
import { AssignType } from '../../Types';
import AssignModal from '../components/AssignModal';
import { getHostCopyValue, checkHostsInHostPool } from '../../utils';
import { useTranslation } from 'react-i18next';
import ImportHost from '../components/ImportHost';
import './style.css';
import { useDirectoryStore } from '@/store/DirectoryStore';
import { usePoolHostStore } from '@/store/PoolHostStore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/store/AuthStore';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import HostDetailDrawer from '../components/HostDetailDrawer';
import { useHostDetailDeepLink } from '../hooks/useHostDetailDeepLink';

interface HostListProps {
  selectedId?: number;
}

export const hostResourcePath = '/resource/host';
export const deleteHistoryPath = hostResourcePath + '/deleteHistory';

const HostList: React.FC<HostListProps> = ({ selectedId }) => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canWrite = useAuthStore((state) => state.canWrite());
  const { confirm } = Modal;

  // Directory context
  const directories = useDirectoryStore((state) => state.directories);
  const fetchDirectories = useDirectoryStore((state) => state.fetchDirectories);
  const removePoolHosts = usePoolHostStore((state) => state.removeHosts);

  // Pool hosts
  const poolHosts = usePoolHostStore((state) => state.hosts);
  const poolHostTotal = usePoolHostStore((state) => state.total);
  const poolHostLoading = usePoolHostStore((state) => state.loading);
  const query = usePoolHostStore((state) => state.query);
  const setPoolHostQuery = usePoolHostStore((state) => state.setQuery);
  const searchPoolHosts = usePoolHostStore((state) => state.search);
  const fetchPoolHosts = usePoolHostStore((state) => state.fetchHosts);

  // Search: the box is controlled locally; the store only holds the submitted keyword
  const submittedKeyword = query.keyword || '';
  const [searchInput, setSearchInput] = useState(submittedKeyword);
  // 关键字在别处被改掉（如退出登录时 reset）时，输入框跟着同步
  useEffect(() => {
    setSearchInput(submittedKeyword);
  }, [submittedKeyword]);

  // Host detail drawer (deep link `?host_id=<display_id>`)
  const hostDetail = useHostDetailDeepLink();

  // Modals
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [assignType, setAssignType] = useState<AssignType>(AssignType.None);

  // Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const hasSelection = selectedRowKeys.length > 0;

  useEffect(() => {
    setSelectedRowKeys([]);
    setPoolHostQuery({
      directoryId: selectedId && selectedId > 0 ? selectedId : undefined,
      page: 1,
    });
  }, [selectedId, setPoolHostQuery]);

  useEffect(() => {
    void fetchPoolHosts();
  }, [fetchPoolHosts, query.directoryId, query.page, query.pageSize, query.keyword]);

  // 回车 / 点搜索按钮 / 点 × 时提交；关键字和页码都没变时（再按一次回车）重新拉一次
  const handleSearch = (value: string) => {
    const keyword = value.trim();
    setSelectedRowKeys([]);
    if (keyword === submittedKeyword && query.page === 1) {
      void fetchPoolHosts();
      return;
    }
    searchPoolHosts(keyword);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    handleSearch('');
  };

  const hostPoolStatuses = checkHostsInHostPool(selectedRowKeys, poolHosts, directories);

  const handleCopyMenuClick = useCallback(
    (copyKey: ResourceCopyKey) => {
      if (!selectedRowKeys.length) return;
      const selectedHosts = poolHosts.filter((h: any) =>
        selectedRowKeys.includes(h.host.bk_host_id),
      );
      const text = selectedHosts.map((rec: any) => getHostCopyValue(rec, copyKey)).join('\n');
      if (!text) {
        message.warning(t('resource.host.messages.noCopyContent'));
        return;
      }
      navigator.clipboard
        ?.writeText(text)
        .then(() => message.success(t('resource.host.messages.copySuccess')))
        .catch(() => message.error(t('resource.host.messages.copyFailed')));
    },
    [poolHosts, selectedRowKeys, message, t],
  );

  const handleMoreMenuClick = (key: ResourceMoreKey) => {
    if (!canWrite) return;
    if (key === ResourceMoreKey.Delete) {
      confirm({
        title: t('resource.host.messages.confirmDelete'),
        icon: <ExclamationCircleFilled />,
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onOk() {
          message.success(t('resource.host.messages.deleteSuccess'));
        },
      });
    }
  };

  const handleImportSuccess = () => {
    void fetchDirectories();
    void fetchPoolHosts();
  };

  const columns = [
    {
      title: t('resource.host.columns.id'),
      width: 80,
      sorter: true,
      render: (_: any, record: any) => {
        const displayId = record.host.bk_host_display_id;
        if (displayId === undefined || displayId === null || displayId === record.host.bk_host_id) {
          return record.host.bk_host_id;
        }
        return (
          <Button
            type="link"
            size="small"
            className="host-list-id-link"
            aria-label={t('resource.host.aria.openDetail', { id: displayId })}
            onClick={() => hostDetail.open(displayId)}
          >
            {displayId}
          </Button>
        );
      },
    },
    {
      title: t('resource.host.columns.innerIpv4'),
      sorter: true,
      render: (_: any, record: any) => record.host.bk_host_innerip || '--',
    },
    {
      title: t('resource.host.columns.innerIpv6'),
      sorter: true,
      render: (_: any, record: any) => record.host.bk_host_innerip_v6 || '--',
    },
    {
      title: t('resource.host.columns.cloudArea'),
      render: (_: any, record: any) => {
        const cloudInfo = record.host.bk_cloud_id;
        return cloudInfo?.length ? cloudInfo[0].bk_inst_name : '--';
      },
    },
    {
      title: t('resource.host.columns.cloudHostStatus'),
      sorter: true,
      render: (_: any, record: any) => record.host.bk_cloud_host_status || '--',
    },
  ];

  const getHostKey = (record: any) => record.host.bk_host_id;

  const toggleSelectedHost = (hostId: React.Key, checked: boolean) => {
    setSelectedRowKeys((current) =>
      checked ? Array.from(new Set([...current, hostId])) : current.filter((key) => key !== hostId),
    );
  };

  const emptyNode = submittedKeyword ? (
    <EmptySearchResult onClearFilter={handleClearSearch} />
  ) : (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />
  );

  return (
    <div className="host-list-wrapper">
      {/* Toolbar */}
      <div className="host-list-toolbar">
        <div className="host-list-toolbar__bulk-actions">
          {canWrite && (
            <Button type="primary" onClick={() => setImportModalVisible(true)}>
              {t('resource.host.actions.importHost')}
            </Button>
          )}
          <Dropdown
            menu={{
              items: resourceAssignMenuItems.map((item) => ({
                ...item,
                label: t(item.label),
              })),
              onClick: (e) => setAssignType(e.key as AssignType),
            }}
            trigger={['click']}
          >
            <Button disabled={!hasSelection || !canWrite}>
              {t('resource.host.actions.assign')} <DownOutlined />
            </Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: resourceCopyMenuItems.map((item: any) => ({
                ...item,
                label: t(item.label),
                children: item.children?.map((child: any) => ({
                  ...child,
                  label: t(child.label),
                })),
              })),
              onClick: ({ key }) => handleCopyMenuClick(key as ResourceCopyKey),
            }}
            trigger={['click']}
            overlayStyle={{ width: 190 }}
          >
            <Button disabled={!hasSelection}>
              {t('resource.host.actions.copy')} <DownOutlined />
            </Button>
          </Dropdown>
          {canWrite && (
            <Dropdown
              menu={{
                items: resourceMoreMenuItems.map((item) => ({
                  ...item,
                  label: t(item.label),
                })),
                onClick: ({ key }) => handleMoreMenuClick(key as ResourceMoreKey),
              }}
              trigger={['click']}
            >
              <Button disabled={!hasSelection}>
                {t('resource.host.actions.more')} <DownOutlined />
              </Button>
            </Dropdown>
          )}
        </div>
        <div className="host-list-toolbar__actions">
          <Input.Search
            className="host-list-toolbar__search"
            allowClear
            size="middle"
            placeholder={t('resource.host.search.placeholder')}
            aria-label={t('resource.host.search.placeholder')}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onSearch={handleSearch}
          />
          <Tooltip title={t('resource.host.tooltips.viewDeleteHistory')}>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => navigate(deleteHistoryPath + '?' + searchParams.toString())}
            />
          </Tooltip>
        </div>
      </div>

      {/* Desktop table */}
      <div className="host-list-table-shell">
        <Table
          columns={columns}
          dataSource={poolHosts}
          loading={poolHostLoading}
          rowKey={getHostKey}
          showSorterTooltip={false}
          pagination={false}
          scroll={{ x: 800 }}
          rowSelection={{
            selectedRowKeys,
            onChange: (rowKeys) => setSelectedRowKeys(rowKeys),
          }}
          locale={{ emptyText: poolHostLoading ? null : emptyNode }}
        />
      </div>

      {/* Mobile card list — loading and empty are now mutually exclusive */}
      <div className="host-mobile-card-list" aria-live="polite">
        {poolHostLoading ? (
          <div className="host-mobile-loading">
            <div className="host-mobile-loading__spinner" />
          </div>
        ) : poolHosts.length > 0 ? (
          poolHosts.map((record: any) => {
            const hostId = getHostKey(record);
            const hostDisplayId = record.host.bk_host_display_id ?? hostId;
            const selected = selectedRowKeys.includes(hostId);
            const cloudInfo = record.host.bk_cloud_id;
            return (
              <article key={hostId} className="host-mobile-card">
                <div className="host-mobile-card__head">
                  <Checkbox
                    checked={selected}
                    onChange={(e) => toggleSelectedHost(hostId, e.target.checked)}
                    aria-label={t('resource.host.aria.selectHost', { id: hostDisplayId })}
                  />
                  <div>
                    <div className="host-mobile-card__title">
                      {record.host.bk_host_innerip || hostId}
                    </div>
                    <div className="host-mobile-card__meta">
                      ID{' '}
                      {hostDisplayId !== hostId ? (
                        <Button
                          type="link"
                          size="small"
                          className="host-list-id-link"
                          aria-label={t('resource.host.aria.openDetail', { id: hostDisplayId })}
                          onClick={() => hostDetail.open(hostDisplayId)}
                        >
                          {hostDisplayId}
                        </Button>
                      ) : (
                        hostDisplayId
                      )}
                    </div>
                  </div>
                </div>
                <dl className="host-mobile-card__grid">
                  <div>
                    <dt>{t('resource.host.columns.innerIpv6')}</dt>
                    <dd>{record.host.bk_host_innerip_v6 || '--'}</dd>
                  </div>
                  <div>
                    <dt>{t('resource.host.columns.cloudArea')}</dt>
                    <dd>{cloudInfo?.length ? cloudInfo[0].bk_inst_name : '--'}</dd>
                  </div>
                  <div>
                    <dt>{t('resource.host.columns.cloudHostStatus')}</dt>
                    <dd>{record.host.bk_cloud_host_status || '--'}</dd>
                  </div>
                </dl>
              </article>
            );
          })
        ) : (
          <div className="host-list-empty host-list-empty--mobile">{emptyNode}</div>
        )}
      </div>

      <Pagination
        total={poolHostTotal}
        pageSize={query.pageSize}
        current={query.page}
        onChange={(nextPage, nextPageSize) =>
          setPoolHostQuery({ page: nextPage, pageSize: nextPageSize })
        }
        onSizeChange={(_, size) => setPoolHostQuery({ page: 1, pageSize: size })}
      />

      {/* Modals */}
      <AssignModal
        assignType={assignType}
        selectedRowKeys={selectedRowKeys}
        hostPoolStatuses={hostPoolStatuses}
        onClose={() => setAssignType(AssignType.None)}
        onSuccess={(type) => {
          if (type === AssignType.Biz) {
            removePoolHosts(selectedRowKeys.map(String));
          }
          setSelectedRowKeys([]);
          void fetchDirectories();
          void fetchPoolHosts();
        }}
      />
      <ImportHost
        visible={importModalVisible}
        selectedDirId={selectedId}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={handleImportSuccess}
      />
      <HostDetailDrawer
        displayId={hostDetail.displayId}
        onClose={hostDetail.close}
        onNotFound={hostDetail.notFound}
      />
    </div>
  );
};

export default HostList;
