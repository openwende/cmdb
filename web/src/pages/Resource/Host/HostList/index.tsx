import React, { useCallback, useEffect, useState } from 'react';
import { Table, Button, Dropdown, Modal, Tooltip, Checkbox, Empty } from 'antd';
import { useAppMessage } from '@/utils/message';
import {
  DownOutlined,
  ExclamationCircleFilled,
  HistoryOutlined,
  CloseOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import {
  resourceAssignMenuItems,
  resourceCopyMenuItems,
  resourceMoreMenuItems,
} from '../../constants';
import { MenuItemProps, ResourceCopyKey, ResourceMoreKey } from '../../Types';
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
  const activeDir = directories.find((d) => d.bk_module_id === selectedId);
  const dirDisplayName = activeDir?.bk_module_name ?? t('host.directory.hostPool');

  // Pool hosts
  const poolHosts = usePoolHostStore((state) => state.hosts);
  const poolHostTotal = usePoolHostStore((state) => state.total);
  const poolHostLoading = usePoolHostStore((state) => state.loading);
  const query = usePoolHostStore((state) => state.query);
  const setPoolHostQuery = usePoolHostStore((state) => state.setQuery);
  const fetchPoolHosts = usePoolHostStore((state) => state.fetchHosts);

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
  }, [fetchPoolHosts, query.directoryId, query.page, query.pageSize]);

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
      render: (_: any, record: any) => record.host.bk_host_id,
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
      checked
        ? Array.from(new Set([...current, hostId]))
        : current.filter((key) => key !== hostId),
    );
  };

  const emptyNode = (
    <div className="host-list-empty">
      <InboxOutlined className="host-list-empty__icon" />
      <p className="host-list-empty__hint">{t('resource.host.empty.poolHint', '此目录暂无主机')}</p>
      {canWrite && (
        <Button type="primary" onClick={() => setImportModalVisible(true)}>
          {t('resource.host.actions.importHost')}
        </Button>
      )}
    </div>
  );

  return (
    <div className="host-list-wrapper">
      {/* Toolbar */}
      <div className="host-list-toolbar">
        <div className="host-list-toolbar__dir">
          <span className="host-list-toolbar__dir-name">{dirDisplayName}</span>
          <span className="host-list-toolbar__dir-count">{poolHostTotal}</span>
        </div>
        <div className="host-list-toolbar__actions">
          {canWrite && (
            <Button type="primary" onClick={() => setImportModalVisible(true)}>
              {t('resource.host.actions.importHost')}
            </Button>
          )}
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
          locale={{ emptyText: emptyNode }}
        />
      </div>

      {/* Mobile card list — loading and empty are now mutually exclusive */}
      <div className="host-mobile-card-list" aria-live="polite">
        {poolHostLoading ? (
          <div className="host-mobile-loading">
            <div className="host-mobile-loading__spinner" aria-label="加载中" />
          </div>
        ) : poolHosts.length > 0 ? (
          poolHosts.map((record: any) => {
            const hostId = getHostKey(record);
            const selected = selectedRowKeys.includes(hostId);
            const cloudInfo = record.host.bk_cloud_id;
            return (
              <article key={hostId} className="host-mobile-card">
                <div className="host-mobile-card__head">
                  <Checkbox
                    checked={selected}
                    onChange={(e) => toggleSelectedHost(hostId, e.target.checked)}
                    aria-label={`选择主机 ${hostId}`}
                  />
                  <div>
                    <div className="host-mobile-card__title">
                      {record.host.bk_host_innerip || hostId}
                    </div>
                    <div className="host-mobile-card__meta">ID {hostId}</div>
                  </div>
                </div>
                <dl className="host-mobile-card__grid">
                  <div>
                    <dt>{t('resource.host.columns.innerIpv6')}</dt>
                    <dd>{record.host.bk_host_innerip_v6 || '--'}</dd>
                  </div>
                  <div>
                    <dt>{t('resource.host.columns.cloudArea')}</dt>
                    <dd>
                      {cloudInfo?.length ? cloudInfo[0].bk_inst_name : '--'}
                    </dd>
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

      {/* Floating Action Bar — appears when rows are selected */}
      <div className={`host-fab${hasSelection ? ' host-fab--visible' : ''}`} aria-hidden={!hasSelection}>
        <span className="host-fab__count">
          已选 <strong>{selectedRowKeys.length}</strong> 台
        </span>
        <div className="host-fab__actions">
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
            <Button type="primary" disabled={!canWrite}>
              {t('resource.host.actions.assignTo')} <DownOutlined />
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
            <Button>
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
              <Button>
                {t('resource.host.actions.more')} <DownOutlined />
              </Button>
            </Dropdown>
          )}
        </div>
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => setSelectedRowKeys([])}
          className="host-fab__close"
          aria-label="取消选择"
        />
      </div>

      {/* Modals */}
      <AssignModal
        assignType={assignType}
        selectedRowKeys={selectedRowKeys}
        hostPoolStatuses={hostPoolStatuses}
        onClose={() => setAssignType(AssignType.None)}
      />
      <ImportHost
        visible={importModalVisible}
        selectedDirId={selectedId}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default HostList;
