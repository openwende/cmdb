import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModuleNodeInfo from '@/pages/Business/BusinessTopology/components/ModuleNodeInfo';
import SetNodeInfo from '@/pages/Business/BusinessTopology/components/SetNodeInfo';
import { TopoTreeNodeType, TreeData } from '@/pages/Business/Types';

const mocks = vi.hoisted(() => ({
  deleteTopologySet: vi.fn(async () => ({ code: 0 })),
  deleteTopologyModule: vi.fn(async () => ({ code: 0 })),
  updateTopologySet: vi.fn(async () => ({ code: 0 })),
  updateTopologyModule: vi.fn(async () => ({ code: 0 })),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/api/services/business', () => ({
  deleteTopologySet: mocks.deleteTopologySet,
  deleteTopologyModule: mocks.deleteTopologyModule,
  updateTopologySet: mocks.updateTopologySet,
  updateTopologyModule: mocks.updateTopologyModule,
}));

vi.mock('@/components/common/ConfirmModal', () => ({
  default: ({ visible, onOk, title }: { visible: boolean; onOk: () => void; title: string }) =>
    visible ? (
      <div>
        <div>{title}</div>
        <button type="button" onClick={onOk}>
          confirm-delete
        </button>
      </div>
    ) : null,
}));

vi.mock('antd', () => {
  const FormComponent = ({ children }: { children?: React.ReactNode }) => <form>{children}</form>;
  FormComponent.Item = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  FormComponent.useForm = () => [
    {
      resetFields: vi.fn(),
      setFieldsValue: vi.fn(),
      validateFields: vi.fn(async () => ({})),
      setFieldValue: vi.fn(),
    },
  ];

  return {
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children?: React.ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Collapse: ({
      items,
    }: {
      items?: { key: string; label: React.ReactNode; children: React.ReactNode }[];
    }) => (
      <div>
        {items?.map((item) => (
          <div key={item.key}>
            <div>{item.label}</div>
            <div>{item.children}</div>
          </div>
        ))}
      </div>
    ),
    Form: FormComponent,
    Input: Object.assign(
      ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
      {
        TextArea: ({ placeholder }: { placeholder?: string }) => (
          <textarea placeholder={placeholder} />
        ),
      },
    ),
    Select: ({ children }: { children?: React.ReactNode }) => <select>{children}</select>,
    Spin: () => <div>loading</div>,
    message: {
      success: mocks.success,
      error: mocks.error,
    },
  };
});

vi.mock('@/mock/resource', () => ({
  userListMock: [],
}));

vi.mock('@/pages/Business/BusinessTopology/components/ServiceCategory', () => ({
  default: () => <div>service-category</div>,
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

const buildNode = (overrides: Partial<TreeData>): TreeData => ({
  title: 'node',
  key: 'node-1',
  type: TopoTreeNodeType.Set,
  extra: {},
  ...overrides,
});

describe('topology node delete actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a set through the topology api from the node info panel', async () => {
    const onTopologyChanged = vi.fn();

    render(
      <SetNodeInfo
        selectedNode={buildNode({
          title: 'SmokeSet',
          key: 'set-4',
          nodeId: '4',
          type: TopoTreeNodeType.Set,
          extra: {
            bk_set_id: 4,
            bk_set_name: 'SmokeSet',
          },
        })}
        onTopologyChanged={onTopologyChanged}
      />,
    );

    fireEvent.click(screen.getByText('business.topology.setNodeInfo.deleteNode'));
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(mocks.deleteTopologySet).toHaveBeenCalledWith(4);
    });

    expect(onTopologyChanged).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('business.topology.setNodeInfo.deleteSuccess');
  });

  it('deletes a module through the topology api from the node info panel', async () => {
    const onTopologyChanged = vi.fn();

    render(
      <ModuleNodeInfo
        selectedNode={buildNode({
          title: 'SmokeModule',
          key: 'module-9',
          nodeId: '9',
          type: TopoTreeNodeType.Module,
          extra: {
            bk_module_id: 9,
            bk_module_name: 'SmokeModule',
          },
        })}
        onTopologyChanged={onTopologyChanged}
      />,
    );

    fireEvent.click(screen.getByText('business.topology.moduleNodeInfo.deleteNode'));
    fireEvent.click(screen.getByText('confirm-delete'));

    await waitFor(() => {
      expect(mocks.deleteTopologyModule).toHaveBeenCalledWith(9);
    });

    expect(onTopologyChanged).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledWith('business.topology.moduleNodeInfo.deleteSuccess');
  });
});
