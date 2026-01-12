import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Drawer, Form, Input, message, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { processInfo, processInstanceDetail } from '@/mock/business';
import Pagination from '@/components/common/Pagination';

interface Props {
  selectedNode?: any;
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  expandAll: boolean;
  setExpandAll: (expand: boolean) => void;
}

const Process: React.FC<Props> = ({ selectedRowKeys, setSelectedRowKeys, expandAll }) => {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'view' | 'edit'>('view');
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    if (expandAll) {
      const allKeys = processInfo.map((_, index) => index);
      setExpandedRowKeys(allKeys);
    } else {
      setExpandedRowKeys([]);
    }
  }, [expandAll]);

  const processColumns = [
    {
      title: t('business.topology.serviceInstance.process.columns.processAlias'),
      dataIndex: 'bk_process_name',
      key: 'bk_process_name',
    },
    {
      title: t('business.topology.serviceInstance.process.columns.instanceCount'),
      dataIndex: 'process_ids',
      key: 'process_ids',
      render: (ids: number[]) => ids?.join(', ') || '--',
    },
  ];

  const processExpandedRowRender = () => {
    const columns = [
      {
        title: t('business.topology.serviceInstance.process.columns.serviceInstance'),
        dataIndex: 'service_instance_name',
        key: 'service_instance_name',
        render: (value: string, record: any) => (
          <Button type="link" onClick={() => handleViewProcess(record)}>
            {value}
          </Button>
        ),
      },
      {
        title: t('business.topology.serviceInstance.process.columns.processName'),
        dataIndex: ['property', 'bk_func_name'],
        key: 'func_name',
      },
      {
        title: t('business.topology.serviceInstance.process.columns.startupParams'),
        dataIndex: ['property', 'bk_start_param_regex'],
        key: 'start_param',
        render: (value: string) => value || '--',
      },
      {
        title: t('business.topology.serviceInstance.process.columns.bindInfo'),
        dataIndex: ['property', 'bind_info'],
        key: 'bind_info',
        render: (value: []) => (value.length > 0 ? value : '--'),
      },
      {
        title: t('business.topology.serviceInstance.process.columns.action'),
        key: 'action',
        render: (processRecord: any) => (
          <Space>
            <Button type="link" onClick={() => handleEditProcess(processRecord)}>
              {t('common.edit')}
            </Button>
            <Popconfirm
              title={t('business.topology.serviceInstance.process.confirm.deleteProcess')}
              onConfirm={() => handleDeleteProcess(processRecord)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" danger>
                {t('common.delete')}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={processInstanceDetail}
        pagination={false}
        size="small"
        rowKey={(record) => record.process_id}
      />
    );
  };

  const handleViewProcess = (_record: any) => {
    setDrawerType('view');
    setDrawerVisible(true);
  };

  const handleEditProcess = (_record: any) => {
    setDrawerType('edit');
    setDrawerVisible(true);
  };

  const handleDeleteProcess = (record: any) => {
    message.success(t('business.topology.serviceInstance.process.messages.deleteSuccess'));
  };

  const renderDrawerContent = () => {
    if (drawerType === 'view') {
      return (
        <div>
          <h3>{t('business.topology.serviceInstance.process.sections.basicInfo')}</h3>
          <div style={{ marginBottom: 16 }}>
            <div>
              {t('business.topology.serviceInstance.process.fields.createTime')}：2025-05-27
              14:52:15
            </div>
            <div>{t('business.topology.serviceInstance.process.fields.creator')}：bk-cmdb</div>
            <div>{t('business.topology.serviceInstance.process.form.processName')}：devTest</div>
            <div>
              {t('business.topology.serviceInstance.process.fields.updateTime')}：2025-05-27
              14:52:15
            </div>
            <div>{t('business.topology.serviceInstance.process.form.processAlias')}：devTest</div>
            <div>{t('business.topology.serviceInstance.process.fields.description')}：--</div>
          </div>

          <h3>{t('business.topology.serviceInstance.process.sections.listenInfo')}</h3>
          <Table
            columns={[
              { title: 'IP', dataIndex: 'ip', key: 'ip' },
              { title: 'Port', dataIndex: 'port', key: 'port' },
              { title: 'Protocol', dataIndex: 'protocol', key: 'protocol' },
              { title: 'Enable', dataIndex: 'enable', key: 'enable' },
              { title: 'RowID', dataIndex: 'rowId', key: 'rowId' },
            ]}
            dataSource={[]}
            pagination={false}
            size="small"
            locale={{ emptyText: t('business.topology.serviceInstance.process.table.noData') }}
          />

          <div style={{ marginTop: 16 }}>
            <Button type="primary">{t('common.edit')}</Button>
          </div>
        </div>
      );
    }

    return (
      <Form layout="vertical">
        <h3>{t('business.topology.serviceInstance.process.sections.basicInfo')}</h3>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.processName')}
            style={{ flex: 1 }}
          >
            <Input defaultValue="devTest" />
          </Form.Item>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.processAlias')}
            style={{ flex: 1 }}
          >
            <Input defaultValue="devTest" />
          </Form.Item>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.startupParams')}
            style={{ flex: 1 }}
          >
            <Input
              placeholder={t(
                'business.topology.serviceInstance.process.form.placeholders.startupParams',
              )}
            />
          </Form.Item>
          <Form.Item
            label={t('business.topology.serviceInstance.process.form.description')}
            style={{ flex: 1 }}
          >
            <Input
              placeholder={t(
                'business.topology.serviceInstance.process.form.placeholders.description',
              )}
            />
          </Form.Item>
        </div>

        <div style={{ marginTop: 16 }}>
          <Button type="primary" style={{ marginRight: 8 }}>
            {t('common.save')}
          </Button>
          <Button onClick={() => setDrawerVisible(false)}>{t('common.cancel')}</Button>
        </div>
      </Form>
    );
  };

  return (
    <div>
      {/* Table */}
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          getCheckboxProps: () => ({
            disabled: true,
          }),
        }}
        columns={processColumns}
        dataSource={processInfo}
        rowKey={(record) => record.bk_process_name}
        expandable={{
          expandedRowRender: processExpandedRowRender,
          expandedRowKeys,
          onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
          defaultExpandAllRows: false,
        }}
        pagination={false}
        bordered
      />

      {/* Pagination */}
      <div
        style={{
          marginTop: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>
          {t('business.topology.serviceInstance.process.pagination.selected')}
          &nbsp;{selectedRowKeys.length}
          &nbsp;{t('business.topology.serviceInstance.process.pagination.items')}
        </span>
        <Pagination
          total={processInfo.length}
          pageSize={pageSize}
          current={current}
          onChange={(page, size) => {
            setCurrent(page);
            setPageSize(size);
          }}
          onSizeChange={(_, size) => {
            setPageSize(size);
            setCurrent(1);
          }}
        />
      </div>

      {/* Drawer */}
      <Drawer
        title={
          drawerType === 'view'
            ? t('business.topology.serviceInstance.process.drawer.viewTitle')
            : t('business.topology.serviceInstance.process.drawer.editTitle')
        }
        placement="right"
        width={800}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      >
        {renderDrawerContent()}
      </Drawer>
    </div>
  );
};

export default Process;
