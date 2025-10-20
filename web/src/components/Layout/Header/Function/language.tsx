import React from 'react';
import { Dropdown, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import type { MenuProps } from 'antd';
import ZhSvg from '@/assets/icons/zh.svg?react';
import EnSvg from '@/assets/icons/en.svg?react';

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
            <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Button
                    type="text"
                    icon={<ZhSvg />}
                    style={{ color: '#fff' }}
                />
                <Button
                    type="text"
                    icon={<EnSvg />}
                    style={{ color: '#fff' }}
                />
            </div>
        </Dropdown>
    );
};

export default Language;