import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhTranslation from './locales/zh-CN.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: {
        translation: zhTranslation
      }
    },
    lng: 'zh', // default language
    fallbackLng: 'zh', // if current language does not have a key, fallback to this language
    interpolation: {
      escapeValue: false // React has already done XSS protection
    }
  });

export default i18n;