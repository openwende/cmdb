import React from 'react';
import { Radio } from 'antd';
import { RadioChangeEvent } from 'antd/es/radio';
import { useTranslation } from 'react-i18next';
import { BUILTIN_MODELS } from '../../constants';

interface TargetItem {
  id: BUILTIN_MODELS;
  name: string;
  desc: string;
}

interface SearchTargetProps {
  value?: BUILTIN_MODELS;
  disabled?: boolean;
  showModal?: boolean;
  onChange?: (value: BUILTIN_MODELS, oldValue?: BUILTIN_MODELS) => void;
  onShowModal?: (id: BUILTIN_MODELS) => void;
}

const SearchTarget: React.FC<SearchTargetProps> = ({
  value = BUILTIN_MODELS.HOST,
  disabled = false,
  showModal = false,
  onChange,
  onShowModal,
}) => {
  const { t } = useTranslation();

  const list: TargetItem[] = [
    {
      id: BUILTIN_MODELS.HOST,
      name: t('business.dynamicGroupForm.searchTarget.host.name'),
      desc: t('business.dynamicGroupForm.searchTarget.host.desc'),
    },
    {
      id: BUILTIN_MODELS.SET,
      name: t('business.dynamicGroupForm.searchTarget.object.name'),
      desc: t('business.dynamicGroupForm.searchTarget.object.desc'),
    },
  ];
  const handleChange = (e: RadioChangeEvent) => {
    const newValue = e.target.value as BUILTIN_MODELS;
    const oldValue = value;

    if (disabled) return;

    if (showModal) {
      const item = list.find((item) => item.id === newValue);
      if (item?.id) onShowModal?.(item.id);
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

export default SearchTarget;
