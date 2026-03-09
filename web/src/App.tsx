import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { useTranslation } from 'react-i18next';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import router from './routes/router';

const antdTheme = {
  token: {
    // Brand
    colorPrimary: '#2563eb',
    colorSuccess: '#16a34a',
    colorWarning: '#ea580c',
    colorError: '#dc2626',
    colorInfo: '#0ea5e9',

    // Layout
    colorBgLayout: '#f1f5f9',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',

    // Border
    colorBorder: '#e2e8f0',
    colorBorderSecondary: '#f1f5f9',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // Typography
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,

    // Text
    colorText: '#0f172a',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#94a3b8',
    colorTextQuaternary: '#cbd5e1',

    // Sizes
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
  },
  algorithm: theme.defaultAlgorithm,
  components: {
    Layout: {
      headerBg: '#0f172a',
      headerHeight: 52,
      siderBg: '#ffffff',
      bodyBg: '#f1f5f9',
    },
    Menu: {
      darkItemBg: '#0f172a',
      darkItemSelectedBg: 'rgba(37, 99, 235, 0.2)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.08)',
      darkItemColor: 'rgba(255, 255, 255, 0.75)',
      darkItemSelectedColor: '#ffffff',
      itemBg: '#ffffff',
      itemSelectedBg: '#eff6ff',
      itemSelectedColor: '#2563eb',
      itemHoverBg: '#f8fafc',
      itemHeight: 40,
      itemMarginInline: 8,
      itemBorderRadius: 6,
    },
    Table: {
      headerBg: '#f8fafc',
      headerColor: '#475569',
      headerSplitColor: '#e2e8f0',
      rowHoverBg: '#f8fafc',
      borderColor: '#f1f5f9',
      cellPaddingBlock: 12,
    },
    Card: {
      borderRadiusLG: 8,
    },
    Button: {
      borderRadius: 6,
      fontWeight: 500,
    },
    Tabs: {
      itemSelectedColor: '#2563eb',
      inkBarColor: '#2563eb',
      itemHoverColor: '#1d4ed8',
    },
    Descriptions: {
      titleColor: '#0f172a',
      contentColor: '#475569',
    },
    Breadcrumb: {
      itemColor: '#94a3b8',
      lastItemColor: '#0f172a',
      linkColor: '#475569',
      linkHoverColor: '#2563eb',
      separatorColor: '#cbd5e1',
    },
    Input: {
      borderRadius: 6,
    },
    Select: {
      borderRadius: 6,
    },
  },
};

function App() {
  const { i18n } = useTranslation();

  // Map i18n language to Ant Design locale
  const antdLocale = i18n.language === 'en-US' ? enUS : zhCN;

  // Sync document lang attribute with current locale
  useEffect(() => {
    document.documentElement.lang = i18n.language === 'en-US' ? 'en' : 'zh-CN';
  }, [i18n.language]);

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  );
}

export default App;
