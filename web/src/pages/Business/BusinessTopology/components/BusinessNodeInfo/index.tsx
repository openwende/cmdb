import React, { useEffect, useMemo, useState } from 'react';
import { Collapse } from 'antd';
import { useTranslation } from 'react-i18next';
import { getBusinessDetail } from '@/api';
import type { BusinessDetail } from '@/api/types/resource';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import { normalizeBusinessNodeDetail } from '../../nodeDetailAdapters';
import './style.css';

interface Props {
  selectedNode: TreeData;
}

type NormalizedBusinessNodeDetail = ReturnType<typeof normalizeBusinessNodeDetail>;

const isEmptyValue = (value?: string | null): boolean => !value || value === '--';

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString();
};

const getLifecycleLabel = (value: string | undefined, t: (key: string) => string): string => {
  switch (value) {
    case '1':
    case 'testing':
      return t('business.topology.businessNodeInfo.testing');
    case '2':
    case 'online':
      return t('business.topology.businessNodeInfo.online');
    case 'offline':
      return 'offline';
    default:
      return '--';
  }
};

const getLanguageLabel = (value: string | undefined, t: (key: string) => string): string => {
  switch (value) {
    case '1':
    case 'zh':
    case 'zh-CN':
      return t('business.topology.businessNodeInfo.chinese');
    case '2':
    case 'en':
    case 'en-US':
      return t('business.topology.businessNodeInfo.english');
    default:
      return '--';
  }
};

const needsHydration = (bizData: NormalizedBusinessNodeDetail): boolean => {
  return [
    bizData.create_time,
    bizData.bk_created_by,
    bizData.last_time,
    bizData.bk_updated_by,
    bizData.time_zone,
    bizData.language,
    bizData.bk_biz_maintainer,
    bizData.bk_biz_productor,
    bizData.bk_biz_tester,
    bizData.bk_biz_developer,
  ].some((value) => isEmptyValue(value));
};

const mergeBusinessDetail = (
  base: NormalizedBusinessNodeDetail,
  detail: BusinessDetail | null,
): NormalizedBusinessNodeDetail => {
  if (!detail) {
    return base;
  }

  return {
    ...base,
    bk_biz_name: isEmptyValue(base.bk_biz_name) ? detail.name : base.bk_biz_name,
    create_time: isEmptyValue(base.create_time) ? detail.created_at : base.create_time,
    bk_created_by: isEmptyValue(base.bk_created_by) ? detail.created_by : base.bk_created_by,
    last_time: isEmptyValue(base.last_time) ? detail.updated_at : base.last_time,
    bk_updated_by: isEmptyValue(base.bk_updated_by) ? detail.updated_by : base.bk_updated_by,
    life_cycle: isEmptyValue(base.life_cycle) ? detail.lifecycle : base.life_cycle,
    time_zone: isEmptyValue(base.time_zone) ? detail.timezone : base.time_zone,
    language: isEmptyValue(base.language) ? detail.language : base.language,
    bk_biz_maintainer: isEmptyValue(base.bk_biz_maintainer)
      ? detail.sres?.join(', ')
      : base.bk_biz_maintainer,
    bk_biz_productor: isEmptyValue(base.bk_biz_productor)
      ? detail.bizops?.join(', ')
      : base.bk_biz_productor,
    bk_biz_tester: isEmptyValue(base.bk_biz_tester)
      ? detail.testers?.join(', ')
      : base.bk_biz_tester,
    bk_biz_developer: isEmptyValue(base.bk_biz_developer)
      ? detail.developers?.join(', ')
      : base.bk_biz_developer,
  };
};

const shouldShowValue = (value?: string | null): boolean => !isEmptyValue(value);

