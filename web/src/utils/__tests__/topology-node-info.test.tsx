import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import SetNodeInfo from '@/pages/Business/BusinessTopology/components/SetNodeInfo';
import ModuleNodeInfo from '@/pages/Business/BusinessTopology/components/ModuleNodeInfo';
import BusinessNodeInfo from '@/pages/Business/BusinessTopology/components/BusinessNodeInfo';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const { getBusinessDetail } = vi.hoisted(() => ({
  getBusinessDetail: vi.fn(),
}));

vi.mock('@/api', () => ({
  getBusinessDetail,
}));

const buildNode = (overrides: Partial<TreeData>): TreeData => ({
  title: 'node',
  key: 'node-1',
  type: TopoTreeNodeType.Set,
  extra: {},
  ...overrides,
});

describe('topology node info components', () => {
  it('renders business info from selected node detail instead of legacy mock data', () => {
    render(
      <BusinessNodeInfo
        selectedNode={buildNode({
          key: 'business-1',
          nodeId: '1',
          title: 'SmokeBiz',
          type: TopoTreeNodeType.Biz,
          extra: {
            bk_biz_id: 1,
            bk_biz_name: 'SmokeBiz',
            create_time: '2026-03-10T16:05:49Z',
            last_time: '2026-03-10T16:05:49Z',
            bk_created_by: 'tester',
            bk_updated_by: 'operator',
            life_cycle: '2',
            time_zone: 'Asia/Shanghai',
            language: '1',
            bk_biz_maintainer: 'alice',
            bk_biz_productor: 'bob',
            bk_biz_tester: 'carol',
            bk_biz_developer: 'dave',
            operator: 'erin',
          },
        })}
      />,
    );

    expect(screen.getByText('SmokeBiz')).toBeInTheDocument();
    expect(screen.queryByText('business')).not.toBeInTheDocument();
  });

  it('renders missing business lifecycle and language as empty values', () => {
    render(
      <BusinessNodeInfo
        selectedNode={buildNode({
          key: 'business-2',
          nodeId: '2',
          title: 'SparseBiz',
          type: TopoTreeNodeType.Biz,
          extra: {
            bk_biz_id: 2,
            bk_biz_name: 'SparseBiz',
          },
        })}
      />,
    );

    expect(screen.getByText('SparseBiz')).toBeInTheDocument();
    expect(
      screen.queryByText('business.topology.businessNodeInfo.testing'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('business.topology.businessNodeInfo.english'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('business.topology.businessNodeInfo.rolesEmpty')).toBeInTheDocument();
  });

  it('prefers canonical business detail fields when legacy aliases are absent', () => {
    render(
      <BusinessNodeInfo
        selectedNode={buildNode({
          key: 'business-3',
          nodeId: '3',
          title: 'CanonicalBiz',
          type: TopoTreeNodeType.Biz,
          extra: {
            lifecycle: 'online',
            timezone: 'UTC',
            language: 'en',
            sres: ['alice', 'bob'],
            bizops: ['carol'],
            testers: ['dave'],
            developers: ['erin'],
          },
        })}
      />,
    );

    expect(screen.getByText('CanonicalBiz')).toBeInTheDocument();
    expect(screen.getByText('business.topology.businessNodeInfo.online')).toBeInTheDocument();
    expect(screen.getByText('business.topology.businessNodeInfo.english')).toBeInTheDocument();
    expect(screen.getByText('UTC')).toBeInTheDocument();
    expect(screen.getByText('alice, bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
    expect(screen.getByText('dave')).toBeInTheDocument();
    expect(screen.getByText('erin')).toBeInTheDocument();
  });

  it('hydrates sparse business nodes with fetched business detail data', async () => {
    getBusinessDetail.mockResolvedValueOnce({
      data: {
        id: '4',
        name: 'FetchedBiz',
        language: 'zh',
        lifecycle: 'testing',
        timezone: 'Asia/Shanghai',
        created_at: '2026-03-10T16:05:49Z',
        created_by: 'creator',
        updated_at: '2026-03-10T16:06:49Z',
        updated_by: 'updater',
        sres: ['alice'],
        bizops: ['bob'],
        testers: ['carol'],
        developers: ['dave'],
      },
    });

    render(
      <BusinessNodeInfo
        selectedNode={buildNode({
          key: 'business-4',
          nodeId: '4',
          title: 'FetchedBiz',
          type: TopoTreeNodeType.Biz,
          extra: {
            bk_biz_id: 4,
            bk_biz_name: 'FetchedBiz',
          },
        })}
      />,
    );

    await waitFor(() => {
      expect(getBusinessDetail).toHaveBeenCalledWith('4');
    });

    expect(await screen.findByText('Asia/Shanghai')).toBeInTheDocument();
    expect(screen.getByText('creator')).toBeInTheDocument();
    expect(screen.getByText('updater')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
    expect(screen.getByText('dave')).toBeInTheDocument();
  });

  it('renders set info from selected node detail instead of legacy mock data', () => {
    render(
      <SetNodeInfo
        selectedNode={buildNode({
          key: 'set-1',
          nodeId: '1',
          title: 'SmokeSet',
          type: TopoTreeNodeType.Set,
          extra: {
            bk_set_id: 1,
            bk_set_name: 'SmokeSet',
            bk_set_desc: 'Created from scene state',
            bk_set_env: '2',
            bk_service_status: '2',
            bk_capacity: '12',
            description: 'detail description',
            create_time: '2026-03-10T16:07:04Z',
            last_time: '2026-03-10T16:07:04Z',
            bk_created_by: 'tester',
            bk_updated_by: 'operator',
          },
        })}
      />,
    );

    expect(screen.getByText('SmokeSet')).toBeInTheDocument();
    expect(screen.queryByText('set2')).not.toBeInTheDocument();
  });

  it('prefers canonical set detail fields when legacy aliases are absent', () => {
    render(
      <SetNodeInfo
        selectedNode={buildNode({
          key: 'set-2',
          nodeId: '2',
          title: 'CanonicalSet',
          type: TopoTreeNodeType.Set,
          extra: {
            description: 'canonical description',
            env_type: 'staging',
            create_time: '2026-03-10T16:07:04Z',
            last_time: '2026-03-10T16:07:04Z',
          },
        })}
      />,
    );

    expect(screen.getByText('CanonicalSet')).toBeInTheDocument();
    expect(screen.getAllByText('canonical description')).toHaveLength(2);
    expect(
      screen.getByText('business.topology.setNodeInfo.environment.experience'),
    ).toBeInTheDocument();
  });

  it('renders module info from selected node detail instead of legacy mock data', () => {
    render(
      <ModuleNodeInfo
        selectedNode={buildNode({
          key: 'module-7',
          nodeId: '7',
          title: 'SmokeModule',
          type: TopoTreeNodeType.Module,
          extra: {
            bk_module_id: 7,
            bk_module_name: 'SmokeModule',
            bk_module_type: '2',
            operator: 'alice,bob',
            bk_bak_operator: 'carol',
            create_time: '2026-03-10T16:07:04Z',
            last_time: '2026-03-10T16:07:04Z',
            bk_created_by: 'tester',
            bk_updated_by: 'operator',
          },
        })}
      />,
    );

    expect(screen.getByText('SmokeModule')).toBeInTheDocument();
    expect(screen.queryByText('game')).not.toBeInTheDocument();
  });

  it('prefers canonical module detail fields when legacy aliases are absent', () => {
    render(
      <ModuleNodeInfo
        selectedNode={buildNode({
          key: 'module-8',
          nodeId: '8',
          title: 'CanonicalModule',
          type: TopoTreeNodeType.Module,
          extra: {
            service_type: 'web',
            operators: ['alice', 'bob'],
            backup_operators: ['carol'],
          },
        })}
      />,
    );

    expect(screen.getByText('CanonicalModule')).toBeInTheDocument();
    expect(screen.getByText('web')).toBeInTheDocument();
    expect(screen.getByText('alice, bob')).toBeInTheDocument();
    expect(screen.getByText('carol')).toBeInTheDocument();
  });
});
