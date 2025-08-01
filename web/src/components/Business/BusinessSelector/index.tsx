import React, { useEffect, useRef } from 'react';
import { Select, Spin } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBusinessStore, BusinessType } from '../../../store/BusinessStore';
import { getBusinessTopologyPath, getBusinessSetTopologyPath, isBusinessRelatedPage, parseBusinessInfoFromUrl } from '../../../utils/routes';
import './style.css';

const SELECTOR_COLLAPSED_WIDTH = 42;

const { Option, OptGroup } = Select;

interface BusinessSelectorProps {
    collapsed?: boolean;
}

const BusinessSelector: React.FC<BusinessSelectorProps> = ({ collapsed = false }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const containerRef = useRef<HTMLDivElement>(null);

    const {
        currentBusiness,
        businessList,
        businessSetList,
        loading,
        loadBusinessData,
        getBusinessById,
        setCurrentBusiness
    } = useBusinessStore();

    useEffect(() => {
        loadBusinessData();
    }, [loadBusinessData]);

    // Parse business ID from URL
    // This function is now removed and replaced with the utility function from routes.ts

    // Update current business when URL changes
    useEffect(() => {
        const businessInfo = parseBusinessInfoFromUrl(location.pathname);

        if (businessInfo) {
            const { id, type } = businessInfo;
            const business = getBusinessById(id.toString(), type);

            if (business) {
                setCurrentBusiness(business);
            }
        }
    }, [location.pathname, getBusinessById, setCurrentBusiness]);

    // Generate select value from current business
    const getSelectValue = (): string => {
        if (!currentBusiness) return '';
        return `${currentBusiness.type}:${currentBusiness.id}`;
    };

    // Handle business selection change
    const handleChange = (value: string) => {
        const [type, idStr] = value.split(':');
        const id = parseInt(idStr, 10);

        if (type === BusinessType.Business) {
            const business = getBusinessById(id, BusinessType.Business);
            if (business) {
                setCurrentBusiness(business);
                // Always use replace to ensure page state refresh
                navigate(getBusinessTopologyPath(id), { replace: true });
            }
        } else if (type === BusinessType.BusinessSet) {
            const businessSet = getBusinessById(id, BusinessType.BusinessSet);
            if (businessSet) {
                setCurrentBusiness(businessSet);

                // Always use replace to ensure page state refresh
                navigate(getBusinessSetTopologyPath(id), { replace: true });
            }
        }
    };

    // Show selector in business or business set pages
    const isBusinessPath = isBusinessRelatedPage(location.pathname);
    if (!isBusinessPath) {
        return null;
    }

    return (
        <div ref={containerRef} className="business-selector-container">
            <Select
                value={getSelectValue()}
                onChange={handleChange}
                className="business-selector"
                loading={loading}
                notFoundContent={loading ? <Spin size="small" /> : null}
                placeholder="请选择业务或业务集"
                getPopupContainer={() => containerRef.current!}
                styles={{ root: { width: collapsed ? SELECTOR_COLLAPSED_WIDTH : undefined } }}
            >
                {businessList.length > 0 && (
                    <OptGroup label="业务">
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
                    <OptGroup label="业务集">
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

export default BusinessSelector;
