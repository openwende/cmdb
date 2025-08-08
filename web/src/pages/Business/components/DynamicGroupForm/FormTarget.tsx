import React from 'react';
import { Radio } from 'antd';
import { useTranslation } from 'react-i18next';
import { RadioChangeEvent } from 'antd/es/radio';
import { BUILTIN_MODELS } from '../../constants';

interface FormTargetProps {
  value?: BUILTIN_MODELS;
  disabled?: boolean;
  showCancelDialog?: boolean;
  onChange?: (value: BUILTIN_MODELS, oldValue?: BUILTIN_MODELS) => void;
  onCanShowDialog?: (item: any) => void;
}

interface TargetItem {
  id: string;
  name: string;
  desc: string;
}

const FormTarget: React.FC<FormTargetProps> = ({
  value = BUILTIN_MODELS.HOST,
  disabled = false,
  showCancelDialog = false,
  onChange,
  onCanShowDialog
}) => {
  const { t } = useTranslation();

  const list: TargetItem[] = [
    {
      id: BUILTIN_MODELS.HOST,
      name: t('主机'),
      desc: t('目标为主机列表')
    },
    {
      id: BUILTIN_MODELS.SET,
      name: t('集群'),
      desc: t('目标为集群列表')
    }
  ];

  const handleChange = (e: RadioChangeEvent) => {
    const newValue = e.target.value;
    const oldValue = value;

    if (disabled) return;

    if (showCancelDialog) {
      const item = list.find(item => item.id === newValue);
      onCanShowDialog?.(item);
      return;
    }

    onChange?.(newValue, oldValue);
  };

  return (
    <Radio.Group
      value={value}
      onChange={handleChange}
      disabled={disabled}
      className="form-target-radio-group"
    >
      {list.map((item) => (
        <Radio key={item.id} value={item.id}>
          <div className="radio-content">
            <div className="radio-title">{item.name}</div>
            <div className="radio-desc">{item.desc}</div>
          </div>
        </Radio>
      ))}
    </Radio.Group>
  );
};

export default FormTarget;
