import React, { createContext, useContext, useState, useEffect } from 'react';
import translations_en from './en.json';
import translations_zh from './zh.json';

const I18nContext = createContext();

// Language object with methods
class LanguageContext {
  constructor(code) {
    this.code = code;
    this.supportedTranslatableLanguages = ['zh'];
  }

  canTranslate() {
    return this.supportedTranslatableLanguages.includes(this.code);
  }

  toString() {
    return this.code;
  }

  // Allow string comparison for backward compatibility
  static create(code) {
    return new LanguageContext(code);
  }
}

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState(LanguageContext.create('en'));
  const [translations, setTranslations] = useState(translations_en);

  useEffect(() => {
    const initLanguage = async () => {
      try {
        // Try to get saved language from config
        if (window.api && window.api.getLanguage) {
          const savedLang = await window.api.getLanguage();
          if (savedLang && ['en', 'zh'].includes(savedLang)) {
            setLanguage(LanguageContext.create(savedLang));
            loadTranslations(savedLang);
            return;
          }
        }
      } catch (err) {
        console.warn('Could not get saved language:', err);
      }

      // Fallback: detect system language
      const systemLang = navigator.language.split('-')[0];
      const supportedLangs = ['en', 'zh'];
      const lang = supportedLangs.includes(systemLang) ? systemLang : 'en';
      setLanguage(LanguageContext.create(lang));
      loadTranslations(lang);
    };

    initLanguage();
  }, []);

  const loadTranslations = async (lang) => {
    try {
      if (lang === 'en') {
        setTranslations(translations_en);
      } else if (lang === 'zh') {
        setTranslations(translations_zh);
      }
    } catch (err) {
      console.error('Failed to load translations:', err);
      setTranslations(translations_en);
    }
  };

  const t = (key, defaultValue = key, params = {}) => {
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      if (!value?.hasOwnProperty(k)) {
        console.warn(`[i18n] Missing key "${k}" in path "${key}"`);
        return defaultValue;
      }
      value = value[k];
    }

    if (typeof value === 'string' && params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        value = value.replace(`{${paramKey}}`, val);
      });
    }

    return value;
  };

  const changeLanguage = async (lang) => {
    setLanguage(LanguageContext.create(lang));
    loadTranslations(lang);

    // Persist to backend
    try {
      if (window.api && window.api.setLanguage) {
        await window.api.setLanguage(lang);
      }
    } catch (err) {
      console.error('Failed to save language preference:', err);
    }
  };

  return (
    <I18nContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    console.error('useTranslation must be used within I18nProvider');
    return {
      t: (key) => key,
      language: 'en',
      changeLanguage: () => {},
    };
  }
  return context;
};
