import zhCN from './locales/zh-CN';
import zhTW from './locales/zh-TW';
import en from './locales/en';
import fr from './locales/fr';
import ja from './locales/ja';
import de from './locales/de';
import es from './locales/es';
import ar from './locales/ar';
import { LanguageCode, TranslationObject } from './types';

// 所有翻译
const translations: Record<LanguageCode, TranslationObject> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'en': en,
  'fr': fr,
  'ja': ja,
  'de': de,
  'es': es,
  'ar': ar,
};

// 获取翻译
export function getTranslation(locale: LanguageCode): TranslationObject {
  return translations[locale] || translations['en'];
}

// 导出所有翻译
export { translations };
export { zhCN, zhTW, en, fr, ja, de, es, ar };
