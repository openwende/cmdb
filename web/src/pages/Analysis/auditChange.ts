import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { TFunction } from 'i18next';
import type { OperationDetail } from '@/pages/Analysis/Types';

dayjs.extend(utc);

/**
 * 审计记录的变更内容转换（纯函数）。
 * 后端每条主机审计记录的 operation_detail.details 有 pre_data / cur_data / update_fields，
 * 流转记录靠 cur_data.source 区分；这里把它们转换成列表摘要、流向和属性表行。
 */

export type AuditTranslate = TFunction;

export type AuditDetails = OperationDetail['details'];

export type AuditFlowType = 'import' | 'allocate' | 'transfer' | 'reclaim';

export const AUDIT_FLOW_TYPES: AuditFlowType[] = ['import', 'allocate', 'transfer', 'reclaim'];

/** 流转类型标签颜色（AntD Tag 预设色） */
export const AUDIT_FLOW_TAG_COLORS: Record<AuditFlowType, string> = {
  import: 'geekblue',
  allocate: 'green',
  transfer: 'blue',
  reclaim: 'orange',
};

/** 已经体现在流向里的内部字段，不单独列出 */
export const AUDIT_HIDDEN_FIELDS = new Set([
  'module_id',
  'module_ids',
  'business_id',
  'directory_id',
  'source',
]);

/** 有中文名的字段，同时决定属性表展开后的排序 */
const FIELD_LABEL_KEYS: Record<string, string> = {
  host_name: 'analysis.audit.change.fields.host_name',
  primary_ip: 'analysis.audit.change.fields.primary_ip',
  ip_addresses: 'analysis.audit.change.fields.ip_addresses',
  status: 'analysis.audit.change.fields.status',
  business_name: 'analysis.audit.change.fields.business_name',
  module_names: 'analysis.audit.change.fields.module_names',
  cpu: 'analysis.audit.change.fields.cpu',
  memory: 'analysis.audit.change.fields.memory',
  disk_size: 'analysis.audit.change.fields.disk_size',
  os_type: 'analysis.audit.change.fields.os_type',
  os_version: 'analysis.audit.change.fields.os_version',
};
const FIELD_ORDER = Object.keys(FIELD_LABEL_KEYS);

const CUSTOM_FIELD_PREFIX = 'custom_fields.';

/** 北京时间（Asia/Shanghai）固定 UTC+8，没有夏令时 */
const BEIJING_UTC_OFFSET_MINUTES = 8 * 60;
const AUDIT_TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const EMPTY_TEXT = '--';

/**
 * 后端 operation_time 是不带时区的 UTC 字符串（如 `2026-09-14 09:30:00`），
 * 转成北京时间显示；不依赖运行环境的本地时区。
 */
export const formatAuditTime = (value?: string | null): string => {
  if (!value) return EMPTY_TEXT;
  const parsed = dayjs.utc(value);
  if (!parsed.isValid()) return value;
  return parsed.utcOffset(BEIJING_UTC_OFFSET_MINUTES).format(AUDIT_TIME_FORMAT);
};

export interface DirectoryTreeNodeLike {
  id: number | string;
  name: string;
  children?: DirectoryTreeNodeLike[];
}

/** 把资源池目录树展开成 id → 名称 */
export const buildDirectoryNameMap = (
  nodes?: DirectoryTreeNodeLike[] | null,
): Map<number, string> => {
  const map = new Map<number, string>();
  const walk = (list?: DirectoryTreeNodeLike[] | null) => {
    (list || []).forEach((node) => {
      if (node && node.id !== undefined && node.id !== null) {
        map.set(Number(node.id), node.name);
      }
      walk(node?.children);
    });
  };
  walk(nodes);
  return map;
};

const isEmptyValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

const hasDirectory = (data?: Record<string, unknown> | null) =>
  !!data && !isEmptyValue(data.directory_id);

