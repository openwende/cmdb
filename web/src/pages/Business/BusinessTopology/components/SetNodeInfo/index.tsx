import React, { useState } from 'react';
import { Collapse, Button, message, Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { setNodeInfo } from '@/mock/business';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import ConfirmModal from '@/components/common/ConfirmModal';
import './style.css';

const { Option } = Select;

interface Props {
  selectedNode: TreeData;
}

const SetNodeInfo: React.FC<Props> = () => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();
  const [formChanged, setFormChanged] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  const setData = setNodeInfo[0];

  const handleEdit = () => {
    form.setFieldsValue({
      bkSetName: setData.bk_set_name,
      setDesc: setData.bk_set_desc || '',
      bkServiceStatus: setData.bk_service_status,
      bkSetEnv: setData.bk_set_env || '3',
      bkCapacity: setData.bk_capacity,
      bkSetDesc: setData.bk_set_desc || '',
    });
    setFormChanged(false);
    setIsEditing(true);
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const confirmDelete = () => {
    // TODO: api
    message.success(t('business.topology.setNodeInfo.deleteSuccess'));
    setIsDeleteModalVisible(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();

      const setProcessedValues = {
        ...values,
      };

      console.log(setProcessedValues);
      message.success(t('business.topology.setNodeInfo.saveSuccess'));
      setIsEditing(false);
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
            <Button type="primary" onClick={handleSave} disabled={!formChanged}>
              {t('common.submit')}
            </Button>
            <Button onClick={handleCancel}>{t('common.cancel')}</Button>
          </div>
        </div>
      </>
    );
  };

  // Return edit form if in editing mode
  if (isEditing) {
    return <div className="node-info-container">{renderEditForm()}</div>;
  }

  // Otherwise, return info view
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
          {t('business.topology.setNodeInfo.none')}
        </div>
      </div>

      <Collapse
        defaultActiveKey={['1']}
        ghost
        items={[
          {
            key: '1',
            label: (
              <span style={{ fontWeight: 'bold', color: '#000' }}>
                {t('business.topology.setNodeInfo.basicInfo')}
              </span>
            ),
            children: (
              <div className="info-grid">
                <InfoItem
                  label={t('business.topology.setNodeInfo.createTime')}
                  value={new Date(setData.create_time).toLocaleString()}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.creator')}
                  value={setData.bk_created_by}
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.updateTime')}
                  value={new Date(setData.last_time).toLocaleString()}
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
                  value={
                    setData.bk_set_env === '3'
                      ? t('business.topology.setNodeInfo.environment.production')
                      : t('business.topology.setNodeInfo.environment.test')
                  }
                />
                <InfoItem
                  label={t('business.topology.setNodeInfo.serviceStatus')}
                  value={
                    setData.bk_service_status === '1'
                      ? t('business.topology.setNodeInfo.status.open')
                      : t('business.topology.setNodeInfo.status.closed')
                  }
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
          <Button type="primary" onClick={handleEdit}>
            {t('common.edit')}
          </Button>
          <Button type="primary" danger onClick={handleDelete}>
            {t('business.topology.setNodeInfo.deleteNode')}
          </Button>
        </div>
      </div>
    </>
  );
};

export default SetNodeInfo;
