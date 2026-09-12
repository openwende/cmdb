import React from 'react';
import { Layout } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import Logo from './Logo';
import Menu from './Menu';
import Function from './Function';
import './style.css';

const { Header: AntHeader } = Layout;

interface HeaderProps {
  isMobile?: boolean;
  onToggleSidebar?: () => void;
}

const Header: React.FC<HeaderProps> = ({ isMobile, onToggleSidebar }) => {
  return (
    <AntHeader className="app-header">
      <div className="header-left">
        {isMobile && (
          <button
            type="button"
            className="header-hamburger"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
          >
            <MenuOutlined />
          </button>
        )}
        <Logo />
        {!isMobile && <Menu />}
      </div>
      <Function />
    </AntHeader>
  );
};

export default Header;
