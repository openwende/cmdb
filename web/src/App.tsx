import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import router from './routes/router';

function App() {
  const { i18n } = useTranslation();

  // Map i18n language to Ant Design locale
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN;

  return (
    <ConfigProvider locale={antdLocale}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

export default App;
