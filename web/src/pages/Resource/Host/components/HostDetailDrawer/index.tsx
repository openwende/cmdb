import React, { useEffect, useRef, useState } from 'react';
import { Descriptions, Drawer, Empty, Spin, Tag } from 'antd';
import type { DescriptionsProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  adaptHostAuditLogs,
  adaptHostDetail,
  HOST_EMPTY_TEXT,
  type HostAuditView,
  type HostDetailView,
} from '@/api/adapters/hostAdapter';
import { getHostByDisplayId, listHostAuditLogs } from '@/api/services/host';
import { formatAuditTime } from '@/pages/Analysis/auditChange';
import { getHostActions } from '@/pages/Analysis/constants';
import { useAppMessage } from '@/utils/message';
import { getAuditRecordPath } from '@/utils/routes';
import { useResponsive } from '@/utils/useResponsive';
import './style.css';

/** 最近变更显示的条数 */
export const HOST_RECENT_AUDIT_SIZE = 5;

/**
 * 比 AI 助手抽屉（默认 1000）高一层：从 AI 回答里点主机引用时，
 * 主机详情要盖在 AI 抽屉上面，即使 AI 抽屉的容器比它后插入 body。
 */
const HOST_DETAIL_DRAWER_Z_INDEX = 1001;

interface HostDetailDrawerProps {
  /** 主机 display_id；为 null 时抽屉关闭 */
  displayId: number | null;
  onClose: () => void;
  /** 主机不存在（404）或编号非法（400）。不传时提示后直接关闭 */
  onNotFound?: () => void;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'success'; detail: HostDetailView }
  | { status: 'error' };

type AuditState =
  | { status: 'loading' }
  | { status: 'success'; items: HostAuditView[] }
  | { status: 'error' };

