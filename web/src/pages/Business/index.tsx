import React, { useEffect } from 'react';
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom';
import { useBusinessStore, BusinessType } from '../../store/BusinessStore';

/**
 * 业务/业务集页面组件
 * 处理路径参数中的业务ID，并渲染子路由内容
 */
const Business: React.FC = () => {
  const params = useParams();
  const { businessId, businessSetId } = params; // 从路径参数获取ID
  const navigate = useNavigate();
  const location = useLocation();

  const {
    getBusinessById,
    setCurrentBusiness,
    loadBusinessData,
    businessList,
    businessSetList,
    currentBusiness
  } = useBusinessStore();

  // 加载业务数据
  useEffect(() => {
    // 确保业务数据已加载
    if (businessList.length === 0) {
      loadBusinessData();
    }
  }, [loadBusinessData, businessList.length]);

  // 处理路由：确保有具体的业务/业务集ID，否则重定向
  useEffect(() => {
    const path = location.pathname;

    // 如果是根路径，重定向到第一个业务
    if (path === '/business') {
      // 显示加载中状态，不做重定向
      if (businessList.length === 0) {
        // 加载业务数据
        loadBusinessData().then(() => {
          // 获取最新的业务列表状态
          const { businessList: updatedList } = useBusinessStore.getState();
          // 加载完成后，如果用户仍在/business路径，重定向到第一个业务
          if (location.pathname === '/business' && updatedList.length > 0) {
            const firstBusiness = updatedList[0];
            navigate(`/business/${firstBusiness.id}/topology`, { replace: true });
          } else if (location.pathname === '/business' && updatedList.length === 0) {
            // 如果没有业务数据，显示提示信息，不进行跳转
            console.warn('No business data available');
          }
        }).catch(error => {
          console.error('Failed to load business data:', error);
          // 如果加载失败，仍然保持在当前页面
        });
      } else {
        // 如果业务列表已加载，重定向到第一个业务
        const firstBusiness = businessList[0];
        navigate(`/business/${firstBusiness.id}/topology`, { replace: true });
      }
      return;
    }

    // 如果是业务集根路径，重定向到第一个业务集
    if (path === '/business-set') {
      if (businessSetList.length > 0) {
        const firstBusinessSet = businessSetList[0];
        navigate(`/business-set/${firstBusinessSet.id}/topology`, { replace: true });
      }
      return;
    }

    // 检查是否需要添加默认子路由 topology
    if (businessId && path === `/business/${businessId}`) {
      navigate(`/business/${businessId}/topology`, { replace: true });
      return;
    }

    // 检查是否需要添加默认子路由 topology
    if (businessSetId && path === `/business-set/${businessSetId}`) {
      navigate(`/business-set/${businessSetId}/topology`, { replace: true });
      return;
    }
  }, [location.pathname, businessList, businessSetList, navigate, businessId, businessSetId]);

  // 根据URL更新当前选中的业务/业务集
  useEffect(() => {
    if (businessId) {
      const business = getBusinessById(businessId, BusinessType.BUSINESS);
      if (business) {
        setCurrentBusiness(business);
      } else if (businessList.length > 0) {
        // 如果找不到指定的业务ID，但有业务数据，则重定向到第一个业务
        console.warn(`Business ID ${businessId} not found, redirecting to first business`);
        navigate(`/business/${businessList[0].id}/topology`, { replace: true });
      }
    } else if (businessSetId) {
      const businessSet = getBusinessById(businessSetId, BusinessType.BUSINESS_SET);
      if (businessSet) {
        setCurrentBusiness(businessSet);
      } else if (businessSetList.length > 0) {
        // 如果找不到指定的业务集ID，但有业务集数据，则重定向到第一个业务集
        console.warn(`Business Set ID ${businessSetId} not found, redirecting to first business set`);
        navigate(`/business-set/${businessSetList[0].id}/topology`, { replace: true });
      }
    }
  }, [businessId, businessSetId, businessList, businessSetList, getBusinessById, setCurrentBusiness, navigate]);

  // 添加加载状态
  const { loading } = useBusinessStore();
  const path = location.pathname;

  // 如果是业务根路径并且正在加载数据，显示加载状态
  if (path === '/business' && (loading || businessList.length === 0)) {
    return (
      <div className="business-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <div>加载业务数据中...</div>
      </div>
    );
  }

  // 使用 Outlet 来渲染子路由的内容
  return (
    <div className="business-page">
      <Outlet />
    </div>
  );
};

export default Business;