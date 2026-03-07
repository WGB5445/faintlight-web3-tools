import { useLanguage } from "../context/LanguageContext";

export default function HomePage() {
  const { t } = useLanguage();
  const supportItems = t<string[]>("home.support.items");

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("home.title")}
        </h1>
        <p className="text-slate-300">{t("home.description")}</p>
      </section>
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 shadow-inner">
        <h2 className="text-xl font-medium text-slate-100">
          {t("home.support.title")}
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-300">
          {supportItems.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
