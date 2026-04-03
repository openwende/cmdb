import React, { useEffect } from 'react';
import { Spin } from 'antd';
import { useNavigate } from 'react-router-dom';

import { BusinessType, useBusinessStore } from '@/store/BusinessStore';
import { getBusinessSetTopologyPath, getBusinessTopologyPath } from '@/utils/routes';

const EntryRedirect: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentBusiness,
    businessList,
    businessSetList,
    initialized,
    loading,
    loadBusinessData,
  } = useBusinessStore();

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
      void loadBusinessData();
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

  return <Spin style={{ margin: '48px auto', display: 'block' }} />;
};

export default EntryRedirect;