/** 流转记录的类型；不是流转记录返回 null */
export const getAuditFlowType = (details?: AuditDetails | null): AuditFlowType | null => {
  const source = details?.curData?.source;
  return AUDIT_FLOW_TYPES.includes(source) ? (source as AuditFlowType) : null;
};

/** 记录里是否引用了资源池目录（需要目录名） */
export const recordUsesDirectory = (record: OperationDetail) =>
  hasDirectory(record.details?.preData) || hasDirectory(record.details?.curData);

/**
 * 位置文案：
 * - 业务内：`业务名 / 模块名`，多个模块用"、"连接
 * - 资源池：`资源池 / 目录名`，查不到目录名时 `资源池 / 目录 #<id>`
 * - 既无业务也无目录：`无归属`
 */
export const formatAuditLocation = (
  data: Record<string, unknown> | null | undefined,
  directoryNames: Map<number, string>,
  t: AuditTranslate,
): string => {
  if (!data) return t('analysis.audit.change.unassigned');

  if (!isEmptyValue(data.business_name)) {
    const modules = Array.isArray(data.module_names)
      ? data.module_names.filter((name: unknown) => !isEmptyValue(name))
      : [];
    return modules.length > 0
      ? `${String(data.business_name)} / ${modules.join(t('analysis.audit.change.listSeparator'))}`
      : String(data.business_name);
  }

  if (hasDirectory(data)) {
    const directoryId = Number(data.directory_id);
    const directoryName =
      directoryNames.get(directoryId) ||
      t('analysis.audit.change.directoryFallback', { id: String(data.directory_id) });
    return `${t('analysis.audit.change.resourcePool')} / ${directoryName}`;
  }

  return t('analysis.audit.change.unassigned');
};

export const getAuditFieldLabel = (field: string, t: AuditTranslate): string => {
  if (FIELD_LABEL_KEYS[field]) return t(FIELD_LABEL_KEYS[field]);
  if (field.startsWith(CUSTOM_FIELD_PREFIX)) return field.slice(CUSTOM_FIELD_PREFIX.length);
  return field;
};

