import { ACTION_LABELS } from '@/pages/Analysis/constants';
import { AuditTabKey, OperationDetail } from '@/pages/Analysis/Types';
import dayjs from 'dayjs';
import { formatAuditTime } from '@/pages/Analysis/auditChange';

export interface AuditQueryFilters {
  business?: number | string;
  operationTarget?: string;
  action?: string[] | string;
  timeRange?: [string, string] | null;
  account?: {
    type?: string;
    value?: string;
  };
  host?: {
    type?: string;
    value?: string;
  };
  instance?: {
    type?: string;
    value?: string;
  };
}

export const getDefaultAuditTimeRange = (): [dayjs.Dayjs, dayjs.Dayjs] => [
  dayjs().subtract(30, 'day'),
  dayjs(),
];

export const getDefaultAuditFilters = (): AuditQueryFilters => {
  const [startTime, endTime] = getDefaultAuditTimeRange();
  return {
    timeRange: [startTime.format('YYYY-MM-DD'), endTime.format('YYYY-MM-DD')],
  };
};

const includesIgnoreCase = (source: unknown, keyword?: string) => {
  if (!keyword) return true;
  return String(source || '')
    .toLowerCase()
    .includes(keyword.trim().toLowerCase());
};

const normalizeActionFilter = (action?: string[] | string) => {
  if (!action) return [];
  return Array.isArray(action) ? action : [action];
};

export const filterOperationDetails = (
  detailList: any[],
  tab: AuditTabKey,
  filters: AuditQueryFilters = {},
) => {
  const actionFilter = normalizeActionFilter(filters.action);

  return detailList.filter((detailItem) => {
    if (detailItem.audit_type !== tab) {
      return false;
    }

    if (filters.business && String(detailItem.bk_biz_id) !== String(filters.business)) {
      return false;
    }

    if (
      filters.operationTarget &&
      detailItem.resource_type !== filters.operationTarget &&
      detailItem.operation_detail?.bk_obj_id !== filters.operationTarget
    ) {
      return false;
    }

    if (actionFilter.length > 0 && !actionFilter.includes(detailItem.action)) {
      return false;
    }

    if (filters.timeRange?.[0] && filters.timeRange?.[1]) {
      const operationTime = dayjs(detailItem.operation_time);
      const startTime = dayjs(filters.timeRange[0]).startOf('day');
      const endTime = dayjs(filters.timeRange[1]).endOf('day');
      if (
        !operationTime.isValid() ||
        operationTime.isBefore(startTime) ||
        operationTime.isAfter(endTime)
      ) {
        return false;
      }
    }

    const accountKeyword = filters.account?.value?.trim();
    if (accountKeyword) {
      const matched = includesIgnoreCase(detailItem.user, accountKeyword);
      if (filters.account?.type === 'exclude' ? matched : !matched) {
        return false;
      }
    }

    const hostKeyword = filters.host?.value?.trim();
    if (hostKeyword) {
      const detail = detailItem.operation_detail?.details || {};
      const hostValues = [
        detailItem.resource_id,
        detailItem.resource_name,
        detail.pre_data?.bk_host_id,
        detail.pre_data?.bk_host_innerip,
        detail.pre_data?.bk_host_innerip_v6,
        detail.cur_data?.bk_host_id,
        detail.cur_data?.bk_host_innerip,
        detail.cur_data?.bk_host_innerip_v6,
      ];
      if (!hostValues.some((value) => includesIgnoreCase(value, hostKeyword))) {
        return false;
      }
    }

    const instanceKeyword = filters.instance?.value?.trim();
    if (instanceKeyword) {
      const instanceValues = [detailItem.resource_id, detailItem.resource_name];
      if (!instanceValues.some((value) => includesIgnoreCase(value, instanceKeyword))) {
        return false;
      }
    }

    return true;
  });
};

/***
 * Process the detail list from server response
 * @param detailList - The detail list to process
 * @returns The processed operation detail list
 */
export const processDetailList = (detailList: any[]): OperationDetail[] => {
  return detailList.map((detailItem, index) => {
    const {
      biz_name,
      resource_type,
      operation_detail,
      user,
      operation_time,
      resource_name,
      action,
    } = detailItem;

    const actionName = ACTION_LABELS[action] || action;

    return {
      id: detailItem.id || index + 1,
      business: biz_name || '--',
      object: resource_type,
      action: actionName,
      actionKey: action,
      modelType: operation_detail?.bk_obj_id || resource_type,
      instance: resource_name,
      description: `${actionName}${resource_name}`,
      time: formatAuditTime(operation_time),
      account: user,
      details: {
        preData: operation_detail?.details?.pre_data || null,
        curData: operation_detail?.details?.cur_data || null,
        updateFields: operation_detail?.details?.update_fields || null,
      },
    };
  });
};
