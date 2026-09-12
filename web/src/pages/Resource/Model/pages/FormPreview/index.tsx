import React from 'react';
import { Alert, Form, Input, InputNumber, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { useModelPageContext } from '../../context';
import { normalizeAttributeOptions } from '../../shared';

const FormPreviewPage: React.FC = () => {
  const { t } = useTranslation();
  const { attributes } = useModelPageContext();

  return (
    <div className="model-page">
      <Alert
        type="info"
        showIcon
        message={t('resource.model.tabs.preview')}
        description={t('resource.model.helper.previewNotice')}
      />

      <Form layout="vertical">
        {attributes.map((attribute) => {
          const options = normalizeAttributeOptions(attribute.options);

          if (attribute.field_type === 'bool') {
            return (
              <Form.Item
                key={attribute.id}
                label={attribute.display_name}
                extra={options.help_text}
              >
                <Switch disabled />
              </Form.Item>
            );
          }

          if (attribute.field_type === 'int') {
            return (
              <Form.Item
                key={attribute.id}
                label={attribute.display_name}
                extra={options.help_text}
              >
                <InputNumber style={{ width: '100%' }} placeholder={options.placeholder} disabled />
              </Form.Item>
            );
          }

          if (attribute.field_type === 'enum') {
            return (
              <Form.Item
                key={attribute.id}
                label={attribute.display_name}
                extra={options.help_text}
              >
                <Select
                  disabled
                  placeholder={options.placeholder}
                  options={(options.enum_values || []).map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
              </Form.Item>
            );
          }

          return (
            <Form.Item key={attribute.id} label={attribute.display_name} extra={options.help_text}>
              <Input placeholder={options.placeholder} disabled />
            </Form.Item>
          );
        })}
      </Form>
    </div>
  );
};

export default FormPreviewPage;
