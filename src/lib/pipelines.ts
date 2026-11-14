import { Agent, nommer, outil, interroger } from "./agent";
import { chat, extraireJson } from "./llm";
import { NAF_SECTEURS } from "@/config/site";
import { ajouterMois, clamp, deptDepuisCodePostal, deptsListe, euros, mediane, montantTranche, normDept } from "./outils";
import type { Concurrent, Lead } from "./types";

const AUJ = () => new Date().toISOString().slice(0, 10);
/** La recherche plein texte ne gère pas OR : une requête par mot-clé, en parallèle, dédoublonnée. */
async function parMots(jeu: string, mots: string[], requete: Record<string, unknown>, cle: (l: any) => string) {
  const rs = await Promise.all(mots.slice(0, 2).map((m) => interroger(jeu, { ...requete, recherche: m })));
  const vus = new Set<string>();
  const lignes = rs.flatMap((r) => r.data?.lignes || []).filter((l: any) => { const k = cle(l); if (vus.has(k)) return false; vus.add(k); return true; });
  return { res: rs, lignes };
}

type Marche = Record<string, any>;

function statsMarches(lignes: Marche[]) {
  const offres = lignes.map((l) => Number(l.offresrecues)).filter((n) => n > 0);
  const uneOffre = offres.filter((n) => n === 1).length;
  const sansPub = lignes.filter((l) => /sans publicit/i.test(l.procedure || "")).length;
  const montant = lignes.reduce((s, l) => s + (Number(l.montant) || 0), 0);
  return {
    n: lignes.length,
    montant,
    offresMoy: offres.length ? offres.reduce((a, b) => a + b, 0) / offres.length : 0,
    pctUneOffre: offres.length ? (uneOffre / offres.length) * 100 : 0,
    pctSansPub: lignes.length ? (sansPub / lignes.length) * 100 : 0,
    mediane: mediane(lignes.map((l) => Number(l.montant) || 0).filter(Boolean)),
  };
}

function grouperTitulaires(lignes: Marche[]) {
  const m = new Map<string, { marches: number; montant: number; offres: number[] }>();
  for (const l of lignes) {
    const id = String(l.titulaire_id_1 || "");
    if (!/^\d{14}$/.test(id)) continue;
    const g = m.get(id) || { marches: 0, montant: 0, offres: [] };
    g.marches++; g.montant += Number(l.montant) || 0;
    const o = Number(l.offresrecues); if (o > 0) g.offres.push(o);
    m.set(id, g);
  }
  return [...m.entries()].map(([siret, g]) => ({ siret, marches: g.marches, montant: g.montant, offresMoy: g.offres.length ? g.offres.reduce((a, b) => a + b, 0) / g.offres.length : 0 }))
    .sort((a, b) => b.montant - a.montant);
}

function parDept(lignes: Marche[], champ = (l: Marche) => deptDepuisCodePostal(l.lieuexecution_code)) {
  const m: Record<string, Marche[]> = {};
  for (const l of lignes) { const d = champ(l); if (d) (m[d] ||= []).push(l); }
  return m;
}

type Texte = { titre: string; sousTitre: string; lien?: string };
const propre = (t: unknown, n: number) => String(t || "").replace(/<[^>]+>/g, "").replace(/\[\.\.\.\]/g, "…").replace(/\s+/g, " ").trim().slice(0, n);

/** Derniers amendements déposés + textes en vigueur (Légifrance) sur la commande publique du secteur. */
async function parlement(a: Agent, q: string, mot?: string): Promise<Texte[]> {
  const items = await a.etape("parlement", "Je lis les derniers amendements et les textes en vigueur…", async () => {
    const [am, lf] = await Promise.all([
      interroger("amendements", { recherche: q || "commande publique", tri: "date_depot", ordre: "desc", limite: 8, colonnes: ["uid", "numero_long", "date_depot", "signataires_affichable", "article_designation_courte", "expose_sommaire", "sort_en_seance"] }).catch(() => null),
      interroger("legifrance_lois_decrets", { recherche: `marchés publics ${mot || "seuils"}`, limite: 4 }).catch(() => null),
    ]);
    const vus = new Set<string>();
    const amend: Texte[] = ((am?.data?.lignes || []) as any[]).filter((d) => { const k = String(d.expose_sommaire || "").slice(0, 60); if (!k || vus.has(k)) return false; vus.add(k); return true; }).slice(0, 3).map((d) => ({
      titre: [`Amendement ${d.numero_long || ""}`.trim(), d.date_depot && `déposé le ${new Date(d.date_depot).toLocaleDateString("fr-FR")}`, propre(d.signataires_affichable, 40), d.sort_en_seance].filter(Boolean).join(" · "),
      sousTitre: propre(d.expose_sommaire, 420),
    }));
    const lois: Texte[] = ((lf?.data?.lignes || []) as any[]).slice(0, 3).map((d) => ({
      titre: propre(d.titre, 220), sousTitre: propre(d.extraits, 420),
      lien: d.texte_id ? `https://www.legifrance.gouv.fr/jorf/id/${d.texte_id}` : undefined,
    }));
    const items = [...lois, ...amend];
    return { res: [am, lf].filter(Boolean) as any[], detail: `${lois.length} texte(s) en vigueur, ${amend.length} amendement(s) récent(s)`, valeur: items };
  });
  if (items?.length) a.envoyer({ t: "parlement", items });
  return items || [];
}

