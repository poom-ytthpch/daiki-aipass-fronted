'use client';

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import {DEFAULT_LOCALE,LOCALE_COOKIE_KEY,LOCALE_STORAGE_KEY,localeRegistry,normalizeLocale,type Locale} from './config';
import {t as translate,translateText} from './messages';

type I18nContextValue={locale:Locale;setLocale:(locale:Locale)=>void;t:(key:string)=>string};
const I18nContext=createContext<I18nContextValue|null>(null);

const TRANSLATABLE_ATTRIBUTES=['aria-label','title','placeholder'] as const;
const SKIP_SELECTOR='[data-i18n-skip],.markdownBody,.userText,.sentAttachment,.historyItem>button strong,.profileCopy strong,.secretBox code,.metadataPre,code,pre';

function shouldSkip(node:Node){
  const el=node.nodeType===Node.ELEMENT_NODE?node as Element:node.parentElement;
  return Boolean(el?.closest(SKIP_SELECTOR));
}

function LegacyI18nBridge({locale}:{locale:Locale}){
  const textSources=useRef(new WeakMap<Text,string>());
  const attributeSources=useRef(new WeakMap<Element,Map<string,string>>());

  useEffect(()=>{
    if(typeof document==='undefined')return;
    const observer=new MutationObserver(records=>{
      observer.disconnect();
      for(const record of records){
        if(record.type==='characterData')translateNode(record.target,true);
        else if(record.type==='attributes')translateElement(record.target as Element,true,record.attributeName||undefined);
        else for(const added of Array.from(record.addedNodes))translateTree(added,true);
      }
      observe();
    });

    const translateNode=(node:Node,recapture=false)=>{
      if(node.nodeType!==Node.TEXT_NODE||shouldSkip(node))return;
      const text=node as Text;
      if(recapture||!textSources.current.has(text))textSources.current.set(text,text.nodeValue||'');
      const source=textSources.current.get(text)||'';
      const next=translateText(source,locale);
      if(text.nodeValue!==next)text.nodeValue=next;
    };

    const translateElement=(el:Element,recapture=false,onlyAttribute?:string)=>{
      if(shouldSkip(el))return;
      let sources=attributeSources.current.get(el);
      if(!sources){sources=new Map();attributeSources.current.set(el,sources)}
      for(const attr of TRANSLATABLE_ATTRIBUTES){
        if(onlyAttribute&&attr!==onlyAttribute)continue;
        if(!el.hasAttribute(attr))continue;
        if(recapture||!sources.has(attr))sources.set(attr,el.getAttribute(attr)||'');
        const source=sources.get(attr)||'';
        const next=translateText(source,locale);
        if(el.getAttribute(attr)!==next)el.setAttribute(attr,next);
      }
    };

    const translateTree=(root:Node,recapture=false)=>{
      if(shouldSkip(root))return;
      if(root.nodeType===Node.TEXT_NODE){translateNode(root,recapture);return}
      if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE&&root.nodeType!==Node.DOCUMENT_FRAGMENT_NODE)return;
      if(root.nodeType===Node.ELEMENT_NODE)translateElement(root as Element,recapture);
      const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
      let current=walker.nextNode();
      while(current){
        if(current.nodeType===Node.TEXT_NODE)translateNode(current,recapture);
        else translateElement(current as Element,recapture);
        current=walker.nextNode();
      }
    };

    const observe=()=>observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:[...TRANSLATABLE_ATTRIBUTES]});

    observer.disconnect();
    translateTree(document.body,false);
    observe();

    const originalAlert=window.alert.bind(window);
    const originalConfirm=window.confirm.bind(window);
    const originalPrompt=window.prompt.bind(window);
    window.alert=(message?:unknown)=>originalAlert(translateText(String(message??''),locale));
    window.confirm=(message?:string)=>originalConfirm(translateText(String(message??''),locale));
    window.prompt=(message?:string,defaultValue?:string)=>originalPrompt(translateText(String(message??''),locale),defaultValue);

    return()=>{
      observer.disconnect();
      window.alert=originalAlert;
      window.confirm=originalConfirm;
      window.prompt=originalPrompt;
    };
  },[locale]);

  return null;
}

export function I18nProvider({initialLocale=DEFAULT_LOCALE,children}:{initialLocale?:Locale;children:React.ReactNode}){
  const [locale,setLocaleState]=useState<Locale>(initialLocale);

  const setLocale=useCallback((next:Locale)=>{
    const normalized=normalizeLocale(next);
    setLocaleState(normalized);
    try{localStorage.setItem(LOCALE_STORAGE_KEY,normalized)}catch{}
    document.cookie=`${LOCALE_COOKIE_KEY}=${encodeURIComponent(normalized)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  },[]);

  useEffect(()=>{
    const meta=localeRegistry[locale];
    document.documentElement.lang=meta.htmlLang;
    document.documentElement.dataset.locale=locale;
    document.cookie=`${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  },[locale]);

  const value=useMemo<I18nContextValue>(()=>({locale,setLocale,t:(key:string)=>translate(locale,key)}),[locale,setLocale]);
  return <I18nContext.Provider value={value}><LegacyI18nBridge locale={locale}/>{children}</I18nContext.Provider>;
}

export function useI18n(){
  const value=useContext(I18nContext);
  if(!value)throw new Error('useI18n must be used inside I18nProvider');
  return value;
}
