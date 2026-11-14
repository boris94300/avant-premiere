import Link from "next/link";
import { MARCHE } from "@/config/site";
import Offres from "@/components/Offres";
import { tr } from "@/lib/i18n";
import { langServeur } from "@/lib/lang-serveur";

export async function generateMetadata() {
  return { title: `${tr(await langServeur(), "Modèle économique")} — Avant-Première` };
}

export default async function Modele() {
  const lang = await langServeur();
  const t = (s: string) => tr(lang, s);
  return (
    <div className="wrap">
      <h1 className="page-titre">{t("Modèle économique")}</h1>
      <p style={{ color: "var(--encre-2)", maxWidth: "65ch", fontSize: 18 }}>
        {lang === "en"
          ? `€${MARCHE.commandePubliqueMdEUR}bn of public procurement every year in France. Today's monitoring tools show calls for tenders once they are published; Avant-Première shows those of 2027 to 2032, before everyone else, and computes the chances of winning.`
          : `${MARCHE.commandePubliqueMdEUR} Md€ de commande publique par an en France. Les outils de veille actuels montrent les appels d'offres une fois publiés ; Avant-Première montre ceux de 2027 à 2032, avant tout le monde, et calcule les chances de gain.`}
      </p>
      <Offres />
      <h2 style={{ fontSize: 22, marginTop: 40 }}>{t("Les chiffres clés")}</h2>
      <table className="tableau">
        <tbody>{MARCHE.hypotheses.map((h) => <tr key={h.label}><td>{t(h.label)}</td><td>{t(h.valeur)}</td></tr>)}</tbody>
      </table>
      <p style={{ marginTop: 24 }}><Link href="/" className="btn" style={{ textDecoration: "none", display: "inline-flex" }}>{t("Essayer l'agent")}</Link></p>
    </div>
  );
}