/** Courriel public d'un acheteur, lu dans l'annuaire officiel de l'administration (service-public.fr). */
async function contactPublic(nom: string): Promise<{ nom: string; courriel: string } | null> {
  const mots = nom.split("—")[0].replace(/\(.*?\)/g, " ").replace(/["'’,]/g, " ").split(/\s+/).filter((m) => m.length > 2 && !/^(des|les|aux|sur|pour|par|commune|ville)$/i.test(m));
  if (!mots.length) return null;
  let l: any = null;
  for (const n of [...new Set([mots.length, 3, 2])].filter((n) => n <= mots.length || n === mots.length)) {
    const url = `https://api-lannuaire.service-public.fr/api/explore/v2.1/catalog/datasets/api-lannuaire-administration/records?where=${encodeURIComponent(`search(nom,"${mots.slice(0, n).join(" ")}") and adresse_courriel is not null`)}&limit=8&select=nom,adresse_courriel`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) }).then((x) => x.json()).catch(() => null);
    const rs: any[] = r?.results || [];
    l = rs.find((x) => /achat/i.test(x.nom)) || rs.find((x) => /^(mairie|secrétariat général|conseil|préfecture)/i.test(x.nom)) || rs[0];
    if (l) break;
  }
  const courriel = String(l?.adresse_courriel || "").split(/[;,\s]+/).find((c) => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c));
  return courriel ? { nom: l.nom, courriel } : null;
}

/* ───────────────────────────── ENTREPRISE ───────────────────────────── */

const EFFECTIFS: Record<string, [number, string]> = {
  "00": [0, "aucun salarié"], "01": [2, "1 à 2 salariés"], "02": [5, "3 à 5 salariés"], "03": [9, "6 à 9 salariés"], "11": [19, "10 à 19 salariés"],
  "12": [49, "20 à 49 salariés"], "21": [99, "50 à 99 salariés"], "22": [199, "100 à 199 salariés"], "31": [249, "200 à 249 salariés"], "32": [499, "250 à 499 salariés"],
  "41": [999, "500 à 999 salariés"], "42": [1999, "1 000 à 1 999 salariés"], "51": [4999, "2 000 à 4 999 salariés"], "52": [9999, "5 000 à 9 999 salariés"], "53": [20000, "10 000 salariés et plus"],
};
const PLAFOND_CATEGORIE: Record<string, number> = { PME: 50e6, ETI: 1.5e9 };
const LABELS: [string, string][] = [["est_rge", "RGE"], ["est_bio", "bio"], ["est_ess", "économie sociale et solidaire"], ["est_siae", "insertion par l'activité économique"], ["est_qualiopi", "Qualiopi"], ["est_societe_mission", "société à mission"], ["est_achats_responsables", "label achats responsables"], ["est_patrimoine_vivant", "entreprise du patrimoine vivant"]];

type Taille = { ca: number; caLibelle: string; estime: boolean; effectifs?: string; labels: string[]; site?: string | null };

/** Taille de l'entreprise lue dans le registre officiel (recherche-entreprises.api.gouv.fr) : comptes publiés, sinon ordre de grandeur d'après les effectifs. */
async function tailleEntreprise(siren: string): Promise<Taille | null> {
  const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}&per_page=1`, { signal: AbortSignal.timeout(6000), cache: "no-store" });
  if (!r.ok) return null;
  const e = (await r.json()).results?.find((x: any) => x.siren === siren);
  if (!e) return null;
  const labels = LABELS.filter(([k]) => e.complements?.[k]).map(([, l]) => l);
  const eff = EFFECTIFS[String(e.tranche_effectif_salarie)];
  const annee = Object.keys(e.finances || {}).sort().pop();
  const caPublie = annee ? Number(e.finances[annee].ca) : 0;
  if (caPublie > 0) return { ca: caPublie, caLibelle: `${euros(caPublie)} (comptes ${annee})`, estime: false, effectifs: eff?.[1], labels };
  // Ordre de grandeur : 100 k€ par salarié, borné par le plafond légal de la catégorie.
  const ca = Math.min(Math.max(150e3, (eff?.[0] ?? 1) * 100e3), PLAFOND_CATEGORIE[e.categorie_entreprise] ?? Infinity);
  return { ca, caLibelle: `environ ${euros(ca)} (estimé d'après les effectifs, comptes non publiés)`, estime: true, effectifs: eff?.[1], labels };
}

