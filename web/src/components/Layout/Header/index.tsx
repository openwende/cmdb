import React, { Fragment } from 'react';
import { Layout } from 'antd';
import Logo from './Logo';
import Menu from './Menu';
import Function from './Function';
import './style.css';

const { Header: AntHeader } = Layout;

const Header: React.FC = () => {
    return <AntHeader className="app-header">
        <div className="header-left">
            <Logo />
            <Menu />
        </div>
        <Function />
    </AntHeader>
}

export default Header;
