import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { App as AntdApp, ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import router from './routes/router';
import { antdTheme } from '@/theme/tokens';

function App() {
  const { i18n } = useTranslation();

  // Map i18n language to Ant Design locale
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN;

  // Sync document lang attribute with current locale
  useEffect(() => {
    document.documentElement.lang = i18n.language === 'en-US' ? 'en' : 'zh-CN';
  }, [i18n.language]);

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme} wave={{ disabled: true }} button={{ autoInsertSpace: false }}>
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
