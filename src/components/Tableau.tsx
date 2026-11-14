"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { PROFILS, SITE, type ProfilId } from "@/config/site";
import { caAtteignable, exporterCsv, exporterPdf, envoyerAvecPdf, decouperMail } from "@/lib/dossier";
import type { Concurrent, Etape, Evenement, Kpi, Lead } from "@/lib/types";
import { FORMATS, fDate, fDec, fEuros, fHeure, fPourcent } from "@/lib/format";
import { useLang } from "./Langue";
import { t } from "@/lib/i18n";
import Compteur from "./Compteur";
import Chat from "./Chat";
import { scene, type Focus } from "@/lib/scene-bus";

const Carte = dynamic(() => import("./Carte"), { ssr: false, loading: () => <div className="carte-zone" /> });

type Etat = {
  etapes: Etape[]; cible?: Extract<Evenement, { t: "cible" }>; kpis?: Kpi[]; leads?: Lead[]; leadsTitre?: string;
  concurrents?: Concurrent[]; concTitre?: string; parlement?: { titre: string; sousTitre: string; lien?: string }[];
  carte?: Extract<Evenement, { t: "carte" }>; synthese?: { texte: string; mail?: string; destinataire?: string }; fin?: Extract<Evenement, { t: "fin" }>; erreur?: string;
};

function lienGmail(mail: string, a?: string) {
  const { sujet, corps } = decouperMail(mail);
  return `https://mail.google.com/mail/?view=cm&fs=1${a ? `&to=${encodeURIComponent(a)}` : ""}&su=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`;
}

type Volet = "accueil" | "recherche" | "profils" | "resultats";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SOURCES = [
  { b: "Achats publics annoncés", s: "APProch — avant l'appel d'offres, jusqu'en 2032" },
  { b: "Marchés attribués", s: "DECP — titulaire, montant, durée, offres reçues" },
  { b: "Registre Sirene", s: "Insee — entreprises, établissements, dirigeants" },
  { b: "Finances et subventions locales", s: "OFGL, DGCL — DETR, DSIL, comptes des communes" },
  { b: "Parlement", s: "Assemblée nationale — amendements en cours" },
];

