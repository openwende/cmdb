import React from 'react';
import { Layout } from 'antd';
import Breadcrumb from '../Breadcrumb';

const { Content: AntContent } = Layout;

interface ContentProps {
  children: React.ReactNode;
}

const Content: React.FC<ContentProps> = ({ children }) => {
  return (
    <AntContent>
      <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px', marginTop: 8 }}>
        <Breadcrumb />
        {children}
      </div>
    </AntContent>
  );
};

export default Content;
