'use client';

import {Languages} from 'lucide-react';
import {usePathname} from 'next/navigation';
import {localeRegistry,supportedLocales,type Locale} from './config';
import {useI18n} from './I18nProvider';

export function LanguageSwitcher({variant='sidebar'}:{variant?:'sidebar'|'floating'}){
  const {locale,setLocale,t}=useI18n();
  const pathname=usePathname();
  const floatingClass=variant==='floating'?`languageSwitcherFloating ${pathname==='/chat'?'languageSwitcherChatFloating':''}`:'';
  return <label className={`languageSwitcher ${floatingClass}`} data-i18n-skip>
    <Languages size={15}/>
    <span>{t('Language')}</span>
    <select aria-label={t('Language')} value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
      {supportedLocales.map(code=><option key={code} value={code}>{localeRegistry[code].nativeLabel}</option>)}
    </select>
  </label>;
}
