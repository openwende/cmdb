import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import TopologyTree from '@/pages/Business/BusinessTopology/components/TopologyTree';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/MainlineStore', () => ({
  useMainlineStore: () => ({
    getChildModels: () => [],
  }),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) =>
    selector
      ? selector({
          canWrite: () => true,
        })
      : {
          canWrite: () => true,
        },
}));

vi.mock('@/pages/Business/BusinessTopology/components/CreateNodeModal', () => ({
  default: () => null,
}));

vi.mock('antd', () => ({
  Button: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
  Tree: ({
    treeData,
    titleRender,
  }: {
    treeData: TreeData[];
    titleRender: (node: TreeData) => React.ReactNode;
  }) => {
    const renderNodes = (nodes: TreeData[]) =>
      nodes.map((node) => (
        <div key={node.key} data-testid={`tree-node-${node.key}`}>
          {titleRender(node)}
          {node.children?.length ? renderNodes(node.children) : null}
        </div>
      ));

    return <div>{renderNodes(treeData)}</div>;
  },
}));

describe('topology tree layout', () => {
  let styleContent = '';

  beforeAll(async () => {
    styleContent = await readFile(
      path.resolve(
        process.cwd(),
        'src/pages/Business/BusinessTopology/components/TopologyTree/style.css',
      ),
      'utf8',
    );
  });

  it('wraps long topology titles in a dedicated text container', () => {
    render(
      <TopologyTree
        treeData={[
          {
            key: 'set-4',
            type: TopoTreeNodeType.Set,
            objName: '集',
            title: 'ProbeSet-1773163724333',
            children: [
              {
                key: 'module-3',
                type: TopoTreeNodeType.Module,
                objName: '模',
                title: 'SmokeModule-1773163733771',
              },
            ],
          },
        ]}
        tailEleType={TailEleType.Count}
        onNodeSelect={() => undefined}
      />,
    );

    const titleText = screen.getByText('ProbeSet-1773163724333');
    expect(titleText).toHaveClass('title-text');
  });

  it('keeps topology tree rows at a fixed 36px height', () => {
    const treenodeBlock = styleContent.match(/\.ant-tree-treenode\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const switcherBlock = styleContent.match(/\.ant-tree-switcher\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const titleWrapperBlock = styleContent.match(/\.title-wrapper\s*\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(treenodeBlock).toContain('height: 36px;');
    expect(treenodeBlock).toContain('min-height: 36px;');
    expect(switcherBlock).toContain('height: 36px;');
    expect(switcherBlock).toContain('line-height: 36px;');
    expect(titleWrapperBlock).toContain('height: 36px;');
    expect(styleContent).toContain('white-space: nowrap;');
  });

  it('renders host counts only on module nodes', () => {
    render(
      <TopologyTree
        treeData={[
          {
            key: 'set-4',
            type: TopoTreeNodeType.Set,
            objName: '集',
            title: 'ProbeSet-1773163724333',
            children: [
              {
                key: 'module-3',
                type: TopoTreeNodeType.Module,
                objName: '模',
                title: 'SmokeModule-1773163733771',
                extra: {
                  host_count: 0,
                  child_count: 2,
                },
              },
            ],
          },
        ]}
        tailEleType={TailEleType.Count}
        onNodeSelect={() => undefined}
      />,
    );

    expect(within(screen.getByTestId('tree-node-set-4')).queryByText('1')).not.toBeInTheDocument();
    expect(within(screen.getByTestId('tree-node-module-3')).getByText('2')).toBeInTheDocument();
  });

  it('prefers backend allowed_actions for create capability checks', () => {
    render(
      <TopologyTree
        treeData={[
          {
            key: 'biz-1',
            type: TopoTreeNodeType.Biz,
            objName: '业',
            title: 'Smoke Business',
            extra: {
              allowed_actions: ['create_child'],
            },
          },
        ]}
        tailEleType={TailEleType.All}
        onNodeSelect={() => undefined}
      />,
    );

    fireEvent.mouseEnter(screen.getByText('Smoke Business'));

    expect(screen.getByText('resource.business.actions.create')).toBeInTheDocument();
  });

  it('does not show create action for idle pool nodes', () => {
    render(
      <TopologyTree
        treeData={[
          {
            key: 'idle_set-5',
            type: TopoTreeNodeType.Set,
            backendType: 'idle_set',
            objName: '集',
            title: '空闲机池',
            extra: {
              allowed_actions: ['create_child'],
            },
          },
        ]}
        tailEleType={TailEleType.All}
        onNodeSelect={() => undefined}
      />,
    );

    fireEvent.mouseEnter(screen.getByText('空闲机池'));

    expect(screen.queryByText('resource.business.actions.create')).not.toBeInTheDocument();
  });
});
