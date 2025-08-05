import React from 'react';
import { Radio, Space } from 'antd';
import { useTranslation } from 'react-i18next';

interface FormTargetProps {
  value?: string;
  disabled?: boolean;
  showCancelDialog?: boolean;
  onChange?: (value: string, oldValue?: string) => void;
  onCanShowDialog?: (item: any) => void;
}

interface TargetItem {
  bk_obj_id: string;
  bk_obj_name: string;
  desc: string;
}

const FormTarget: React.FC<FormTargetProps> = ({
  value = '',
  disabled = false,
  showCancelDialog = false,
  onChange,
  onCanShowDialog
}) => {
  const { t } = useTranslation();

  const list: TargetItem[] = [
    {
      bk_obj_id: 'host',
      bk_obj_name: t('主机'),
      desc: t('目标为主机列表')
    },
    {
      bk_obj_id: 'set',
      bk_obj_name: t('集群'),
      desc: t('目标为集群列表')
    }
  ];

  const handleChange = (e: any) => {
    const newValue = e.target.value;
    const oldValue = value;

    if (disabled) return;

    if (showCancelDialog) {
      const item = list.find(item => item.bk_obj_id === newValue);
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
        <Radio key={item.bk_obj_id} value={item.bk_obj_id}>
          <div className="radio-content">
            <div className="radio-title">{item.bk_obj_name}</div>
            <div className="radio-desc">{item.desc}</div>
          </div>
        </Radio>
      ))}
    </Radio.Group>
  );
};

export default FormTarget;
