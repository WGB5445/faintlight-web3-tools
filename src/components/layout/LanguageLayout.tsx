import { useCallback, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { detectInitialLanguage, isLanguageCode, LanguageCode, storeLanguagePreference } from '../../i18n';
import { LanguageProvider } from '../../context/LanguageContext';

function buildFallbackPath(target: LanguageCode, pathname: string, search: string, hash: string) {
  const remainder = pathname.replace(/^\/[^/]+/, '');
  const normalizedRemainder = remainder === '/' ? '' : remainder;
  return `/${target}${normalizedRemainder}${search}${hash}`;
}

export default function LanguageLayout() {
  const params = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const rawLang = (params.lang ?? '').toLowerCase();
  const lang = isLanguageCode(rawLang) ? (rawLang as LanguageCode) : null;

  if (!lang) {
    const target = detectInitialLanguage();
    const fallback = buildFallbackPath(target, location.pathname, location.search, location.hash);
    return <Navigate to={fallback} replace />;
  }

  useEffect(() => {
    storeLanguagePreference(lang);
  }, [lang]);

  const setLanguage = useCallback(
    (nextLang: LanguageCode) => {
      if (nextLang === lang) return;
      const prefix = `/${lang}`;
      let remainder = location.pathname.startsWith(prefix)
        ? location.pathname.slice(prefix.length)
        : location.pathname;
      if (remainder === '/' || remainder === '') {
        remainder = '';
      }
      const targetPath = `/${nextLang}${remainder}${location.search}${location.hash}`;
      navigate(targetPath, { replace: false });
    },
    [lang, location.hash, location.pathname, location.search, navigate]
  );

  const buildPath = useCallback(
    (slug?: string) => {
      if (!slug) {
        return `/${lang}`;
      }
      const cleaned = slug.replace(/^\/+/, '');
      if (!cleaned) {
        return `/${lang}`;
      }
      return `/${lang}/${cleaned}`;
    },
    [lang]
  );

  return (
    <LanguageProvider lang={lang} setLanguage={setLanguage} buildPath={buildPath}>
      <Outlet />
    </LanguageProvider>
  );
}
