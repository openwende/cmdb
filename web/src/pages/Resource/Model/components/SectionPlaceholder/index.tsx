import React from 'react';
import { Alert } from 'antd';

interface Props {
  message: string;
  description?: string;
}

const SectionPlaceholder: React.FC<Props> = ({ message, description }) => {
  return (
    <div className="model-page">
      <Alert type="info" showIcon message={message} description={description} />
    </div>
  );
};

export default SectionPlaceholder;
