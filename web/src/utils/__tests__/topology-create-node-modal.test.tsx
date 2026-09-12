import { render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import CreateNodeModal from '@/pages/Business/BusinessTopology/components/CreateNodeModal';
import { TopoTreeNodeType, TreeData } from '@/pages/Business/Types';

const mockedStores = vi.hoisted(() => {
  const loadMainlineModels = vi.fn(async () => undefined);
  const getChildModels = vi.fn(() => []);
  const loadFormSchema = vi.fn(async () => undefined);

  const mainlineState = {
    mainlineModels: [],
    topologySettings: null,
    loadingModels: false,
    loadingSettings: false,
    initializedModels: false,
    initializedSettings: true,
    getModelByUID: vi.fn(),
    getChildModels,
    loadMainlineModels,
    loadTopologySettings: vi.fn(),
    reset: vi.fn(),
  };

  const businessState = {
    currentBusiness: {
      id: 'biz-1',
      name: 'SmokeBiz',
      type: 'business',
    },
  };

  const schemaState = {
    schemas: {},
    formSchemas: {
      'set:topology_create': {
        model_uid: 'set',
        scene: 'topology_create',
        fields: [
          {
            name: 'description',
            display_name: 'Description',
            field_type: 'text',
            is_required: false,
            is_unique: false,
            is_editable: true,
            is_system: false,
            sort_order: 1,
          },
        ],
      },
    },
    loading: false,
    error: null,
    loadSchema: vi.fn(),
    loadFormSchema,
    reset: vi.fn(),
  };

  const useSchemaCenterStore = Object.assign(
    (selector?: (state: typeof schemaState) => unknown) =>
      selector ? selector(schemaState) : schemaState,
    {
      getState: () => schemaState,
    },
  );

  return {
    loadMainlineModels,
    loadFormSchema,
    mainlineState,
    businessState,
    useSchemaCenterStore,
  };
});

const mockedAntd = vi.hoisted(() => {
  const formApi = {
    resetFields: vi.fn(),
    setFieldsValue: vi.fn(),
    validateFields: vi.fn(async () => ({})),
    setFieldValue: vi.fn(),
  };
  const useForm = vi.fn(() => [formApi]);

  return { formApi, useForm };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'business.topology.tree.create.helper.modelDriven':
            '会根据当前节点自动筛选允许创建的子节点类型，并按表单 schema 生成创建表单。',
          'business.topology.tree.create.fields.childModel': '子节点类型',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('antd', () => {
  const FormComponent = ({ children }: { children?: any }) => <form>{children}</form>;
  FormComponent.Item = ({ children, label }: { children?: any; label?: any }) => (
    <div>
      {label ? <div>{label}</div> : null}
      {children}
    </div>
  );
  FormComponent.useForm = mockedAntd.useForm;

  return {
    Alert: ({ message }: { message?: any }) => <div>{message}</div>,
    Empty: ({ description }: { description?: any }) => <div>{description}</div>,
    Form: FormComponent,
    Input: Object.assign(
      ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
      {
        TextArea: ({ placeholder }: { placeholder?: string }) => (
          <textarea placeholder={placeholder} />
        ),
      },
    ),
    InputNumber: ({ placeholder }: { placeholder?: string }) => <input placeholder={placeholder} />,
    Modal: ({ open, children }: { open?: boolean; children?: any }) =>
      open ? <div>{children}</div> : null,
    Select: ({ options }: { options?: { value: string; label: string }[] }) => (
      <select>
        {options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    Spin: () => <div>loading</div>,
    Switch: () => <input type="checkbox" />,
    message: {
      error: vi.fn(),
      success: vi.fn(),
    },
  };
});

vi.mock('@/api', () => ({
  createModelInstance: vi.fn(),
  createTopologyModule: vi.fn(),
  createTopologySet: vi.fn(),
}));

vi.mock('@/store/MainlineStore', () => ({
  useMainlineStore: () => mockedStores.mainlineState,
}));

vi.mock('@/store/BusinessStore', () => ({
  useBusinessStore: () => mockedStores.businessState,
}));

vi.mock('@/store/SchemaCenterStore', () => ({
  useSchemaCenterStore: mockedStores.useSchemaCenterStore,
}));

const buildNode = (overrides: Partial<TreeData>): TreeData => ({
  title: 'node',
  key: 'node-1',
  type: TopoTreeNodeType.Set,
  extra: {},
  ...overrides,
});

describe('topology create node modal', () => {
  beforeAll(() => {});

  it('does not create a form instance while the modal is hidden', () => {
    render(
      <CreateNodeModal
        visible={false}
        selectedNode={buildNode({
          key: 'business-1',
          nodeId: 'biz-1',
          title: 'SmokeBiz',
          type: TopoTreeNodeType.Biz,
          backendType: 'business',
        })}
        parentNodes={[]}
        onClose={() => undefined}
        onCreated={() => undefined}
      />,
    );

    expect(mockedAntd.useForm).not.toHaveBeenCalled();
  });

  it('does not load mainline models for builtin business-to-set creation', async () => {
    render(
      <CreateNodeModal
        visible
        selectedNode={buildNode({
          key: 'business-1',
          nodeId: 'biz-1',
          title: 'SmokeBiz',
          type: TopoTreeNodeType.Biz,
          backendType: 'business',
        })}
        parentNodes={[]}
        onClose={() => undefined}
        onCreated={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(mockedStores.loadFormSchema).toHaveBeenCalledWith('set', 'topology_create', 'biz-1');
    });

    expect(
      screen.getByText(
        '会根据当前节点自动筛选允许创建的子节点类型，并按表单 schema 生成创建表单。',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('子节点类型')).toBeInTheDocument();
    expect(mockedStores.loadMainlineModels).not.toHaveBeenCalled();
  });
});
