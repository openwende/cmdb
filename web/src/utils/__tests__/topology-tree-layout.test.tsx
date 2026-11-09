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
    expandedKeys,
    onExpand,
  }: {
    treeData: TreeData[];
    titleRender: (node: TreeData) => React.ReactNode;
    expandedKeys?: string[];
    onExpand?: (keys: string[]) => void;
  }) => {
    const renderNodes = (nodes: TreeData[]) =>
      nodes.map((node) => (
        <div key={node.key} data-testid={`tree-node-${node.key}`}>
          {titleRender(node)}
          {node.children?.length ? renderNodes(node.children) : null}
        </div>
      ));

    return (
      <div data-expanded-keys={(expandedKeys ?? []).join(',')} data-has-expand={String(!!onExpand)}>
        {renderNodes(treeData)}
      </div>
    );
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

  it('renders recursive host counts on every topology node', () => {
    render(
      <TopologyTree
        treeData={[
          {
            key: 'business-1',
            type: TopoTreeNodeType.Biz,
            objName: '业',
            title: 'Smoke Business',
            children: [
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
                      host_count: 2,
                    },
                  },
                  {
                    key: 'module-4',
                    type: TopoTreeNodeType.Module,
                    objName: '模',
                    title: 'SmokeModule-1773163733772',
                    extra: {
                      host_count: 1,
                    },
                  },
                ],
              },
            ],
          },
        ]}
        tailEleType={TailEleType.Count}
        onNodeSelect={() => undefined}
      />,
    );

    expect(
      within(screen.getByTestId('tree-node-business-1')).getAllByText('3').length,
    ).toBeGreaterThan(0);
    expect(within(screen.getByTestId('tree-node-set-4')).getAllByText('3').length).toBeGreaterThan(
      0,
    );
    expect(within(screen.getByTestId('tree-node-module-3')).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByTestId('tree-node-module-4')).getByText('1')).toBeInTheDocument();
  });

  it('styles host count suffixes as compact pills', () => {
    const suffixBlock = styleContent.match(/\.suffix-count\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const selectedSuffixBlock =
      styleContent.match(/\.suffix-count\.selected,[\s\S]*?\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(suffixBlock).toContain('min-width: 20px;');
    expect(suffixBlock).toContain('height: 20px;');
    expect(suffixBlock).toContain('background: #f5f7fa;');
    expect(suffixBlock).toContain('color: #9aa3b2;');
    expect(selectedSuffixBlock).toContain('background: #93b1f5;');
    expect(selectedSuffixBlock).toContain(
      'background: color-mix(in srgb, var(--color-primary) 50%, #ffffff);',
    );
  });

  it('does not draw an outer ring around selected topology prefixes', () => {
    const selectedBadgeBlock =
      styleContent.match(/\.node-badge\.selected,[\s\S]*?\{([\s\S]*?)\}/)?.[1] ?? '';

    expect(selectedBadgeBlock).toContain('border-color: transparent !important;');
    expect(selectedBadgeBlock).toContain('box-shadow: none !important;');
    expect(styleContent).not.toContain('.node-badge--icon');
    expect(styleContent).not.toContain('.badge-idle-fault');
  });

  it('does not render prefix icons for idle pool nodes', () => {
    render(
      <TopologyTree
        treeData={[
          {
            key: 'idle_set-5',
            type: TopoTreeNodeType.Idle,
            backendType: 'idle_set',
            objName: '空闲机池',
            title: '空闲机池',
            children: [
              {
                key: 'idle_module-5001',
                type: TopoTreeNodeType.Module,
                backendType: 'idle_module',
                objName: '模块',
                title: '待回收',
              },
            ],
          },
        ]}
        tailEleType={TailEleType.Count}
        onNodeSelect={() => undefined}
      />,
    );

    expect(screen.getByTestId('tree-node-idle_set-5').querySelector('.node-badge')).toBeNull();
    expect(
      screen.getByTestId('tree-node-idle_module-5001').querySelector('.node-badge'),
    ).toBeNull();
  });

  it('keeps previously expanded branches when selecting another parent node', () => {
    const onExpandedKeysChange = vi.fn();
    const onNodeSelect = vi.fn();
    const treeData: TreeData[] = [
      {
        key: 'business-1',
        type: TopoTreeNodeType.Biz,
        objName: '业',
        title: 'Smoke Business',
        children: [
          {
            key: 'set-1',
            type: TopoTreeNodeType.Set,
            objName: '集',
            title: 'Set One',
            children: [
              {
                key: 'module-1',
                type: TopoTreeNodeType.Module,
                objName: '模',
                title: 'Module One',
              },
            ],
          },
          {
            key: 'set-2',
            type: TopoTreeNodeType.Set,
            objName: '集',
            title: 'Set Two',
            children: [
              {
                key: 'module-2',
                type: TopoTreeNodeType.Module,
                objName: '模',
                title: 'Module Two',
              },
            ],
          },
        ],
      },
    ];

    const { rerender } = render(
      <TopologyTree
        treeData={treeData}
        selectedKeys={['set-1']}
        expandedKeys={['business-1', 'set-1']}
        onExpandedKeysChange={onExpandedKeysChange}
        onNodeSelect={onNodeSelect}
      />,
    );

    fireEvent.click(screen.getByText('Set Two'));

    expect(onExpandedKeysChange).toHaveBeenLastCalledWith(['business-1', 'set-1', 'set-2']);
    expect(onNodeSelect).toHaveBeenCalledTimes(1);

    onExpandedKeysChange.mockClear();
    onNodeSelect.mockClear();

    rerender(
      <TopologyTree
        treeData={treeData}
        selectedKeys={['set-1']}
        expandedKeys={['business-1', 'set-1', 'set-2']}
        onExpandedKeysChange={onExpandedKeysChange}
        onNodeSelect={onNodeSelect}
      />,
    );

    fireEvent.click(screen.getByText('Set One'));

    expect(onExpandedKeysChange).toHaveBeenLastCalledWith(['business-1', 'set-2']);
    expect(onNodeSelect).not.toHaveBeenCalled();
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
