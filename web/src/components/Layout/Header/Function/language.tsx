import React from 'react';
import { Dropdown, Button } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';

enum LanguageKey {
    ZH = 'zh-CN',
    EN = 'en-US'
}

const Language: React.FC = () => {
    const { i18n } = useTranslation();

    const languageOptions: MenuProps['items'] = [
        {
            key: LanguageKey.ZH,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🇨🇳</span>
                    <span>中文</span>
                </div>
            ),
        },
        {
            key: LanguageKey.EN,
            label: (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>🇺🇸</span>
                    <span>English</span>
                </div>
            ),
        },
    ];

    const handleLanguageChange: MenuProps['onClick'] = ({ key }) => {
        // Key point: switch language and store preference
        i18n.changeLanguage(key);
        localStorage.setItem('language', key);
    };

    const getCurrentLanguageLabel = () => {
        return i18n.language === LanguageKey.ZH ? '🇨🇳' : '🇺🇸';
    };

    return (
        <Dropdown
            menu={{
                items: languageOptions,
                onClick: handleLanguageChange,
                selectedKeys: [i18n.language],
            }}
            placement="bottom"
        >
            <Button
                type="text"
                icon={<GlobalOutlined />}
                style={{
                    color: '#fff',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    height: '64px',
                    gap: '4px'
                }}
            >
                {getCurrentLanguageLabel()}
            </Button>
        </Dropdown>
    );
};

export default Language;