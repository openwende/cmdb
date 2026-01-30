import { useState, useEffect } from 'react';
import { Drawer, Form, Input, Button, Space, Collapse, Tooltip, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  DynamicGroupFormData,
  ObjectMainLine,
  PropertyMap,
  Property,
  ConditionType,
  Condition,
} from '../../Types';
import { availableModelIds, requestConfig, BUILTIN_MODELS } from '../../constants';
import {
  createServiceTemplateProperty,
  formatDynamicConditions,
  isValidCondition,
  processConditionGroups,
  getConditionName,
} from '../../utils';
import SearchTarget from './SearchTarget';
import ConditionPicker from './ConditionPicker';
import PropertyList from './PropertyList';
import PreviewResult from './PreviewResult';
import DragHandle from '@/components/common/DragHandle';
import ConfirmModal from '@/components/common/ConfirmModal';
import { getAvailableModels, batchSearchObjectAttribute } from '@/api';
import { useBusinessStore } from '@/store/BusinessStore';
import dayjs from 'dayjs';
import { dynamicGroupPreviewResult } from '@/mock/business';
import './style.css';

const DRAWER_WIDTH = 1200;
const MIN_WIDTH = 400;
const MAX_WIDTH = 500;
const PADDING = 24;

export enum FormMode {
  CREATE = 'create',
  EDIT = 'edit',
  PREVIEW = 'preview',
}
interface DynamicGroupFormProps {
  title: string;
  visible: boolean;
  mode: FormMode;
  initialData: any;
  onClose: () => void;
  onDataChange: () => void;
  onModeChange: (mode: FormMode) => void;
}

