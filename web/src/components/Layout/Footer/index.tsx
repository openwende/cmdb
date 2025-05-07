import React from 'react';
import { Layout } from 'antd';
import './style.css';

const { Footer: AntFooter } = Layout;

const Footer: React.FC = () => {
   return <AntFooter className="app-footer">
        Copyright © 2025 Wende. All Rights Reserved.
   </AntFooter>
}

export default Footer;