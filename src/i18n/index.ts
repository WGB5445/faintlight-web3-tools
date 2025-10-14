import en from './en';
import zh from './zh';

export const SUPPORTED_LANGUAGES = ['en', 'zh'] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

type Localized<T> = T extends string
  ? string
  : T extends number | boolean | null | undefined
  ? T
  : T extends readonly (infer U)[]
  ? readonly Localized<U>[]
  : T extends (infer U)[]
  ? Localized<U>[]
  : { readonly [K in keyof T]: Localized<T[K]> };

export type Messages = Localized<typeof en>;

export const messages: Record<LanguageCode, Messages> = {
  en,
  zh
};

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

export const LANGUAGE_STORAGE_KEY = 'preferredLanguage';

export function getStoredLanguage(): LanguageCode | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguageCode(stored) ? stored : null;
  } catch (error) {
    console.warn('Failed to read stored language preference', error);
    return null;
  }
}

export function storeLanguagePreference(lang: LanguageCode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (error) {
    console.warn('Failed to persist language preference', error);
  }
}

export function getBrowserLanguage(): LanguageCode | null {
  if (typeof navigator === 'undefined') return null;
  const language = navigator.language?.toLowerCase() ?? '';
  if (language.startsWith('zh')) return 'zh';
  if (language.startsWith('en')) return 'en';
  return null;
}

export function detectInitialLanguage(): LanguageCode {
  return getStoredLanguage() ?? getBrowserLanguage() ?? DEFAULT_LANGUAGE;
}
