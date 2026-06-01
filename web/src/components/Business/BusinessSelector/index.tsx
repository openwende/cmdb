import React, { useCallback, useEffect, useRef } from 'react';
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

  // Subscribe to each slice individually so unrelated store updates
  // (e.g. ``loading`` toggling) don't force a Select-popup remount.
  const currentBusiness = useBusinessStore((s) => s.currentBusiness);
  const businessList = useBusinessStore((s) => s.businessList);
  const businessSetList = useBusinessStore((s) => s.businessSetList);
  const loading = useBusinessStore((s) => s.loading);
  const initialized = useBusinessStore((s) => s.initialized);
  const loadBusinessData = useBusinessStore((s) => s.loadBusinessData);
  const getBusinessById = useBusinessStore((s) => s.getBusinessById);
  const setCurrentBusiness = useBusinessStore((s) => s.setCurrentBusiness);
  const wasBusinessPathRef = useRef(false);

  // Stable popup container so the antd Select dropdown's portal doesn't churn
  // its internal innerContainer state during the navigation cascade.
  const getPopupContainer = useCallback(() => document.body, []);
  const isBusinessPath = isBusinessRelatedPage(location.pathname);

  useEffect(() => {
    if (!isBusinessPath) {
      wasBusinessPathRef.current = false;
      return;
    }

    if (loading) {
      return;
    }

    if (!initialized) {
      wasBusinessPathRef.current = true;
      void loadBusinessData();
      return;
    }

    if (!wasBusinessPathRef.current) {
      wasBusinessPathRef.current = true;
      void loadBusinessData(true);
    }
  }, [initialized, isBusinessPath, loading, loadBusinessData]);

  // Update current business when URL changes
  useEffect(() => {
    const businessInfo = parseBusinessInfoFromUrl(location.pathname);
    if (!businessInfo) return;
    const business = getBusinessById(businessInfo.id, businessInfo.type);
    if (business && currentBusiness?.id !== business.id) {
      setCurrentBusiness(business);
    }
    // Depending on list lengths lets the URL sync re-run after business data refreshes.
  }, [
    location.pathname,
    currentBusiness?.id,
    businessList.length,
    businessSetList.length,
    getBusinessById,
    setCurrentBusiness,
  ]);

  // Generate select value from current business
  const getSelectValue = (): string => {
    if (!currentBusiness) return '';
    return `${currentBusiness.type}:${currentBusiness.id}`;
  };

  // Handle business selection change. We intentionally only navigate here —
  // ``setCurrentBusiness`` is driven by the URL-watching effect below. Doing
  // both in the same handler causes overlapping re-renders during the popup
  // close animation, which triggered a setState loop inside antd's portal.
  const handleChange = (value: string) => {
    const [type, idStr] = value.split(':');

    if (type === BusinessType.Business) {
      const business = getBusinessById(Number(idStr), BusinessType.Business);
      if (business) {
        navigate(getBusinessTopologyPath(business.id), { replace: true });
      }
    } else if (type === BusinessType.BusinessSet) {
      const businessSet = getBusinessById(Number(idStr), BusinessType.BusinessSet);
      if (businessSet) {
        navigate(getBusinessSetTopologyPath(businessSet.id), { replace: true });
      }
    }
  };

  // Handle create business click
  const handleCreateBusiness = useCallback(() => {
    navigate(`/resource/business?create=${CREATE_TYPES.BUSINESS}`);
  }, [navigate]);

  // Custom popup render with create business option at bottom.
  // Memoized — antd Select treats popupRender identity as a dep; an unstable
  // function makes the popup remount on every parent render.
  const renderPopup = useCallback(
    (menu: React.ReactElement) => (
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
    ),
    [t, handleCreateBusiness],
  );

  // Show selector in business or business set pages
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
        getPopupContainer={getPopupContainer}
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
                {business.name} <span className="option-id">({business.id})</span>
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
                {businessSet.name} <span className="option-id">({businessSet.id})</span>
              </Option>
            ))}
          </OptGroup>
        )}
      </Select>
    </div>
  );
};

export default React.memo(BusinessSelector);