const BusinessNodeInfo: React.FC<Props> = ({ selectedNode }) => {
  const { t } = useTranslation();
  const [hydratedDetail, setHydratedDetail] = useState<BusinessDetail | null>(null);
  const baseBizData = useMemo(() => normalizeBusinessNodeDetail(selectedNode), [selectedNode]);

  useEffect(() => {
    const businessID = String(selectedNode.nodeId ?? baseBizData.bk_biz_id ?? '').trim();

    setHydratedDetail(null);

    if (!businessID || !needsHydration(baseBizData)) {
      return;
    }

    let cancelled = false;

    const fetchBusinessDetail = async () => {
      try {
        const response = await getBusinessDetail(Number(businessID));
        if (!cancelled && response?.data) {
          setHydratedDetail(response.data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to hydrate business node detail:', error);
        }
      }
    };

    fetchBusinessDetail();

    return () => {
      cancelled = true;
    };
  }, [baseBizData, selectedNode.nodeId]);

  const bizData = useMemo(
    () => mergeBusinessDetail(baseBizData, hydratedDetail),
    [baseBizData, hydratedDetail],
  );
  const basicFields = useMemo(
    () =>
      [
        { label: 'ID', value: bizData.bk_biz_id },
        {
          label: t('business.topology.businessNodeInfo.businessName'),
          value: bizData.bk_biz_name,
        },
        {
          label: t('business.topology.businessNodeInfo.createTime'),
          value: formatDateTime(bizData.create_time),
        },
        {
          label: t('business.topology.businessNodeInfo.creator'),
          value: bizData.bk_created_by,
          optional: true,
        },
        {
          label: t('business.topology.businessNodeInfo.updateTime'),
          value: formatDateTime(bizData.last_time),
        },
        {
          label: t('business.topology.businessNodeInfo.updater'),
          value: bizData.bk_updated_by,
          optional: true,
        },
        {
          label: t('business.topology.businessNodeInfo.lifecycle'),
          value: getLifecycleLabel(bizData.life_cycle, t),
          optional: true,
        },
        {
          label: t('business.topology.businessNodeInfo.timezone'),
          value: bizData.time_zone,
          optional: true,
        },
        {
          label: t('business.topology.businessNodeInfo.language'),
          value: getLanguageLabel(bizData.language, t),
          optional: true,
        },
      ].filter((field) => !field.optional || shouldShowValue(field.value)),
    [bizData, t],
  );
  const roleFields = useMemo(
    () =>
      [
        {
          label: t('business.topology.businessNodeInfo.maintainer'),
          value: bizData.bk_biz_maintainer,
        },
        {
          label: t('business.topology.businessNodeInfo.productor'),
          value: bizData.bk_biz_productor,
        },
        {
          label: t('business.topology.businessNodeInfo.tester'),
          value: bizData.bk_biz_tester,
        },
        {
          label: t('business.topology.businessNodeInfo.developer'),
          value: bizData.bk_biz_developer,
        },
        {
          label: t('business.topology.businessNodeInfo.operator'),
          value: bizData.operator,
        },
      ].filter((field) => shouldShowValue(field.value)),
    [bizData, t],
  );

  return (
    <>
      <Collapse
        defaultActiveKey={['1', '2']}
        ghost
        items={[
          {
            key: '1',
            label: (
              <span className="basic-info">
                {t('business.topology.businessNodeInfo.basicInfo')}
              </span>
            ),
            children: (
              <div className="info-grid">
                {basicFields.map((field) => (
                  <InfoItem key={field.label} label={field.label} value={field.value} />
                ))}
              </div>
            ),
          },
          {
            key: '2',
            label: (
              <span className="basic-info">{t('business.topology.businessNodeInfo.roles')}</span>
            ),
            children:
              roleFields.length > 0 ? (
                <div className="info-grid">
                  {roleFields.map((field) => (
                    <InfoItem key={field.label} label={field.label} value={field.value} />
                  ))}
                </div>
              ) : (
                <div className="info-empty">
                  {t('business.topology.businessNodeInfo.rolesEmpty')}
                </div>
              ),
          },
        ]}
      />
    </>
  );
};

export default BusinessNodeInfo;
