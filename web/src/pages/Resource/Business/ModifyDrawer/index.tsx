import React, { useState, useRef, useEffect } from "react";
import { Drawer, Form, Input, Select, Button, Collapse } from "antd";
import { userListMock } from '@/mock/resource';
import ConfirmModal from '@/components/common/ConfirmModal';
import {
    FormFieldItem,
    PersonnelSelectItem,
    FormFieldName,
    isCreateMode,
    isEditMode,
} from '../components/FormFields';
import "./style.css";

const { Panel } = Collapse;

const lifecycleOptions = ['测试中', '已上线', '停运'];
const languageOptions = ['中文', 'English'];

// Get IANA time zones
const defaultTimeZone = 'Asia/Shanghai';
const timeZoneOptions: string[] = (Intl as any).supportedValuesOf
    ? (Intl as any).supportedValuesOf('timeZone')
    : ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York'];

interface DrawerProps {
    visible: boolean;
    type: "create" | "edit";
    onClose: () => void;
}

const ModifyDrawer: React.FC<DrawerProps> = ({ visible, type, onClose }) => {
    const [lang, setLang] = useState<string>(languageOptions[0]);
    const [searchOptions, setSearchOptions] = useState<{ value: string, label: string }[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [form] = Form.useForm();
    const [showModal, setShowModal] = useState<boolean>(false);
    // Using in edit mode
    const [selectedFields, setSelectedFields] = useState<FormFieldName[]>([]);
    const [isFormChanged, setIsFormChanged] = useState<boolean>(false);

    // Utility function to determine if a field should be disabled
    const isFieldDisabled = (fieldName: FormFieldName): boolean => {
        return isEditMode(type) && !selectedFields.includes(fieldName);
    };

    // Limit the frequency of search requests
    const debounceSearch = (val: string) => {
        setSearchOptions([]);

        if (searchTimerRef.current) {
            clearTimeout(searchTimerRef.current);
        }

        setIsSearching(true);

        searchTimerRef.current = setTimeout(() => {
            setSearchOptions(buildUserOptions(val, lang));
            setIsSearching(false);
        }, 300);
    };

    const buildUserOptions = (keyword: string, lang: string) => {
        if (!keyword) return [];

        const isChineseLang = lang === languageOptions[0];

        return userListMock
            .filter(u => {
                const name = isChineseLang ? u.chinese_name : u.english_name;
                return name.toLowerCase().includes(keyword.toLowerCase());
            })
            .map(u => {
                const name = isChineseLang ? u.chinese_name : u.english_name;
                return { value: name, label: name };
            });
    };

    const handleSearch = (val: string) => {
        debounceSearch(val);
    }

    // Clear the timer when the component unmounts
    useEffect(() => {
        return () => {
            if (searchTimerRef.current) {
                clearTimeout(searchTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (visible) {
            setSelectedFields([]);
            setIsFormChanged(false);

            if (isCreateMode(type)) {
                form.setFieldsValue({
                    language: languageOptions[0],
                    lifecycle: lifecycleOptions[1],
                    timeZone: defaultTimeZone
                })
            }
        }
    }, [visible, type, form]);

    useEffect(() => {
        if (isEditMode(type)) {
            setIsFormChanged(selectedFields.length > 0);
        }
    }, [selectedFields, type]);

    const handleFieldChange = (field: FormFieldName, checked: boolean) => {
        if (checked) {
            setSelectedFields(prev => {
                const newSelectedFields = [...prev, field];
                if (isEditMode(type)) {
                    setIsFormChanged(newSelectedFields.length > 0);
                }
                return newSelectedFields;
            });
        } else {
            setSelectedFields(prev => {
                const newSelectedFields = prev.filter(item => item !== field);
                if (isEditMode(type)) {
                    setIsFormChanged(newSelectedFields.length > 0);
                }
                return newSelectedFields;
            });
        }
    };

    const handleFormValueChange = () => {
        if (!isEditMode(type)) return;
        const hasSelectedFields = selectedFields.length > 0;
        setIsFormChanged(hasSelectedFields);
    };

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields();
            console.log('Form submission data:', values);
            handleConfirmClose();
        } catch (errorInfo) {
            console.log('Form validation failed:', errorInfo);
        }
    };

    const handleClose = () => {
        if (isCreateMode(type)) {
            setShowModal(true);
        } else {
            handleReset();
            onClose();
        }
    };

    const handleReset = () => {
        form.resetFields();
        setSearchOptions([]);
        setSelectedFields([]);
    }

    const handleConfirmClose = () => {
        handleReset();
        setShowModal(false);
        onClose();
    };

    return (
        <Drawer
            title={isCreateMode(type) ? "创建业务" : "批量编辑业务"}
            width={800}
            onClose={handleClose}
            open={visible}
            maskClosable={false}
            className="modify-drawer"
        >
            <Form form={form} layout="vertical" onValuesChange={handleFormValueChange}>
                <Collapse defaultActiveKey={["base", "role"]} ghost>                    
                <Panel header="基础信息" key="base">
                        <div className="form-grid">
                            <FormFieldItem
                                fieldName="businessName"
                                label="业务名"
                                required={true}
                                type={type}
                                handleFieldChange={handleFieldChange}
                                selectedFields={selectedFields}
                            >                                <Input
                                    placeholder="请输入业务名"
                                    disabled={isFieldDisabled('businessName')}
                                    className="select-input"
                                />
                            </FormFieldItem>
                            <FormFieldItem
                                fieldName="lifecycle"
                                label="生命周期"
                                type={type}
                                handleFieldChange={handleFieldChange}
                                selectedFields={selectedFields}
                            >                                <Select
                                    placeholder="请选择生命周期"
                                    options={lifecycleOptions.map(v => ({ label: v, value: v }))}
                                    disabled={isFieldDisabled('lifecycle')}
                                    className="select-input"
                                />
                            </FormFieldItem>

                            {isCreateMode(type) && (
                                <FormFieldItem
                                    fieldName="timeZone"
                                    label="时区"
                                    required={true}
                                    type={type}
                                    handleFieldChange={handleFieldChange}
                                    selectedFields={selectedFields}
                                >
                                    <Select
                                        showSearch
                                        placeholder="请选择时区"
                                        filterOption={(input, option) => (option?.value as string).toLowerCase().includes(input.toLowerCase())}                                        options={timeZoneOptions.map(tz => ({ value: tz, label: tz }))}
                                        className="select-input"
                                    />
                                </FormFieldItem>)}
                            <FormFieldItem
                                fieldName="language"
                                label="语言"
                                required={true}
                                type={type}
                                handleFieldChange={handleFieldChange}
                                selectedFields={selectedFields}
                            >
                                <Select
                                    placeholder="请选择语言"
                                    onChange={setLang}                                    
                                    options={languageOptions.map(v => ({ label: v, value: v }))}
                                    disabled={isFieldDisabled('language')}
                                    className="select-input"
                                />
                            </FormFieldItem>
                        </div>
                    </Panel>                    
                    <Panel header="角色" key="role">
                        <div className="form-grid">
                            <PersonnelSelectItem
                                fieldName="operators"
                                label="运维人员"
                                required={true}
                                type={type}
                                isSearching={isSearching}
                                searchOptions={searchOptions}
                                handleSearch={handleSearch}
                                handleFieldChange={handleFieldChange}
                                isFieldDisabled={isFieldDisabled}
                                selectedFields={selectedFields}
                            />

                            <PersonnelSelectItem
                                fieldName="productManagers"
                                label="产品人员"
                                type={type}
                                isSearching={isSearching}
                                searchOptions={searchOptions}
                                handleSearch={handleSearch}
                                handleFieldChange={handleFieldChange}
                                isFieldDisabled={isFieldDisabled}
                                selectedFields={selectedFields}
                            />

                            <PersonnelSelectItem
                                fieldName="testers"
                                label="测试人员"
                                type={type}
                                isSearching={isSearching}
                                searchOptions={searchOptions}
                                handleSearch={handleSearch}
                                handleFieldChange={handleFieldChange}
                                isFieldDisabled={isFieldDisabled}
                                selectedFields={selectedFields}
                            />

                            <PersonnelSelectItem
                                fieldName="developers"
                                label="开发人员"
                                type={type}
                                isSearching={isSearching}
                                searchOptions={searchOptions}
                                handleSearch={handleSearch}
                                handleFieldChange={handleFieldChange}
                                isFieldDisabled={isFieldDisabled}
                                selectedFields={selectedFields}
                            />

                            <PersonnelSelectItem
                                fieldName="administrators"
                                label="操作人员"
                                type={type}
                                isSearching={isSearching}
                                searchOptions={searchOptions}
                                handleSearch={handleSearch}
                                handleFieldChange={handleFieldChange}
                                isFieldDisabled={isFieldDisabled}
                                selectedFields={selectedFields}
                            />
                        </div>
                    </Panel>
                </Collapse>
            </Form>            
            
            <div className="button-container">
                <Button
                    type="primary"
                    onClick={handleSubmit}
                    className="submit-button"
                    disabled={!isCreateMode(type) && !isFormChanged}
                >
                    提交
                </Button>
                <Button onClick={handleClose}>取消</Button>
            </div>

            <ConfirmModal
                visible={showModal}
                onOk={handleConfirmClose}
                onCancel={() => setShowModal(false)}
            />
        </Drawer>
    );
};

export default ModifyDrawer;
