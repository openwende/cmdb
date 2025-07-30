import React, { useEffect } from 'react';
import { Select, Spin } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { useBusinessStore, BusinessType } from '../../../store/BusinessStore';
import './style.css';

const { Option, OptGroup } = Select;

const BusinessSelector: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

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
    const getBusinessIdFromUrl = (): { id: string; type: BusinessType } | null => {
        const pathSegments = location.pathname.split('/');

        // Check if path is business path: /business/:businessId/...
        if (pathSegments.length >= 3 && pathSegments[1] === 'business') {
            const id = pathSegments[2];
            // Ensure ID is a number and not empty
            if (id && !isNaN(Number(id))) {
                return {
                    id,
                    type: BusinessType.BUSINESS
                };
            }
        }

        // Check if path is business set path: /business-set/:businessSetId/...
        if (pathSegments.length >= 3 && pathSegments[1] === 'business-set') {
            const id = pathSegments[2];
            // Ensure ID is a number and not empty
            if (id && !isNaN(Number(id))) {
                return {
                    id,
                    type: BusinessType.BUSINESS_SET
                };
            }
        }

        return null;
    };

    // Update current business when URL changes
    useEffect(() => {
        const businessInfo = getBusinessIdFromUrl();

        if (businessInfo) {
            const { id, type } = businessInfo;
            const business = getBusinessById(id, type);

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

        if (type === BusinessType.BUSINESS) {
            const business = getBusinessById(id, BusinessType.BUSINESS);
            if (business) {
                setCurrentBusiness(business);
                // Always use replace to ensure page state refresh
                navigate(`/business/${id}/topology`, { replace: true });
            }
        } else if (type === BusinessType.BUSINESS_SET) {
            const businessSet = getBusinessById(id, BusinessType.BUSINESS_SET);
            if (businessSet) {
                setCurrentBusiness(businessSet);

                // Always use replace to ensure page state refresh
                navigate(`/business-set/${id}/topology`, { replace: true });
            }
        }
    };

    // Show selector in business or business set pages
    const isBusinessPath = location.pathname.startsWith('/business');
    if (!isBusinessPath) {
        return null;
    }

    return (
        <div className="business-selector-container">
            <Select
                value={getSelectValue()}
                onChange={handleChange}
                className="business-selector"
                loading={loading}
                notFoundContent={loading ? <Spin size="small" /> : null}
                placeholder="请选择业务或业务集"
                optionLabelProp="label"
            >
                {businessList.length > 0 && (
                    <OptGroup label="业务">
                        {businessList.map((business) => (
                            <Option
                                key={`${BusinessType.BUSINESS}:${business.id}`}
                                value={`${BusinessType.BUSINESS}:${business.id}`}
                                label={business.name}
                            >
                                {business.name}
                            </Option>
                        ))}
                    </OptGroup>
                )}

                {businessSetList.length > 0 && (
                    <OptGroup label="业务集">
                        {businessSetList.map((businessSet) => (
                            <Option
                                key={`${BusinessType.BUSINESS_SET}:${businessSet.id}`}
                                value={`${BusinessType.BUSINESS_SET}:${businessSet.id}`}
                                label={businessSet.name}
                            >
                                {businessSet.name}
                            </Option>
                        ))}
                    </OptGroup>
                )}
            </Select>
        </div>
    );
};

export default BusinessSelector;
