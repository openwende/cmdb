import { beforeAll, describe, expect, it } from 'vitest';
import i18next, { type TFunction } from 'i18next';
import zhCN from '@/locales/zh-CN.json';
import enUS from '@/locales/en-US.json';
import {
  buildAuditChangeSummary,
  buildAuditFlow,
  buildAuditPropertyRows,
  buildDirectoryNameMap,
  formatAuditLocation,
  formatAuditTime,
  formatAuditValue,
} from '@/pages/Analysis/auditChange';
import { processDetailList } from '@/pages/Analysis/utils';
import type { OperationDetail } from '@/pages/Analysis/Types';

// 以下记录取自本地后端 GET /api/v1/audit?audit_type=host 的真实数据形状
const RECLAIM_622 = {
  id: 622,
  audit_type: 'host',
  user: 'chenjing',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: {
        business_id: '1029',
        business_name: '数据中台',
        host_name: 'data-etl-05',
        module_id: 109,
        module_ids: [109],
        module_names: ['待回收'],
        primary_ip: '10.40.1.15',
      },
      cur_data: {
        directory_id: 4,
        host_name: 'data-etl-05',
        primary_ip: '10.40.1.15',
        source: 'reclaim',
      },
      update_fields: ['directory_id', 'source'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-14 09:30:00',
  bk_biz_id: 0,
  biz_name: '',
  resource_id: 81,
  resource_name: '10.40.1.15',
};

const TRANSFER_613 = {
  id: 613,
  audit_type: 'host',
  user: 'zhangwei',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: {
        business_id: '1027',
        business_name: '支付清结算',
        host_name: 'pay-gw-01',
        module_id: 99,
        module_ids: [99],
        module_names: ['风控服务'],
        primary_ip: '10.20.1.11',
      },
      cur_data: {
        business_id: '1027',
        business_name: '支付清结算',
        host_name: 'pay-gw-01',
        module_id: 99,
        module_ids: [97, 99],
        module_names: ['支付网关', '风控服务'],
        primary_ip: '10.20.1.11',
        source: 'transfer',
      },
      update_fields: ['module_ids', 'module_names', 'source'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-17 01:12:00',
  bk_biz_id: 1027,
  biz_name: '支付清结算',
  resource_id: 43,
  resource_name: '10.20.1.11',
};

const ALLOCATE_885 = {
  id: 885,
  audit_type: 'host',
  user: 'zhangwei',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: { directory_id: 1, host_name: 'mall-gw-01', primary_ip: '10.10.2.11' },
      cur_data: {
        business_id: '1027',
        business_name: '支付清结算',
        host_name: 'mall-gw-01',
        module_id: 94,
        module_ids: [94],
        module_names: ['空闲机'],
        primary_ip: '10.10.2.11',
        source: 'allocate',
      },
      update_fields: [
        'business_id',
        'business_name',
        'module_id',
        'module_ids',
        'module_names',
        'source',
      ],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-19 02:19:00',
  bk_biz_id: 1027,
  biz_name: '支付清结算',
  resource_id: 14,
  resource_name: '10.10.2.11',
};

const IMPORT_404 = {
  id: 404,
  audit_type: 'host',
  user: 'chenjing',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: { host_name: 'pool-10-10-90-13', primary_ip: '10.10.90.23' },
      cur_data: {
        directory_id: 3,
        host_name: 'pool-10-10-90-13',
        primary_ip: '10.10.90.23',
        source: 'import',
      },
      update_fields: ['directory_id', 'source'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-07-26 03:05:12',
  bk_biz_id: 0,
  biz_name: '',
  resource_id: 125,
  resource_name: '10.10.90.23',
};

const hostSnapshot = {
  business_id: '1027',
  cloud_area_id: '0d7f4289-c812-4bb5-8a27-4a5c6ad7617c',
  cpu: 16,
  'custom_fields.SLA': '99.95%',
  'custom_fields.固资编号': 'WD-2024-00052',
  'custom_fields.备份': true,
  'custom_fields.标签': ['db'],
  'custom_fields.环境': '生产',
  'custom_fields.监控': true,
  'custom_fields.责任团队': '支付 SRE',
  disk_size: 1000,
  host_name: 'pay-db-02',
  ip_addresses: ['10.20.4.12'],
  memory: 65536,
  os_type: 'linux',
  os_version: 'Ubuntu 22.04.4 LTS',
  primary_ip: '10.20.4.12',
  status: 'running',
};

const CONFIG_627 = {
  id: 627,
  audit_type: 'host',
  user: 'zhangwei',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: hostSnapshot,
      cur_data: {
        ...hostSnapshot,
        'custom_fields.备份': false,
        'custom_fields.标签': ['db', '维护窗口'],
      },
      update_fields: ['custom_fields.备份', 'custom_fields.标签'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-21 15:31:00',
  bk_biz_id: 1027,
  biz_name: '支付清结算',
  resource_id: 57,
  resource_name: '10.20.4.12',
};

const CONFIG_617 = {
  id: 617,
  audit_type: 'host',
  user: 'chenjing',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: { ...hostSnapshot, disk_size: 300, status: 'stopped' },
      cur_data: { ...hostSnapshot, disk_size: 500, status: 'running' },
      update_fields: ['disk_size', 'status'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-11 08:05:00',
  bk_biz_id: 1026,
  biz_name: '文德商城',
  resource_id: 20,
  resource_name: '10.10.3.13',
};

const CREATE_204 = {
  id: 204,
  audit_type: 'host',
  user: 'chenjing',
  resource_type: 'host',
  action: 'create',
  operation_detail: {
    details: {
      pre_data: null,
      cur_data: {
        cloud_area_id: '8a167e7d-69fb-422a-96c4-fe75a19fe862',
        cpu: 8,
        'custom_fields.备份': false,
        'custom_fields.标签': ['etl'],
        disk_size: 200,
        host_name: 'data-etl-04',
        ip_addresses: ['10.40.1.14'],
        memory: 32768,
        os_type: 'linux',
        os_version: 'Rocky Linux 9.3',
        primary_ip: '10.40.1.14',
        status: 'running',
      },
      update_fields: null,
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-07-26 02:01:14',
  bk_biz_id: 0,
  biz_name: '',
  resource_id: 80,
  resource_name: '10.40.1.14',
};

const BUSINESS_UPDATE_57 = {
  id: 57,
  audit_type: 'business',
  user: 'system',
  resource_type: 'business',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: null,
      cur_data: { business_id: '1003', name: '测试跳转2' },
      update_fields: null,
    },
    bk_obj_id: 'business',
  },
  operation_time: '2026-09-09 07:43:02',
  bk_biz_id: 1003,
  biz_name: '测试跳转2',
  resource_id: 1003,
  resource_name: '测试跳转2',
};

// getResourceDirectoryTree() 的 data
const DIRECTORY_TREE = [
  { id: 1, name: '默认目录', children: [] },
  { id: 3, name: '腾讯云上海弹性备机' },
  { id: 4, name: '高配计算', children: [{ id: 41, name: '高配子目录' }] },
];

let zh: TFunction;
let en: TFunction;

beforeAll(async () => {
  const instance = i18next.createInstance();
  await instance.init({
    resources: { 'zh-CN': { translation: zhCN }, 'en-US': { translation: enUS } },
    lng: 'zh-CN',
    fallbackLng: 'zh-CN',
    interpolation: { escapeValue: false },
  });
  zh = instance.getFixedT('zh-CN');
  en = instance.getFixedT('en-US');
});

const toRecord = (raw: unknown): OperationDetail => processDetailList([raw])[0];
const directories = () => buildDirectoryNameMap(DIRECTORY_TREE);

describe('audit host change flow', () => {
  describe('formatAuditTime', () => {
    it('converts the backend UTC string to Beijing time regardless of the runtime TZ', () => {
      expect(formatAuditTime('2026-09-14 09:30:00')).toBe('2026-09-14 17:30:00');
      expect(formatAuditTime('2026-09-17 01:12:00')).toBe('2026-09-17 09:12:00');
      // 跨天
      expect(formatAuditTime('2026-09-21 18:31:00')).toBe('2026-09-22 02:31:00');
    });

    it('keeps empty and unparsable values readable', () => {
      expect(formatAuditTime('')).toBe('--');
      expect(formatAuditTime(null)).toBe('--');
      expect(formatAuditTime('not-a-time')).toBe('not-a-time');
    });

    it('is applied by processDetailList', () => {
      expect(toRecord(RECLAIM_622).time).toBe('2026-09-14 17:30:00');
      expect(toRecord(TRANSFER_613).time).toBe('2026-09-17 09:12:00');
    });
  });

  describe('directory names', () => {
    it('flattens nested directory nodes', () => {
      const map = directories();
      expect(map.get(4)).toBe('高配计算');
      expect(map.get(41)).toBe('高配子目录');
      expect(buildDirectoryNameMap(undefined).size).toBe(0);
    });

    it('falls back to the directory id when the name is unknown or the tree failed to load', () => {
      expect(formatAuditLocation({ directory_id: 99 }, directories(), zh)).toBe(
        '资源池 / 目录 #99',
      );
      expect(formatAuditLocation({ directory_id: 4 }, new Map(), zh)).toBe('资源池 / 目录 #4');
    });

    it('formats business, multi-module and unassigned locations', () => {
      expect(
        formatAuditLocation(
          { business_name: '支付清结算', module_names: ['支付网关', '风控服务'] },
          new Map(),
          zh,
        ),
      ).toBe('支付清结算 / 支付网关、风控服务');
      expect(formatAuditLocation({ host_name: 'x', primary_ip: '1.1.1.1' }, new Map(), zh)).toBe(
        '无归属',
      );
    });
  });

  describe('AC1 reclaim 622', () => {
    it('shows the move from business to resource pool in the list and the detail', () => {
      const record = toRecord(RECLAIM_622);
      const summary = buildAuditChangeSummary(record, directories(), zh);
      expect(summary.kind).toBe('flow');
      expect(summary.text).toBe('数据中台 / 待回收 → 资源池 / 高配计算');
      expect(summary.fullText).toBe('回收到资源池  数据中台 / 待回收 → 资源池 / 高配计算');

      expect(buildAuditFlow(record.details, directories(), zh)).toEqual({
        type: 'reclaim',
        label: '回收到资源池',
        from: '数据中台 / 待回收',
        to: '资源池 / 高配计算',
      });
    });

    it('lists the real fields instead of internal ids', () => {
      const rows = buildAuditPropertyRows(toRecord(RECLAIM_622).details, zh);
      expect(rows.map((row) => [row.label, row.before, row.after])).toEqual([
        ['业务', '数据中台', '--'],
        ['模块', '待回收', '--'],
      ]);
      const allFields = buildAuditPropertyRows(toRecord(RECLAIM_622).details, zh, true).map(
        (row) => row.field,
      );
      expect(allFields).toEqual(['host_name', 'primary_ip', 'business_name', 'module_names']);
    });
  });

  it('AC2 transfer 613 joins multiple modules', () => {
    const record = toRecord(TRANSFER_613);
    const summary = buildAuditChangeSummary(record, directories(), zh);
    expect(summary.fullText).toBe('转移  支付清结算 / 风控服务 → 支付清结算 / 支付网关、风控服务');
    expect(record.time).toBe('2026-09-17 09:12:00');
    expect(
      buildAuditPropertyRows(record.details, zh).map((row) => [row.label, row.before, row.after]),
    ).toEqual([['模块', '风控服务', '支付网关、风控服务']]);
  });

  it('AC3 allocate 885 moves from the default directory to a business', () => {
    const summary = buildAuditChangeSummary(toRecord(ALLOCATE_885), directories(), zh);
    expect(summary.fullText).toBe('分配到业务  资源池 / 默认目录 → 支付清结算 / 空闲机');
  });

  it('AC4 import 404 starts from no owner', () => {
    const summary = buildAuditChangeSummary(toRecord(IMPORT_404), directories(), zh);
    expect(summary.fullText).toBe('导入资源池  无归属 → 资源池 / 腾讯云上海弹性备机');
  });

  describe('AC5 config change', () => {
    it('627 shows boolean and array values', () => {
      const record = toRecord(CONFIG_627);
      const summary = buildAuditChangeSummary(record, directories(), zh);
      expect(summary.kind).toBe('fields');
      expect(summary.text).toBe('备份 是 → 否；标签 db → db、维护窗口');

      const rows = buildAuditPropertyRows(record.details, zh);
      expect(rows.map((row) => [row.label, row.before, row.after])).toEqual([
        ['备份', '是', '否'],
        ['标签', 'db', 'db、维护窗口'],
      ]);

      const expanded = buildAuditPropertyRows(record.details, zh, true);
      expect(expanded.length).toBeGreaterThan(rows.length);
      expect(expanded.find((row) => row.field === 'memory')).toMatchObject({
        label: '内存（MB）',
        before: '65536',
        after: '65536',
      });
      expect(expanded.find((row) => row.field === 'ip_addresses')?.after).toBe('10.20.4.12');
      expect(expanded.some((row) => row.field === 'business_id')).toBe(false);
      expect(expanded.every((row) => row.after === '--')).toBe(false);
    });

    it('617 shows disk size and status', () => {
      const summary = buildAuditChangeSummary(toRecord(CONFIG_617), directories(), zh);
      expect(summary.text).toBe('磁盘（GB） 300 → 500；状态 stopped → running');
    });

    it('collapses more than two fields into "等 N 项"', () => {
      const raw = {
        ...CONFIG_617,
        operation_detail: {
          ...CONFIG_617.operation_detail,
          details: {
            pre_data: { ...hostSnapshot, memory: 16384, disk_size: 300, status: 'stopped' },
            cur_data: { ...hostSnapshot, memory: 32768, disk_size: 500, status: 'running' },
            update_fields: ['disk_size', 'memory', 'status'],
          },
        },
      };
      const summary = buildAuditChangeSummary(toRecord(raw), directories(), zh);
      expect(summary.text).toBe('磁盘（GB） 300 → 500；内存（MB） 16384 → 32768 等 3 项');
      expect(summary.fullText).toBe(
        '磁盘（GB） 300 → 500；内存（MB） 16384 → 32768；状态 stopped → running',
      );
    });
  });

  it('AC6 create shows "新建主机" and the created configuration', () => {
    const record = toRecord(CREATE_204);
    expect(buildAuditChangeSummary(record, directories(), zh).text).toBe('新建主机');
    const rows = buildAuditPropertyRows(record.details, zh);
    expect(rows.find((row) => row.field === 'cpu')).toMatchObject({
      label: 'CPU（核）',
      after: '8',
    });
    expect(rows.find((row) => row.field === 'memory')?.after).toBe('32768');
    expect(rows.find((row) => row.field === 'disk_size')?.after).toBe('200');
    expect(rows.find((row) => row.field === 'custom_fields.备份')?.after).toBe('否');
    expect(rows.every((row) => row.before === '--')).toBe(true);
  });

  it('AC7 business tab records show their real fields', () => {
    const record = toRecord(BUSINESS_UPDATE_57);
    expect(buildAuditFlow(record.details, directories(), zh)).toBeNull();
    expect(buildAuditPropertyRows(record.details, zh)).toEqual([
      { field: 'name', label: 'name', before: '--', after: '测试跳转2' },
    ]);
    expect(buildAuditChangeSummary(record, directories(), zh).text).toBe('name -- → 测试跳转2');
  });

  it('formats values and labels in English too', () => {
    expect(formatAuditValue(true, en)).toBe('Yes');
    expect(formatAuditValue(['db', 'x'], en)).toBe('db, x');
    expect(formatAuditValue(null, en)).toBe('--');
    expect(buildAuditChangeSummary(toRecord(RECLAIM_622), new Map(), en).fullText).toBe(
      'Returned to Pool  数据中台 / 待回收 → Resource Pool / Directory #4',
    );
  });
});
