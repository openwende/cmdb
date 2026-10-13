/**
 * 主机详情适配器：把 `GET /v1/hosts/display/:display_id` 和主机审计列表的后端结构
 * 转成详情抽屉直接显示的模型。空值统一显示 `--`。
 */

import dayjs from 'dayjs';
import type { AuditLogRaw } from '../services/audit';
import type { HostDetailRaw, HostPlacementRaw } from '../types/host';

export const HOST_EMPTY_TEXT = '--';

const HOST_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export interface HostPlacementView {
  key: string;
  kind: 'business' | 'pool';
  /** 业务：`业务 / 集群 / 模块`；资源池：目录名称 */
  label: string;
}

export interface HostCustomFieldView {
  key: string;
  value: string;
}

export interface HostDetailView {
  displayId: number;
  hostName: string;
  primaryIp: string;
  ipAddresses: string;
  status: string;
  os: string;
  cpu: string;
  memory: string;
  disk: string;
  cloudVendor: string;
  cloudArea: string;
  cloudInstanceId: string;
  cloudRegion: string;
  vpcId: string;
  subnetId: string;
  placements: HostPlacementView[];
  customFields: HostCustomFieldView[];
  createdAt: string;
  updatedAt: string;
}

export interface HostAuditView {
  id: number;
  /** 后端原样的 operation_time（不带时区的 UTC），显示时用审计页同一个格式化函数 */
  operationTime: string;
  action: string;
  user: string;
}

const text = (value?: string | null): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || HOST_EMPTY_TEXT;
};

const numberWithUnit = (value: number | null | undefined, unit?: string): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return HOST_EMPTY_TEXT;
  return unit ? `${value} ${unit}` : String(value);
};

/** 内存（后端单位 MB）：≥1024 MB 换算成 GB（整数不带小数，否则保留 1 位），小于 1024 显示 MB */
export const formatMemory = (memoryMb: number | null | undefined): string => {
  if (typeof memoryMb !== 'number' || !Number.isFinite(memoryMb)) return HOST_EMPTY_TEXT;
  if (memoryMb < 1024) return `${memoryMb} MB`;
  return `${Number((memoryMb / 1024).toFixed(1))} GB`;
};

/** ISO 时间按浏览器本地时区显示 */
export const formatHostTime = (value?: string | null): string => {
  if (!value) return HOST_EMPTY_TEXT;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(HOST_TIME_FORMAT) : value;
};

/** 自定义字段的值：字符串原样，数字 / 布尔转文本，数组和对象显示成 JSON 文本 */
export const formatCustomFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) return HOST_EMPTY_TEXT;
  if (typeof value === 'string') return text(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const nameOrId = (name?: string, id?: number): string => {
  if (name && name.trim()) return name.trim();
  if (id !== undefined && id !== null) return `#${id}`;
  return HOST_EMPTY_TEXT;
};

const adaptPlacement = (placement: HostPlacementRaw, index: number): HostPlacementView => {
  if (placement.kind === 'pool') {
    return {
      key: `pool-${placement.directory_id ?? ''}-${index}`,
      kind: 'pool',
      label: nameOrId(placement.directory_name, placement.directory_id),
    };
  }
  return {
    key: `business-${placement.module_id ?? ''}-${index}`,
    kind: 'business',
    label: [
      nameOrId(placement.business_name, placement.business_id),
      nameOrId(placement.set_name, placement.set_id),
      nameOrId(placement.module_name, placement.module_id),
    ].join(' / '),
  };
};

export const adaptHostDetail = (raw: HostDetailRaw): HostDetailView => {
  const os = [raw.os_type, raw.os_version]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');
  const ipAddresses = (raw.ip_addresses || []).filter(Boolean);

  return {
    displayId: raw.display_id,
    hostName: text(raw.host_name),
    primaryIp: text(raw.primary_ip),
    ipAddresses: ipAddresses.length ? ipAddresses.join(', ') : HOST_EMPTY_TEXT,
    status: text(raw.status),
    os: os || HOST_EMPTY_TEXT,
    cpu: numberWithUnit(raw.cpu),
    memory: formatMemory(raw.memory),
    disk: numberWithUnit(raw.disk_size, 'GB'),
    cloudVendor: text(raw.cloud_vendor),
    cloudArea: text(raw.cloud_area_name),
    cloudInstanceId: text(raw.cloud_instance_id),
    cloudRegion: text(raw.cloud_region),
    vpcId: text(raw.vpc_id),
    subnetId: text(raw.subnet_id),
    placements: (raw.placements || []).map(adaptPlacement),
    customFields: Object.entries(raw.custom_fields || {}).map(([key, value]) => ({
      key,
      value: formatCustomFieldValue(value),
    })),
    createdAt: formatHostTime(raw.created_at),
    updatedAt: formatHostTime(raw.updated_at),
  };
};

export const adaptHostAuditLogs = (items?: AuditLogRaw[] | null): HostAuditView[] =>
  (items || []).map((item) => ({
    id: item.id,
    operationTime: item.operation_time,
    action: item.action,
    user: text(item.user),
  }));
