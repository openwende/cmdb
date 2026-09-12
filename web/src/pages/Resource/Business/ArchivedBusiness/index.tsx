import React, { useEffect, useState } from 'react';
import { Table, Input, Space, Button, message, Popconfirm, Modal, Form, Empty, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import { deleteBusiness, getBusinessList, updateBusiness } from '@/api';
import dayjs from 'dayjs';
import './style.css';
import { BusinessDetail } from '@/api/types/resource';
import { LIFECYCLE } from '../../constants';

const PAGE_SIZE = 20;

const ArchivedBusiness: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [businessCount, setBusinessCount] = useState(0);
  const [businessList, setBusinessList] = useState<BusinessDetail[]>([]);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [currentBusiness, setCurrentBusiness] = useState<BusinessDetail | null>(null);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [form] = Form.useForm();

  const columns = [
    {
      title: t('resource.business.archived.columns.id'),
      dataIndex: 'id',
      sorter: true,
      width: 300,
    },
    {
      title: t('resource.business.archived.columns.name'),
      dataIndex: 'name',
      sorter: true,
      width: 300,
    },
    {
      title: t('resource.business.archived.columns.maintainer'),
      dataIndex: 'sres',
      sorter: true,
      width: 240,
      render: (val: string[]) => (val && val.length > 0 ? val.join(', ') : '--'),
    },
    {
      title: t('resource.business.archived.columns.createdAt'),
      dataIndex: 'created_at',
      sorter: true,
      width: 240,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('resource.business.archived.columns.createdBy'),
      dataIndex: 'created_by',
      sorter: true,
      width: 240,
      render: (val: string) => (val ? val : '--'),
    },
    {
      title: t('resource.business.archived.columns.updatedAt'),
      dataIndex: 'updated_at',
      sorter: true,
      width: 240,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('resource.business.archived.columns.updatedBy'),
      dataIndex: 'updated_by',
      sorter: true,
      width: 240,
      render: (val: string) => (val ? val : '--'),
    },
    {
      title: t('resource.business.archived.columns.archivedAt'),
      dataIndex: 'archived_at',
      sorter: true,
      width: 240,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('resource.business.archived.columns.actions'),
      dataIndex: 'action',
      render: (_: string, record: BusinessDetail) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleRestore(record)}>
            {t('resource.business.archived.actions.restore')}
          </Button>
          <Popconfirm
            title={t('resource.business.archived.deleteConfirm.title')}
            description={t('resource.business.archived.deleteConfirm.description')}
            onConfirm={() => confirmDelete(record)}
            okText={t('common.confirm')}
            cancelText={t('common.cancel')}
          >
            <Button type="link" size="small" danger>
              {t('resource.business.archived.actions.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const fetchBusinessList = async () => {
    try {
      setLoading(true);
      // TODO: Use these params when backend API supports filtering
      // const params = {
      //   searchText: searchText,
      // };
      const { data } = await getBusinessList({
        limit: 100,
        offset: 0,
      });
      const archivedBusinesses = data.items.filter(
        (item: BusinessDetail) => item.lifecycle === LIFECYCLE.OFFLINE,
      );
      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      setBusinessList(archivedBusinesses.slice(start, end));
      setBusinessCount(archivedBusinesses.length);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessList();
  }, [page, pageSize]);

  const handleRestore = (business: BusinessDetail) => {
    setCurrentBusiness(business);
    form.setFieldsValue({
      businessName: business.name,
    });
    setRestoreModalVisible(true);
  };

  const confirmRestore = () => {
    form
      .validateFields()
      .then(async () => {
        if (!currentBusiness) {
          return;
        }

        try {
          const data = await updateBusiness(currentBusiness.id, {
            ...currentBusiness,
            lifecycle: LIFECYCLE.ONLINE,
          });

          if (!data.success) {
            message.error(t('resource.business.archived.messages.restoreFailed'));
            return;
          }

          message.success(t('resource.business.archived.messages.restoreSuccess'));
          setRestoreModalVisible(false);
          setCurrentBusiness(null);
          await fetchBusinessList();
        } catch (error) {
          console.error(error);
          message.error(t('resource.business.archived.messages.restoreFailed'));
        }
      })
      .catch((error) => {
        console.error('Validation failed:', error);
      });
  };

  const confirmDelete = async (business: BusinessDetail) => {
    try {
      const data = await deleteBusiness(business.id);
      if (data.success) {
        message.success(t('resource.business.archived.messages.deleteSuccess'));

        // Remove the business from the list
        const updatedList = businessList.filter((item: BusinessDetail) => item.id !== business.id);
        setBusinessList(updatedList);
        setBusinessCount(businessCount - 1);
      } else {
        message.error(t('resource.business.archived.messages.deleteFailed'));
      }
    } catch {
      message.error(t('resource.business.archived.messages.deleteFailed'));
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1);
    fetchBusinessList();
  };

  return (
    <div className="archived-business">
      <div className="list-header">
        <div className="list-search">
          <Input.Search
            style={{ width: 280 }}
            placeholder={t('resource.business.archived.search.placeholder')}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={handleSearch}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={businessList}
        showSorterTooltip={false}
        rowKey="id"
        bordered={true}
        pagination={false}
        locale={{
          emptyText: loading ? (
            <Spin className="table-spin" />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />
          ),
        }}
      />

      <Pagination
        total={businessCount}
        pageSize={pageSize}
        current={page}
        onChange={setPage}
        onSizeChange={(_, size) => {
          setPage(1);
          setPageSize(size);
        }}
      />

      {/* Restore business modal */}
      <Modal
        title={t('resource.business.archived.restoreModal.title')}
        open={restoreModalVisible}
        onOk={confirmRestore}
        onCancel={() => {
          setRestoreModalVisible(false);
        }}
        okText={t('common.confirm')}
        cancelText={t('common.cancel')}
        maskClosable={false}
        width={400}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="businessName"
            label={t('resource.business.archived.restoreModal.nameLabel')}
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Input placeholder={t('resource.business.archived.restoreModal.namePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ArchivedBusiness;
