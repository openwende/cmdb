import React from 'react';
import { Dropdown, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import './style.css';

enum LanguageKey {
  ZH = 'zh-CN',
  EN = 'en-US',
}

const Language: React.FC = () => {
  const { i18n } = useTranslation();

  const languageOptions: MenuProps['items'] = [
    {
      key: LanguageKey.ZH,
      label: '中文',
    },
    {
      key: LanguageKey.EN,
      label: 'English',
    },
  ];

  const handleLanguageChange: MenuProps['onClick'] = ({ key }) => {
    // Key point: switch language and store preference
    i18n.changeLanguage(key);
    localStorage.setItem('language', key);
  };

  return (
    <div className="language-container">
      <Dropdown
        menu={{
          items: languageOptions,
          onClick: handleLanguageChange,
          selectedKeys: [i18n.language],
        }}
        placement="bottom"
      >
        <Button type="text" icon={<GlobalOutlined />} className="language-button">
          <span className="language-label">{i18n.language === LanguageKey.ZH ? '中' : 'EN'}</span>
        </Button>
      </Dropdown>
    </div>
  );
};

export default Language;