const DynamicGroupForm: React.FC<DynamicGroupFormProps> = ({
  title,
  visible,
  mode,
  initialData,
  onClose,
  onDataChange,
  onModeChange,
}) => {
  const { currentBusiness } = useBusinessStore();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [groupObject, setGroupObject] = useState<BUILTIN_MODELS>(BUILTIN_MODELS.HOST);
  const [availableModels, setAvailableModels] = useState<readonly ObjectMainLine[]>([]);
  const [propertyMap, setPropertyMap] = useState<PropertyMap>({});
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);
  const [conditions, setConditions] = useState<Record<string, Condition>>({});
  const [errors, setErrors] = useState<Set<number>>(new Set());
  // Storage for conditions that are not yet applied
  const [storageConditions, setStorageConditions] = useState<Record<string, Condition>>({});
  // State for form section width
  const [basicInfoWidth, setBasicInfoWidth] = useState<number>(MIN_WIDTH);
  // State for confirm modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingGroupObject, setPendingGroupObject] = useState<BUILTIN_MODELS | null>(null);
  // State for leave confirm modal
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  // Preview result state
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const disabled = mode === FormMode.PREVIEW;

  const conditionTypes = [
    {
      key: ConditionType.VARIABLE,
      title: getConditionName(ConditionType.VARIABLE, t),
      desc: t('business.dynamicGroupForm.conditionTypes.variable.desc'),
    },
    {
      key: ConditionType.IMMUTABLE,
      title: getConditionName(ConditionType.IMMUTABLE, t),
      desc: t('business.dynamicGroupForm.conditionTypes.immutable.desc'),
    },
  ];

  useEffect(() => {
    getMainLineModels();
  }, []);

  useEffect(() => {
    if (availableModels.length) {
      getModelProperties();
    }
  }, [availableModels]);

  useEffect(() => {
    if (
      (mode === FormMode.EDIT || mode === FormMode.PREVIEW) &&
      initialData &&
      Object.keys(propertyMap).length > 0
    ) {
      initializeFormData(initialData);
    }
  }, [mode, initialData, propertyMap]);

  useEffect(() => {
    if (
      (mode === FormMode.EDIT || mode === FormMode.PREVIEW) &&
      Object.keys(conditions).length > 0
    ) {
      // Use setTimeout to avoid calling during render
      const timeoutId = setTimeout(() => {
        handlePreview();
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [conditions, mode]);

  const getMainLineModels = async () => {
    try {
      // TODO: api
      const models = await getAvailableModels();
      // eslint-disable-next-line max-len
      const availableModels = availableModelIds.map((modelId) => {
        return models.find((model) => model.bk_obj_id === modelId);
      });
      setAvailableModels(Object.freeze(availableModels) as readonly ObjectMainLine[]);
    } catch (error) {
      console.error(error);
    }
  };

  const getModelProperties = async () => {
    try {
      // TODO: api
      const propertyMap = await batchSearchObjectAttribute({
        params: {
          bk_biz_id: currentBusiness?.id,
          bk_obj_id: { $in: availableModels.map((model) => model.bk_obj_id) },
          // TODO: Get from windown supplier
          bk_supplier_account: '0',
        },
        config: {
          requestId: requestConfig.property,
          fromCache: true,
        },
      });
      propertyMap.module.unshift(createServiceTemplateProperty(t));
      setPropertyMap(Object.freeze(propertyMap));
    } catch (error) {
      console.error(error);
      setPropertyMap({});
    }
  };

  const initializeFormData = (data: any) => {
    form.setFieldsValue({
      groupName: data.name,
      groupObject: data.bk_obj_id,
    });
    setGroupObject(data.bk_obj_id);

    const newSelectedProperties: Property[] = [];
    const initialConditions: Record<string, Condition> = {};

    // Process immutable conditions
    const immutableResult = processConditionGroups(
      data.info?.condition || [],
      ConditionType.IMMUTABLE,
      propertyMap,
    );
    // Process variable conditions
    const variableResult = processConditionGroups(
      data.info?.variable_condition || [],
      ConditionType.VARIABLE,
      propertyMap,
    );

    // Combine results
    newSelectedProperties.push(
      ...immutableResult.selectedProperties,
      ...variableResult.selectedProperties,
    );
    Object.assign(
      initialConditions,
      immutableResult.storageConditions,
      variableResult.storageConditions,
    );

    setSelectedProperties(newSelectedProperties);
    setStorageConditions(initialConditions);
  };

  const handlePropertyChange = (newProperties: Property[]) => {
    setSelectedProperties(newProperties);
    // if (!newProperties.length) { setSelectedProperties([]); }

    // const { addSelect, deleteSelect } = getConditionSelect(newProperties, selectedProperties);
    // updatePropertySelect(selectedProperties, addSelect, deleteSelect, setSelectedProperties, 'unshift');
  };

  const handleRemoveProperty = (property: Property) => {
    const newSelectedProperties = selectedProperties.filter((p) => p.id !== property.id);
    setSelectedProperties(newSelectedProperties);

    // Remove the property from conditions and storageConditions
    const newConditions = { ...conditions };
    const newStorageConditions = { ...storageConditions };

    delete newConditions[property.id];
    delete newStorageConditions[property.id];

    setConditions(newConditions);
    setStorageConditions(newStorageConditions);
  };

  const handleToggleProperty = (property: Property, newConditionType: ConditionType) => {
    // Set the new condition type
    const updatedProperty = { ...property, conditionType: newConditionType };

    // Update selectedProperties - remove old and add updated
    setSelectedProperties((prev) => {
      const filtered = prev.filter((p) => p.id !== property.id);
      return [...filtered, updatedProperty];
    });

    // Update conditions to reflect the new condition type
    setConditions((prev) => {
      if (prev[property.id]) {
        return {
          ...prev,
          [property.id]: {
            ...prev[property.id],
            property: updatedProperty,
          },
        };
      }
      return prev;
    });

    // Update storageConditions to reflect the new condition type
    setStorageConditions((prev) => {
      if (prev[property.id]) {
        return {
          ...prev,
          [property.id]: {
            ...prev[property.id],
            property: updatedProperty,
          },
        };
      }
      return prev;
    });
  };

  const handleConditionChange = (newCondition: Record<string, Condition>) => {
    // Merge new conditions with existing conditions instead of replacing
    setConditions((prev) => ({
      ...prev,
      ...newCondition,
    }));
    setStorageConditions((prev) => ({
      ...prev,
      ...newCondition,
    }));
  };

  const handleErrors = (propertyId: number, hasError: boolean) => {
    setErrors((prev) => {
      const newErrors = new Set(prev);
      if (hasError) {
        newErrors.add(propertyId);
      } else {
        newErrors.delete(propertyId);
      }
      return newErrors;
    });
  };

  // Validate all conditions
  const validateAllConditions = (): boolean => {
    let isValid = true;
    const newErrors = new Set<number>();

    Object.values(conditions).forEach((condition) => {
      if (!isValidCondition(condition.value)) {
        newErrors.add(condition.property.id);
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async () => {
    try {
      // TODO: api
      setLoading(true);
      const values = await form.validateFields();

      // Validate all conditions
      if (!validateAllConditions()) {
        setLoading(false);
        return;
      }

      const { condition, variable_condition } = formatDynamicConditions(conditions);

      const _formData: DynamicGroupFormData = {
        name: values.groupName,
        bk_biz_id: currentBusiness?.id,
        bk_obj_id: values.groupObject,
        condition,
        variable_condition,
      };

      // Call service to get group data
      onDataChange();

      handleActualClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePreview = async () => {
    try {
      setLoading(true);

      // Validate all conditions
      if (!validateAllConditions()) {
        setLoading(false);
        return;
      }

      const { condition, variable_condition } = formatDynamicConditions(conditions);

      const _previewData = {
        bk_biz_id: currentBusiness?.id,
        condition,
        variable_condition,
      };
      // TODO: API
      setPreviewData(dynamicGroupPreviewResult);
      setLastUpdateTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (mode !== FormMode.PREVIEW && selectedProperties.length > 0) {
      setShowLeaveConfirmModal(true);
      return;
    }
    handleActualClose();
  };

  const handleActualClose = () => {
    onClose();
    handleClearConditions();
    form.resetFields();
    form.setFieldsValue({ groupObject: BUILTIN_MODELS.HOST });
  };

  const handleLeaveConfirmOk = () => {
    setShowLeaveConfirmModal(false);
    handleActualClose();
  };

  const handleLeaveConfirmCancel = () => {
    setShowLeaveConfirmModal(false);
  };

  const handleClearConditions = () => {
    setSelectedProperties([]);
    setConditions({});
    setStorageConditions({});
    setErrors(new Set());
    setPreviewData([]);
    setLastUpdateTime('');
  };

  const handleGroupObjectChange = (newValue: BUILTIN_MODELS) => {
    setGroupObject(newValue);
    form.setFieldsValue({ groupObject: newValue });
  };

  const handleShowConfirmModal = (id: BUILTIN_MODELS) => {
    setPendingGroupObject(id);
    setShowConfirmModal(true);
  };

  const handleConfirmOk = () => {
    if (pendingGroupObject) {
      handleClearConditions();
      setGroupObject(pendingGroupObject);
      form.setFieldsValue({ groupObject: pendingGroupObject });
    }
    setShowConfirmModal(false);
    setPendingGroupObject(null);
  };

  const handleConfirmCancel = () => {
    setShowConfirmModal(false);
    setPendingGroupObject(null);
  };

  return (
    <Drawer
      title={title}
      open={visible}
      onClose={handleClose}
      width={DRAWER_WIDTH}
      className="dynamic-group-drawer"
    >
      <div className="dynamic-group-content">
        <div className="form-section" style={{ width: basicInfoWidth }}>
          <div className="form-content">
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                groupName: '',
                groupObject,
              }}
            >
              <div className="section-title">
                {t('business.dynamicGroupForm.sections.basicInfo')}
              </div>
              <Form.Item
                label={t('business.dynamicGroupForm.form.groupName.label')}
                name="groupName"
                rules={[{ required: true, message: t('common.form.rulesMessage') }, { max: 256 }]}
              >
                <Input
                  placeholder={t('business.dynamicGroupForm.form.groupName.placeholder')}
                  disabled={disabled}
                />
              </Form.Item>

              <Form.Item
                label={t('business.dynamicGroupForm.form.groupObject.label')}
                name="groupObject"
                rules={[{ required: true }]}
              >
                <SearchTarget
                  value={groupObject}
                  showModal={selectedProperties.length > 0}
                  disabled={disabled}
                  onChange={handleGroupObjectChange}
                  onShowModal={handleShowConfirmModal}
                />
              </Form.Item>

              {conditionTypes.map((conditionType) => (
                <Collapse
                  ghost
                  key={conditionType.key}
                  defaultActiveKey={[conditionType.key]}
                  items={[
                    {
                      key: conditionType.key,
                      label: (
                        <Tooltip title={conditionType.desc} styles={{ root: { maxWidth: 'none' } }}>
                          <span className="condition-title">{conditionType.title}</span>
                        </Tooltip>
                      ),
                      extra: (
                        <ConditionPicker
                          propertyMap={propertyMap!}
                          models={availableModels}
                          selected={selectedProperties}
                          conditionType={conditionType.key}
                          disabled={disabled}
                          onPropertyChange={handlePropertyChange}
                        />
                      ),
                      children: (
                        <PropertyList
                          bizId={currentBusiness!.id}
                          conditionType={conditionType.key}
                          models={availableModels}
                          selectedProperties={selectedProperties}
                          conditions={conditions}
                          storageConditions={storageConditions}
                          errors={errors}
                          disabled={disabled}
                          onRemove={handleRemoveProperty}
                          onToggle={handleToggleProperty}
                          onConditionChange={handleConditionChange}
                          onUpdateErrors={handleErrors}
                        />
                      ),
                    },
                  ]}
                />
              ))}
            </Form>
          </div>

          <div className="form-actions">
            <Space>
              {mode === FormMode.PREVIEW ? (
                <Button type="primary" onClick={() => onModeChange(FormMode.EDIT)}>
                  {t('common.edit')}
                </Button>
              ) : (
                <>
                  <Button
                    type="primary"
                    onClick={handleSubmit}
                    loading={loading}
                    disabled={disabled || selectedProperties.length === 0}
                  >
                    {mode === FormMode.CREATE ? t('common.submit') : t('common.save')}
                  </Button>
                  <Button
                    onClick={handlePreview}
                    disabled={selectedProperties.length === 0}
                    color="primary"
                    variant="outlined"
                  >
                    {t('business.dynamicGroupForm.buttons.preview')}
                  </Button>
                  <Popconfirm
                    title={t('business.dynamicGroupForm.confirm.clearConditions')}
                    onConfirm={handleClearConditions}
                    okText={t('common.confirm')}
                    cancelText={t('common.cancel')}
                  >
                    <Button disabled={disabled || selectedProperties.length === 0}>
                      {t('business.dynamicGroupForm.buttons.clearConditions')}
                    </Button>
                  </Popconfirm>
                </>
              )}
              <Button onClick={handleClose}>{t('common.cancel')}</Button>
            </Space>
          </div>

          {/* The drag handle */}
          <DragHandle
            minWidth={MIN_WIDTH}
            maxWidth={MAX_WIDTH}
            currentWidth={basicInfoWidth}
            onWidthChange={setBasicInfoWidth}
          />
        </div>

        <div
          className="preview-section"
          style={{ width: DRAWER_WIDTH - basicInfoWidth - PADDING * 2 }}
        >
          <PreviewResult
            data={previewData}
            loading={loading}
            lastUpdateTime={lastUpdateTime}
            onRefresh={handlePreview}
          />
        </div>
      </div>

      {/* Toggle Confirm Modal */}
      <ConfirmModal
        visible={showConfirmModal}
        title={t('business.dynamicGroupForm.confirm.toggleConfirm')}
        description={t('business.dynamicGroupForm.confirm.toggleDescription')}
        onOk={handleConfirmOk}
        onCancel={handleConfirmCancel}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />

      {/* Leave Confirm Modal */}
      <ConfirmModal
        visible={showLeaveConfirmModal}
        title={t('business.dynamicGroupForm.confirm.leaveConfirm')}
        description={t('business.dynamicGroupForm.confirm.leaveDescription')}
        onOk={handleLeaveConfirmOk}
        onCancel={handleLeaveConfirmCancel}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />
    </Drawer>
  );
};

export default DynamicGroupForm;
