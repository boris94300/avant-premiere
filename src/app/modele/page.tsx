import Link from "next/link";
import { MARCHE } from "@/config/site";
import Offres from "@/components/Offres";

export const metadata = { title: "Modèle économique — Avant-Première" };

export default function Modele() {
  return (
    <div className="wrap">
      <h1 className="page-titre">Modèle économique</h1>
      <p style={{ color: "var(--encre-2)", maxWidth: "65ch", fontSize: 18 }}>
        {MARCHE.commandePubliqueMdEUR} Md€ de commande publique par an en France. Les outils de veille actuels montrent les appels d'offres une fois publiés ;
        Avant-Première montre ceux de 2027 à 2032, avant tout le monde, et calcule les chances de gain.
      </p>
      <Offres />
      <h2 style={{ fontSize: 22, marginTop: 40 }}>Les chiffres clés</h2>
      <table className="tableau">
        <tbody>{MARCHE.hypotheses.map((h) => <tr key={h.label}><td>{h.label}</td><td>{h.valeur}</td></tr>)}</tbody>
      </table>
      <p style={{ marginTop: 24 }}><Link href="/" className="btn" style={{ textDecoration: "none", display: "inline-flex" }}>Essayer l'agent</Link></p>
    </div>
  );
}
