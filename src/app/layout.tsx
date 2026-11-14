import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import Link from "next/link";
import { SITE } from "@/config/site";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import FondScene from "@/components/FondScene";
import Cookies from "@/components/Cookies";
import BoutonLangue, { LangProvider } from "@/components/Langue";
import { tr } from "@/lib/i18n";
import { langServeur } from "@/lib/lang-serveur";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const lang = await langServeur();
  return { title: `${SITE.nom} — ${tr(lang, SITE.accroche)}`, description: tr(lang, SITE.sousTitre) };
}
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#060F1E" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await langServeur();
  const t = (s: string) => tr(lang, s);
  return (
    <html lang={lang} className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <LangProvider initiale={lang}>
        <FondScene />
        <a href="#contenu" className="skip">{t("Aller au contenu")}</a>
        <header className="entete">
          <div className="entete-in">
            <Link href="/" className="logo" aria-label={`${SITE.nom}, ${t("accueil")}`}>
              <span className="logo-marque" aria-hidden="true">AP</span>
              <span>{SITE.nom}</span>
            </Link>
            <nav aria-label={t("Navigation principale")} className="nav">
              <Link href="/">{t("Produit")}</Link>
              <Link href="/modele">{t("Modèle économique")}</Link>
            </nav>
            <BoutonLangue />
          </div>
        </header>
        <main id="contenu">{children}</main>
        <footer className="pied">
          <p>{t(SITE.sourcesMention)}</p>
          <p>{t("Prédictions indicatives, calculées à partir des données publiques. Aucune donnée personnelle n'est stockée.")}</p>
        </footer>
        <Cookies />
        </LangProvider>
      </body>
    </html>
  );
}