/** Site officiel de l'entreprise d'après Wikidata (gratuit, sans clé) : connu surtout pour les grandes entreprises. */
async function siteWeb(siren: string): Promise<string | null> {
  const q = `SELECT ?site WHERE { ?i wdt:P1616 "${siren.replace(/\D/g, "")}" ; wdt:P856 ?site } LIMIT 1`;
  const r = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(q)}`, {
    headers: { Accept: "application/sparql-results+json", "User-Agent": "AvantPremiere/1.0 (https://avant-premiere-nine.vercel.app)" },
    signal: AbortSignal.timeout(5000), cache: "no-store",
  });
  if (!r.ok) return null;
  return (await r.json()).results?.bindings?.[0]?.site?.value || null;
}

const SECTEURS_VUS = new Map<string, { secteur: string; mots: string[] }>();

export async function analyseEntreprise(q: string, a: Agent) {
  const ent = await a.etape("sirene", "Je lis le registre des entreprises (Sirene)…", async () => {
    const r = await outil("chercher_entreprise", { q });
    const liste: any[] = r.data?.entreprises || [];
    if (!liste.length) throw new Error("Aucune entreprise trouvée");
    const qn = q.toUpperCase();
    const actifs = liste.filter((e) => e.etat_administratif === "A");
    const e = (/^\d{9}$/.test(q) ? liste.find((x) => x.siren === q) : null)
      || actifs.filter((x) => String(x.nom).toUpperCase().includes(qn.split(" ")[0])).sort((x, y) => (y.etablissements_ouverts || 0) - (x.etablissements_ouverts || 0))[0]
      || actifs[0] || liste[0];
    return { res: r, detail: `${e.nom} — ${e.etablissements_ouverts ?? "?"} établissements, NAF ${e.activite_principale}`, valeur: e };
  });
  if (!ent) return;

  const naf = String(ent.activite_principale || "");
  const secteur = await a.etape("ia", "L'agent déduit vos marchés publics cibles…", async () => {
    const def = NAF_SECTEURS[naf.slice(0, 2)] || { secteur: "Activité " + naf, mots: [String(ent.nom).split(" ")[0].toLowerCase()] };
    const regle = NAF_SECTEURS[naf.slice(0, 2)] || SECTEURS_VUS.get(ent.siren);
    if (regle) return { detail: `${regle.secteur} → ${regle.mots.slice(0, 2).join(", ")}`, valeur: regle };
    try {
      const m = await chat([
        { role: "system", content: "Tu es expert de la commande publique française. Réponds uniquement en JSON." },
        { role: "user", content: `Entreprise : ${ent.nom}, code NAF ${naf}. Donne {"secteur": "libellé court", "mots": [2 mots-clés d'un seul mot, en minuscules, les plus fréquents dans l'objet des marchés publics qu'elle peut gagner, le premier étant le terme générique du métier (ex. nettoyage, voirie, informatique, restauration, gardiennage)]}` },
      ], { max_tokens: 200, temperature: 0 });
      const j = extraireJson<{ secteur: string; mots: string[] }>(m.content);
      if (j?.mots?.length) { SECTEURS_VUS.set(ent.siren, { secteur: j.secteur, mots: j.mots.slice(0, 2).map((x) => String(x).toLowerCase()) }); return { detail: `${j.secteur} → ${j.mots.join(", ")}`, valeur: { secteur: j.secteur, mots: j.mots.slice(0, 2).map((x) => String(x).toLowerCase()) } }; }
    } catch { /* repli NAF */ }
    return { detail: `${def.secteur} → ${def.mots.join(", ")} (règle NAF)`, valeur: def };
  });
  const mots = secteur!.mots;
  const taille = await a.etape("taille", "Je mesure la taille de l'entreprise (registre officiel, comptes publiés)…", async () => {
    const [t, site] = await Promise.all([tailleEntreprise(ent.siren).catch(() => null), siteWeb(ent.siren).catch(() => null)]);
    return { outil: "Annuaire des entreprises (data.gouv.fr) + Wikidata", detail: [t ? `Chiffre d'affaires : ${t.caLibelle}` : "Taille inconnue : montants non filtrés", site && `site ${site}`].filter(Boolean).join(" · "), valeur: t && { ...t, site } };
  });
  // Règle de prudence : un marché est « à la taille » s'il pèse au plus la moitié du chiffre d'affaires par an.
  const maxAnnuel = taille ? taille.ca / 2 : Infinity;
  const annuelDe = (montant: number, mois?: number) => (mois && mois > 12 ? montant * 12 / mois : montant);
  const tropGros = (annuel: number) => `Trop gros pour votre taille : ${euros(annuel)} par an, pour un chiffre d'affaires de ${euros(taille!.ca)}`;
  const depSiege = normDept(ent.siege?.departement || "");

  a.envoyer({
    t: "cible", titre: ent.nom, sousTitre: secteur!.secteur,
    ca: taille?.ca,
    details: [
      { label: "SIREN", valeur: ent.siren },
      { label: "Catégorie", valeur: ent.categorie || "—" },
      ...(taille ? [{ label: "Chiffre d'affaires", valeur: taille.caLibelle }] : []),
      ...(taille?.effectifs ? [{ label: "Effectifs", valeur: taille.effectifs }] : []),
      ...(taille?.labels.length ? [{ label: "Labels publics", valeur: taille.labels.join(", ") }] : []),
      ...(taille?.site ? [{ label: "Site web (Wikidata)", valeur: taille.site }] : []),
      { label: "Établissements ouverts", valeur: String(ent.etablissements_ouverts ?? "—") },
      { label: "Siège", valeur: ent.siege?.adresse || "—" },
      { label: "Dirigeant", valeur: ent.dirigeants?.[0] ? `${ent.dirigeants[0].prenoms ?? ""} ${ent.dirigeants[0].nom}`.trim() : "—" },
    ],
  });

  const [annonces, marches, textes] = await Promise.all([
    a.etape("achats", "J'interroge les achats publics annoncés avant appel d'offres (APProch)…", async () => {
      const { res: r, lignes: l } = await parMots("projets_achats_publics", mots, {
        filtres: [{ colonne: "date_previsionnelle_de_publication", op: "gte", valeur: AUJ() }],
        tri: "date_previsionnelle_de_publication", ordre: "asc", limite: 100,
      }, (x) => String(x.code));
      return { res: r, detail: `${l.length} projets d'achat à venir trouvés`, valeur: l };
    }),
    a.etape("marches", "Je lis les marchés déjà attribués et calcule leur date de renouvellement…", async () => {
      const { res: r, lignes: l } = await parMots("marches_publics", mots, { limite: 100 }, (x) => `${x.acheteur_id}-${x.id}-${x.titulaire_id_1}`);
      return { res: r, detail: `${l.length} marchés attribués analysés`, valeur: l };
    }),
    parlement(a, "commande publique", mots[0]),
  ]);

  const ann = annonces || [];
  const mar = (marches || []).filter((l) => Number(l.montant) > 0);
  const renouv = mar.filter((l) => Number(l.dureemois) > 0)
    .map((l) => ({ l, fin: ajouterMois(l.datenotification, Number(l.dureemois)) }))
    .filter((x) => x.fin > new Date())
    .map((x) => ({ ...x, annuel: annuelDe(Number(x.l.montant) || 0, Number(x.l.dureemois)) }))
    .sort((x, y) => Number(x.annuel > maxAnnuel) - Number(y.annuel > maxAnnuel) || y.annuel - x.annuel).slice(0, 25);
  const titulaires = grouperTitulaires(mar).slice(0, 8);

  const noms = await a.etape("enrichir", "J'identifie les acheteurs et vos concurrents (Sirene)…", async () => {
    const ids = [
      ...ann.slice(0, 12).map((l) => String(l.siren_de_l_entite_acheteuse).padStart(9, "0")),
      ...renouv.slice(0, 8).map((x) => String(x.l.acheteur_id)),
      ...titulaires.slice(0, 6).map((t) => t.siret),
    ];
    const { noms, res } = await nommer(ids);
    return { res, detail: `${Object.keys(noms).length} organisations identifiées`, valeur: noms };
  }) || {};

  const leads: Lead[] = [];
  for (const l of ann) {
    const montant = montantTranche(l.montant_estime_du_marche);
    const depts = deptsListe(l.departement_s_d_execution_du_marche);
    const mois = (new Date(l.date_previsionnelle_de_publication).getTime() - Date.now()) / (30 * 864e5);
    const raisons = ["Annoncé avant appel d'offres : vous avez le temps de vous positionner"];
    let s = 45 + Math.min(25, montant / 4e4);
    if (depts.includes(depSiege)) { s += 12; raisons.push("Dans le département de votre siège"); }
    if (mois < 12) { s += 8; raisons.push("Publication prévue dans moins d'un an"); }
    if (l.marche_reserve) raisons.push(`Marché réservé : ${l.marche_reserve}`);
    const hors = montant > maxAnnuel;
    if (hors) { s = Math.min(s, 20); raisons.unshift(tropGros(montant)); }
    leads.push({
      id: "a" + l.code, type: "annonce", titre: l.libelle,
      acheteur: noms[String(l.siren_de_l_entite_acheteuse).padStart(9, "0")] || `SIREN ${l.siren_de_l_entite_acheteuse}`,
      depts, date: l.date_previsionnelle_de_publication, montant, annuel: montant, horsTaille: hors,
      montantLibelle: l.montant_estime_du_marche || "Non communiqué", score: Math.round(clamp(s, 5, 97)), raisons,
      lien: l.lien_vers_la_consultation,
    });
  }
  for (const { l, fin, annuel } of renouv) {
    const montant = Number(l.montant) || 0;
    const offres = Number(l.offresrecues) || 0;
    const relance = ajouterMois(fin.toISOString(), -4);
    const raisons = [`Notifié le ${new Date(l.datenotification).toLocaleDateString("fr-FR")} pour ${l.dureemois} mois : fin le ${fin.toLocaleDateString("fr-FR")}`];
    let s = 40 + Math.min(25, montant / 6e4);
    if (offres === 1) { s += 15; raisons.push("Une seule offre reçue la dernière fois : concurrence faible"); }
    else if (offres >= 5) { s -= 10; raisons.push(`${offres} offres reçues : marché disputé`); }
    if (/sans publicit/i.test(l.procedure || "")) { s -= 8; raisons.push("Passé sans publicité : prenez contact en amont"); }
    const dep = deptDepuisCodePostal(l.lieuexecution_code);
    if (dep && dep === depSiege) { s += 10; raisons.push("Dans le département de votre siège"); }
    const hors = annuel > maxAnnuel;
    if (hors) { s = Math.min(s, 20); raisons.unshift(tropGros(annuel)); }
    leads.push({
      id: "r" + l.acheteur_id + l.id, type: "renouvellement", titre: l.objet,
      acheteur: noms[String(l.acheteur_id)] || `SIRET ${l.acheteur_id}`,
      depts: dep ? [dep] : [], date: relance.toISOString().slice(0, 10), montant, annuel, horsTaille: hors,
      montantLibelle: euros(montant) + " (montant actuel)", score: Math.round(clamp(s, 5, 95)), raisons,
    });
  }
  leads.sort((x, y) => y.score - x.score);

  const valeurs: Record<string, number> = {};
  for (const ld of leads) for (const d of ld.depts) valeurs[d] = (valeurs[d] || 0) + ld.montant / Math.max(1, ld.depts.length);

  const totalAnn = leads.filter((l) => l.type === "annonce" && !l.horsTaille).reduce((s, l) => s + l.montant, 0);
  const totalRen = leads.filter((l) => l.type === "renouvellement" && !l.horsTaille).reduce((s, l) => s + l.montant, 0);
  const st = statsMarches(mar);
  a.envoyer({ t: "kpis", kpis: [
    { label: "Opportunités publiques détectées", valeur: totalAnn + totalRen, format: "euros", aide: "Achats annoncés (milieu de fourchette) + marchés à renouveler, à la taille de l'entreprise" },
    { label: "Achats annoncés avant appel d'offres", valeur: leads.filter((l) => l.type === "annonce").length, format: "nombre" },
    { label: "Renouvellements prédits", valeur: leads.filter((l) => l.type === "renouvellement").length, format: "nombre" },
    { label: "Marchés de votre secteur à une seule offre", valeur: st.pctUneOffre, format: "pourcent", aide: "Plus ce taux est haut, plus il y a de place pour un nouvel entrant" },
  ] });
  a.envoyer({ t: "carte", valeurs, legende: "Montant des opportunités par département", focusDept: depSiege || undefined });
  const gros = leads.filter((l) => l.horsTaille).slice(0, 3);
  const affiches = [...leads.filter((l) => !l.horsTaille).slice(0, 30 - gros.length), ...gros];
  a.envoyer({ t: "leads", leads: affiches, titre: "Vos opportunités, triées par chances" });
  const conc: Concurrent[] = titulaires.map((t) => ({ ...t, nom: noms[t.siret] || `SIRET ${t.siret}`, vous: t.siret.startsWith(ent.siren) }));
  a.envoyer({ t: "concurrents", concurrents: conc, titre: "Qui gagne les marchés de votre secteur" });

  const cibleMail = leads[0];
  const contact = cibleMail ? await a.etape("contact", "Je cherche le contact public de l'acheteur (annuaire de l'administration)…", async () => {
    const c = await contactPublic(cibleMail.acheteur).catch(() => null);
    return { outil: "Annuaire service-public.fr", detail: c ? `${c.nom} : ${c.courriel}` : "Aucun courriel public trouvé, destinataire à compléter", valeur: c };
  }) : null;

  await a.etape("synthese", "L'agent rédige votre plan d'attaque et un mail d'approche…", async () => {
    const top = leads.slice(0, 5).map((l) => `- [${l.type}] ${l.titre} | ${l.acheteur} | ${l.date} | ${l.montantLibelle} | score ${l.score} | ${l.raisons.join(" ; ")}`).join("\n");
    const moi = conc.find((c) => c.vous);
    const faits = [
      `${ent.etablissements_ouverts ?? "?"} établissements ouverts`, ent.categorie && `catégorie ${ent.categorie}`, taille && `chiffre d'affaires ${taille.caLibelle}`, taille?.effectifs, taille?.labels.length && `labels publics : ${taille.labels.join(", ")}`, `siège : ${ent.siege?.adresse || "dép. " + depSiege}`,
      moi ? `déjà titulaire de ${moi.marches} marché(s) publics du secteur pour ${euros(moi.montant)}` : "pas encore titulaire parmi les marchés analysés",
    ].filter(Boolean).join(" ; ");
    const lois = (textes || []).map((t, i) => `T${i + 1}. ${t.titre} : ${t.sousTitre.slice(0, 260)}`).join("\n") || "aucun";
    const m = await chat([
      { role: "system", content: `Tu es un directeur commercial expert de la commande publique française. Ton direct, concret, sans emoji, ${a.redaction}. Ne cite que les faits fournis : n'invente ni chiffre, ni référence, ni texte de loi, ni proximité géographique, ni équipe ou référence client qui ne figure pas dans les faits. Si aucun texte fourni ne concerne vraiment le marché, n'en cite aucun.` },
      { role: "user", content: `Date du jour : ${new Date().toLocaleDateString("fr-FR")}. Entreprise : ${ent.nom} (${secteur!.secteur}). Faits publics : ${faits}.\nMarché du secteur : ${st.n} marchés récents, ${st.pctUneOffre.toFixed(0)} % avec une seule offre, médiane ${euros(st.mediane)}.\nTop opportunités :\n${top}\nTextes en vigueur et amendements récents :\n${lois}\n\nRéponds en JSON : {"synthese": "3 phrases : où attaquer en priorité et pourquoi", "mail": "mail à l'acheteur de la première opportunité. Première ligne : '${a.lang === "en" ? "Subject" : "Objet"} : ...'. Puis 150 à 200 mots : une phrase d'accroche sur son marché précis (objet, échéance, montant), 3 points concrets numérotés tirés des faits publics de l'entreprise, puis un paragraphe citant un ou deux des textes fournis seulement s'ils concernent vraiment ce marché, en expliquant ce qu'ils permettent à l'acheteur (procédure plus simple, économie, obligation à anticiper), enfin une proposition de rendez-vous de sourcing. Mentionne le dossier joint. Signature : ${ent.nom}."}${a.lang === "en" ? "\nIMPORTANT : rédige « synthese » ET « mail » entièrement en anglais, y compris l'objet (première ligne : 'Subject: ...'). Seuls l'intitulé exact du marché et les titres de textes de loi restent en français." : ""}` },
    ], { max_tokens: 1100 });
    const j = extraireJson<{ synthese: string; mail: string }>(m.content);
    a.envoyer({ t: "synthese", texte: j?.synthese || m.content || "", mail: j?.mail, destinataire: contact?.courriel, cible: cibleMail?.id });
    return { detail: "Synthèse et mail rédigés", valeur: true };
  });
}

