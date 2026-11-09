import React, { useEffect, useMemo } from 'react';
import { Button, Select, Space } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useBusinessStore } from '@/store/BusinessStore';

const { Option } = Select;

export interface BusinessSelectorProps {
  value?: number | string | null;
  onChange?: (value: number | string) => void;
  allowClear?: boolean;
  showSearch?: boolean;
  disabled?: boolean;
  size?: 'large' | 'middle' | 'small';
  className?: string;
}

const BusinessSelector: React.FC<BusinessSelectorProps> = ({
  value,
  onChange,
  allowClear = true,
  showSearch = true,
  disabled = false,
  size = 'middle',
  className,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { businessList, initialized, loading, error, loadBusinessData } = useBusinessStore();

  useEffect(() => {
    if (!initialized && !loading) {
      void loadBusinessData();
    }
  }, [initialized, loading, loadBusinessData]);

  const handleChange = (val: number | string) => {
    onChange?.(val);
  };

  const filterOption = (input: string, option: any) => {
    const children = option?.children as string;
    return children?.toLowerCase().includes(input.toLowerCase());
  };

  const notFoundContent = useMemo(() => {
    if (loading) return null;
    if (error) {
      return (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#ff4d4f', marginBottom: 8 }}>{error}</div>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => loadBusinessData(true)}>
            {t('business.entryRedirect.retry')}
          </Button>
        </div>
      );
    }
    if (!initialized) {
      return (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#999', marginBottom: 8 }}>
            {t('business.messages.loadBusinessFailed')}
          </div>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => loadBusinessData(true)}>
            {t('business.entryRedirect.retry')}
          </Button>
        </div>
      );
    }
    if (businessList.length === 0) {
      return (
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{ color: '#999', marginBottom: 8 }}>
            {t('business.messages.noBusinessData')}
          </div>
          <Space>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => loadBusinessData(true)}>
              {t('business.entryRedirect.retry')}
            </Button>
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/resource/business')}
            >
              {t('common.components.businessSelector.createBusiness')}
            </Button>
          </Space>
        </div>
      );
    }
    return undefined;
  }, [loading, initialized, error, businessList.length, loadBusinessData, navigate, t]);

  return (
    <Select
      value={value as any}
      onChange={handleChange as any}
      placeholder={t('common.components.businessSelector.selectBusiness')}
      style={{ width: '100%' }}
      allowClear={allowClear}
      showSearch={showSearch}
      disabled={disabled}
      size={size}
      className={className}
      filterOption={showSearch ? filterOption : false}
      notFoundContent={notFoundContent}
      loading={loading}
    >
      {businessList.map((biz) => (
        <Option key={biz.id} value={biz.id}>
          {`[${biz.id}] ${biz.name}`}
        </Option>
      ))}
    </Select>
  );
};

export default BusinessSelector;
