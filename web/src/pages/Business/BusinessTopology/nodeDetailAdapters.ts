import { TreeData } from '../Types';

type NodeExtra = NonNullable<TreeData['extra']>;

const readString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return undefined;
};

const readList = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (Array.isArray(value)) {
      const items = value
        .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '').trim()))
        .filter(Boolean);

      if (items.length > 0) {
        return items.join(', ');
      }
    }

    const asString = readString(value);
    if (asString) {
      return asString;
    }
  }

  return undefined;
};

const getExtra = (selectedNode: TreeData): NodeExtra => selectedNode.extra ?? {};

export const normalizeBusinessNodeDetail = (selectedNode: TreeData) => {
  const extra = getExtra(selectedNode);

  return {
    bk_biz_id: readString(extra.bk_biz_id, selectedNode.nodeId) ?? '',
    bk_biz_name: readString(extra.bk_biz_name, extra.name, selectedNode.title) ?? '--',
    create_time: readString(extra.create_time, extra.created_at),
    bk_created_by: readString(extra.bk_created_by, extra.created_by),
    last_time: readString(extra.last_time, extra.updated_at),
    bk_updated_by: readString(extra.bk_updated_by, extra.updated_by),
    life_cycle: readString(extra.life_cycle, extra.lifecycle),
    time_zone: readString(extra.time_zone, extra.timezone),
    language: readString(extra.language),
    bk_biz_maintainer: readList(extra.bk_biz_maintainer, extra.sres, extra.maintainers),
    bk_biz_productor: readList(extra.bk_biz_productor, extra.bizops),
    bk_biz_tester: readList(extra.bk_biz_tester, extra.testers),
    bk_biz_developer: readList(extra.bk_biz_developer, extra.developers),
    operator: readList(extra.operator, extra.operators),
  };
};

const mapEnvTypeToLegacy = (value: string | undefined): string | undefined => {
  switch (value) {
    case 'test':
      return '1';
    case 'staging':
      return '2';
    case 'prod':
      return '3';
    default:
      return undefined;
  }
};

export const normalizeSetNodeDetail = (selectedNode: TreeData) => {
  const extra = getExtra(selectedNode);
  const description = readString(extra.description, extra.bk_set_desc) ?? '';

  return {
    bk_set_id: readString(extra.bk_set_id, selectedNode.nodeId) ?? '',
    bk_set_name: readString(extra.bk_set_name, extra.name, selectedNode.title) ?? '--',
    bk_set_desc: readString(extra.bk_set_desc, extra.description) ?? '',
    bk_service_status: readString(extra.bk_service_status, extra.service_status),
    bk_set_env: readString(extra.bk_set_env, mapEnvTypeToLegacy(readString(extra.env_type))),
    bk_capacity: readString(extra.bk_capacity, extra.capacity),
    description,
    create_time: readString(extra.create_time, extra.created_at),
    last_time: readString(extra.last_time, extra.updated_at),
    bk_created_by: readString(extra.bk_created_by, extra.created_by),
    bk_updated_by: readString(extra.bk_updated_by, extra.updated_by),
    set_template_id: readString(extra.set_template_id),
  };
};

const mapServiceTypeToLegacy = (value: string | undefined): string | undefined => {
  switch (value) {
    case 'db':
      return '2';
    case 'web':
    case 'api':
    case 'cache':
    case 'mq':
    case 'other':
      return '1';
    default:
      return undefined;
  }
};

export const normalizeModuleNodeDetail = (selectedNode: TreeData) => {
  const extra = getExtra(selectedNode);

  return {
    bk_module_id: readString(extra.bk_module_id, selectedNode.nodeId) ?? '',
    bk_module_name: readString(extra.bk_module_name, extra.name, selectedNode.title) ?? '--',
    bk_module_type: readString(
      extra.bk_module_type,
      mapServiceTypeToLegacy(readString(extra.service_type)),
    ),
    service_type: readString(extra.service_type),
    operator: readList(extra.operator, extra.operators),
    bk_bak_operator: readList(extra.bk_bak_operator, extra.backup_operators),
    create_time: readString(extra.create_time, extra.created_at),
    last_time: readString(extra.last_time, extra.updated_at),
    bk_created_by: readString(extra.bk_created_by, extra.created_by),
    bk_updated_by: readString(extra.bk_updated_by, extra.updated_by),
    host_apply_enabled: Boolean(extra.host_apply_enabled),
    service_template_id: readString(extra.service_template_id),
    service_category_id: readString(extra.service_category_id),
  };
};
