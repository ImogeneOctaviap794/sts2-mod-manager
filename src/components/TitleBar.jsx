import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../i18n';
import { Minus, Square, X, Github, Languages, ChevronDown } from 'lucide-react';

export default function TitleBar() {
  const { t, language, changeLanguage } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);
  
  const handleLanguageChange = (lang) => {
    changeLanguage(lang);
    setShowDropdown(false);
  };
  
  const languages = [
    { code: 'en', name: t('titleBar.language.en', 'English') },
    { code: 'zh', name: t('titleBar.language.zh', '中文') }
  ];

  return (
    <div className="titlebar flex items-center justify-between h-10 bg-gray-900 px-4 select-none relative">
      <div className="flex items-center gap-2">
        <span className="text-white text-sm font-semibold tracking-wide">{t('titleBar.appName', 'STS2 Mod Manager')}</span>
      </div>
      <div className="flex items-center">
        <div className="relative" ref={dropdownRef}>
          <button onClick={() => setShowDropdown(!showDropdown)}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title={t('titleBar.selectLanguage', 'Select Language')}>
            <Languages size={14} />
            <ChevronDown size={10} className="ml-1" />
          </button>
          {showDropdown && (
            <div style={{ backgroundColor: '#1f2937' }} className="absolute top-full right-0 mt-1 border border-gray-600 rounded shadow-lg z-50">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors ${
                    language === lang.code ? 'text-white bg-gray-700' : 'text-gray-300'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => window.api.openUrl('https://github.com/ImogeneOctaviap794/sts2-mod-manager')}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
          title={t('titleBar.github', 'GitHub')}>
          <Github size={14} />
        </button>
        <button onClick={() => window.api.minimize()}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <Minus size={14} />
        </button>
        <button onClick={() => window.api.maximize()}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <Square size={12} />
        </button>
        <button onClick={() => window.api.close()}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-600 transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
