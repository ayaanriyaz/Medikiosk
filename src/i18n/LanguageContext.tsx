import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { Language } from '../types';
import { translations, TranslationStrings } from './translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationStrings & ((key: string, fallback?: string) => string);
  isHindi: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEYS = ['language', 'medikiosk_language'];

function getInitialLanguage(): Language {
  try {
    for (const key of STORAGE_KEYS) {
      const saved = localStorage.getItem(key);
      if (saved === 'hi' || saved === 'en') {
        return saved;
      }
    }
  } catch (e) {
    console.warn('Unable to access localStorage for language:', e);
  }
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (newLang: Language) => {
    if (newLang !== 'en' && newLang !== 'hi') return;
    setLanguageState(newLang);
    try {
      localStorage.setItem('language', newLang);
      localStorage.setItem('medikiosk_language', newLang);
      document.documentElement.lang = newLang;
    } catch (e) {
      console.warn('Unable to persist language:', e);
    }
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // safe ignore in environments without DOM
    }
  }, [language]);

  const value = useMemo<LanguageContextType>(() => {
    const dict = translations[language] || translations.en;

    // Create a callable proxy that supports both:
    // 1) t.welcome, t.homeHeroTitle1
    // 2) t('homeHeroTitle1', 'Fallback')
    const tFn = (key: string, fallback?: string): string => {
      if (key in dict && typeof dict[key] === 'string') {
        return dict[key];
      }
      if (key in dict && typeof dict[key] === 'function') {
        return dict[key];
      }
      return fallback !== undefined ? fallback : (dict[key] || key);
    };

    // Assign all dictionary properties onto the function
    const combined = Object.assign(tFn, dict) as any;

    return {
      language,
      setLanguage,
      t: combined,
      isHindi: language === 'hi',
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback if rendered outside provider
    const fallbackLang = getInitialLanguage();
    const dict = translations[fallbackLang];
    const tFn = ((key: string, fallback?: string) => fallback !== undefined ? fallback : (dict[key] || key)) as any;
    Object.assign(tFn, dict);
    return {
      language: fallbackLang,
      setLanguage: () => {},
      t: tFn,
      isHindi: fallbackLang === 'hi',
    };
  }
  return context;
}
