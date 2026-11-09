import React, { useState, useEffect, Suspense } from 'react';
import { Spin } from 'antd';
import { getFormComponent } from './index';

interface DynamicComponentProps {
  componentType: string;
  [key: string]: any;
}

const DynamicComponent: React.FC<DynamicComponentProps> = ({ componentType, ...props }) => {
  const [Component, setComponent] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    getFormComponent(componentType).then(setComponent).catch(console.error);
  }, [componentType]);

  if (!Component) {
    return <Spin size="small" />;
  }

  return (
    <Suspense fallback={<Spin size="small" />}>
      <Component {...props} />
    </Suspense>
  );
};

export default DynamicComponent;
