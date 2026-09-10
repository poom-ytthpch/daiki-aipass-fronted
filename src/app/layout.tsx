import type {Metadata} from 'next';
import {cookies} from 'next/headers';
import './globals.css';
import {AppShell} from '@/components/AppShell';
import {I18nProvider} from '@/i18n/I18nProvider';
import {LOCALE_COOKIE_KEY,localeRegistry,normalizeLocale} from '@/i18n/config';

export const metadata:Metadata={title:'Daiki AI Passport',description:'Private AI gateway and local LLM workspace'};

export default async function RootLayout({children}:{children:React.ReactNode}){
  const cookieStore=await cookies();
  const locale=normalizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value);
  return <html lang={localeRegistry[locale].htmlLang} data-locale={locale}><body><I18nProvider initialLocale={locale}><AppShell>{children}</AppShell></I18nProvider></body></html>;
}
