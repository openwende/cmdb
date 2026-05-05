import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Button, Collapse, Form, Input, Select, Switch, Table, Space, Tooltip } from 'antd';
import './style.css';
import { InfoCircleOutlined } from '@ant-design/icons';
import { ProcessItem } from '../../TransferHost';
import ConfirmModal from '@/components/common/ConfirmModal';


const protocolOptions = ['TCP', 'UDP', 'TCP6', 'UDP6'];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmit: (info: any) => void;
  mode: 'add' | 'edit';
  initialValues?: ProcessItem | null;
  listenIpOptions?: Array<string | undefined>;
}

export interface ListenInfo {
  id: string;
  ip: string | null;
  port: string | null;
  protocol: string | null;
  enable: boolean;
}

export const normalizeListenIpOptions = (options: Array<string | undefined>): string[] =>
  Array.from(new Set(options.map((item) => item?.trim()).filter((item): item is string => Boolean(item))));

const AddProcessModal: React.FC<Props> = ({
  visible,
  onClose,
  onSubmit,
  mode,
  initialValues,
  listenIpOptions = [],
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  const [listenInfoList, setListenInfoList] = useState<ListenInfo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [isChanged, setIsChanged] = useState(false);
  const availableListenIps = normalizeListenIpOptions(listenIpOptions);

  useEffect(() => {
    if (visible) {
      if (mode === 'edit' && initialValues) {
        form.setFieldsValue(initialValues);
        setListenInfoList(initialValues.bindInfo || []);
      } else if (mode === 'add') {
        form.resetFields();
        setListenInfoList([]);
      }
    }
  }, [visible, mode, initialValues, form]);

  useEffect(() => {
    if (mode !== 'edit' || !initialValues) {
      setIsChanged(true);
      return;
    }
    const formValues = form.getFieldsValue();
    const isFormChanged = Object.keys(formValues).some(
      (key) => formValues[key] !== initialValues[key],
    );
    const isListenChanged =
      JSON.stringify(listenInfoList) !== JSON.stringify(initialValues.bindInfo || []);
    setIsChanged(isFormChanged || isListenChanged);
  }, [listenInfoList, initialValues, mode]);

  // Listen to form changes
  const handleFormChange = () => {
    if (mode !== 'edit' || !initialValues) {
      setIsChanged(true);
      return;
    }
    const formValues = form.getFieldsValue();
    const isFormChanged = Object.keys(formValues).some(
      (key) => formValues[key] !== initialValues[key],
    );
    const isListenChanged =
      JSON.stringify(listenInfoList) !== JSON.stringify(initialValues.bindInfo || []);
    setIsChanged(isFormChanged || isListenChanged);
  };

  // Handle add listen info row
  const handleAddListenInfo = () => {
    const newId = Date.now().toString();
    setListenInfoList([
      ...listenInfoList,
      {
        id: newId,
        ip: null,
        port: null,
        protocol: null,
        enable: false,
      },
    ]);
  };

  // Handle delete listen info row
  const handleDeleteListenInfo = (id: string) => {
    setListenInfoList(listenInfoList.filter((item) => item.id !== id));
  };

  // Update listen info
  const handleUpdateListenInfo = (id: string, field: string, value: any) => {
    setListenInfoList(
      listenInfoList.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  // Listen info table columns
  const listenInfoColumns = [
    {
      title: 'IP',
      dataIndex: 'ip',
      key: 'ip',
      width: 180,
      render: (value: string, record: ListenInfo) => (
        <Select
          value={value}
          style={{ width: '100%' }}
          placeholder={t('business.topology.addProcessModal.placeholders.selectOrInputIP')}
          onChange={(val) => handleUpdateListenInfo(record.id, 'ip', val)}
        >
          {availableListenIps.map((item) => (
            <Select.Option value={item} key={item}>
              {item}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Port',
      dataIndex: 'port',
      key: 'port',
      width: 180,
      render: (value: string, record: ListenInfo) => (
        <Input
          placeholder={t('business.topology.addProcessModal.placeholders.inputPort')}
          value={value}
          onChange={(e) => handleUpdateListenInfo(record.id, 'port', e.target.value)}
        />
      ),
    },
    {
      title: 'Protocol',
      dataIndex: 'protocol',
      key: 'protocol',
      width: 180,
      render: (value: string, record: ListenInfo) => (
        <Select
          value={value}
          style={{ width: '100%' }}
          placeholder={t('business.topology.addProcessModal.placeholders.selectProtocol')}
          onChange={(val) => handleUpdateListenInfo(record.id, 'protocol', val)}
        >
          {protocolOptions.map((item) => (
            <Select.Option value={item} key={item}>
              {item}
            </Select.Option>
          ))}
        </Select>
      ),
    },
    {
      title: 'Enable',
      dataIndex: 'enable',
      key: 'enable',
      width: 150,
      render: (value: boolean, record: ListenInfo) => (
        <Switch
          checked={value}
          onChange={(checked) => handleUpdateListenInfo(record.id, 'enable', checked)}
        />
      ),
    },
    {
      title: t('business.topology.addProcessModal.columns.actions'),
      key: 'action',
      render: (_: any, record: ListenInfo) => (
        <Space>
          <Button type="link" onClick={handleAddListenInfo}>
            {t('business.topology.addProcessModal.buttons.add')}
          </Button>
          <Button type="link" danger onClick={() => handleDeleteListenInfo(record.id)}>
            {t('business.topology.addProcessModal.buttons.delete')}
          </Button>
        </Space>
      ),
    },
  ];

  // Handle submit process form
  const handleSubmitProcess = () => {
    form.validateFields().then((values) => {
      // Keep the original ID（edit mode）
      const payload =
        mode === 'edit' && initialValues
          ? { id: initialValues.id, ...values }
          : {
              ...values,
            };
      onSubmit({ ...payload, bindInfo: listenInfoList });
    });
  };

  const handleClose = () => {
    if (mode === 'edit') {
      if (isChanged) {
        setShowModal(true);
      } else {
        onClose();
      }
    } else {
      setShowModal(true);
    }
  };

  const handleConfirmClose = () => {
    form.resetFields();
    setListenInfoList([]);
    setShowModal(false);
    onClose();
  };

  return (
    <>
      <Drawer
        title={
          mode === 'edit'
            ? t('business.topology.addProcessModal.titles.edit')
            : t('business.topology.addProcessModal.titles.add')
        }
        open={visible}
        onClose={handleClose}
        width={1000}
        footer={
          <div className="footer-wrapper">
            <Button
              key="confirm"
              type="primary"
              onClick={handleSubmitProcess}
              disabled={mode === 'edit' && !isChanged}
            >
              {t('business.topology.addProcessModal.buttons.submit')}
            </Button>
            <Button key="cancel" onClick={handleClose}>
              {t('business.topology.addProcessModal.buttons.cancel')}
            </Button>
          </div>
        }
        className="process-drawer"
      >
        <div className="process-content">
          <Form form={form} layout="vertical" onValuesChange={handleFormChange}>
            {/* Basic Info */}
            <Collapse defaultActiveKey={['basic']} ghost items={[{ key: 'basic', label: t('business.topology.addProcessModal.sections.basicInfo'), children: (<>
                <div className="form-row">
                  <Form.Item
                    name="processName"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.processName')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.processName')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.processName')}
                    />
                  </Form.Item>
                  <Form.Item
                    name="processAlias"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.processAlias')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.processAlias')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.processAlias')}
                    />
                  </Form.Item>
                </div>
                <div className="form-row">
                  <Form.Item
                    name="startupParams"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.startupParams')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.startupParams')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    style={{ flex: 1 }}
                  >
                    <Input.TextArea
                      placeholder={t(
                        'business.topology.addProcessModal.placeholders.startupParams',
                      )}
                      rows={3}
                    />
                  </Form.Item>
                  <Form.Item
                    name="description"
                    label={t('business.topology.addProcessModal.fields.description')}
                    style={{ flex: 1 }}
                  >
                    <Input.TextArea
                      placeholder={t('business.topology.addProcessModal.placeholders.description')}
                      rows={3}
                    />
                  </Form.Item>
                </div>
            </>)}]}/>

            {/* Listen Info */}
            <Collapse defaultActiveKey={['listen']} ghost items={[{ key: 'listen', label: t('business.topology.addProcessModal.sections.listenInfo'), children: (<>
                <div className="listen-content">
                  <Table
                    dataSource={listenInfoList}
                    columns={listenInfoColumns}
                    pagination={false}
                    rowKey="id"
                    size="small"
                  />
                  {listenInfoList.length === 0 && (
                    <div className="add-button">
                      <Button type="link" onClick={handleAddListenInfo}>
                        + {t('business.topology.addProcessModal.buttons.addImmediately')}
                      </Button>
                    </div>
                  )}
                </div>
            </>)}]}/>

            {/* Process Management Info */}
            <Collapse ghost items={[{ key: 'processManagement', label: t('business.topology.addProcessModal.sections.processManagementInfo'), children: (<>
                <div className="form-row">
                  <Form.Item
                    name="workPath"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.workPath')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.workPath')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.workPath')}
                    />
                  </Form.Item>
                  <Form.Item
                    name="pidFile"
                    label={t('business.topology.addProcessModal.fields.pidFile')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.pidFile')}
                    />
                  </Form.Item>
                </div>
                <div className="form-row">
                  <Form.Item
                    name="startUser"
                    label={t('business.topology.addProcessModal.fields.startUser')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.startUser')}
                    />
                  </Form.Item>
                  <Form.Item
                    name="startCount"
                    label={t('business.topology.addProcessModal.fields.startCount')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      type="number"
                      placeholder={t('business.topology.addProcessModal.placeholders.startCount')}
                    />
                  </Form.Item>
                </div>
                <div className="form-row">
                  <Form.Item
                    name="priority"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.priority')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.priority')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.priority')}
                    />
                  </Form.Item>
                  <Form.Item
                    name="startCommand"
                    label={t('business.topology.addProcessModal.fields.startCommand')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.startCommand')}
                    />
                  </Form.Item>
                </div>
                <div className="form-row">
                  <Form.Item
                    name="stopCommand"
                    label={t('business.topology.addProcessModal.fields.stopCommand')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t('business.topology.addProcessModal.placeholders.stopCommand')}
                    />
                  </Form.Item>
                  <Form.Item
                    name="restartCommand"
                    label={t('business.topology.addProcessModal.fields.restartCommand')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t(
                        'business.topology.addProcessModal.placeholders.restartCommand',
                      )}
                    />
                  </Form.Item>
                </div>
                <div className="form-row">
                  <Form.Item
                    name="forceStopCommand"
                    label={t('business.topology.addProcessModal.fields.forceStopCommand')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t(
                        'business.topology.addProcessModal.placeholders.forceStopCommand',
                      )}
                    />
                  </Form.Item>
                  <Form.Item
                    name="reloadCommand"
                    label={t('business.topology.addProcessModal.fields.reloadCommand')}
                    style={{ flex: 1 }}
                  >
                    <Input
                      placeholder={t(
                        'business.topology.addProcessModal.placeholders.reloadCommand',
                      )}
                    />
                  </Form.Item>
                </div>
                <div className="form-row">
                  <Form.Item
                    name="startWaitTime"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.startWaitTime')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.startWaitTime')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    style={{ flex: 1 }}
                  >
                    <Input
                      type="number"
                      placeholder={t(
                        'business.topology.addProcessModal.placeholders.startWaitTime',
                      )}
                      suffix="s"
                    />
                  </Form.Item>
                  <Form.Item
                    name="operationTimeout"
                    label={
                      <span>
                        {t('business.topology.addProcessModal.fields.operationTimeout')}
                        <Tooltip
                          title={
                            <span style={{ whiteSpace: 'nowrap' }}>
                              {t('business.topology.addProcessModal.tooltips.operationTimeout')}
                            </span>
                          }
                          styles={{ root: { maxWidth: 'none' } }}
                          className="label-tip"
                        >
                          <InfoCircleOutlined />
                        </Tooltip>
                      </span>
                    }
                    style={{ flex: 1 }}
                  >
                    <Input
                      type="number"
                      placeholder={t(
                        'business.topology.addProcessModal.placeholders.operationTimeout',
                      )}
                      suffix="s"
                    />
                  </Form.Item>
                </div>
            </>)}]}/>
          </Form>
        </div>
      </Drawer>
      <ConfirmModal
        visible={showModal}
        onOk={handleConfirmClose}
        onCancel={() => setShowModal(false)}
        title={t('business.topology.addProcessModal.confirmModal.title')}
        description={t('business.topology.addProcessModal.confirmModal.description')}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />
    </>
  );
};

export default AddProcessModal;
