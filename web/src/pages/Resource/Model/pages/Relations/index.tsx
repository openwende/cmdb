import React from 'react';
import { Result } from 'antd';

const ModelGlobalTopology: React.FC = () => {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Result
        status="info"
        title="全局关系拓扑即将上线"
        subTitle="全局模型关系拓扑图谱功能正在建设中，敬请期待。"
      />
    </div>
  );
};

export default ModelGlobalTopology;
