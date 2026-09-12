import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Drawer, Form, Input, Select, Button, Collapse } from 'antd';
import { useAppMessage } from '@/utils/message';
import { useTranslation } from 'react-i18next';
import { userListMock } from '@/mock/resource';
import ConfirmModal from '@/components/common/ConfirmModal';
import { createBusiness } from '@/api';
import { LIFECYCLE_OPTIONS, LANGUAGE_OPTIONS } from '@/pages/Resource/constants';
import { CreateBusinessRequest } from '@/api/types/resource';
import { useResponsive } from '@/utils/useResponsive';
import { useBusinessStore } from '@/store/BusinessStore';
import {
  FormFieldItem,
  PersonnelSelectItem,
  FormFieldName,
  isCreateMode,
  isEditMode,
} from '../FormFields';
import './style.css';

const defaultTimeZone = 'Asia/Shanghai';
export const timezoneOptions: string[] = (Intl as any).supportedValuesOf
  ? (Intl as any).supportedValuesOf('timeZone')
  : ['UTC', 'Asia/Shanghai', 'Asia/Tokyo', 'America/New_York'];

interface DrawerProps {
  visible: boolean;
  type: 'create' | 'edit';
  onClose: () => void;
  onSuccess: () => void;
}

const ModifyDrawer: React.FC<DrawerProps> = ({ visible, type, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const message = useAppMessage();
  const refreshBusinessData = useBusinessStore((state) => state.loadBusinessData);
  const [lang, setLang] = useState<string>('chinese');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string }[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [form] = Form.useForm();
  const [showModal, setShowModal] = useState<boolean>(false);
  // Using in edit mode
  const [selectedFields, setSelectedFields] = useState<FormFieldName[]>([]);
  const [isFormChanged, setIsFormChanged] = useState<boolean>(false);

  // Lifecycle and language options with i18n (memoized to prevent useEffect loop)
  const lifecycleOptions = useMemo(
    () =>
      LIFECYCLE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );
  const languageOptions = useMemo(
    () =>
      LANGUAGE_OPTIONS.map((option) => ({
        ...option,
        label: t(option.label),
      })),
    [t],
  );

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
    const isChineseLang = lang === languageOptions[0].value;

    const filtered = keyword
      ? userListMock.filter((u) => {
          const name = isChineseLang ? u.chinese_name : u.english_name;
          return name.toLowerCase().includes(keyword.toLowerCase());
        })
      : userListMock;

    return filtered.map((u) => {
      const name = isChineseLang ? u.chinese_name : u.english_name;
      return { value: name, label: name };
    });
  };

  // 下拉框打开时展示全量用户
  const handleDropdownOpen = (open: boolean) => {
    if (open) {
      setSearchOptions(buildUserOptions('', lang));
    }
  };

  const handleSearch = (val: string) => {
    debounceSearch(val);
  };

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
          language: languageOptions[0].value,
          lifecycle: lifecycleOptions[1].value,
          timezone: defaultTimeZone,
        });
        setLang(languageOptions[0].value);
      }
    }
  }, [visible, type, form, languageOptions, lifecycleOptions]);

  useEffect(() => {
    if (isEditMode(type)) {
      setIsFormChanged(selectedFields.length > 0);
    }
  }, [selectedFields, type]);

  const handleFieldChange = (field: FormFieldName, checked: boolean) => {
    if (checked) {
      setSelectedFields((prev) => {
        const newSelectedFields = [...prev, field];
        if (isEditMode(type)) {
          setIsFormChanged(newSelectedFields.length > 0);
        }
        return newSelectedFields;
      });
    } else {
      setSelectedFields((prev) => {
        const newSelectedFields = prev.filter((item) => item !== field);
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

      // 构造符合后端契约的 payload
      const payload: CreateBusinessRequest = {
        name: values.name,
        description: values.description,
        identifier: values.identifier,
        lifecycle: values.lifecycle,
        timezone: values.timezone,
        language: values.language,
        // 业务角色
        sres: values.sres || [],
        developers: values.developers || [],
        testers: values.testers || [],
        bizops: values.bizops || [],
      };

      const data = await createBusiness(payload);
      if (data.success) {
        await refreshBusinessData(true);
        message.success(t('common.message.createSuccess'));
      } else {
        message.error(t('common.message.createFailed'));
      }
      onSuccess();
      handleConfirmClose();
    } catch (error) {
      console.log(error);
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
  };

  const handleConfirmClose = () => {
    handleReset();
    setShowModal(false);
    onClose();
  };

  return (
    <Drawer
      title={
        isCreateMode(type)
          ? t('resource.business.modify.title.create')
          : t('resource.business.modify.title.edit')
      }
      width={isMobile ? '100%' : 800}
      onClose={handleClose}
      open={visible}
      maskClosable={false}
      className="modify-drawer"
    >
      <Form form={form} layout="vertical" onValuesChange={handleFormValueChange}>
        <Collapse
          defaultActiveKey={['base', 'role']}
          ghost
          items={[
            {
              key: 'base',
              label: t('resource.business.modify.sections.basic'),
              children: (
                <div className="form-grid">
                  {isCreateMode(type) && (
                    <FormFieldItem
                      fieldName="name"
                      label={t('resource.business.modify.fields.name')}
                      required={true}
                      type={type}
                      handleFieldChange={handleFieldChange}
                      selectedFields={selectedFields}
                    >
                      <Input
                        placeholder={t('resource.business.modify.placeholders.name')}
                        disabled={isFieldDisabled('name')}
                        className="select-input"
                        maxLength={100}
                        showCount
                      />
                    </FormFieldItem>
                  )}
                  <FormFieldItem
                    fieldName="lifecycle"
                    label={t('resource.business.modify.fields.lifecycle')}
                    type={type}
                    handleFieldChange={handleFieldChange}
                    selectedFields={selectedFields}
                  >
                    <Select
                      placeholder={t('resource.business.modify.placeholders.lifecycle')}
                      options={lifecycleOptions}
                      disabled={isFieldDisabled('lifecycle')}
                      className="select-input"
                    />
                  </FormFieldItem>

                  {isCreateMode(type) && (
                    <FormFieldItem
                      fieldName="timezone"
                      label={t('resource.business.modify.fields.timezone')}
                      required={true}
                      type={type}
                      handleFieldChange={handleFieldChange}
                      selectedFields={selectedFields}
                    >
                      <Select
                        showSearch
                        placeholder={t('resource.business.modify.placeholders.timezone')}
                        filterOption={(input, option) =>
                          (option?.value as string).toLowerCase().includes(input.toLowerCase())
                        }
                        options={timezoneOptions.map((tz) => ({ value: tz, label: tz }))}
                        className="select-input"
                      />
                    </FormFieldItem>
                  )}
                  <FormFieldItem
                    fieldName="language"
                    label={t('resource.business.modify.fields.language')}
                    required={true}
                    type={type}
                    handleFieldChange={handleFieldChange}
                    selectedFields={selectedFields}
                  >
                    <Select
                      placeholder={t('resource.business.modify.placeholders.language')}
                      onChange={setLang}
                      options={languageOptions}
                      disabled={isFieldDisabled('language')}
                      className="select-input"
                    />
                  </FormFieldItem>
                </div>
              ),
            },
            {
              key: 'role',
              label: t('resource.business.modify.sections.roles'),
              children: (
                <div className="form-grid">
                  <PersonnelSelectItem
                    fieldName="sres"
                    label={t('resource.business.modify.fields.sres')}
                    required={true}
                    type={type}
                    isSearching={isSearching}
                    searchOptions={searchOptions}
                    handleSearch={handleSearch}
                    handleFieldChange={handleFieldChange}
                    isFieldDisabled={isFieldDisabled}
                    selectedFields={selectedFields}
                    onOpenChange={handleDropdownOpen}
                  />

                  <PersonnelSelectItem
                    fieldName="bizops"
                    label={t('resource.business.modify.fields.bizops')}
                    type={type}
                    isSearching={isSearching}
                    searchOptions={searchOptions}
                    handleSearch={handleSearch}
                    handleFieldChange={handleFieldChange}
                    isFieldDisabled={isFieldDisabled}
                    selectedFields={selectedFields}
                    onOpenChange={handleDropdownOpen}
                  />

                  <PersonnelSelectItem
                    fieldName="testers"
                    label={t('resource.business.modify.fields.testers')}
                    type={type}
                    isSearching={isSearching}
                    searchOptions={searchOptions}
                    handleSearch={handleSearch}
                    handleFieldChange={handleFieldChange}
                    isFieldDisabled={isFieldDisabled}
                    selectedFields={selectedFields}
                    onOpenChange={handleDropdownOpen}
                  />

                  <PersonnelSelectItem
                    fieldName="developers"
                    label={t('resource.business.modify.fields.developers')}
                    type={type}
                    isSearching={isSearching}
                    searchOptions={searchOptions}
                    handleSearch={handleSearch}
                    handleFieldChange={handleFieldChange}
                    isFieldDisabled={isFieldDisabled}
                    selectedFields={selectedFields}
                    onOpenChange={handleDropdownOpen}
                  />
                </div>
              ),
            },
          ]}
        />
      </Form>

      <div className="button-container">
        <Button
          type="primary"
          onClick={handleSubmit}
          className="submit-button"
          disabled={!isCreateMode(type) && !isFormChanged}
        >
          {t('common.submit')}
        </Button>
        <Button onClick={handleClose}>{t('common.cancel')}</Button>
      </div>

      <ConfirmModal
        visible={showModal}
        onOk={handleConfirmClose}
        onCancel={() => setShowModal(false)}
        title={t('common.confirmLeave')}
        description={t('common.unsavedChanges')}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />
    </Drawer>
  );
};

export default ModifyDrawer;
