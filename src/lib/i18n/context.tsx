'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { LanguageCode, languages, LanguageConfig } from './types';
import { getTranslation, translations } from './index';

// 获取嵌套对象中的值
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

// 替换模板变量
function interpolate(template: string, variables: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key]?.toString() ?? match;
  });
}

interface I18nContextType {
  // 当前语言
  locale: LanguageCode;
  // 语言配置
  languageConfig: LanguageConfig;
  // 文字方向
  dir: 'ltr' | 'rtl';
  // 翻译函数
  t: (key: string, variables?: Record<string, string | number>) => string;
  // 切换语言
  setLocale: (locale: LanguageCode) => void;
  // 所有可用语言
  availableLanguages: typeof languages;
  // 是否加载中
  loading: boolean;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'meta_analysis_locale';

// 默认语言检测
function detectDefaultLocale(): LanguageCode {
  // 首先检查本地存储
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as LanguageCode;
    if (stored && languages[stored]) {
      return stored;
    }
    
    // 检测浏览器语言
    const browserLang = navigator.language;
    
    // 精确匹配
    if (languages[browserLang as LanguageCode]) {
      return browserLang as LanguageCode;
    }
    
    // 语言前缀匹配（如 zh -> zh-CN）
    const prefix = browserLang.split('-')[0];
    for (const [code] of Object.entries(languages)) {
      if (code.startsWith(prefix)) {
        return code as LanguageCode;
      }
    }
  }
  
  // 默认简体中文
  return 'zh-CN';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LanguageCode>('zh-CN');
  const [loading, setLoading] = useState(true);

  // 初始化
  useEffect(() => {
    const defaultLocale = detectDefaultLocale();
    setLocaleState(defaultLocale);
    setLoading(false);
  }, []);

  // 更新 HTML 属性
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const config = languages[locale];
      document.documentElement.lang = locale;
      document.documentElement.dir = config.dir;
    }
  }, [locale]);

  // 翻译函数
  const t = useCallback((key: string, variables?: Record<string, string | number>): string => {
    const translation = getTranslation(locale);
    const value = getNestedValue(translation as unknown as Record<string, unknown>, key);
    
    if (value === undefined) {
      // 回退到英文
      const fallback = getNestedValue(translations['en'] as unknown as Record<string, unknown>, key);
      if (fallback === undefined) {
        console.warn(`Translation not found: ${key}`);
        return key;
      }
      return variables ? interpolate(fallback, variables) : fallback;
    }
    
    return variables ? interpolate(value, variables) : value;
  }, [locale]);

  // 切换语言
  const setLocale = useCallback((newLocale: LanguageCode) => {
    if (languages[newLocale]) {
      setLocaleState(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newLocale);
      }
    }
  }, []);

  const languageConfig = languages[locale];
  const dir = languageConfig.dir;

  return (
    <I18nContext.Provider
      value={{
        locale,
        languageConfig,
        dir,
        t,
        setLocale,
        availableLanguages: languages,
        loading,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// 简化的翻译 Hook
export function useTranslation() {
  const { t, locale, dir } = useI18n();
  return { t, locale, dir };
}