const HostDetailDrawer: React.FC<HostDetailDrawerProps> = ({ displayId, onClose, onNotFound }) => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const { isMobile } = useResponsive();
  const [detailState, setDetailState] = useState<DetailState>({ status: 'loading' });
  const [auditState, setAuditState] = useState<AuditState>({ status: 'loading' });

  // effect 只跟 displayId 走：语言切换、父组件重渲染时不重新请求
  const latest = useRef({ t, message, onClose, onNotFound });
  latest.current = { t, message, onClose, onNotFound };

  useEffect(() => {
    if (displayId === null) return undefined;
    let cancelled = false;
    setDetailState({ status: 'loading' });
    setAuditState({ status: 'loading' });

    getHostByDisplayId(displayId)
      .then((response) => {
        if (cancelled) return;
        if (!response?.data) throw Object.assign(new Error('empty'), { response: { status: 404 } });
        setDetailState({ status: 'success', detail: adaptHostDetail(response.data) });
      })
      .catch((error: { response?: { status?: number } }) => {
        if (cancelled) return;
        setDetailState({ status: 'error' });
        const { t: translate, message: api, onClose: close, onNotFound: notFound } = latest.current;
        const status = error?.response?.status;
        if (status === 404 || status === 400) {
          if (notFound) {
            notFound();
          } else {
            api.error(translate('resource.host.detail.messages.notFound'));
            close();
          }
          return;
        }
        api.error(translate('resource.host.detail.messages.loadFailed'));
        close();
      });

    listHostAuditLogs(displayId, HOST_RECENT_AUDIT_SIZE)
      .then((response) => {
        if (cancelled) return;
        setAuditState({
          status: 'success',
          items: adaptHostAuditLogs(response?.data?.info).slice(0, HOST_RECENT_AUDIT_SIZE),
        });
      })
      .catch(() => {
        if (!cancelled) setAuditState({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, [displayId]);

  const actionLabels = new Map(getHostActions(t).map((item) => [item.value, item.label]));

  const renderSection = (title: string, content: React.ReactNode) => (
    <section className="host-detail__section" aria-label={title}>
      <h3 className="host-detail__section-title">{title}</h3>
      {content}
    </section>
  );

  const renderItems = (items: DescriptionsProps['items']) => (
    <Descriptions
      bordered
      size="small"
      column={isMobile ? 1 : 2}
      items={items}
      className="host-detail__descriptions"
    />
  );

  const renderDetail = (detail: HostDetailView) => {
    const field = (key: string, value: string, span?: number) => ({
      key,
      label: t(`resource.host.detail.fields.${key}`),
      children: value,
      span,
    });

    return (
      <>
        {renderSection(
          t('resource.host.detail.sections.basic'),
          renderItems([
            field('id', String(detail.displayId)),
            field('hostName', detail.hostName),
            field('primaryIp', detail.primaryIp),
            field('status', detail.status),
            field('ipAddresses', detail.ipAddresses, 2),
            field('os', detail.os, 2),
            field('cpu', detail.cpu),
            field('memory', detail.memory),
            field('disk', detail.disk),
          ]),
        )}

        {renderSection(
          t('resource.host.detail.sections.placement'),
          detail.placements.length > 0 ? (
            <ul className="host-detail__placements">
              {detail.placements.map((placement) => (
                <li key={placement.key} className="host-detail__placement">
                  <Tag color={placement.kind === 'pool' ? 'orange' : 'blue'}>
                    {t(`resource.host.detail.placement.${placement.kind}`)}
                  </Tag>
                  <span className="host-detail__placement-label">{placement.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="host-detail__empty">{HOST_EMPTY_TEXT}</div>
          ),
        )}

        {renderSection(
          t('resource.host.detail.sections.cloud'),
          renderItems([
            field('cloudVendor', detail.cloudVendor),
            field('cloudArea', detail.cloudArea),
            field('cloudInstanceId', detail.cloudInstanceId),
            field('cloudRegion', detail.cloudRegion),
            field('vpcId', detail.vpcId),
            field('subnetId', detail.subnetId),
          ]),
        )}

        {renderSection(
          t('resource.host.detail.sections.customFields'),
          detail.customFields.length > 0 ? (
            renderItems(
              // 键名是用户自定义的，原样显示，不翻译
              detail.customFields.map((item) => ({
                key: `custom-${item.key}`,
                label: item.key,
                children: <span className="host-detail__value">{item.value}</span>,
              })),
            )
          ) : (
            <div className="host-detail__empty">{HOST_EMPTY_TEXT}</div>
          ),
        )}

        {renderSection(
          t('resource.host.detail.sections.time'),
          renderItems([field('createdAt', detail.createdAt), field('updatedAt', detail.updatedAt)]),
        )}

        {renderSection(t('resource.host.detail.sections.audit'), renderAudits())}
      </>
    );
  };

  const renderAudits = () => {
    if (auditState.status === 'loading') {
      return (
        <div className="host-detail__loading host-detail__loading--inline">
          <Spin size="small" />
        </div>
      );
    }
    if (auditState.status === 'error') {
      return <div className="host-detail__empty">{t('resource.host.detail.audit.loadFailed')}</div>;
    }
    if (auditState.items.length === 0) {
      return <div className="host-detail__empty">{t('resource.host.detail.audit.empty')}</div>;
    }
    return (
      <ul className="host-detail__audits">
        {auditState.items.map((item) => (
          <li key={item.id}>
            <Link
              to={getAuditRecordPath(item.id)}
              className="host-detail__audit"
              aria-label={t('resource.host.detail.audit.open', { id: item.id })}
            >
              <span className="host-detail__audit-time">{formatAuditTime(item.operationTime)}</span>
              <span className="host-detail__audit-action">
                {actionLabels.get(item.action) || item.action || HOST_EMPTY_TEXT}
              </span>
              <span className="host-detail__audit-user">{item.user}</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  };

  const detail = detailState.status === 'success' ? detailState.detail : null;
  // 关闭动画期间 displayId 已经是 null，标题沿用已加载的编号
  const titleId = displayId ?? detail?.displayId ?? null;

  return (
    <Drawer
      title={
        <span className="host-detail__title">
          {t('resource.host.detail.title')}
          {titleId !== null && (
            <span className="host-detail__title-meta">
              #{titleId}
              {detail && detail.hostName !== HOST_EMPTY_TEXT ? ` · ${detail.hostName}` : ''}
            </span>
          )}
        </span>
      }
      placement="right"
      width={isMobile ? '100%' : 720}
      open={displayId !== null}
      onClose={onClose}
      zIndex={HOST_DETAIL_DRAWER_Z_INDEX}
      rootClassName="host-detail-drawer"
    >
      {detail ? (
        renderDetail(detail)
      ) : detailState.status === 'loading' ? (
        <div className="host-detail__loading">
          <Spin />
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </Drawer>
  );
};

export default HostDetailDrawer;
