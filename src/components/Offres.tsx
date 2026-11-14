"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OFFRES } from "@/config/site";

type Offre = (typeof OFFRES)[number];
const TEXTE = {
  bouton: "Choisir",
  refus: "Votre carte a été refusée. Aucun montant n'a été débité.",
  demo: "Démonstration : aucun paiement réel, les données de carte ne quittent pas votre navigateur.",
};

export default function Offres() {
  const [choix, setChoix] = useState<Offre | null>(null);
  return (
    <>
      <div className="offres">
        {OFFRES.map((o) => (
          <button type="button" key={o.nom} className={`offre offre-btn${"phare" in o && o.phare ? " phare" : ""}`} onClick={() => setChoix(o)}>
            {"phare" in o && o.phare && <span className="etiquette annonce" style={{ alignSelf: "flex-start" }}>Le plus choisi</span>}
            <span className="offre-nom">{o.nom}</span>
            <span className="offre-cible">{o.cible}</span>
            <span className="prix">{o.prix} €<small> HT / mois</small></span>
            <ul>{o.inclus.map((x) => <li key={x}>{x}</li>)}</ul>
            <span className="offre-cta">{TEXTE.bouton} {o.nom}</span>
          </button>
        ))}
      </div>
      {choix && <Paiement offre={choix} fermer={() => setChoix(null)} />}
    </>
  );
}

function Paiement({ offre, fermer }: { offre: Offre; fermer: () => void }) {
  const [v, setV] = useState({ email: "", carte: "", exp: "", cvc: "", nom: "" });
  const [etat, setEtat] = useState<"saisie" | "envoi" | "refus">("saisie");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const boite = useRef<HTMLDivElement>(null);
  const ttc = (offre.prix * 1.2).toLocaleString("fr-FR", { minimumFractionDigits: 2 });

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") fermer(); };
    window.addEventListener("keydown", k);
    boite.current?.querySelector("input")?.focus();
    return () => window.removeEventListener("keydown", k);
  }, [fermer]);

  const regler = (cle: keyof typeof v, brut: string) => {
    let x = brut;
    if (cle === "carte") x = brut.replace(/\D/g, "").slice(0, 16).replace(/(.{4})(?=.)/g, "$1 ");
    if (cle === "exp") { const d = brut.replace(/\D/g, "").slice(0, 4); x = d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d; }
    if (cle === "cvc") x = brut.replace(/\D/g, "").slice(0, 4);
    setV((s) => ({ ...s, [cle]: x })); setEtat("saisie");
    setErreurs((e) => ({ ...e, [cle]: "" }));
  };
  const payer = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = "Adresse e-mail invalide.";
    if (v.carte.replace(/\s/g, "").length < 15) e.carte = "Numéro de carte incomplet.";
    const [mm, aa] = v.exp.split(" / ").map(Number);
    if (!mm || mm > 12 || !aa) e.exp = "Date invalide.";
    if (v.cvc.length < 3) e.cvc = "Code incomplet.";
    if (!v.nom.trim()) e.nom = "Nom requis.";
    setErreurs(e);
    if (Object.keys(e).length) return;
    setEtat("envoi");
    setTimeout(() => setEtat("refus"), 1900);
  };
  const champ = (cle: keyof typeof v, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className={`champ${erreurs[cle] ? " faux" : ""}`}>
      <span>{label}</span>
      <input value={v[cle]} onChange={(e) => regler(cle, e.target.value)} aria-invalid={!!erreurs[cle]} disabled={etat === "envoi"} {...props} />
      {erreurs[cle] && <em role="alert">{erreurs[cle]}</em>}
    </label>
  );

  return createPortal(
    <div className="paiement-fond" onClick={(e) => { if (e.target === e.currentTarget) fermer(); }}>
      <div className="paiement" role="dialog" aria-modal="true" aria-label={`Paiement de l'offre ${offre.nom}`} ref={boite}>
        <aside className="paiement-resume">
          <button type="button" className="paiement-retour" onClick={fermer}>← Avant-Première</button>
          <p className="paiement-quoi">S'abonner à {offre.nom}</p>
          <p className="paiement-prix">{offre.prix} €<small> HT par mois</small></p>
          <dl>
            <div><dt>Offre {offre.nom}</dt><dd>{offre.prix},00 €</dd></div>
            <div><dt>TVA (20 %)</dt><dd>{(offre.prix * 0.2).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €</dd></div>
            <div className="total"><dt>Total dû aujourd'hui</dt><dd>{ttc} €</dd></div>
          </dl>
          <p className="paiement-demo">{TEXTE.demo}</p>
        </aside>
        <form className="paiement-form" onSubmit={payer} noValidate>
          <h2>Payer par carte</h2>
          {champ("email", "E-mail", { type: "email", autoComplete: "email", placeholder: "vous@entreprise.fr" })}
          <fieldset className="carte-groupe">
            <legend>Informations de carte</legend>
            {champ("carte", "Numéro de carte", { inputMode: "numeric", autoComplete: "cc-number", placeholder: "1234 1234 1234 1234" })}
            <div className="deux">
              {champ("exp", "Expiration", { inputMode: "numeric", autoComplete: "cc-exp", placeholder: "MM / AA" })}
              {champ("cvc", "CVC", { inputMode: "numeric", autoComplete: "cc-csc", placeholder: "CVC" })}
            </div>
          </fieldset>
          {champ("nom", "Nom du titulaire", { autoComplete: "cc-name", placeholder: "Nom complet" })}
          {etat === "refus" && <p className="paiement-refus" role="alert">{TEXTE.refus}</p>}
          <button type="submit" className="paiement-payer" disabled={etat === "envoi"}>
            {etat === "envoi" ? <><span className="tourne" aria-hidden="true" />Traitement…</> : etat === "refus" ? "Réessayer" : `S'abonner · ${ttc} €`}
          </button>
          <p className="paiement-mention">Sans engagement, résiliable à tout moment.</p>
        </form>
      </div>
    </div>
  , document.body);
}
