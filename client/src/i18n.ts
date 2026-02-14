import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en.json';
import fr from '@/locales/fr.json';

export const UI_LANG_STORAGE_KEY = 'avatrr-ui-lang';

const defaultLng = typeof localStorage !== 'undefined' ? (localStorage.getItem(UI_LANG_STORAGE_KEY) ?? 'fr') : 'fr';

i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
  },
  lng: defaultLng,
  fallbackLng: 'fr',
  interpolation: {
    escapeValue: false,
  },
});

i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng;
    localStorage.setItem(UI_LANG_STORAGE_KEY, lng);
  }
});

export default i18n;