export default function Tableau() {
  const lang = useLang();
  const [profil, setProfil] = useState<ProfilId>("entreprise");
  const [q, setQ] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [filtre, setFiltre] = useState<"tous" | Lead["type"]>("tous");
  const [nbLeads, setNbLeads] = useState(8);
  const source = useRef<EventSource | null>(null);
  const [copie, setCopie] = useState(false);
  const P = PROFILS[profil];
  const [volet, setVolet] = useState<Volet>("accueil");
  const [leadChoisi, setLeadChoisi] = useState<string | null>(null);
  const [etroit, setEtroit] = useState(false);

  useEffect(() => {
    const m = matchMedia("(max-width: 820px)"); const f = () => setEtroit(m.matches); f();
    m.addEventListener("change", f); return () => m.removeEventListener("change", f);
  }, []);
  // La scène suit l'interface : caméra, décalage du cadre, lumières.
  useEffect(() => {
    const focus: Focus = volet === "recherche" ? "lanterne" : volet === "profils" ? "arbre" : volet === "resultats" ? "pont" : "overview";
    const grand = volet === "resultats";
    scene.regler({ focus, decaleX: etroit ? 0 : grand ? 0.5 : volet === "accueil" ? 0 : -0.3, decaleY: etroit ? (grand ? 0.62 : volet === "accueil" ? 0 : 0.5) : 0 });
  }, [volet, etroit]);
  useEffect(() => {
    const top = [...(etat?.leads || [])].sort((x, y) => y.score - x.score).slice(0, 48).map((l, i) => ({ id: l.id, score: l.score, titre: l.titre, rang: i < 3 ? i + 1 : undefined, etiquette: i < 3 ? (l.montant > 0 ? l.montantLibelle : fDate(l.date)) : undefined }));
    scene.regler({ phase: enCours ? "running" : etat ? "done" : "idle", leads: top });
  }, [etat?.leads, enCours, etat]);
  useEffect(() => {
    const a = scene.ecouterRepere((r) => setVolet(r === "lanterne" ? "recherche" : r === "arbre" ? "profils" : "resultats"));
    const b = scene.ecouterLead((id) => { setLeadChoisi(id); setVolet("resultats"); });
    return () => { a(); b(); };
  }, []);

  useEffect(() => {
    const u = new URLSearchParams(window.location.search);
    const p = u.get("profil") as ProfilId | null; const v = u.get("q");
    if (p && p in PROFILS) setProfil(p);
    const vue = u.get("vue"); if (vue === "lanterne") setVolet("recherche"); else if (vue === "arbre") setVolet("profils"); else if (vue === "pont") setVolet("resultats");
    if (v) lancer(v, p && p in PROFILS ? p : "entreprise");
    window.history.replaceState(null, "", window.location.pathname);
    return () => source.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changement de langue : l'analyse affichée est relancée pour que les textes de l'agent suivent.
  const langVue = useRef(lang);
  useEffect(() => {
    if (langVue.current === lang) return;
    langVue.current = lang;
    if (etat && q.trim()) lancer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function partager() {
    const url = `${window.location.origin}/?profil=${profil}&q=${encodeURIComponent(q)}`;
    if (navigator.share) navigator.share({ title: `Avant-Première — ${q}`, url }).catch(() => {});
    else navigator.clipboard?.writeText(url).then(() => { setCopie(true); setTimeout(() => setCopie(false), 2000); });
  }

  function lancer(requete = q, p = profil) {
    const v = requete.trim(); if (!v) return;
    source.current?.close();
    setQ(v); setEnCours(true); setFiltre("tous"); setNbLeads(8);
    setEtat({ etapes: [] }); setVolet("resultats"); setLeadChoisi(null);
    const es = new EventSource(`/api/analyse?profil=${p}&lang=${lang}&q=${encodeURIComponent(v)}`);
    source.current = es;
    es.onmessage = (m) => {
      const e = JSON.parse(m.data) as Evenement;
      setEtat((s) => {
        const n: Etat = { ...(s || { etapes: [] }) };
        switch (e.t) {
          case "etape": { const i = n.etapes.findIndex((x) => x.id === e.etape.id); n.etapes = i >= 0 ? n.etapes.map((x, j) => (j === i ? e.etape : x)) : [...n.etapes, e.etape]; break; }
          case "cible": n.cible = e; break;
          case "kpis": n.kpis = e.kpis; break;
          case "leads": n.leads = e.leads; n.leadsTitre = e.titre; break;
          case "concurrents": n.concurrents = e.concurrents; n.concTitre = e.titre; break;
          case "parlement": n.parlement = e.items; break;
          case "carte": n.carte = { ...(n.carte || {}), ...e, valeurs: Object.keys(e.valeurs).length || !n.carte ? e.valeurs : n.carte.valeurs } as any; break;
          case "synthese": n.synthese = { texte: e.texte, mail: e.mail, destinataire: e.destinataire }; break;
          case "erreur": n.erreur = e.message; break;
          case "fin": n.fin = e; break;
        }
        return n;
      });
      if (e.t === "fin") { es.close(); setEnCours(false); }
    };
    es.onerror = () => { es.close(); setEnCours(false); };
  }

  const changerProfil = (p: ProfilId) => { setProfil(p); setQ(""); if (!enCours && etat) { setEtat(null); window.history.replaceState(null, "", "/"); } };
  const leads = useMemo(() => (etat?.leads || []).filter((l) => filtre === "tous" || l.type === filtre), [etat?.leads, filtre]);
  const types = useMemo(() => [...new Set((etat?.leads || []).map((l) => l.type))], [etat?.leads]);
  const creditsLive = (etat?.etapes || []).reduce((s, e) => s + (e.credits || 0), 0);
  const formatCarte = profil === "etat" ? fPourcent : fEuros;

  const formulaire = (
    <form className="recherche" role="search" onSubmit={(e) => { e.preventDefault(); lancer(); }}>
      <label htmlFor="q" className="sr">{t(P.question)}</label>
      <input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(P.placeholder)} autoComplete="off" enterKeyHint="search" />
      <button className="btn" type="submit" disabled={enCours || !q.trim()}>{enCours ? t("Analyse…") : t("Lancer l'agent")}</button>
    </form>
  );
  const selecteur = (
    <div className="profils" role="group" aria-label={t("À qui s'adresse l'analyse")}>
      {(Object.keys(PROFILS) as ProfilId[]).map((p) => (
        <button key={p} type="button" aria-pressed={profil === p} onClick={() => changerProfil(p)}>{t(PROFILS[p].libelle)}</button>
      ))}
    </div>
  );
  const exemples = (
    <div className="exemples"><span>{t("Essayer :")}</span>
      {P.exemples.map((x) => <button key={x} type="button" onClick={() => lancer(x)}>{x}</button>)}
    </div>
  );

  const podium = useMemo(() => [...(etat?.leads || [])].sort((x, y) => y.score - x.score).slice(0, 3), [etat?.leads]);
  const choisi = leadChoisi ? etat?.leads?.find((l) => l.id === leadChoisi) : undefined;
  const fermer = <button type="button" className="fermer" onClick={() => setVolet("accueil")} aria-label={t("Fermer et revenir à la vue d'ensemble")}>{t("Vue d'ensemble")}</button>;

  return (
    <div className="scene-app" data-volet={volet}>
      {volet === "accueil" && (
        <section className="intro">
          <div className="intro-actions">
            <button type="button" className="btn" onClick={() => setVolet("recherche")}>{t("Allumer la lanterne")}</button>
            {etat && <button type="button" className="btn btn-fantome" onClick={() => setVolet("resultats")}>{t("Revoir les résultats")}</button>}
          </div>
          <p className="astuce">{t("Cliquez sur la lanterne, l'arbre, le pont ou le moulin.")}</p>
        </section>
      )}

      {volet === "recherche" && (
        <section className="volet petit" aria-label={t("Recherche")}>
          <div className="volet-tete"><div><small>{t("La lanterne")}</small><h2>{t("Que voulez-vous éclairer ?")}</h2></div>{fermer}</div>
          {selecteur}
          <p className="promesse">{t(P.promesse)}</p>
          {formulaire}
          {exemples}
        </section>
      )}

      {volet === "profils" && (
        <div className="profils-mini" role="group" aria-label={t("Choisir un profil")}>
          {(Object.keys(PROFILS) as ProfilId[]).map((p) => (
            <button key={p} type="button" aria-pressed={profil === p} onClick={() => { changerProfil(p); setVolet("recherche"); }}>{t(PROFILS[p].libelle)}</button>
          ))}
        </div>
      )}

      {volet === "resultats" && (
        <section className="volet grand" aria-label={t("Résultats de l'analyse")}>
          <div className="volet-tete">
            <div><small>{t("Le pont")}</small><h2>{!etat ? t("Aucune analyse pour l'instant") : enCours ? t("Les lanternes cherchent…") : `${etat.leads?.length ?? 0} ${t("opportunités éclairées")}`}</h2></div>
            <span className="etat-live">{etat && <><span className="pastille-live" aria-hidden="true" />{enCours ? t("en direct") : t("terminé")}</>}</span>
            {fermer}
          </div>
          <div className="barre-recherche-dash">{selecteur}{formulaire}</div>
          {!etat ? <>{exemples}<p className="vide">{t("Lancez une analyse : chaque opportunité trouvée allumera une lumière au-dessus du village.")}</p></> : (<>
            {podium.length > 0 && (
              <ol className="podium" aria-label={t("Les trois meilleures opportunités")}>
                {podium.map((l, i) => (
                  <li key={l.id}>
                    <button type="button" aria-pressed={leadChoisi === l.id} onClick={() => setLeadChoisi(l.id)}>
                      <span className="rang">{i + 1}</span>
                      <strong>{l.montant > 0 ? l.montantLibelle : fDate(l.date)}</strong>
                      <span className="qui">{l.acheteur}</span>
                      <span className="quoi">{nettoyerTitre(l.titre)}</span>
                      <span className="bas"><span>{fDate(l.date)}</span><span>score {l.score}</span></span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {etat.fin && etat.leads && etat.leads.length > 0 && (
              <div className="actions-mini">
                {profil === "entreprise" && <span className="ca" title={t("Marchés à votre taille à moins de 12 mois, en montant annuel pondéré par le score, plafonné à 30 % de votre chiffre d'affaires")}>≈ <b>{fEuros(caAtteignable(etat.leads, etat.cible?.ca))}</b> {t("atteignables sur 12 mois")}</span>}
                <button type="button" onClick={() => exporterPdf({ cible: etat.cible, kpis: etat.kpis, leads: etat.leads!, concurrents: etat.concurrents, textes: etat.parlement, synthese: etat.synthese?.texte, mail: etat.synthese?.mail, destinataire: etat.synthese?.destinataire })}>{t("Dossier PDF")}</button>
                <button type="button" onClick={() => exporterCsv(etat.leads!, etat.cible?.titre || profil)}>Excel</button>
                {etat.synthese?.mail && <button type="button" title={t("Le mail avec le dossier PDF en pièce jointe")} onClick={() => envoyerAvecPdf({ cible: etat.cible, kpis: etat.kpis, leads: etat.leads!, concurrents: etat.concurrents, textes: etat.parlement, synthese: etat.synthese?.texte, mail: etat.synthese?.mail, destinataire: etat.synthese?.destinataire })}>{t("Mail + PDF")}</button>}
                {etat.synthese?.mail && <a href={lienGmail(etat.synthese.mail, etat.synthese.destinataire)} target="_blank" rel="noreferrer" title={etat.synthese.destinataire ? `${t("À :")} ${etat.synthese.destinataire}` : t("Destinataire à compléter")}>Gmail</a>}
              </div>
            )}
            {choisi && (
              <div className="lead-choisi" role="status">
                <div className="volet-tete"><div><small>{t("Lumière sélectionnée")} · score {choisi.score}/100</small><h3>{nettoyerTitre(choisi.titre)}</h3></div><button type="button" className="fermer" onClick={() => setLeadChoisi(null)}>{t("Fermer")}</button></div>
                <div className="acheteur">{choisi.acheteur}</div>
                <div className="etiquettes"><span className={`etiquette ${choisi.type}`}>{t(choisi.type === "annonce" ? "Annoncé avant appel d'offres" : choisi.type === "renouvellement" ? "Renouvellement prédit" : "Projet subventionné")}</span><span className="etiquette">{choisi.montantLibelle}</span><span className="etiquette">{fDate(choisi.date)}</span></div>
                <ul className="raisons">{choisi.raisons.map((r) => <li key={r}>{r}</li>)}{choisi.lien && <li><a href={choisi.lien} target="_blank" rel="noreferrer">{t("Voir la consultation")}</a></li>}</ul>
              </div>
            )}
      <div className="dash">
        <aside className="colonne-agent panneau" aria-label={t("Journal de l'agent")}>
          <div className="panneau-tete">
            <h2>{t("Agent prospecteur")} {enCours && <span className="sr">{t("en cours")}</span>}</h2>
            <div className="compteurs" aria-live="polite"><span><b>{etat.etapes.filter((e) => e.statut === "ok").length}</b> {t("étapes")}</span><span><b>{creditsLive}</b> {t("crédits")}</span></div>
          </div>
          <ol className="flux" aria-live="polite">
            {etat.etapes.map((e) => (
              <li key={e.id}>
                <span className={`icone-etat ${e.statut}`} aria-label={t(e.statut === "run" ? "en cours" : e.statut === "ok" ? "terminé" : "erreur")}>
                  {e.statut === "ok" && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>}
                  {e.statut === "err" && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>}
                </span>
                <div>
                  <div className="label">{e.label}</div>
                  {e.detail && <div className="detail">{e.detail}</div>}
                  {e.statut !== "run" && (
                    <div className="meta">
                      {e.outil && <span>{e.outil}</span>}
                      {e.ms != null && <span>{fDec(e.ms / 1000)} s</span>}
                      {!!e.credits && <span>{e.credits} cr.</span>}
                      {e.lu_le && <span>{t("lu à")} {fHeure(e.lu_le)}</span>}
                      {e.source && <span>{e.source}</span>}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {etat.fin && <div className="panneau-corps" style={{ borderTop: "1px solid var(--ligne)", fontSize: 13, color: "var(--encre-2)" }}>
            {t("Terminé en")} <b className="mono">{fDec(etat.fin.ms / 1000)} s</b> — {etat.fin.appels} {t("appels live")}, {etat.fin.credits} {t("crédits Hémicycle")}.
          </div>}
        </aside>

        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          {etat.erreur && <div className="erreur" role="alert">{etat.erreur}</div>}
          <Carte valeurs={etat.carte?.valeurs || {}} legende={etat.carte?.legende || ""} focus={etat.carte?.focus} focusDept={etat.carte?.focusDept} points={etat.carte?.points} format={formatCarte} titre={etat.cible ? etat.cible.titre : t("Recherche en cours…")} />

          {etat.kpis ? (
            <div className="kpis">
              {etat.kpis.map((k, i) => (
                <div className="kpi" key={k.label} style={{ animationDelay: `${i * 80}ms` }}>
                  <div className="v"><Compteur valeur={k.valeur} format={FORMATS[k.format]} /></div>
                  <div className="l">{k.label}</div>
                  {k.aide && <div className="a">{k.aide}</div>}
                </div>
              ))}
            </div>
          ) : enCours && <div className="kpis">{[0, 1, 2, 3].map((i) => <div className="kpi" key={i}><div className="squelette" style={{ height: 30 }} /><div className="squelette" /></div>)}</div>}

          {etat.cible && (
            <section className="panneau panneau-corps cible" aria-label={t("Fiche")}>
              <div><h2>{etat.cible.titre}</h2><p className="sous">{etat.cible.sousTitre}</p></div>
              <dl>{etat.cible.details.map((d) => <div key={d.label}><dt>{d.label}</dt><dd>{d.valeur}</dd></div>)}</dl>
            </section>
          )}

          {etat.synthese && (
            <section className="panneau" aria-label={t("Synthèse de l'agent")}>
              <div className="panneau-tete"><h3>{t("Synthèse de l'agent")}</h3><span className="etiquette">{t("IA · données citées")}</span></div>
              <div className="panneau-corps">
                <p className="synthese">{etat.synthese.texte}</p>
              </div>
            </section>
          )}

          <div className="grille-2">
            <section className="panneau" aria-label={etat.leadsTitre || t("Opportunités")}>
              <div className="panneau-tete" style={{ flexWrap: "wrap" }}>
                <h3>{etat.leadsTitre || t("Opportunités")} {etat.leads && <span className="mono" style={{ color: "var(--encre-3)" }}>({etat.leads.length})</span>}</h3>
                {types.length > 1 && <div className="filtres" role="group" aria-label={t("Filtrer")}>
                  {(["tous", ...types] as const).map((ty) => <button key={ty} type="button" aria-pressed={filtre === ty} onClick={() => setFiltre(ty)}>{t(ty === "tous" ? "Tous" : ty === "annonce" ? "Annoncés" : ty === "renouvellement" ? "À renouveler" : "Subventions")}</button>)}
                </div>}
              </div>
              {leads.length > 0 && profil !== "etat" && <Frise leads={leads} />}
              {!etat.leads && enCours ? <div className="panneau-corps">{[0, 1, 2].map((i) => <div key={i} className="squelette" style={{ height: 40 }} />)}</div>
                : leads.length === 0 ? <p className="vide">{t("Aucune opportunité trouvée pour cette recherche.")}</p>
                : <>
                  <ul className="leads">{leads.slice(0, nbLeads).map((l, i) => <LigneLead key={l.id} l={l} i={i} profil={profil} />)}</ul>
                  {leads.length > nbLeads && <div className="panneau-corps" style={{ borderTop: "1px solid var(--ligne)" }}><button type="button" className="btn btn-fantome" onClick={() => setNbLeads(nbLeads + 12)}>{t("Voir plus")} ({leads.length - nbLeads} {t("restantes")})</button></div>}
                </>}
            </section>

            <div style={{ display: "grid", gap: 16 }}>
              <section className="panneau" aria-label={etat.concTitre || t("Concurrents")}>
                <div className="panneau-tete"><h3>{etat.concTitre || t("Concurrents")}</h3></div>
                <div className="panneau-corps">
                  {!etat.concurrents ? <div className="squelette" /> : etat.concurrents.length === 0 ? <p className="vide">{t("Pas de titulaire identifié.")}</p> : (
                    <ul className="barres">
                      {etat.concurrents.map((c) => (
                        <li key={c.siret}>
                          <div className="nom"><span>{c.nom}{c.vous ? ` ${t("(vous)")}` : ""}</span><span>{fEuros(c.montant)}</span></div>
                          <div className="barre"><i style={{ width: `${(c.montant / etat.concurrents![0].montant) * 100}%`, background: c.vous ? "var(--bleu)" : undefined }} /></div>
                          <div className="sub">{c.marches} {t("marché(s)")} · {c.offresMoy ? `${fDec(c.offresMoy)} ${t("offres en moyenne face à lui")}` : t("offres non communiquées")}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
              {etat.parlement && etat.parlement.length > 0 && (
                <section className="panneau" aria-label={t("Au Parlement")}>
                  <div className="panneau-tete"><h3>{t("Au Parlement : commande publique")}</h3></div>
                  <ul className="parl panneau-corps">{etat.parlement.map((p, i) => <li key={i}><b>{p.titre}</b><span>{p.sousTitre}…</span></li>)}</ul>
                </section>
              )}
            </div>
          </div>
          {etat.fin && (
            <div className="bandeau-fin" aria-live="polite">
              <span>{t("Analyse terminée en")} <b>{fDec(etat.fin.ms / 1000)} s</b></span>
              <span><b>{etat.fin.appels}</b> {t("appels aux sources officielles")}</span>
              <span><b>{etat.fin.credits}</b> {t("crédits Hémicycle")}</span>
              <span>{t("Aucune donnée en cache : tout a été lu maintenant.")}</span>
              <button type="button" className="btn btn-fantome" onClick={partager}>{copie ? t("Lien copié") : t("Partager l'analyse")}</button>
            </div>
          )}
        </div>
      </div>

          </>)}
        </section>
      )}
      <Chat />
    </div>
  );
}

function LigneLead({ l, i, profil }: { l: Lead; i: number; profil: ProfilId }) {
  const [ouvert, setOuvert] = useState(false);
  const couleur = l.score >= 75 ? "rgba(74,222,128,.2)" : l.score >= 55 ? "rgba(255,190,121,.22)" : "rgba(255,255,255,.08)";
  const libType = t(l.type === "annonce" ? "Annoncé avant appel d'offres" : l.type === "renouvellement" ? (profil === "etat" ? "Concurrence faible" : "Renouvellement prédit") : "Projet subventionné");
  return (
    <li className="lead" style={{ animationDelay: `${Math.min(i, 10) * 45}ms` }}>
      <div className="jauge" style={{ background: couleur }} aria-label={`Score ${l.score} ${t("sur")} 100`}><div>{l.score}<small>/100</small></div></div>
      <button className="ouvrir" type="button" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
        <h4>{nettoyerTitre(l.titre)}</h4>
        <div className="acheteur">{l.acheteur}</div>
        <div className="etiquettes">
          <span className={`etiquette ${l.type}`}>{libType}</span>
          <span className="etiquette">{l.montantLibelle}</span>
          {l.horsTaille && <span className="etiquette hors-taille">{t("Trop gros pour votre taille")}</span>}
          {profil !== "etat" && l.type !== "subvention" && <span className="etiquette">{t(l.type === "annonce" ? "Publication" : "Relance estimée")} : {fDate(l.date)}</span>}
          {l.depts.length > 0 && <span className="etiquette">{l.depts.length > 3 ? `${l.depts.length} ${t("départements")}` : `${t("Dép.")} ${l.depts.join(", ")}`}</span>}
        </div>
        {ouvert && <ul className="raisons">{l.raisons.map((r) => <li key={r}>{r}</li>)}{l.lien && <li><a href={l.lien} target="_blank" rel="noreferrer">{t("Voir la consultation")}</a></li>}</ul>}
      </button>
    </li>
  );
}

function Frise({ leads }: { leads: Lead[] }) {
  const pts = leads.filter((l) => l.type !== "subvention").map((l) => ({ l, t: new Date(l.date).getTime() })).filter((x) => !isNaN(x.t));
  if (pts.length < 2) return null;
  const a0 = new Date().getFullYear(); const a1 = Math.max(a0 + 2, ...pts.map((p) => new Date(p.t).getFullYear())) + 1;
  const t0 = new Date(a0, 0, 1).getTime(); const t1 = new Date(a1, 0, 1).getTime();
  const pos = (t: number) => `${Math.max(1, Math.min(99, ((t - t0) / (t1 - t0)) * 100))}%`;
  return (
    <div className="panneau-corps" style={{ paddingBottom: 4 }} aria-hidden="true">
      <div style={{ fontSize: 12, color: "var(--encre-3)" }}>{t("Calendrier :")} <span style={{ color: "var(--bleu)" }}>● {t("annoncés")}</span> · <span style={{ color: "var(--ambre)" }}>■ {t("renouvellements prédits")}</span></div>
      <div className="frise">
        <div className="axe" />
        {Array.from({ length: a1 - a0 + 1 }, (_, k) => a0 + k).map((a) => <span key={a} className="an" style={{ left: pos(new Date(a, 0, 1).getTime()) }}>{a}</span>)}
        {pts.slice(0, 40).map(({ l, t }) => <span key={l.id} className={`pt ${l.type}`} style={{ left: pos(t) }} title={`${l.titre} — ${fDate(l.date)}`} />)}
      </div>
    </div>
  );
}

function nettoyerTitre(t: string) {
  return t.replace(/^PROG[_ ]?\d{4}\s*[–-]\s*/i, "").replace(/_ID_[A-Z0-9]+$/i, "").replace(/_/g, " ").replace(/\s{2,}/g, " ").trim();
}
