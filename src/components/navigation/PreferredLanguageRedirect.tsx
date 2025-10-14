import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { detectInitialLanguage, LanguageCode } from '../../i18n';

export default function PreferredLanguageRedirect() {
  const [target, setTarget] = useState<LanguageCode | null>(null);

  useEffect(() => {
    setTarget(detectInitialLanguage());
  }, []);

  if (!target) {
    return null;
  }

  return <Navigate to={`/${target}`} replace />;
}
