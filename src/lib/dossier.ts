import type { Concurrent, Kpi, Lead } from "./types";
import { FORMATS, fEuros } from "./format";

export type Dossier = {
  cible?: { titre: string; sousTitre: string; details: { label: string; valeur: string }[] };
  kpis?: Kpi[]; leads: Lead[]; concurrents?: Concurrent[];
  textes?: { titre: string; sousTitre: string; lien?: string }[];
  synthese?: string; mail?: string; destinataire?: string;
};

const DOUZE_MOIS = 365 * 864e5;
/** Chiffre d'affaires atteignable : montants des opportunités à moins de 12 mois, pondérés par leur score. */
export function caAtteignable(leads: Lead[]) {
  const lim = Date.now() + DOUZE_MOIS;
  return leads.filter((l) => new Date(l.date).getTime() <= lim).reduce((s, l) => s + l.montant * (l.score / 100), 0);
}

function telecharger(blob: Blob, nom: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const slug = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 40) || "analyse";

export function exporterCsv(leads: Lead[], nom: string) {
  const c = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""').replace(/\s+/g, " ")}"`;
  const lignes = [["Rang", "Type", "Score", "Acheteur", "Objet", "Date", "Montant (€)", "Montant affiché", "Départements", "Pourquoi", "Lien"].map(c).join(";")];
  leads.forEach((l, i) => lignes.push([i + 1, l.type, l.score, l.acheteur, l.titre, l.date, Math.round(l.montant), l.montantLibelle, l.depts.join(" "), l.raisons.join(" | "), l.lien || ""].map(c).join(";")));
  telecharger(new Blob(["\ufeff" + lignes.join("\r\n")], { type: "text/csv;charset=utf-8" }), `opportunites-${slug(nom)}.csv`);
}

/** Les polices standard du PDF ne couvrent que le Latin-1 étendu. */
const pdfTxt = (s: unknown) => String(s ?? "").replace(/[\u202f\u00a0\u2009]/g, " ").replace(/[’‘]/g, "'").replace(/[“”«»]/g, '"').replace(/[–—]/g, "-").replace(/…/g, "...").replace(/œ/g, "oe").replace(/Œ/g, "OE").replace(/\s?€/g, " EUR").replace(/[^\x09\x0a\x20-\xff]/g, "");

export async function exporterPdf(d: Dossier) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = 595, H = 842, M = 48, W = L - 2 * M;
  let y = M;
  const saut = (h: number) => { if (y + h > H - 56) { doc.addPage(); y = M; } };
  const texte = (s: unknown, o: { t?: number; gras?: boolean; gris?: boolean; apres?: number; retrait?: number } = {}) => {
    const t = o.t ?? 10.5, x = M + (o.retrait ?? 0);
    doc.setFont("helvetica", o.gras ? "bold" : "normal"); doc.setFontSize(t);
    doc.setTextColor(o.gris ? 105 : 20, o.gris ? 112 : 28, o.gris ? 125 : 45);
    for (const l of doc.splitTextToSize(pdfTxt(s), W - (o.retrait ?? 0)) as string[]) { saut(t * 1.4); doc.text(l, x, y + t); y += t * 1.4; }
    y += o.apres ?? 4;
  };
  const titre = (s: string) => { y += 10; saut(60); doc.setDrawColor(230, 150, 60); doc.setLineWidth(2); doc.line(M, y, M + 28, y); y += 8; texte(s, { t: 15, gras: true, apres: 8 }); };

  const nom = d.cible?.titre || "Entreprise";
  const cible = d.leads[0];
  texte("AVANT-PREMIERE · DOSSIER D'APPROCHE", { t: 9, gras: true, gris: true, apres: 10 });
  texte(nom, { t: 24, gras: true, apres: 2 });
  if (d.cible?.sousTitre) texte(d.cible.sousTitre, { t: 12, gris: true, apres: 2 });
  texte(`Établi le ${new Date().toLocaleDateString("fr-FR")} à partir de données publiques lues à la source.`, { t: 9, gris: true, apres: 6 });

  if (d.cible?.details?.length) { titre("1. L'entreprise"); for (const x of d.cible.details) texte(`${x.label} : ${x.valeur}`); }
  const moi = d.concurrents?.find((c) => c.vous);
  if (moi) texte(`Marchés publics du secteur déjà remportés : ${moi.marches} pour ${fEuros(moi.montant)}.`);

  if (cible) {
    titre("2. L'opportunité visée");
    texte(cible.titre, { gras: true, t: 12 });
    texte(`Acheteur : ${cible.acheteur}`);
    texte(`${cible.type === "annonce" ? "Publication prévue" : "Remise en concurrence estimée"} : ${new Date(cible.date).toLocaleDateString("fr-FR")} · Montant : ${cible.montantLibelle} · Score : ${cible.score}/100`);
    for (const r of cible.raisons) texte(`- ${r}`, { retrait: 10, apres: 2 });
    if (cible.lien) texte(cible.lien, { t: 9, gris: true });
  }
  if (d.synthese) { titre("3. Plan d'attaque"); texte(d.synthese); }
  if (d.kpis?.length) for (const k of d.kpis) texte(`${k.label} : ${FORMATS[k.format](k.valeur)}`, { apres: 2 });
  texte(`Chiffre d'affaires atteignable sur 12 mois (montants pondérés par le score) : ${fEuros(caAtteignable(d.leads))}.`, { gras: true });

  if (d.textes?.length) {
    titre("4. Textes en vigueur et amendements récents");
    for (const t of d.textes) { texte(t.titre, { gras: true, apres: 2 }); texte(t.sousTitre, { apres: 2 }); if (t.lien) texte(t.lien, { t: 9, gris: true }); y += 4; }
  }
  if (d.concurrents?.length) {
    titre("5. Qui gagne ces marchés aujourd'hui");
    for (const c of d.concurrents.slice(0, 8)) texte(`${c.vous ? "(vous) " : ""}${c.nom} : ${c.marches} marché(s), ${fEuros(c.montant)}, ${c.offresMoy.toFixed(1).replace(".", ",")} offre(s) reçue(s) en moyenne`, { apres: 2 });
  }
  titre("6. Les 10 meilleures opportunités");
  d.leads.slice(0, 10).forEach((l, i) => { texte(`${i + 1}. ${l.titre}`, { gras: true, apres: 1 }); texte(`${l.acheteur} · ${new Date(l.date).toLocaleDateString("fr-FR")} · ${l.montantLibelle} · score ${l.score}`, { gris: true, t: 9.5, apres: 6 }); });
  if (d.mail) { titre("7. Mail d'approche"); if (d.destinataire) texte(`Destinataire : ${d.destinataire}`, { gris: true }); for (const p of d.mail.split(/\n+/)) texte(p, { apres: 6 }); }

  titre("Sources");
  for (const s of ["Registre Sirene (INSEE) et API Recherche d'entreprises (DINUM)", "Projets d'achats publics APProch et données essentielles des marchés publics (DECP)", "Assemblée nationale (amendements) et Légifrance (DILA)", "Annuaire de l'administration (service-public.fr)", "Données interrogées en direct via Hémicycle, sous Licence Ouverte Etalab. Synthèse et mail rédigés par une IA : à relire avant envoi."]) texte(s, { t: 9, gris: true, apres: 2 });

  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(140, 146, 158); doc.text(pdfTxt(`Avant-Première · ${nom}`), M, H - 28); doc.text(`${i} / ${n}`, L - M, H - 28, { align: "right" }); }
  doc.save(`dossier-${slug(nom)}.pdf`);
}
