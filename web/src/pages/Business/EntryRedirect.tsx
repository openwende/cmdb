import React, { useEffect, useState } from 'react';
import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { BusinessType, useBusinessStore } from '@/store/BusinessStore';
import { getBusinessSetTopologyPath, getBusinessTopologyPath } from '@/utils/routes';

const EntryRedirect: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState(false);
  const { currentBusiness, businessList, businessSetList, initialized, loading, loadBusinessData } =
    useBusinessStore();

  useEffect(() => {
    if (currentBusiness) {
      const targetPath =
        currentBusiness.type === BusinessType.BusinessSet
          ? getBusinessSetTopologyPath(currentBusiness.id)
          : getBusinessTopologyPath(currentBusiness.id);
      navigate(targetPath, { replace: true });
      return;
    }

    if (!initialized && !loading) {
      setError(false);
      loadBusinessData().catch(() => setError(true));
      return;
    }

    if (!initialized || loading) {
      return;
    }

    if (businessList.length > 0) {
      navigate(getBusinessTopologyPath(businessList[0].id), { replace: true });
      return;
    }

    if (businessSetList.length > 0) {
      navigate(getBusinessSetTopologyPath(businessSetList[0].id), { replace: true });
      return;
    }

    navigate('/resource/business', { replace: true });
  }, [
    businessList,
    businessSetList,
    currentBusiness,
    initialized,
    loadBusinessData,
    loading,
    navigate,
  ]);

  if (error) {
    return (
      <Result
        status="error"
        title={t('business.entryRedirect.errorTitle')}
        subTitle={t('business.entryRedirect.errorSubTitle')}
        extra={[
          <Button
            type="primary"
            key="retry"
            onClick={() => {
              setError(false);
              loadBusinessData().catch(() => setError(true));
            }}
          >
            {t('business.entryRedirect.retry')}
          </Button>,
          <Button key="create" onClick={() => navigate('/resource/business')}>
            {t('business.entryRedirect.goToBusinessList')}
          </Button>,
        ]}
      />
    );
  }

  if (loading && !initialized) {
    return null;
  }

  return null;
};

export default EntryRedirect;
