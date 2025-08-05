import React from 'react';
import { Card, Typography } from 'antd';

const { Title } = Typography;

interface PreviewResultProps {
  condition: any;
  mode: string;
  properties: any[];
}

const PreviewResult: React.FC<PreviewResultProps> = ({
  condition,
  mode,
  properties
}) => {
  return (
    <div className="preview-result">
      <Card>
        <Title level={4}>预览结果</Title>
        <div>
          <p>查询对象: {mode}</p>
          <p>条件数量: {Object.keys(condition).length}</p>
          <p>属性数量: {properties?.length || 0}</p>
        </div>
      </Card>
    </div>
  );
};

export default PreviewResult;
