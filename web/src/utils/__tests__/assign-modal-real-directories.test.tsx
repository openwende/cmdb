import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AssignModal from '@/pages/Resource/Host/components/AssignModal';
import { AssignType } from '@/pages/Resource/Types';

const { selectPropsRef, fetchDirectories } = vi.hoisted(() => ({
  selectPropsRef: { current: null as Record<string, any> | null },
  fetchDirectories: vi.fn(),
}));

let mockDirectories = [
  { bk_module_id: 1, bk_module_name: '默认目录', host_count: 2, children: [] },
  { bk_module_id: 2, bk_module_name: '可分配目录', host_count: 0, children: [] },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/DirectoryStore', () => ({
  useDirectoryStore: () => ({
    directories: mockDirectories,
    loading: false,
    fetchDirectories,
  }),
}));

vi.mock('@/components/common/BusinessSelector', () => ({
  default: () => <div>business-selector</div>,
}));

vi.mock('antd', () => {
  const Select = ({ children, ...props }: Record<string, any>) => {
    selectPropsRef.current = props;
    return <div data-testid="pool-select">{children}</div>;
  };
  Select.Option = ({ children }: any) => <div>{children}</div>;

  return {
    Modal: ({ children }: any) => <div>{children}</div>,
    Select,
    Typography: {
      Text: ({ children }: any) => <span>{children}</span>,
    },
  };
});

describe('AssignModal pool directory options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDirectories = [
      { bk_module_id: 1, bk_module_name: '默认目录', host_count: 2, children: [] },
      { bk_module_id: 2, bk_module_name: '可分配目录', host_count: 0, children: [] },
    ];
  });

  it('renders real directory store options and excludes directories that already contain all hosts', () => {
    render(
      <AssignModal
        assignType={AssignType.HostPool}
        selectedRowKeys={['host-1', 'host-2']}
        hostPoolStatuses={[
          { id: 1, ip: '10.0.0.1', moduleId: 1, inHostPool: true },
          { id: 2, ip: '10.0.0.2', moduleId: 1, inHostPool: true },
        ]}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('可分配目录')).toBeInTheDocument();
    expect(screen.queryByText('默认目录')).not.toBeInTheDocument();
    expect(fetchDirectories).not.toHaveBeenCalled();
  });
});