/* ───────────────────────────── COLLECTIVITÉ ───────────────────────────── */

export async function analyseCollectivite(q: string, a: Agent) {
  const com = await a.etape("geo", "Je localise la commune (API Géo de l'État)…", async () => {
    const r = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=code,nom,centre,population,codeDepartement,siren&boost=population&limit=1`);
    const j = await r.json();
    if (!j[0]) throw new Error("Commune introuvable");
    return { detail: `${j[0].nom} (${j[0].codeDepartement}) — ${j[0].population?.toLocaleString("fr-FR")} habitants`, valeur: j[0], outil: "geo.api.gouv.fr" };
  });
  if (!com) return;
  const [lng, lat] = com.centre.coordinates;
  const dep = com.codeDepartement as string;
  a.envoyer({ t: "carte", valeurs: {}, legende: "", focus: { lng, lat, zoom: 11 }, points: [{ lng, lat, label: com.nom }] });

  const cpMin = /^\d{2}$/.test(dep);

  const [achats, voisins, finances, dotations] = await Promise.all([
    a.etape("marches", "Je lis tous les marchés notifiés par la commune…", async () => {
      const r = await interroger("marches_publics", { filtres: [{ colonne: "acheteur_id", op: "like", valeur: com.siren }], limite: 100 });
      const l: any[] = r.data?.lignes || [];
      return { res: r, detail: `${l.length} marchés récents`, valeur: l };
    }),
    cpMin ? a.etape("voisins", `Je compare avec les autres acheteurs du département ${dep}…`, async () => {
      const r = await interroger("marches_publics", { filtres: [{ colonne: "lieuexecution_code", op: "like", valeur: dep + "0" }], limite: 100 });
      const l: any[] = (r.data?.lignes || []).filter((x: any) => String(x.lieuexecution_code).startsWith(dep));
      return { res: r, detail: `${l.length} marchés du département comparés`, valeur: l };
    }) : Promise.resolve(null),
    a.etape("finances", "Je lis les comptes de la commune (OFGL)…", async () => {
      const r = await interroger("comptes_communes", {
        filtres: [
          { colonne: "agregat", op: "in", valeur: ["Encours de dette", "Dépenses totales", "Epargne brute", "Dépenses d'équipement"] },
          { colonne: "exer", op: "eq", valeur: 2024 },
          { colonne: "com_code", op: "eq", valeur: com.code },
        ], colonnes: ["agregat", "montant", "euros_par_habitant"], limite: 10,
      });
      const l: any[] = r.data?.lignes || [];
      return { res: r, detail: `${l.length} agrégats 2024`, valeur: Object.fromEntries(l.map((x) => [x.agregat, x])) as Record<string, any> };
    }),
    a.etape("dotations", "Je cherche les projets subventionnés par l'État (DETR, DSIL)…", async () => {
      const r = await interroger("dotations_investissement_2025", { filtres: [{ colonne: "beneficiaire_code_insee", op: "eq", valeur: com.code }], limite: 20 });
      const l: any[] = r.data?.lignes || [];
      return { res: r, detail: `${l.length} projet(s) subventionné(s) en 2025`, valeur: l };
    }),
  ]);

  const mar = (achats || []).filter((l) => Number(l.montant) > 0);
  const st = statsMarches(mar);
  const sv = statsMarches((voisins || []).filter((l) => Number(l.montant) > 0));
  const titulaires = grouperTitulaires(mar).slice(0, 8);
  const noms = await a.etape("enrichir", "J'identifie les fournisseurs de la commune (Sirene)…", async () => {
    const { noms, res } = await nommer(titulaires.slice(0, 6).map((t) => t.siret));
    return { res, detail: `${Object.keys(noms).length} fournisseurs identifiés`, valeur: noms };
  }) || {};

  const f = finances || {};
  const epargne = f["Epargne brute"]?.montant || 0;
  const dette = f["Encours de dette"]?.montant || 0;
  const capacite = epargne > 0 ? dette / epargne : 0;

  a.envoyer({
    t: "cible", titre: com.nom, sousTitre: `Commune — département ${dep}`,
    details: [
      { label: "Population", valeur: com.population?.toLocaleString("fr-FR") },
      { label: "Code Insee / SIREN", valeur: `${com.code} / ${com.siren}` },
      { label: "Dépenses totales 2024", valeur: f["Dépenses totales"] ? euros(f["Dépenses totales"].montant) : "—" },
      { label: "Dépenses d'équipement 2024", valeur: f["Dépenses d'équipement"] ? `${euros(f["Dépenses d'équipement"].montant)} (${Math.round(f["Dépenses d'équipement"].euros_par_habitant)} €/hab.)` : "—" },
      { label: "Capacité de désendettement", valeur: capacite ? `${capacite.toFixed(1).replace(".", ",")} ans` : "—" },
    ],
  });
  a.envoyer({ t: "kpis", kpis: [
    { label: "Marchés notifiés récemment", valeur: st.montant, format: "euros" },
    { label: "Offres reçues en moyenne", valeur: st.offresMoy, format: "nombre", aide: sv.n ? `Moyenne du département : ${sv.offresMoy.toFixed(1).replace(".", ",")}` : undefined },
    { label: "Marchés avec une seule offre", valeur: st.pctUneOffre, format: "pourcent", aide: sv.n ? `Moyenne du département : ${sv.pctUneOffre.toFixed(0)} %` : undefined },
    { label: "Passés sans publicité", valeur: st.pctSansPub, format: "pourcent", aide: sv.n ? `Moyenne du département : ${sv.pctSansPub.toFixed(0)} %` : undefined },
  ] });

  const leads: Lead[] = (dotations || []).map((d: any, i: number) => ({
    id: "d" + i, type: "subvention", titre: d.intitule, acheteur: `${d.dispositif} — subvention ${euros(d.subvention)}`,
    depts: [normDept(d.beneficiaire_dep)], date: "2025-12-31", montant: Number(d.cout_ht) || 0,
    montantLibelle: `${euros(Number(d.cout_ht) || 0)} HT de travaux`, score: 80, raisons: ["Projet financé par l'État en 2025 : marchés de travaux à venir"],
  }));
  for (const t of mar.filter((l) => Number(l.dureemois) > 0).map((l) => ({ l, fin: ajouterMois(l.datenotification, Number(l.dureemois)) })).filter((x) => x.fin > new Date()).sort((x, y) => x.fin.getTime() - y.fin.getTime()).slice(0, 12)) {
    const o = Number(t.l.offresrecues) || 0;
    leads.push({
      id: "r" + t.l.id, type: "renouvellement", titre: t.l.objet, acheteur: noms[t.l.titulaire_id_1] ? `Titulaire : ${noms[t.l.titulaire_id_1]}` : "Titulaire actuel",
      depts: [dep], date: ajouterMois(t.fin.toISOString(), -6).toISOString().slice(0, 10), montant: Number(t.l.montant) || 0,
      montantLibelle: euros(Number(t.l.montant) || 0), score: o === 1 ? 90 : o <= 2 ? 70 : 40,
      raisons: [o === 1 ? "Une seule offre reçue : élargir le sourcing au renouvellement" : `${o || "?"} offres reçues`, `Fin du marché le ${t.fin.toLocaleDateString("fr-FR")}`],
    });
  }
  a.envoyer({ t: "leads", leads, titre: "Projets à venir et marchés à remettre en concurrence" });
  a.envoyer({ t: "concurrents", concurrents: titulaires.map((t) => ({ ...t, nom: noms[t.siret] || `SIRET ${t.siret}` })), titre: "Principaux fournisseurs de la commune" });

  await a.etape("synthese", "L'agent rédige les recommandations achats…", async () => {
    const m = await chat([
      { role: "system", content: `Tu conseilles les acheteurs publics français. Ton factuel, sans emoji, ${a.redaction}. N'invente aucun chiffre.` },
      { role: "user", content: `Commune ${com.nom} (${com.population} hab.). Ses marchés : ${st.n}, ${st.offresMoy.toFixed(1)} offres en moyenne, ${st.pctUneOffre.toFixed(0)} % à une offre, ${st.pctSansPub.toFixed(0)} % sans publicité. Département : ${sv.offresMoy.toFixed(1)} offres, ${sv.pctUneOffre.toFixed(0)} % à une offre. Capacité de désendettement ${capacite.toFixed(1)} ans. Projets subventionnés : ${(dotations || []).map((d: any) => d.intitule).join(" ; ") || "aucun"}.\nRéponds en JSON {"synthese": "4 phrases : diagnostic et 3 actions concrètes pour obtenir plus d'offres et de meilleurs prix"}` },
    ], { max_tokens: 600 });
    const j = extraireJson<{ synthese: string }>(m.content);
    a.envoyer({ t: "synthese", texte: j?.synthese || m.content || "" });
    return { detail: "Recommandations rédigées", valeur: true };
  });
}

