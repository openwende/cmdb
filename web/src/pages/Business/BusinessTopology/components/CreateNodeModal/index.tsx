import React, { useMemo, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Modal, Radio, Select, Input, Form, Button, Tooltip } from "antd";
import { PlusOutlined, InfoCircleOutlined } from "@ant-design/icons";
import { setTemplate, serviceTemplate } from "@/mock/business";
import { CreateMode, TopoTreeNodeType, TreeData } from "@/pages/Business/Types";
import ServiceCategorySelector from "../ServiceCategory";
import "./style.css";

const { Option } = Select;

interface CreateModalProps {
    visible: boolean;
    type: TopoTreeNodeType;
    selectedNode: TreeData | null;
    parentNodes: TreeData[];
    onClose: () => void;
}

const CreateModal: React.FC<CreateModalProps> = ({ visible, type, selectedNode, parentNodes, onClose }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [mode, setMode] = useState<CreateMode>(CreateMode.Template);
    const [serviceCategory, setServiceCategory] = useState<number[]>([]);
    const formItemRules = [{
        required: true,
        message: t("common.form.rulesMessage")
    }];

    const onOk = async () => {
        try {
            const values = await form.validateFields();
            if (
                type === TopoTreeNodeType.Module
                && mode === CreateMode.Direct
                && serviceCategory.length === 0
            ) {
                return;
            }
            console.log(values, serviceCategory);
        } catch (err) {
            console.log(err);
        }

        // TODO: api
        /**
         * 新建集群payload
         * 直接新建
         * {
            "sets": [
                {
                    "set_template_id": 0,
                    "bk_set_name": "set1",
                    "bk_biz_id": 4,
                    "bk_parent_id": 4
                }
            ]
        }
        * 
        */
        /**
         * 新建模块payload
         * 直接新建
         * {
            "bk_module_name": "module1",
            "service_category_id": 2,
            "service_template_id": 0,
            "bk_biz_id": 4,
            "bk_parent_id": 7
        }
         * 
        */
    }

    const onCancel = () => {
        reset();
        onClose();
    }

    const reset = () => {
        form.resetFields();
        setMode(CreateMode.Template);
        setServiceCategory([]);
    }

    const handleCreateSet = () => {
        return <>
            {mode === CreateMode.Template && (
                // Set template
                <Form.Item
                    label={t("business.topology.tree.create.form.label1")}
                    name="setTemplate"
                    rules={formItemRules}
                >
                    <Select
                        placeholder={t("business.topology.tree.create.form.placeholder1")}
                        notFoundContent={t("business.topology.tree.create.form.noContent")}
                        popupRender={menu => (
                            <>
                                {menu}
                                <div style={{ textAlign: "center" }}>
                                    <Button type="link" icon={<PlusOutlined />} style={{ padding: 0 }}>
                                        {t("business.topology.tree.create.form.createSetTemplate")}
                                    </Button>
                                </div>
                            </>
                        )}
                    >
                        {setTemplate.map(t => (
                            <Option key={t.set_template.id} value={t.set_template.id}>
                                {t.set_template.name}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            )}
            {/* Set name */}
            <Form.Item
                label={t("business.topology.tree.create.form.label2")}
                name="setName"
                rules={formItemRules}
            >
                <Input placeholder={t("business.topology.tree.create.form.placeholder2")} />
            </Form.Item>
        </>
    }

    const handleCreateModule = () => {
        return <>
            {mode === CreateMode.Template && (
                // Service template
                <Form.Item
                    label={t("business.topology.tree.create.form.label3")}
                    name="serviceTemplate"
                    rules={formItemRules}
                >
                    <Select
                        placeholder={t("business.topology.tree.create.form.placeholder3")}
                        onChange={v => {
                            const selectedName = serviceTemplate.find(t => t.id === v)?.name;
                            form.setFieldsValue({ moduleName: selectedName });
                        }}
                        popupRender={menu => (
                            <>
                                {menu}
                                <div style={{ textAlign: "center" }}>
                                    <Button type="link" icon={<PlusOutlined />} style={{ padding: 0 }}>
                                        {t("business.topology.tree.create.form.createServiceTemplate")}
                                    </Button>
                                </div>
                            </>
                        )}
                        notFoundContent={t("business.topology.tree.create.form.noContent")}
                    >
                        {serviceTemplate.map(t => (
                            <Option key={t.id} value={t.id}>
                                {t.name}
                            </Option>
                        ))}
                    </Select>
                </Form.Item>
            )}
            {/* Module name */}
            <Form.Item
                label={
                    <span>
                        {t("business.topology.tree.create.form.label4")}
                        {
                            mode === CreateMode.Template
                                ? <Tooltip title={t("business.topology.tree.create.form.tooltip4")}>
                                    <InfoCircleOutlined style={{ marginLeft: 4 }} />
                                </Tooltip> : null
                        }
                    </span>
                }
                name="moduleName"
                rules={formItemRules}
            >
                <Input
                    placeholder={t("business.topology.tree.create.form.placeholder4")}
                    disabled={mode === CreateMode.Template}
                />
            </Form.Item>
            {mode === CreateMode.Direct && (
                // Service category
                <Form.Item
                    label={t("business.topology.tree.create.form.label5")}
                    required={true}
                    rules={formItemRules}
                >
                    <ServiceCategorySelector
                        value={serviceCategory}
                        onChange={(value) => setServiceCategory(value)}
                        style={{ width: "100%" }}
                    />
                </Form.Item>
            )}
        </>
    }

    const topoPath = useMemo(() => {
        return parentNodes.length > 0
            ? parentNodes.map(p => p.title).join(' / ') + ' / ' + selectedNode?.title
            : selectedNode?.title;
    }, [parentNodes, selectedNode])

    return (
        <Modal
            open={visible}
            title={
                type === TopoTreeNodeType.Set
                    ? t("business.topology.tree.create.setTitle")
                    : t("business.topology.tree.create.moduleTitle")
            }
            okText={t("common.confirm")}
            cancelText={t("common.cancel")}
            width={580}
            onOk={onOk}
            onCancel={onCancel}
            maskClosable={false}
            className="create-modal"
        >
            <div className="selected-tip">
                {/* TODO: When selected module, where should show the bizName together */}
                {t("business.topology.tree.create.selected")}: {topoPath}
            </div>
            <Form form={form} layout="vertical">
                {/* Create mode, like template mode and direct mode */}
                <Form.Item>
                    <Radio.Group
                        value={mode}
                        onChange={e => {
                            form.resetFields();
                            setMode(e.target.value);
                        }}
                    >
                        <Radio value={CreateMode.Template}>
                            {t("business.topology.tree.create.templateMode")}
                        </Radio>
                        <Radio value={CreateMode.Direct}>
                            {t("business.topology.tree.create.directMode")}
                        </Radio>
                    </Radio.Group>
                </Form.Item>
                {type === TopoTreeNodeType.Set && handleCreateSet()}
                {type === TopoTreeNodeType.Module && handleCreateModule()}
            </Form>
        </Modal>
    );
};

export default CreateModal;

