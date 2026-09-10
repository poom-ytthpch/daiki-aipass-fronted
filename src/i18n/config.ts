export const DEFAULT_LOCALE='en' as const;
export const LOCALE_COOKIE_KEY='daiki_locale';
export const LOCALE_STORAGE_KEY='daiki_locale';

export const localeRegistry={
  en:{code:'en',label:'English',nativeLabel:'English',htmlLang:'en'},
  th:{code:'th',label:'Thai',nativeLabel:'ไทย',htmlLang:'th'},
} as const;

export type Locale=keyof typeof localeRegistry;
export type LocaleMeta=(typeof localeRegistry)[Locale];

export const supportedLocales=Object.keys(localeRegistry) as Locale[];

export function isLocale(value:unknown):value is Locale{
  return typeof value==='string'&&value in localeRegistry;
}

export function normalizeLocale(value:unknown):Locale{
  if(isLocale(value))return value;
  if(typeof value==='string'){
    const base=value.toLowerCase().split('-')[0];
    if(isLocale(base))return base;
  }
  return DEFAULT_LOCALE;
}
