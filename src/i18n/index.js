import React, { createContext, useContext, useState, useEffect } from 'react';
import translations_en from './en.json';
import translations_zh from './zh.json';

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState('en');
  const [translations, setTranslations] = useState(translations_en);

  useEffect(() => {
    // Try to detect system language
    const systemLang = navigator.language.split('-')[0];
    const supportedLangs = ['en', 'zh'];
    const lang = supportedLangs.includes(systemLang) ? systemLang : 'en';
    setLanguage(lang);
    
    // Load appropriate translations
    loadTranslations(lang);
  }, []);

  const loadTranslations = async (lang) => {
    try {
      if (lang === 'en') {
        setTranslations(translations_en);
      } else if (lang === 'zh') {
        setTranslations(translations_zh);
      }
      // Add more languages here as needed
    } catch (err) {
      console.error('Failed to load translations:', err);
      setTranslations(translations_en);
    }
  };

  const t = (key, defaultValue = key, params = {}) => {
    const keys = key.split('.');
    let value = translations;

    for (const k of keys) {
      value = value?.[k];
      if (!value) {
        return defaultValue;
      }
    }

    // Replace parameters
    if (typeof value === 'string' && params) {
      Object.entries(params).forEach(([key, val]) => {
        value = value.replace(`{${key}}`, val);
      });
    }

    return value;
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    loadTranslations(lang);
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
