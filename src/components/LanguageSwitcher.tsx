'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';
import { languages, LanguageCode } from '@/lib/i18n/types';
import { Globe, Check } from 'lucide-react';

export function LanguageSwitcher() {
  const { locale, setLocale, availableLanguages } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = availableLanguages[locale];

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{currentLang.nativeName}</span>
      </Button>
      
      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 z-50">
          {Object.entries(availableLanguages).map(([code, config]) => (
            <button
              key={code}
              className={`w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between ${
                locale === code ? 'bg-slate-50 dark:bg-slate-700/50' : ''
              }`}
              onClick={() => {
                setLocale(code as LanguageCode);
                setIsOpen(false);
              }}
            >
              <div>
                <span className="font-medium">{config.nativeName}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {config.name !== config.nativeName && config.name}
                </span>
              </div>
              {locale === code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
