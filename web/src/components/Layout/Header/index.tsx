import React from 'react';
import { Layout } from 'antd';
import Logo from './Logo';
import Menu from './Menu';
import Function from './Function';
import './style.css';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
    return <AntHeader className="app-header">
        <Logo />
        <Menu />
        <Function />
    </AntHeader>
}

export default Header;
