import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import Link from "next/link";
import { SITE } from "@/config/site";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import FondScene from "@/components/FondScene";
import Cookies from "@/components/Cookies";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-sans" });
const serif = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"], variable: "--font-serif" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: `${SITE.nom} — ${SITE.accroche}`,
  description: SITE.sousTitre,
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#060F1E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>
        <FondScene />
        <a href="#contenu" className="skip">Aller au contenu</a>
        <header className="entete">
          <div className="entete-in">
            <Link href="/" className="logo" aria-label={`${SITE.nom}, accueil`}>
              <span className="logo-marque" aria-hidden="true">AP</span>
              <span>{SITE.nom}</span>
            </Link>
            <nav aria-label="Navigation principale" className="nav">
              <Link href="/">Produit</Link>
              <Link href="/modele">Modèle économique</Link>
            </nav>
          </div>
        </header>
        <main id="contenu">{children}</main>
        <footer className="pied">
          <p>{SITE.sourcesMention}</p>
          <p>Prédictions indicatives, calculées à partir des données publiques. Aucune donnée personnelle n'est stockée.</p>
        </footer>
        <Cookies />
      </body>
    </html>
  );
}
