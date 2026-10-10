import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Descriptions, Table, Tag } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { OperationDetail } from '@/pages/Analysis/Types';
import {
  AUDIT_FLOW_TAG_COLORS,
  type AuditPropertyRow,
  buildAuditFlow,
  buildAuditPropertyRows,
} from '@/pages/Analysis/auditChange';
import './style.css';

export interface OperationDetailProps {
  visible: boolean;
  record: OperationDetail | null;
  /** 资源池目录 id → 名称，用于流向里的资源池位置 */
  directoryNames?: Map<number, string>;
  onClose: () => void;
}

const EMPTY_DIRECTORY_NAMES = new Map<number, string>();

const OperationDetail: React.FC<OperationDetailProps> = ({
  visible,
  record,
  directoryNames = EMPTY_DIRECTORY_NAMES,
  onClose,
}) => {
  const { t } = useTranslation();
  const [detailList, setDetailList] = useState<OperationDetail | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (record) {
      // Use the record data directly
      setDetailList(record);
      setIsExpanded(false);
    }
  }, [record]);

  // 流转记录（导入 / 分配 / 转移 / 回收）的前后位置
  const flow = useMemo(
    () => (detailList ? buildAuditFlow(detailList.details, directoryNames, t) : null),
    [detailList, directoryNames, t],
  );

  // 属性表：默认只显示改了的字段，展开后显示快照里的全部字段
  const filteredPropertyList = useMemo(
    () => (detailList ? buildAuditPropertyRows(detailList.details, t, isExpanded) : []),
    [detailList, isExpanded, t],
  );

  // Generate table columns based on detailList
  const generateColumns = (): ColumnsType<AuditPropertyRow> => {
    const columns: ColumnsType<AuditPropertyRow> = [
      {
        title: t('analysis.audit.columns.attribute'),
        dataIndex: 'label',
        key: 'label',
      },
    ];

    if (detailList) {
      const { preData, curData } = detailList.details;

      if (preData !== null) {
        columns.push({
          title: t('analysis.audit.columns.before'),
          dataIndex: 'before',
          key: 'before',
        });
      }
      if (curData !== null) {
        columns.push({
          title: t('analysis.audit.columns.after'),
          dataIndex: 'after',
          key: 'after',
        });
      }
    }

    // Calculate and set column widths evenly
    const columnWidth = `${100 / columns.length}%`;
    columns.forEach((column) => {
      column.width = columnWidth;
    });

    return columns;
  };

  // Calculate scroll Y dynamically based on content height
  const calculateScrollY = useMemo(() => {
    const maxHeight = window.innerHeight - (flow ? 452 : 312);
    // Estimate table content height: header(32px) + rows(32px each) + padding
    const estimatedContentHeight = 32 + filteredPropertyList.length * 32 + 16;

    // Only show scroll if content exceeds the max height
    return estimatedContentHeight > maxHeight ? Math.max(maxHeight, 160) : undefined;
  }, [filteredPropertyList.length, flow]);

  const descriptionItems = [
    {
      key: 'business',
      label: t('analysis.audit.detail.business'),
      children: detailList?.business || '--',
    },
    {
      key: 'object',
      label: t('analysis.audit.detail.object'),
      children: detailList?.object || '--',
    },
    {
      key: 'action',
      label: t('analysis.audit.detail.action'),
      children: detailList?.action || '--',
    },
    {
      key: 'modelType',
      label: t('analysis.audit.detail.modelType'),
      children: detailList?.modelType || '--',
    },
    {
      key: 'instance',
      label: t('analysis.audit.detail.instance'),
      children: detailList?.instance || '--',
    },
    {
      key: 'description',
      label: t('analysis.audit.detail.description'),
      children: detailList?.description || '--',
    },
    {
      key: 'time',
      label: t('analysis.audit.detail.time'),
      children: detailList?.time || '--',
    },
    {
      key: 'account',
      label: t('analysis.audit.detail.account'),
      children: detailList?.account || '--',
    },
  ];

  return (
    <Drawer
      title={t('analysis.audit.detail.title')}
      placement="right"
      width={760}
      open={visible}
      onClose={onClose}
      className="operation-details-drawer"
    >
      <>
        {/* Basic Information Section */}
        <Descriptions
          column={2}
          size="small"
          items={descriptionItems}
          className="description-list"
        />

        {/* Host Move Section */}
        {flow && (
          <section className="audit-flow" aria-label={t('analysis.audit.detail.flow')}>
            <div className="audit-flow__header">
              <span className="audit-flow__title">{t('analysis.audit.detail.flow')}</span>
              <Tag color={AUDIT_FLOW_TAG_COLORS[flow.type]}>{flow.label}</Tag>
            </div>
            <div className="audit-flow__body">
              <div className="audit-flow__side">
                <span className="audit-flow__label">{t('analysis.audit.columns.before')}</span>
                <span className="audit-flow__location">{flow.from}</span>
              </div>
              <ArrowRightOutlined className="audit-flow__arrow" aria-hidden />
              <div className="audit-flow__side audit-flow__side--after">
                <span className="audit-flow__label">{t('analysis.audit.columns.after')}</span>
                <span className="audit-flow__location">{flow.to}</span>
              </div>
            </div>
          </section>
        )}

        {/* Change Details Section */}
        <Table
          columns={generateColumns()}
          dataSource={filteredPropertyList}
          pagination={false}
          rowKey="field"
          size="small"
          bordered
          scroll={{ y: calculateScrollY }}
        />
        <div className="details-toggle">
          <a className="toggle-button" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? t('analysis.audit.buttons.collapse') : t('analysis.audit.buttons.expand')}
          </a>
        </div>
      </>
    </Drawer>
  );
};

export default OperationDetail;