/* ───────────────────────────── ÉTAT ───────────────────────────── */

export async function analyseEtat(q: string, a: Agent) {
  const pages = await a.etape("marches", `Je lis les marchés attribués « ${q} » partout en France…`, async () => {
    const rs = await Promise.all([0, 100, 200].map((decalage) => interroger("marches_publics", { recherche: q, limite: 100, decalage })));
    const l = rs.flatMap((r) => r.data?.lignes || []);
    return { res: rs, detail: `${l.length} marchés analysés`, valeur: l };
  });
  const [annonces] = await Promise.all([
    a.etape("achats", "Je lis les achats annoncés par l'État et les hôpitaux…", async () => {
      const r = await interroger("projets_achats_publics", { recherche: q, filtres: [{ colonne: "date_previsionnelle_de_publication", op: "gte", valeur: AUJ() }], tri: "date_previsionnelle_de_publication", ordre: "asc", limite: 100 });
      const l: any[] = r.data?.lignes || [];
      return { res: r, detail: `${l.length} achats à venir`, valeur: l };
    }),
    parlement(a, "commande publique"),
  ]);
  const mar = (pages || []).filter((l) => Number(l.montant) > 0);
  const st = statsMarches(mar);
  const groupes = parDept(mar);
  const valeurs: Record<string, number> = {};
  const fragiles: { d: string; s: ReturnType<typeof statsMarches> }[] = [];
  for (const [d, ls] of Object.entries(groupes)) {
    const s = statsMarches(ls);
    valeurs[d] = s.pctUneOffre;
    if (ls.length >= 2) fragiles.push({ d, s });
  }
  fragiles.sort((x, y) => y.s.pctUneOffre * y.s.montant - x.s.pctUneOffre * x.s.montant);
  const tit = grouperTitulaires(mar);
  const top5 = tit.slice(0, 5).reduce((s, t) => s + t.montant, 0);
  const noms = await a.etape("enrichir", "J'identifie les titulaires dominants (Sirene)…", async () => {
    const { noms, res } = await nommer(tit.slice(0, 6).map((t) => t.siret));
    return { res, detail: `${Object.keys(noms).length} titulaires identifiés`, valeur: noms };
  }) || {};
  const argentUneOffre = mar.filter((l) => Number(l.offresrecues) === 1).reduce((s, l) => s + Number(l.montant), 0);

  a.envoyer({ t: "cible", titre: `Secteur « ${q} »`, sousTitre: "Vue nationale de la concurrence", details: [
    { label: "Marchés analysés", valeur: String(st.n) },
    { label: "Montant total", valeur: euros(st.montant) },
    { label: "Montant médian", valeur: euros(st.mediane) },
    { label: "Départements couverts", valeur: String(Object.keys(groupes).length) },
    { label: "Part des 5 premiers titulaires", valeur: st.montant ? `${Math.round((top5 / st.montant) * 100)} %` : "—" },
  ] });
  a.envoyer({ t: "kpis", kpis: [
    { label: "Argent public attribué sur une seule offre", valeur: argentUneOffre, format: "euros" },
    { label: "Marchés à une seule offre", valeur: st.pctUneOffre, format: "pourcent" },
    { label: "Offres reçues en moyenne", valeur: st.offresMoy, format: "nombre" },
    { label: "Achats annoncés à venir", valeur: (annonces || []).length, format: "nombre" },
  ] });
  a.envoyer({ t: "carte", valeurs, legende: "% de marchés attribués sur une seule offre" });
  a.envoyer({ t: "leads", titre: "Départements où la concurrence est la plus faible", leads: fragiles.slice(0, 12).map(({ d, s }) => ({
    id: "f" + d, type: "renouvellement", titre: `Département ${d} : ${s.n} marchés, ${Math.round(s.pctUneOffre)} % à une seule offre`, acheteur: `${s.offresMoy.toFixed(1).replace(".", ",")} offres en moyenne`,
    depts: [d], date: AUJ(), montant: s.montant, montantLibelle: euros(s.montant), score: Math.round(s.pctUneOffre),
    raisons: [`${Math.round(s.pctSansPub)} % passés sans publicité`],
  })) });
  a.envoyer({ t: "concurrents", concurrents: tit.slice(0, 8).map((t) => ({ ...t, nom: noms[t.siret] || `SIRET ${t.siret}` })), titre: "Titulaires dominants du secteur" });

  await a.etape("synthese", "L'agent rédige la note pour le décideur public…", async () => {
    const m = await chat([
      { role: "system", content: `Tu rédiges des notes de synthèse pour un cabinet ministériel. Ton sobre, sans emoji, ${a.redaction}. N'invente aucun chiffre.` },
      { role: "user", content: `Secteur ${q}. ${st.n} marchés, ${euros(st.montant)}, ${st.pctUneOffre.toFixed(0)} % à une seule offre (${euros(argentUneOffre)}), ${st.offresMoy.toFixed(1)} offres en moyenne, top 5 titulaires = ${st.montant ? Math.round((top5 / st.montant) * 100) : 0} % du montant. Départements les plus fragiles : ${fragiles.slice(0, 4).map((f) => `${f.d} (${Math.round(f.s.pctUneOffre)} %)`).join(", ")}.\nRéponds en JSON {"synthese": "4 phrases : constat, risque pour l'argent public, 2 leviers d'action"}` },
    ], { max_tokens: 600 });
    const j = extraireJson<{ synthese: string }>(m.content);
    a.envoyer({ t: "synthese", texte: j?.synthese || m.content || "" });
    return { detail: "Note rédigée", valeur: true };
  });
}
