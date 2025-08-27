import { useState, useEffect } from 'react';
import { Drawer, Form, Input, Button, Space, Collapse, Tooltip, Popconfirm } from 'antd';
import { DynamicGroupFormData, ObjectMainLine, PropertyMap, Property, ConditionType, ConditionName, Condition } from '../../Types';
import { availableModelIds, requestConfig, BUILTIN_MODELS } from '../../constants';
import { createServiceTemplateProperty, formatDynamicConditions, isValidCondition, processConditionGroups } from '../../utils';
import FormTarget from './FormTarget';
import ConditionPicker from './ConditionPicker';
import FormPropertyList from './FormPropertyList';
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

export const conditionTypes = [
    {
        key: ConditionType.VARIABLE,
        title: ConditionName.VARIABLE,
        desc: '在使用动态分组时，操作符和条件值可修改'
    },
    {
        key: ConditionType.IMMUTABLE,
        title: ConditionName.IMMUTABLE,
        desc: '在使用动态分组时，条件及条件值均不可修改'
    }
];
const exchangeType = {
    [ConditionType.VARIABLE]: ConditionType.IMMUTABLE,
    [ConditionType.IMMUTABLE]: ConditionType.VARIABLE
}

export enum FormMode {
    CREATE = 'create',
    EDIT = 'edit',
    PREVIEW = 'preview'
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
    onModeChange
}) => {
    const { currentBusiness } = useBusinessStore();
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

    useEffect(() => {
        getMainLineModels();
    }, [])

    useEffect(() => {
        if (availableModels.length) {
            getModelProperties();
        }
    }, [availableModels]);

    useEffect(() => {
        if (
            (mode === FormMode.EDIT || mode === FormMode.PREVIEW)
            && initialData && Object.keys(propertyMap).length > 0
        ) {
            initializeFormData(initialData);
        }
    }, [mode, initialData, propertyMap]);

    useEffect(() => {
        if (
            (mode === FormMode.EDIT || mode === FormMode.PREVIEW)
            && Object.keys(conditions).length > 0
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
            const availableModels = availableModelIds.map(modelId => {
                return models.find(model => model.bk_obj_id === modelId);
            });
            setAvailableModels(Object.freeze(availableModels) as readonly ObjectMainLine[]);
        } catch (error) {
            console.error(error);
        }
    }

    const getModelProperties = async () => {
        try {
            // TODO: api
            const propertyMap = await batchSearchObjectAttribute({
                params: {
                    bk_biz_id: currentBusiness?.id,
                    bk_obj_id: { $in: availableModels.map(model => model.bk_obj_id) },
                    // TODO: Get from windown supplier
                    bk_supplier_account: '0'
                },
                config: {
                    requestId: requestConfig.property,
                    fromCache: true
                }
            })
            propertyMap.module.unshift(createServiceTemplateProperty());
            setPropertyMap(Object.freeze(propertyMap));
        } catch (error) {
            console.error(error)
            setPropertyMap({});
        }
    }

    const initializeFormData = (data: any) => {
        form.setFieldsValue({
            groupName: data.name,
            groupObject: data.bk_obj_id
        });
        setGroupObject(data.bk_obj_id);

        const newSelectedProperties: Property[] = [];
        const initialStorageConditions: Record<string, Condition> = {};

        // Process immutable conditions
        const immutableResult = processConditionGroups(
            data.info?.condition || [],
            ConditionType.IMMUTABLE,
            propertyMap
        );
        // Process variable conditions
        const variableResult = processConditionGroups(
            data.info?.variable_condition || [],
            ConditionType.VARIABLE,
            propertyMap
        );

        // Combine results
        newSelectedProperties.push(
            ...immutableResult.selectedProperties,
            ...variableResult.selectedProperties
        );
        Object.assign(
            initialStorageConditions,
            immutableResult.storageConditions,
            variableResult.storageConditions
        );

        setSelectedProperties(newSelectedProperties);
        setStorageConditions(initialStorageConditions);
    };

    const handlePropertyChange = (newProperties: Property[]) => {
        setSelectedProperties(newProperties);
        // if (!newProperties.length) { setSelectedProperties([]); }

        // const { addSelect, deleteSelect } = getConditionSelect(newProperties, selectedProperties);
        // updatePropertySelect(selectedProperties, addSelect, deleteSelect, setSelectedProperties, 'unshift');
    }

    const handleRemoveProperty = (property: Property) => {
        const newSelectedProperties = selectedProperties.filter(p => p.id !== property.id);
        setSelectedProperties(newSelectedProperties);
    }

    const handleToggleProperty = (property: Property, conditionType: ConditionType) => {
        // Remove the property from selectedProperties
        handleRemoveProperty(property);

        // Set the new condition type
        const newConditionType = exchangeType[conditionType];
        // Create a new property object with the new condition type
        const updatedProperty = { ...property, conditionType: newConditionType };

        // Update the propertyMap with the new condition type
        setPropertyMap(prevPropertyMap => {
            const newPropertyMap = { ...prevPropertyMap };
            const modelProperties = newPropertyMap[property.bk_obj_id];

            if (modelProperties) {
                const targetIdx = modelProperties.findIndex(
                    p => p.bk_property_id === property.bk_property_id
                );
                if (targetIdx > -1) {
                    newPropertyMap[property.bk_obj_id] = [...modelProperties];
                    newPropertyMap[property.bk_obj_id][targetIdx] = {
                        ...modelProperties[targetIdx],
                        conditionType: newConditionType
                    };
                }
            }
            return newPropertyMap;
        });

        // Add the updated property to selectedProperties
        setSelectedProperties(prev => [...prev, updatedProperty]);
    };

    const handleConditionChange = (newCondition: Record<string, Condition>) => {
        setConditions(newCondition);
        setStorageConditions(newCondition);
    };

    const handleErrors = (propertyId: number, hasError: boolean) => {
        setErrors(prev => {
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

        Object.values(conditions).forEach(condition => {
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

            const {
                condition,
                variable_condition
            } = formatDynamicConditions(conditions);

            const formData: DynamicGroupFormData = {
                name: values.groupName,
                bk_biz_id: currentBusiness?.id,
                bk_obj_id: values.groupObject,
                condition,
                variable_condition
            };
            console.log('提交数据:', formData);

            // Call service to get group data
            onDataChange();

            handleClose();
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

            const {
                condition,
                variable_condition
            } = formatDynamicConditions(conditions);

            const previewData = {
                bk_biz_id: currentBusiness?.id,
                condition,
                variable_condition
            };
            console.log('预览数据:', previewData);
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
                                groupObject
                            }}
                        >
                            <div className="section-title">基础信息</div>
                            <Form.Item
                                label="分组名称"
                                name="groupName"
                                rules={[
                                    { required: true, message: '该字段是必填项' },
                                    { max: 256 }
                                ]}
                            >
                                <Input placeholder="请输入分组名称" disabled={disabled} />
                            </Form.Item>

                            <Form.Item
                                label="查询对象"
                                name="groupObject"
                                rules={[{ required: true }]}
                            >
                                <FormTarget
                                    value={groupObject}
                                    showModal={selectedProperties.length > 0}
                                    disabled={disabled}
                                    onChange={handleGroupObjectChange}
                                    onShowModal={handleShowConfirmModal}
                                />
                            </Form.Item>

                            {conditionTypes.map(conditionType => (
                                <Collapse
                                    ghost
                                    key={conditionType.key}
                                    defaultActiveKey={[conditionType.key]}
                                    items={[{
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
                                            <FormPropertyList
                                                bizId={currentBusiness?.id!}
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
                                        )
                                    }]}
                                />
                            ))}
                        </Form>
                    </div>

                    <div className="form-actions">
                        <Space>
                            {mode === FormMode.PREVIEW ? (
                                <Button
                                    type="primary"
                                    onClick={() => onModeChange(FormMode.EDIT)}
                                >
                                    编辑
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="primary"
                                        onClick={handleSubmit}
                                        loading={loading}
                                        disabled={disabled || selectedProperties.length === 0}
                                    >
                                        {mode === FormMode.CREATE ? "提交" : "保存"}
                                    </Button>
                                    <Button
                                        onClick={handlePreview}
                                        disabled={selectedProperties.length === 0}
                                        color="primary"
                                        variant="outlined"
                                    >
                                        预览
                                    </Button>
                                    <Popconfirm
                                        title="确认清空当前的分组条件？"
                                        onConfirm={handleClearConditions}
                                        okText="确认"
                                        cancelText="取消"
                                    >
                                        <Button disabled={disabled || selectedProperties.length === 0}>
                                            清空条件
                                        </Button>
                                    </Popconfirm>
                                </>
                            )}
                            <Button onClick={handleClose}>
                                取消
                            </Button>
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
                title="确认切换？"
                description="填写内容会清空，确认切换？"
                onOk={handleConfirmOk}
                onCancel={handleConfirmCancel}
            />

            {/* Leave Confirm Modal */}
            <ConfirmModal
                visible={showLeaveConfirmModal}
                title="确认离开当前页？"
                description="离开将会导致未保存信息丢失"
                onOk={handleLeaveConfirmOk}
                onCancel={handleLeaveConfirmCancel}
            />
        </Drawer>
    );
};

export default DynamicGroupForm;
