// 支持的语言列表
export const languages = {
  'zh-CN': {
    name: '简体中文',
    nativeName: '简体中文',
    dir: 'ltr',
    locale: 'zh-CN',
  },
  'zh-TW': {
    name: '繁體中文',
    nativeName: '繁體中文',
    dir: 'ltr',
    locale: 'zh-TW',
  },
  'en': {
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    locale: 'en',
  },
  'fr': {
    name: 'French',
    nativeName: 'Français',
    dir: 'ltr',
    locale: 'fr',
  },
  'ja': {
    name: 'Japanese',
    nativeName: '日本語',
    dir: 'ltr',
    locale: 'ja',
  },
  'de': {
    name: 'German',
    nativeName: 'Deutsch',
    dir: 'ltr',
    locale: 'de',
  },
  'es': {
    name: 'Spanish',
    nativeName: 'Español',
    dir: 'ltr',
    locale: 'es',
  },
  'ar': {
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    locale: 'ar',
  },
} as const;

export type LanguageCode = keyof typeof languages;

// 翻译键类型
export type TranslationKey = string;

// 翻译对象类型 - 使用索引签名避免循环引用
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TranslationObject = Record<string, any>;

// 语言配置类型
export type LanguageConfig = typeof languages[LanguageCode];
