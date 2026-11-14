"use client";
import { createContext, useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { COOKIE_LANG, setLang, t, type Lang } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; changer: (l: Lang) => void }>({ lang: "fr", changer: () => {} });
/** À appeler dans chaque composant client qui affiche du texte : il se redessine au changement de langue. */
export const useLang = () => useContext(Ctx).lang;

export function LangProvider({ initiale, children }: { initiale: Lang; children: React.ReactNode }) {
  const [lang, setL] = useState<Lang>(initiale);
  const routeur = useRouter();
  setLang(lang);
  const changer = (l: Lang) => {
    document.cookie = `${COOKIE_LANG}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    setLang(l); setL(l); routeur.refresh();
  };
  return <Ctx.Provider value={{ lang, changer }}>{children}</Ctx.Provider>;
}

export default function BoutonLangue() {
  const { lang, changer } = useContext(Ctx);
  return (
    <div className="langue" role="group" aria-label={t("Langue")}>
      <button type="button" aria-pressed={lang === "fr"} onClick={() => changer("fr")} title={t("Passer le site en français")}>FR</button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => changer("en")} title={t("Passer le site en anglais")}>EN</button>
    </div>
  );
}
