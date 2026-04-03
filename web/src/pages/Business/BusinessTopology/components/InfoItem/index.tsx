import React, { useState } from 'react';
import { message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './style.css';

interface Props {
  label: string;
  value: string | number | null | undefined;
}

const InfoItem: React.FC<Props> = ({ label, value }) => {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const hasValue = value !== null && value !== undefined && String(value).trim() !== '';
  const displayValue = hasValue ? String(value) : t('common.notSet');

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success(t('resource.host.messages.copySuccess'));
    } catch {
      message.error(t('resource.host.messages.copyFailed'));
    }
  };

  return (
    <div className="info-item">
      <div className="info-label">{label}：</div>
      <div
        className="info-value-wrapper"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <span>{displayValue}</span>
        {isHovered && hasValue && (
          <CopyOutlined className="copy-icon" onClick={() => handleCopy(String(value))} />
        )}
      </div>
    </div>
  );
};

export default InfoItem;
