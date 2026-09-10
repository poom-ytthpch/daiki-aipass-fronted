# Daiki web i18n

The web UI uses a locale registry plus per-language dictionaries. English is the source/fallback locale and Thai is the first additional locale.

## Add a language

1. Add the locale metadata to `config.ts` (for example `ja`).
2. Create a dictionary file such as `ja.ts` with source-English keys and translated values.
3. Register that dictionary in `messages.ts`.

`LanguageSwitcher` reads `supportedLocales` from the registry, so the selector automatically includes newly registered languages. The selected locale is stored in the `daiki_locale` cookie (and local storage for client compatibility), and the document `lang` attribute is synchronized automatically.

New components should use `useI18n().t('English source text')`. Existing server/client screens are covered by `LegacyI18nBridge`, which translates visible UI text and common accessibility attributes without changing user messages, AI answers, code, secrets, chat titles, or account names. Add `data-i18n-skip` to any new subtree that must never be translated.
