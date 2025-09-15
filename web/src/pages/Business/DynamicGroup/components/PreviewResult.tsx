import React from 'react';
import { Button, Table, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';

interface PreviewData {
  id: string;
  internalIPv4: string;
  region: string;
  cloudVendor: string;
  cloudVendorID: string;
  cloudBusiness: string;
  createTime: string;
  creator: string;
}

interface PreviewResultProps {
  data: PreviewData[];
  loading: boolean;
  lastUpdateTime: string;
  onRefresh?: () => void;
}

const PreviewResult: React.FC<PreviewResultProps> = ({
  data,
  loading,
  lastUpdateTime,
  onRefresh
}) => {
  const { t } = useTranslation();

  const columns: ColumnsType<PreviewData> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      sorter: true,
      width: 100,
      fixed: 'left'
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.internalIPv4'),
      dataIndex: 'internalIPv4',
      key: 'internalIPv4',
      sorter: true,
      width: 200
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.region'),
      dataIndex: 'region',
      key: 'region',
      width: 200
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.cloudVendor'),
      dataIndex: 'cloudVendor',
      key: 'cloudVendor',
      sorter: true,
      width: 200
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.cloudVendorID'),
      dataIndex: 'cloudVendorID',
      key: 'cloudVendorID',
      sorter: true,
      width: 200
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.cloudBusiness'),
      dataIndex: 'cloudBusiness',
      key: 'cloudBusiness',
      sorter: true,
      width: 200
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.createTime'),
      dataIndex: 'createTime',
      key: 'createTime',
      sorter: true,
      width: 200
    },
    {
      title: t('business.dynamicGroupForm.previewResult.columns.creator'),
      dataIndex: 'creator',
      key: 'creator',
      sorter: true,
      width: 200
    },
  ];

  if (!data.length && !lastUpdateTime && !loading) {
    return (
      <div className="preview-result">
        <div className="preview-header">
          <div className="section-title">
            {t('business.dynamicGroupForm.previewResult.title')}
          </div>
        </div>
        <Empty
          description={t('business.dynamicGroupForm.previewResult.emptyTip')}
          className="preview-empty"
        />
      </div>
    );
  }

  return (
    <div className="preview-result">
      <div className="preview-header">
        <div className="section-title">
          {t('business.dynamicGroupForm.previewResult.title')}
          {lastUpdateTime && (
            <span className="update-time">
              {
                t('business.dynamicGroupForm.previewResult.updateTime',
                  { time: lastUpdateTime })
              }
            </span>
          )}
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
          color="primary"
          variant="outlined"
          size="small"
        >
          {t('business.dynamicGroupForm.previewResult.refresh')}
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={false}
        showSorterTooltip={false}
        size="small"
      />
    </div>
  );
};

export default PreviewResult;
