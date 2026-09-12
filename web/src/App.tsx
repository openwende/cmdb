import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import router from './routes/router';
import { antdTheme } from '@/theme/tokens';
import TableEmpty from '@/components/common/TableEmpty';

function App() {
  const { i18n, t } = useTranslation();

  // Map i18n language to Ant Design locale
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN;

  // Sync document lang attribute with current locale
  useEffect(() => {
    document.documentElement.lang = i18n.language === 'en-US' ? 'en' : 'zh-CN';
  }, [i18n.language]);

  const renderEmpty = (componentName?: string) => {
    if (componentName === 'Table') {
      return <TableEmpty />;
    }

    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('common.noData')} />;
  };

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={antdTheme}
      wave={{ disabled: true }}
      button={{ autoInsertSpace: false }}
      renderEmpty={renderEmpty}
    >
      <AntdApp>
        <RouterProvider router={router} />
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
