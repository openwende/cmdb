import React, { useState, useEffect } from 'react';
import { Collapse, Button, Spin, message } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import BasicInfo from './BasicInfo/index';
import RoleInfo from './RoleInfo/index';
import { getBusinessDetail, updateBusiness } from '@/api';
import type { BusinessDetail } from '@/api/types/resource';
import { LIFECYCLE_OPTIONS, LANGUAGE_OPTIONS } from '@/pages/Resource/constants';
import './style.css';

interface PropertiesProps {
  businessId: string;
}

const Properties: React.FC<PropertiesProps> = ({ businessId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [businessData, setBusinessData] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<BusinessDetail | null>(null);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const { t } = useTranslation();

  useEffect(() => {
    fetchBusinessDetail();
  }, [businessId]);

  const fetchBusinessDetail = async () => {
    if (!businessId) return;

    try {
      setLoading(true);
      const { data } = await getBusinessDetail(businessId);
      setBusinessData(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const enhancedBizData = React.useMemo(() => {
    if (!businessData) return null;

    return {
      ...businessData,
      lifecycle: LIFECYCLE_OPTIONS.find((opt) => opt.value === businessData.lifecycle)?.label
        ? t(LIFECYCLE_OPTIONS.find((opt) => opt.value === businessData.lifecycle)!.label)
        : businessData.lifecycle,
      language:
        LANGUAGE_OPTIONS.find((opt) => opt.value === businessData.language)?.label ||
        businessData.language,
      created_at: dayjs(businessData.created_at).format('YYYY-MM-DD HH:mm:ss') || '',
      updated_at: dayjs(businessData.updated_at).format('YYYY-MM-DD HH:mm:ss') || '',
      maintainers: businessData.maintainers.join(', ') || '',
      productManagers: businessData.productManagers?.join(', ') || '',
      testers: businessData.testers?.join(', ') || '',
      developers: businessData.developers?.join(', ') || '',
      operators: businessData.operators?.join(', ') || '',
    };
  }, [businessData, t]);

  const handleEdit = () => {
    if (!businessData || !enhancedBizData) return;

    const editData = {
      ...businessData,
      lifecycle: enhancedBizData.lifecycle,
      language: enhancedBizData.language,
      created_at: enhancedBizData.created_at,
      updated_at: enhancedBizData.updated_at,
      maintainers: businessData.maintainers || [],
      productManagers: businessData.productManagers || [],
      testers: businessData.testers || [],
      developers: businessData.developers || [],
      operators: businessData.operators || [],
    };

    setEditValues(editData);
    setIsEditing(true);
  };

  const handleSave = async () => {
    const errors: string[] = [];

    if (editValues) {
      if (editValues.name.trim() === '') {
        errors.push('name');
      }
      if (editValues.maintainers.length === 0) {
        errors.push('maintainers');
      }
    }

    setErrorFields(errors);
    if (errors.length > 0) {
      return;
    }

    setIsEditing(false);
    console.log('Saved values:', editValues);

    try {
      const data = await updateBusiness(businessId, editValues!);
      fetchBusinessDetail();
      if (data.success) {
        message.success(t('common.message.updateSuccess'));
      } else {
        message.error(t('common.message.updateFailed'));
      }
    } catch (error) {
      console.error(error);
      message.error(t('common.message.updateFailed'));
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValues(null);
    setErrorFields([]);
  };

  const handleValueChange = (key: string, value: string | string[]) => {
    setEditValues((prev) => {
      if (prev === null) {
        return null;
      }

      return {
        ...prev,
        [key]: value,
      };
    });

    // Validate field
    const errors = [...errorFields];
    const fieldIndex = errors.indexOf(key);
    const hasValue = Array.isArray(value) ? value.length > 0 : value.trim() !== '';

    if (hasValue && fieldIndex !== -1) {
      // Remove error if field has value
      errors.splice(fieldIndex, 1);
    } else if (!hasValue && fieldIndex === -1) {
      // Add error if field is empty
      errors.push(key);
    }

    setErrorFields(errors);
  };

  if (loading) {
    return (
      <div className="properties-loading">
        <Spin size="large" />
      </div>
    );
  }

  const items = [
    {
      key: 'basic',
      label: '基础信息',
      children: (
        <BasicInfo
          data={enhancedBizData as unknown as BusinessDetail}
          isEditing={isEditing}
          editValues={editValues}
          onValueChange={handleValueChange}
          errorFields={errorFields}
        />
      ),
    },
    {
      key: 'roles',
      label: '角色',
      children: (
        <RoleInfo
          data={enhancedBizData as unknown as BusinessDetail}
          isEditing={isEditing}
          editValues={editValues}
          onValueChange={handleValueChange}
          errorFields={errorFields}
        />
      ),
    },
  ];

  return (
    <>
      <Collapse
        items={items}
        ghost
        defaultActiveKey={['basic', 'roles']}
        className="properties-collapse"
      />

      <div className="properties-actions">
        <div className="actions-divider"></div>
        <div className="actions-content">
          {!isEditing ? (
            <Button type="primary" onClick={handleEdit}>
              编辑
            </Button>
          ) : (
            <div className="editing-actions">
              <Button type="primary" onClick={handleSave}>
                保存
              </Button>
              <Button onClick={handleCancel}>取消</Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Properties;
