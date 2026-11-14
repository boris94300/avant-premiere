"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { OFFRES } from "@/config/site";
import { useLang } from "./Langue";
import { langue, locale, t } from "@/lib/i18n";

type Offre = (typeof OFFRES)[number];
const TEXTE = {
  bouton: "Choisir",
  refus: "Votre carte a été refusée. Aucun montant n'a été débité.",
  demo: "Démonstration : aucun paiement réel, les données de carte ne quittent pas votre navigateur.",
};

export default function Offres() {
  useLang();
  const [choix, setChoix] = useState<Offre | null>(null);
  const en = langue() === "en";
  return (
    <>
      <div className="offres">
        {OFFRES.map((o) => (
          <button type="button" key={o.nom} className={`offre offre-btn${"phare" in o && o.phare ? " phare" : ""}`} onClick={() => setChoix(o)}>
            {"phare" in o && o.phare && <span className="etiquette annonce" style={{ alignSelf: "flex-start" }}>{t("Le plus choisi")}</span>}
            <span className="offre-nom">{t(o.nom)}</span>
            <span className="offre-cible">{t(o.cible)}</span>
            <span className="prix">{en ? `€${o.prix}` : `${o.prix} €`}<small> {t("HT / mois")}</small></span>
            <ul>{o.inclus.map((x) => <li key={x}>{t(x)}</li>)}</ul>
            <span className="offre-cta">{t(TEXTE.bouton)} {t(o.nom)}</span>
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
  useLang();
  const en = langue() === "en";
  const prix = (n: number, d = 2) => { const v = n.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }); return en ? `€${v}` : `${v} €`; };
  const ttc = prix(offre.prix * 1.2);

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
    if (!/^\S+@\S+\.\S+$/.test(v.email)) e.email = t("Adresse e-mail invalide.");
    if (v.carte.replace(/\s/g, "").length < 15) e.carte = t("Numéro de carte incomplet.");
    const [mm, aa] = v.exp.split(" / ").map(Number);
    if (!mm || mm > 12 || !aa) e.exp = t("Date invalide.");
    if (v.cvc.length < 3) e.cvc = t("Code incomplet.");
    if (!v.nom.trim()) e.nom = t("Nom requis.");
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
      <div className="paiement" role="dialog" aria-modal="true" aria-label={`${t("Paiement de l'offre")} ${t(offre.nom)}`} ref={boite}>
        <aside className="paiement-resume">
          <button type="button" className="paiement-retour" onClick={fermer}>← Avant-Première</button>
          <p className="paiement-quoi">{t("S'abonner à")} {t(offre.nom)}</p>
          <p className="paiement-prix">{prix(offre.prix, 0)}<small> {t("HT par mois")}</small></p>
          <dl>
            <div><dt>{t("Offre")} {t(offre.nom)}</dt><dd>{prix(offre.prix)}</dd></div>
            <div><dt>{t("TVA (20 %)")}</dt><dd>{prix(offre.prix * 0.2)}</dd></div>
            <div className="total"><dt>{t("Total dû aujourd'hui")}</dt><dd>{ttc}</dd></div>
          </dl>
          <p className="paiement-demo">{t(TEXTE.demo)}</p>
        </aside>
        <form className="paiement-form" onSubmit={payer} noValidate>
          <h2>{t("Payer par carte")}</h2>
          {champ("email", t("E-mail"), { type: "email", autoComplete: "email", placeholder: t("vous@entreprise.fr") })}
          <fieldset className="carte-groupe">
            <legend>{t("Informations de carte")}</legend>
            {champ("carte", t("Numéro de carte"), { inputMode: "numeric", autoComplete: "cc-number", placeholder: "1234 1234 1234 1234" })}
            <div className="deux">
              {champ("exp", t("Expiration"), { inputMode: "numeric", autoComplete: "cc-exp", placeholder: t("MM / AA") })}
              {champ("cvc", "CVC", { inputMode: "numeric", autoComplete: "cc-csc", placeholder: "CVC" })}
            </div>
          </fieldset>
          {champ("nom", t("Nom du titulaire"), { autoComplete: "cc-name", placeholder: t("Nom complet") })}
          {etat === "refus" && <p className="paiement-refus" role="alert">{t(TEXTE.refus)}</p>}
          <button type="submit" className="paiement-payer" disabled={etat === "envoi"}>
            {etat === "envoi" ? <><span className="tourne" aria-hidden="true" />{t("Traitement…")}</> : etat === "refus" ? t("Réessayer") : `${t("S'abonner")} · ${ttc}`}
          </button>
          <p className="paiement-mention">{t("Sans engagement, résiliable à tout moment.")}</p>
        </form>
      </div>
    </div>
  , document.body);
}
