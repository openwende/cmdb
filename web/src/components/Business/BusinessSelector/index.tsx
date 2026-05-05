import React, { useEffect } from 'react';
import { Select, Spin, Divider, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBusinessStore, BusinessType } from '../../../store/BusinessStore';
import {
  getBusinessTopologyPath,
  getBusinessSetTopologyPath,
  isBusinessRelatedPage,
  parseBusinessInfoFromUrl,
} from '../../../utils/routes';
import { CREATE_TYPES } from '@/constants/business';
import './style.css';

const SELECTOR_COLLAPSED_WIDTH = 42;

const { Option, OptGroup } = Select;

interface BusinessSelectorProps {
  collapsed?: boolean;
}

const BusinessSelector: React.FC<BusinessSelectorProps> = ({ collapsed = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const {
    currentBusiness,
    businessList,
    businessSetList,
    loading,
    initialized,
    loadBusinessData,
    getBusinessById,
    setCurrentBusiness,
  } = useBusinessStore();

  useEffect(() => {
    // 只在未初始化时加载数据
    if (!initialized && !loading) {
      loadBusinessData();
    }
  }, [initialized, loading]); // 依赖 initialized 而不是 loadBusinessData

  // Update current business when URL changes
  useEffect(() => {
    const businessInfo = parseBusinessInfoFromUrl(location.pathname);

    if (businessInfo) {
      const { id, type } = businessInfo;
      const business = getBusinessById(id, type);

      if (business && currentBusiness?.id !== business.id) {
        setCurrentBusiness(business);
      }
    }
  }, [
    businessList,
    businessSetList,
    currentBusiness?.id,
    getBusinessById,
    location.pathname,
    setCurrentBusiness,
  ]);

  // Generate select value from current business
  const getSelectValue = (): string => {
    if (!currentBusiness) return '';
    return `${currentBusiness.type}:${currentBusiness.id}`;
  };

  // Handle business selection change
  const handleChange = (value: string) => {
    const [type, idStr] = value.split(':');

    if (type === BusinessType.Business) {
      const business = getBusinessById(Number(idStr), BusinessType.Business);
      if (business) {
        setCurrentBusiness(business);
        // Always use replace to ensure page state refresh
        navigate(getBusinessTopologyPath(business.id), { replace: true });
      }
    } else if (type === BusinessType.BusinessSet) {
      const businessSet = getBusinessById(Number(idStr), BusinessType.BusinessSet);
      if (businessSet) {
        setCurrentBusiness(businessSet);

        // Always use replace to ensure page state refresh
        navigate(getBusinessSetTopologyPath(businessSet.id), { replace: true });
      }
    }
  };

  // Handle create business click
  const handleCreateBusiness = () => {
    navigate(`/resource/business?create=${CREATE_TYPES.BUSINESS}`);
  };

  // Custom popup render with create business option at bottom
  const renderPopup = (menu: React.ReactElement) => (
    <>
      {menu}
      <Divider className="create-business-divider" />
      <div className="create-business-container">
        <Button
          color="primary"
          variant="text"
          icon={<PlusOutlined />}
          onClick={handleCreateBusiness}
          className="create-business-button"
        >
          {t('common.components.businessSelector.createBusiness')}
        </Button>
      </div>
    </>
  );

  // Show selector in business or business set pages
  const isBusinessPath = isBusinessRelatedPage(location.pathname);
  if (!isBusinessPath) {
    return null;
  }

  return (
    <div className="business-selector-container">
      <Select
        value={getSelectValue()}
        onChange={handleChange}
        className="business-selector"
        placement="bottomLeft"
        popupClassName="business-selector-dropdown"
        popupMatchSelectWidth={false}
        popupRender={renderPopup}
        loading={loading}
        notFoundContent={loading ? <Spin size="small" /> : null}
        placeholder={t('common.components.businessSelector.placeholder')}
        getPopupContainer={() => document.body}
        styles={{ root: { width: collapsed ? SELECTOR_COLLAPSED_WIDTH : undefined } }}
      >
        {businessList.length > 0 && (
          <OptGroup label={t('common.components.businessSelector.businessGroup')}>
            {businessList.map((business) => (
              <Option
                key={`${BusinessType.Business}:${business.id}`}
                value={`${BusinessType.Business}:${business.id}`}
                label={`${business.name} (${business.id})`}
              >
                {business.name}{' '}
                <span className="option-id">({business.id})</span>
              </Option>
            ))}
          </OptGroup>
        )}

        {businessSetList.length > 0 && (
          <OptGroup label={t('common.components.businessSelector.businessSetGroup')}>
            {businessSetList.map((businessSet) => (
              <Option
                key={`${BusinessType.BusinessSet}:${businessSet.id}`}
                value={`${BusinessType.BusinessSet}:${businessSet.id}`}
                label={`${businessSet.name} (${businessSet.id})`}
              >
                {businessSet.name}{' '}
                <span className="option-id">({businessSet.id})</span>
              </Option>
            ))}
          </OptGroup>
        )}
      </Select>
    </div>
  );
};

export default React.memo(BusinessSelector);
