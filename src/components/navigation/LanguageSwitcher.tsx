import { SUPPORTED_LANGUAGES } from '../../i18n';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSwitcher() {
  const { lang, setLanguage, t } = useLanguage();

  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      <span className="uppercase tracking-[0.2em] text-slate-500">{t('common.languageLabel')}</span>
      <div className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/40 p-1">
        {SUPPORTED_LANGUAGES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLanguage(code)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              lang === code
                ? 'bg-sky-500/30 text-sky-200'
                : 'text-slate-300 hover:text-sky-200'
            }`}
          >
            {t(`common.languageNames.${code}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
