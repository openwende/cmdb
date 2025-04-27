 import React from 'react';
 import { Layout } from 'antd';

 const { Content: AntContent } = Layout;

 interface ContentProps {
    children: React.ReactNode;
 }

 const Content: React.FC<ContentProps> = ({children}) => {
    return <AntContent>
        {children}
    </AntContent>
 }

 export default Content;