/** 值：布尔显示"是 / 否"，数组用"、"连接，空值显示 `--` */
export const formatAuditValue = (value: unknown, t: AuditTranslate): string => {
  if (isEmptyValue(value)) return EMPTY_TEXT;
  if (typeof value === 'boolean') {
    return value ? t('analysis.audit.change.yes') : t('analysis.audit.change.no');
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => formatAuditValue(item, t))
      .join(t('analysis.audit.change.listSeparator'));
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const isSameValue = (a: unknown, b: unknown) => {
  if (isEmptyValue(a) && isEmptyValue(b)) return true;
  return JSON.stringify(a) === JSON.stringify(b);
};

const sortFields = (fields: string[]) => {
  const indexed = fields.map((field, index) => ({ field, index }));
  indexed.sort((a, b) => {
    const ra = FIELD_ORDER.indexOf(a.field);
    const rb = FIELD_ORDER.indexOf(b.field);
    const ka = ra === -1 ? FIELD_ORDER.length : ra;
    const kb = rb === -1 ? FIELD_ORDER.length : rb;
    return ka !== kb ? ka - kb : a.index - b.index;
  });
  return indexed.map((item) => item.field);
};

/** 快照里出现过的全部字段（去掉内部字段） */
export const getAuditSnapshotFields = (details?: AuditDetails | null): string[] => {
  const fields: string[] = [];
  const add = (field: string) => {
    if (!AUDIT_HIDDEN_FIELDS.has(field) && !fields.includes(field)) fields.push(field);
  };
  Object.keys(details?.preData || {}).forEach(add);
  Object.keys(details?.curData || {}).forEach(add);
  return sortFields(fields);
};

/**
 * 改了的字段：配置变更以 update_fields 为准；
 * update_fields 为空或只有内部字段时（流转、新建、业务页签记录），按前后快照比较得出。
 */
export const getAuditChangedFields = (details?: AuditDetails | null): string[] => {
  const updateFields = (details?.updateFields || []).filter(
    (field) => !AUDIT_HIDDEN_FIELDS.has(field),
  );
  if (updateFields.length > 0 && !getAuditFlowType(details)) {
    return updateFields;
  }

  const preData = details?.preData || {};
  const curData = details?.curData || {};
  const changed = getAuditSnapshotFields(details).filter(
    (field) => !isSameValue(preData[field], curData[field]),
  );
  updateFields.forEach((field) => {
    if (!changed.includes(field)) changed.push(field);
  });
  return changed;
};

export interface AuditPropertyRow {
  field: string;
  label: string;
  before: string;
  after: string;
}

/** 详情属性表的行：默认只有改了的字段，展开后是快照全部字段 */
export const buildAuditPropertyRows = (
  details: AuditDetails | null | undefined,
  t: AuditTranslate,
  expanded = false,
): AuditPropertyRow[] => {
  const fields = expanded
    ? sortFields(
        Array.from(
          new Set([...getAuditSnapshotFields(details), ...getAuditChangedFields(details)]),
        ),
      )
    : getAuditChangedFields(details);
  return fields.map((field) => ({
    field,
    label: getAuditFieldLabel(field, t),
    before: formatAuditValue(details?.preData?.[field], t),
    after: formatAuditValue(details?.curData?.[field], t),
  }));
};

export interface AuditFlow {
  type: AuditFlowType;
  label: string;
  from: string;
  to: string;
}

export const buildAuditFlow = (
  details: AuditDetails | null | undefined,
  directoryNames: Map<number, string>,
  t: AuditTranslate,
): AuditFlow | null => {
  const type = getAuditFlowType(details);
  if (!type) return null;
  return {
    type,
    label: t(`analysis.audit.change.flowTypes.${type}`),
    from: formatAuditLocation(details?.preData, directoryNames, t),
    to: formatAuditLocation(details?.curData, directoryNames, t),
  };
};

export type AuditChangeSummary =
  | { kind: 'flow'; flow: AuditFlow; text: string; fullText: string }
  | { kind: 'create'; text: string; fullText: string }
  | { kind: 'fields'; text: string; fullText: string }
  | { kind: 'none'; text: string; fullText: string };

const SUMMARY_FIELD_LIMIT = 2;

/**
 * 列表"变更内容"一列：
 * - 流转：类型标签 + `变更前位置 → 变更后位置`
 * - 新建主机：`新建主机`
 * - 其他（配置变更等）：前 2 个字段 `字段 前 → 后`，多出的显示"等 N 项"
 */
export const buildAuditChangeSummary = (
  record: OperationDetail,
  directoryNames: Map<number, string>,
  t: AuditTranslate,
): AuditChangeSummary => {
  const flow = buildAuditFlow(record.details, directoryNames, t);
  if (flow) {
    const text = `${flow.from} → ${flow.to}`;
    return { kind: 'flow', flow, text, fullText: `${flow.label}  ${text}` };
  }

  if (record.actionKey === 'create') {
    const text =
      record.object === 'host'
        ? t('analysis.audit.change.createHost')
        : t('analysis.audit.change.create');
    return { kind: 'create', text, fullText: text };
  }

  const rows = getAuditChangedFields(record.details).map(
    (field) =>
      `${getAuditFieldLabel(field, t)} ${formatAuditValue(record.details?.preData?.[field], t)} → ${formatAuditValue(record.details?.curData?.[field], t)}`,
  );
  if (rows.length === 0) {
    return { kind: 'none', text: EMPTY_TEXT, fullText: EMPTY_TEXT };
  }

  const separator = t('analysis.audit.change.itemSeparator');
  const shown = rows.slice(0, SUMMARY_FIELD_LIMIT).join(separator);
  const text =
    rows.length > SUMMARY_FIELD_LIMIT
      ? `${shown} ${t('analysis.audit.change.more', { count: rows.length })}`
      : shown;
  return { kind: 'fields', text, fullText: rows.join(separator) };
};
