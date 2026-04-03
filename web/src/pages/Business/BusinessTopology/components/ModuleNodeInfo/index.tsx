import React, { useEffect, useState } from 'react';
import { Collapse, Button, message, Form, Input, Select, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { userListMock } from '@/mock/resource';
import ServiceCategorySelector from '../../components/ServiceCategory';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import ConfirmModal from '@/components/common/ConfirmModal';
import { debounce } from '@/utils/performance';
import { deleteTopologyModule, updateTopologyModule } from '@/api/services/business';
import { normalizeModuleNodeDetail } from '../../nodeDetailAdapters';
import './style.css';

const { Option } = Select;

interface Props {
  selectedNode: TreeData;
  onTopologyChanged?: () => void;
}

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '--';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return date.toLocaleString();
};

const getModuleTypeLabel = (value: string | undefined, t: (key: string) => string): string => {
  switch (value) {
    case '1':
      return t('business.topology.moduleNodeInfo.moduleTypeOptions.normal');
    case '2':
    case 'db':
      return t('business.topology.moduleNodeInfo.moduleTypeOptions.database');
    case 'web':
    case 'api':
    case 'cache':
    case 'mq':
    case 'other':
      return value;
    default:
      return '--';
  }
};

const buildModuleData = (selectedNode: TreeData) => normalizeModuleNodeDetail(selectedNode);

