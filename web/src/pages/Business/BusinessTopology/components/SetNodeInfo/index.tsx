import React, { useEffect, useState } from 'react';
import { Collapse, Button, message, Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import ConfirmModal from '@/components/common/ConfirmModal';
import { deleteTopologySet, updateTopologySet } from '@/api/services/business';
import { normalizeSetNodeDetail } from '../../nodeDetailAdapters';
import { useAuthStore } from '@/store/AuthStore';
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

const getSetEnvLabel = (value: string | undefined, t: (key: string) => string): string => {
  switch (value) {
    case '1':
    case 'test':
      return t('business.topology.setNodeInfo.environment.test');
    case '2':
    case 'staging':
      return t('business.topology.setNodeInfo.environment.experience');
    case '3':
    case 'prod':
      return t('business.topology.setNodeInfo.environment.production');
    case 'dev':
      return 'dev';
    default:
      return '--';
  }
};

const getServiceStatusLabel = (value: string | undefined, t: (key: string) => string): string => {
  switch (value) {
    case '1':
      return t('business.topology.setNodeInfo.status.open');
    case '2':
      return t('business.topology.setNodeInfo.status.closed');
    default:
      return '--';
  }
};

const mapEnvValueToAPI = (value: string | undefined): string | undefined => {
  switch (value) {
    case '1':
      return 'test';
    case '2':
      return 'staging';
    case '3':
      return 'prod';
    default:
      return undefined;
  }
};

const buildSetData = (selectedNode: TreeData) => normalizeSetNodeDetail(selectedNode);

const SetNodeInfo: React.FC<Props> = ({ selectedNode, onTopologyChanged }) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  const [formChanged, setFormChanged] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [setData, setSetData] = useState(() => buildSetData(selectedNode));
  const canWrite = useAuthStore((state) => state.canWrite());

  useEffect(() => {
    setSetData(buildSetData(selectedNode));
  }, [selectedNode]);

  const handleEdit = () => {
    form.setFieldsValue({
      bkSetName: setData.bk_set_name,
      setDesc: setData.bk_set_desc || '',
      bkServiceStatus: setData.bk_service_status,
      bkSetEnv: setData.bk_set_env || '3',
      bkCapacity: setData.bk_capacity,
      bkSetDesc: setData.description || '',
    });
    setFormChanged(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    try {
      const setID = Number(selectedNode.nodeId ?? setData.bk_set_id);
      await deleteTopologySet(setID);
      message.success(t('business.topology.setNodeInfo.deleteSuccess'));
      setIsDeleteModalVisible(false);
      onTopologyChanged?.();
    } catch (error) {
      console.error('Failed to delete topology set:', error);
      message.error(t('business.topology.setNodeInfo.deleteFailed'));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const setID = Number(selectedNode.nodeId ?? setData.bk_set_id);
      await updateTopologySet(setID, {
        name: values.bkSetName,
        description: values.bkSetDesc || values.setDesc || '',
        env_type: mapEnvValueToAPI(values.bkSetEnv),
      });
      setSetData((current) => ({
        ...current,
        bk_set_name: values.bkSetName,
        bk_set_desc: values.setDesc || values.bkSetDesc || '',
        description: values.bkSetDesc || values.setDesc || '',
        bk_set_env: values.bkSetEnv,
        bk_service_status: values.bkServiceStatus,
        bk_capacity: values.bkCapacity,
      }));
      message.success(t('business.topology.setNodeInfo.saveSuccess'));
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
        <Collapse
          defaultActiveKey={['1']}
          ghost
          items={[
            {
              key: '1',
              label: (
                <span className="basic-info">{t('business.topology.setNodeInfo.basicInfo')}</span>
              ),
              children: (
                <Form form={form} layout="vertical">
                  <div className="form-row">
                    <Form.Item
                      label={t('business.topology.setNodeInfo.setName')}
                      name="bkSetName"
                      rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                      className="flex-item"
                    >
                      <Input
                        placeholder={t('business.topology.setNodeInfo.setNamePlaceholder')}
                        onChange={() => setFormChanged(true)}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('business.topology.setNodeInfo.setDescription')}
                      name="setDesc"
                      className="flex-item"
                    >
                      <Input
                        placeholder={t('business.topology.setNodeInfo.setDescriptionPlaceholder')}
                        onChange={() => setFormChanged(true)}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('business.topology.setNodeInfo.environmentType')}
                      name="bkSetEnv"
                      className="flex-item"
                    >
                      <Select
                        placeholder={t('business.topology.setNodeInfo.environmentTypePlaceholder')}
                        onChange={() => setFormChanged(true)}
                      >
                        <Option value="1">
                          {t('business.topology.setNodeInfo.environment.test')}
                        </Option>
                        <Option value="2">
                          {t('business.topology.setNodeInfo.environment.experience')}
                        </Option>
                        <Option value="3">
                          {t('business.topology.setNodeInfo.environment.production')}
                        </Option>
                      </Select>
                    </Form.Item>
                  </div>
                  <div className="form-row last-row">
                    <Form.Item
                      label={t('business.topology.setNodeInfo.serviceStatus')}
                      name="bkServiceStatus"
                      className="flex-item"
                    >
                      <Select
                        placeholder={t('business.topology.setNodeInfo.serviceStatusPlaceholder')}
                        onChange={() => setFormChanged(true)}
                      >
                        <Option value="1">{t('business.topology.setNodeInfo.status.open')}</Option>
                        <Option value="2">
                          {t('business.topology.setNodeInfo.status.closed')}
                        </Option>
                      </Select>
                    </Form.Item>
                    <Form.Item
                      label={t('business.topology.setNodeInfo.designCapacity')}
                      name="bkCapacity"
                      className="flex-item"
                    >
                      <Input
                        placeholder={t('business.topology.setNodeInfo.designCapacityPlaceholder')}
                        onChange={() => setFormChanged(true)}
                      />
                    </Form.Item>
                    <Form.Item
                      label={t('business.topology.setNodeInfo.remarks')}
                      name="bkSetDesc"
                      className="description-item"
                    >
                      <Input.TextArea
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        placeholder={t('business.topology.setNodeInfo.remarksPlaceholder')}
                        onChange={() => setFormChanged(true)}
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
            <Button type="primary" onClick={handleSave} disabled={!formChanged || !canWrite}>
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
        title={t('business.topology.setNodeInfo.confirmDeleteTitle')}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />

      <div className="info-header">
        <div>
          <span className="header-label">
            {t('business.topology.setNodeInfo.clusterTemplate')}：
          </span>
          {setData.set_template_id
            ? String(setData.set_template_id)
            : t('business.topology.setNodeInfo.none')}
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
                {t('business.topology.setNodeInfo.basicInfo')}
              </span>
            ),
            children: (
              <div className="info-grid">
                <InfoItem
                  label={t('business.topology.setNodeInfo.createTime')}
                  value={formatDateTime(setData.create_time)}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.creator')}
                  value={setData.bk_created_by}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.updateTime')}
                  value={formatDateTime(setData.last_time)}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.updater')}
                  value={setData.bk_updated_by}
                />
                <InfoItem label="ID" value={setData.bk_set_id} />
                <InfoItem
                  label={t('business.topology.setNodeInfo.setName')}
                  value={setData.bk_set_name}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.setDescription')}
                  value={setData.bk_set_desc}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.environmentType')}
                  value={getSetEnvLabel(setData.bk_set_env, t)}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.serviceStatus')}
                  value={getServiceStatusLabel(setData.bk_service_status, t)}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.remarks')}
                  value={setData.description}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.designCapacity')}
                  value={setData.bk_capacity}
                />
              </div>
            ),
          },
        ]}
      />

      <div className="node-actions">
        <div className="actions-divider"></div>
        <div className="actions-content">
          {canWrite ? (
            <>
              <Button type="primary" onClick={handleEdit}>
                {t('common.edit')}
              </Button>
              <Button type="primary" danger onClick={handleDelete}>
                {t('business.topology.setNodeInfo.deleteNode')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default SetNodeInfo;
