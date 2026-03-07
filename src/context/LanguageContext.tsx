import { createContext, ReactNode, useContext, useMemo } from "react";
import { LanguageCode, messages } from "../i18n";

type TranslationVariables = Record<string, string | number>;

export type Translator = <T = string>(
  key: string,
  vars?: TranslationVariables,
) => T;

export interface LanguageContextValue {
  lang: LanguageCode;
  t: Translator;
  setLanguage: (lang: LanguageCode) => void;
  buildPath: (slug?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

interface LanguageProviderProps {
  lang: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  buildPath: (slug?: string) => string;
  children: ReactNode;
}

function resolveValue(path: string, lang: LanguageCode) {
  const segments = path.split(".");
  let current: any = messages[lang];
  for (const segment of segments) {
    current = current?.[segment];
    if (current === undefined || current === null) {
      return undefined;
    }
  }
  return current;
}

function applyVariables(value: string, vars?: TranslationVariables) {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return String(vars[key]);
    }
    return match;
  });
}

export function LanguageProvider({
  lang,
  setLanguage,
  buildPath,
  children,
}: LanguageProviderProps) {
  const contextValue = useMemo<LanguageContextValue>(() => {
    const translate: Translator = <T = string,>(
      key: string,
      vars?: TranslationVariables,
    ): T => {
      const resolved = resolveValue(key, lang);
      if (resolved === undefined) {
        console.warn(`Missing translation for key: ${key} (${lang})`);
        return key as T;
      }
      if (typeof resolved === "string") {
        return applyVariables(resolved, vars) as T;
      }
      if (Array.isArray(resolved)) {
        if (!vars) {
          return resolved as T;
        }
        return resolved.map((item) =>
          typeof item === "string" ? applyVariables(item, vars) : item,
        ) as T;
      }
      if (typeof resolved === "object" && resolved !== null && vars) {
        const clone: Record<string, unknown> = {};
        for (const [keyName, value] of Object.entries(resolved)) {
          clone[keyName] =
            typeof value === "string" ? applyVariables(value, vars) : value;
        }
        return clone as T;
      }
      return resolved as T;
    };

    return {
      lang,
      t: translate,
      setLanguage,
      buildPath,
    };
  }, [lang, setLanguage, buildPath]);

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