const ModuleNodeInfo: React.FC<Props> = ({ selectedNode, onTopologyChanged }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  const [serviceCategory, setServiceCategory] = useState<number[]>([1, 2]);
  const [formChanged, setFormChanged] = useState(false);
  const [userOptions, setUserOptions] = useState<{ label: string; value: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const [moduleData, setModuleData] = useState(() => buildModuleData(selectedNode));

  useEffect(() => {
    setModuleData(buildModuleData(selectedNode));
  }, [selectedNode]);

  const handleEdit = () => {
    let operators: string[] = [];
    if (moduleData.operator) {
      const opStr = String(moduleData.operator);
      operators = opStr.split(',').filter((op: string) => op.trim() !== '');
    }

    let backupOperators: string[] = [];
    if (moduleData.bk_bak_operator) {
      const backupOpStr = String(moduleData.bk_bak_operator);
      backupOperators = backupOpStr.split(',').filter((op: string) => op.trim() !== '');
    }

    const categoryId = Number(moduleData.service_category_id);
    if (!Number.isNaN(categoryId) && categoryId > 0) {
      setServiceCategory([categoryId]);
    }

    form.setFieldsValue({
      bkModuleName: moduleData.bk_module_name,
      bkModuleType: moduleData.bk_module_type,
      operator: operators,
      bkBakOperator: backupOperators,
      moduleStatus: 'normal',
      moduleId: moduleData.bk_module_id,
    });

    setFormChanged(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    try {
      const moduleID = Number(selectedNode.nodeId ?? moduleData.bk_module_id);
      await deleteTopologyModule(moduleID);
      message.success(t('business.topology.moduleNodeInfo.deleteSuccess'));
      setIsDeleteModalVisible(false);
      onTopologyChanged?.();
    } catch (error) {
      console.error('Failed to delete topology module:', error);
      message.error(t('business.topology.moduleNodeInfo.deleteFailed'));
    }
  };

  const searchUsers = debounce((value: string) => {
    setIsSearching(true);
    setTimeout(() => {
      if (value.trim() === '') {
        setUserOptions([]);
      } else {
        const filteredUsers = userListMock
          .filter(
            (user) =>
              user.english_name.toLowerCase().includes(value.toLowerCase()) ||
              user.chinese_name.includes(value),
          )
          .map((user) => ({
            label: `${user.chinese_name} (${user.english_name})`,
            value: user.english_name,
          }));
        setUserOptions(filteredUsers);
      }
      setIsSearching(false);
    }, 300);
  }, 300);

  const handleSearch = (value: string) => {
    if (value) {
      searchUsers(value);
    } else {
      setUserOptions([]);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const moduleID = Number(selectedNode.nodeId ?? moduleData.bk_module_id);
      await updateTopologyModule(moduleID, {
        name: values.bkModuleName,
      });
      setModuleData((current) => ({
        ...current,
        bk_module_name: values.bkModuleName,
        bk_module_type: values.bkModuleType,
        operator: Array.isArray(values.operator) ? values.operator.join(',') : values.operator,
        bk_bak_operator: Array.isArray(values.bkBakOperator)
          ? values.bkBakOperator.join(',')
          : values.bkBakOperator,
        service_category_id:
          serviceCategory[0] != null ? String(serviceCategory[0]) : current.service_category_id,
      }));
      message.success(t('business.topology.moduleNodeInfo.saveSuccess'));
      setIsEditing(false);
      setFormChanged(false);
      onTopologyChanged?.();
    } catch (error) {
      console.error('Form validation failed:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setIsEditing(false);
  };

  const renderEditForm = () => {
    return (
      <>
        <div className="edit-info-header">
          <div className="service-category-wrapper">
            <div className="category-label">
              {t('business.topology.moduleNodeInfo.serviceCategory')}
            </div>
            <ServiceCategorySelector
              value={serviceCategory}
              onChange={(value: number[]) => {
                setServiceCategory(value);
                setFormChanged(true);
              }}
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <Collapse
          defaultActiveKey={['1']}
          ghost
          items={[
            {
              key: '1',
              label: (
                <span className="basic-info">
                  {t('business.topology.moduleNodeInfo.basicInfo')}
                </span>
              ),
              children: (
                <Form form={form} layout="vertical">
                  <div className="form-row">
                    <Form.Item
                      label={t('business.topology.moduleNodeInfo.moduleName')}
                      name="bkModuleName"
                      rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                      className="flex-item"
                    >
                      <Input
                        placeholder={t('business.topology.moduleNodeInfo.moduleNamePlaceholder')}
                        onChange={() => setFormChanged(true)}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('business.topology.moduleNodeInfo.moduleType')}
                      name="bkModuleType"
                      className="flex-item"
                    >
                      <Select
                        placeholder={t('business.topology.moduleNodeInfo.moduleTypePlaceholder')}
                        onChange={() => setFormChanged(true)}
                      >
                        <Option value="1">
                          {t('business.topology.moduleNodeInfo.moduleTypeOptions.normal')}
                        </Option>
                        <Option value="2">
                          {t('business.topology.moduleNodeInfo.moduleTypeOptions.database')}
                        </Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      label={t('business.topology.moduleNodeInfo.mainOperator')}
                      name="operator"
                      className="flex-item"
                    >
                      <Select
                        mode="multiple"
                        placeholder={t('business.topology.moduleNodeInfo.mainOperatorPlaceholder')}
                        options={userOptions}
                        filterOption={false}
                        showSearch
                        onSearch={handleSearch}
                        onChange={() => setFormChanged(true)}
                        notFoundContent={isSearching ? <Spin size="small" /> : null}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </div>
                  <div className="form-row last-row">
                    <Form.Item
                      label={t('business.topology.moduleNodeInfo.backupOperator')}
                      name="bkBakOperator"
                      className="flex-item"
                    >
                      <Select
                        mode="multiple"
                        placeholder={t(
                          'business.topology.moduleNodeInfo.backupOperatorPlaceholder',
                        )}
                        options={userOptions}
                        filterOption={false}
                        showSearch
                        onSearch={handleSearch}
                        onChange={() => setFormChanged(true)}
                        notFoundContent={isSearching ? <Spin size="small" /> : null}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </div>
                </Form>
              ),
            },
          ]}
        />

        <div className="node-actions">
          <div className="actions-divider"></div>
          <div className="actions-content">
            <Button type="primary" onClick={handleSave} disabled={!formChanged}>
              {t('common.submit')}
            </Button>
            <Button onClick={handleCancel}>{t('common.cancel')}</Button>
          </div>
        </div>
      </>
    );
  };

  if (isEditing) {
    return <div className="node-info-container">{renderEditForm()}</div>;
  }

  return (
    <>
      <ConfirmModal
        visible={isDeleteModalVisible}
        onOk={confirmDelete}
        onCancel={() => setIsDeleteModalVisible(false)}
        title={t('business.topology.moduleNodeInfo.confirmDeleteTitle')}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />

      <div className="info-header">
        <div>
          <span className="header-label">
            {t('business.topology.moduleNodeInfo.serviceTemplate')}：
          </span>
          {moduleData.service_template_id
            ? String(moduleData.service_template_id)
            : t('business.topology.moduleNodeInfo.none')}
        </div>
        <div>
          <span className="header-label">
            {t('business.topology.moduleNodeInfo.serviceCategory')}：
          </span>
          {moduleData.service_category_id ? String(moduleData.service_category_id) : '--'}
        </div>
        <div>
          <span className="header-label">
            {t('business.topology.moduleNodeInfo.hostAttributeAutoApply')}：
          </span>
          <Button type="link" className="disabled-link">
            {moduleData.host_apply_enabled
              ? 'Enabled'
              : t('business.topology.moduleNodeInfo.notEnabled')}
          </Button>
        </div>
      </div>

      <Collapse
        defaultActiveKey={['1']}
        ghost
        items={[
          {
            key: '1',
            label: (
              <span style={{ fontWeight: 'bold', color: 'var(--color-text-primary)' }}>
                {t('business.topology.moduleNodeInfo.basicInfo')}
              </span>
            ),
            children: (
              <div className="info-grid">
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.createTime')}
                  value={formatDateTime(moduleData.create_time)}
                />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.creator')}
                  value={moduleData.bk_created_by}
                />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.updateTime')}
                  value={formatDateTime(moduleData.last_time)}
                />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.updater')}
                  value={moduleData.bk_updated_by}
                />
                <InfoItem label="ID" value={moduleData.bk_module_id} />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.moduleName')}
                  value={moduleData.bk_module_name}
                />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.moduleType')}
                  value={getModuleTypeLabel(
                    moduleData.service_type ?? moduleData.bk_module_type,
                    t,
                  )}
                />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.mainOperator')}
                  value={moduleData.operator}
                />
                <InfoItem
                  label={t('business.topology.moduleNodeInfo.backupOperator')}
                  value={moduleData.bk_bak_operator}
                />
              </div>
            ),
          },
        ]}
      />

      <div className="node-actions">
        <div className="actions-divider"></div>
        <div className="actions-content">
          <Button type="primary" onClick={handleEdit}>
            {t('common.edit')}
          </Button>
          <Button type="primary" danger onClick={handleDelete}>
            {t('business.topology.moduleNodeInfo.deleteNode')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default ModuleNodeInfo;
