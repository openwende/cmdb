import React from 'react';
import { Form, Select, Spin, Checkbox } from 'antd';
import { useTranslation } from 'react-i18next';
import "./style.css";

// Define form field types
export type FormFieldName = 'businessName' | 'lifecycle' | 'timezone' | 'language' | 'maintainers' |
    'productManagers' | 'testers' | 'developers' | 'administrators';

// Form validation rule constants
export const createRequiredRule = (t: (key: string) => string) => [{ required: true, message: t('common.form.rules_message') }];

// Utility functions for determining drawer type
export const isCreateMode = (type: "create" | "edit"): boolean => type === "create";
export const isEditMode = (type: "create" | "edit"): boolean => type === "edit";

// Common form field component
export interface FormFieldItemProps {
    fieldName: FormFieldName;
    label: string;
    required?: boolean;
    type: "create" | "edit";
    children: React.ReactNode;
    initialValue?: any;
    handleFieldChange: (field: FormFieldName, checked: boolean) => void;
    selectedFields?: FormFieldName[];
}

export const FormFieldItem: React.FC<FormFieldItemProps> = ({
    fieldName,
    label,
    required = false,
    type,
    children,
    initialValue,
    handleFieldChange,
    selectedFields = [],
}) => {
    const { t } = useTranslation();
    
    return (
        <div className="form-field-item">
            <div className="item-header" style={{ marginBottom: 8 }}>
                {isEditMode(type) && (
                    <Checkbox
                        checked={selectedFields.includes(fieldName)}
                        onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
                        className="checkbox"
                    />
                )}
                {label}
            </div>
            <Form.Item
                name={fieldName}
                rules={required && isCreateMode(type) ? createRequiredRule(t) : []}
                initialValue={initialValue}
            >
                {children}
            </Form.Item>
        </div>
    );
};

// Personnel selection form field component
export interface PersonnelSelectItemProps {
    fieldName: FormFieldName;
    label: string;
    required?: boolean;
    type: "create" | "edit";
    isSearching: boolean;
    searchOptions: { value: string, label: string }[];
    handleSearch: (val: string) => void;
    handleFieldChange: (field: FormFieldName, checked: boolean) => void;
    isFieldDisabled: (fieldName: FormFieldName) => boolean;
    selectedFields?: FormFieldName[];
}

export const PersonnelSelectItem: React.FC<PersonnelSelectItemProps> = ({
    fieldName,
    label,
    required = false,
    type,
    isSearching,
    searchOptions,
    handleSearch,
    handleFieldChange,
    isFieldDisabled,
    selectedFields = []
}) => {
    const { t } = useTranslation();
    
    return (
        <FormFieldItem
            fieldName={fieldName}
            label={label}
            required={required}
            type={type}
            handleFieldChange={handleFieldChange}
            selectedFields={selectedFields}
        >
            <Select
                mode="multiple"
                placeholder={`${t('common.pleaseEnter')}${label}`}
                showSearch
                filterOption={false}
                onSearch={handleSearch}
                options={searchOptions}
                notFoundContent={isSearching ? <Spin size="small" /> : t('common.noMatch')}
                disabled={isFieldDisabled(fieldName)}
                className="select-input"
            />
        </FormFieldItem>
    );
};