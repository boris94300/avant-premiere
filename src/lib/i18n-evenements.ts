// Traduction anglaise de ce que les agents envoient à l'écran (étapes, fiches, raisons, libellés).
// Les données publiques (intitulés de marchés, noms d'acheteurs, textes de loi) restent en français, telles que publiées.
import type { Lang } from "./i18n";

const EXACT: Record<string, string> = {
  // Étapes
  "Je lis les derniers amendements et les textes en vigueur…": "Reading the latest amendments and the laws in force…",
  "Je lis le registre des entreprises (Sirene)…": "Reading the company register (Sirene)…",
  "L'agent déduit vos marchés publics cibles…": "The agent works out your target public contracts…",
  "Je mesure la taille de l'entreprise (registre officiel, comptes publiés)…": "Measuring the company's size (official register, published accounts)…",
  "J'interroge les achats publics annoncés avant appel d'offres (APProch)…": "Querying public purchases announced before the call for tenders (APProch)…",
  "Je lis les marchés déjà attribués et calcule leur date de renouvellement…": "Reading contracts already awarded and computing their renewal date…",
  "J'identifie les acheteurs et vos concurrents (Sirene)…": "Identifying the buyers and your competitors (Sirene)…",
  "Je cherche le contact public de l'acheteur (annuaire de l'administration)…": "Looking for the buyer's public contact (directory of the administration)…",
  "L'agent rédige votre plan d'attaque et un mail d'approche…": "The agent writes your plan of attack and an outreach email…",
  "Je localise la commune (API Géo de l'État)…": "Locating the municipality (State Géo API)…",
  "Je lis tous les marchés notifiés par la commune…": "Reading every contract awarded by the municipality…",
  "Je lis les comptes de la commune (OFGL)…": "Reading the municipality's accounts (OFGL)…",
  "Je cherche les projets subventionnés par l'État (DETR, DSIL)…": "Looking for State-subsidised projects (DETR, DSIL)…",
  "J'identifie les fournisseurs de la commune (Sirene)…": "Identifying the municipality's suppliers (Sirene)…",
  "L'agent rédige les recommandations achats…": "The agent writes the procurement recommendations…",
  "Je lis les achats annoncés par l'État et les hôpitaux…": "Reading purchases announced by the State and hospitals…",
  "J'identifie les titulaires dominants (Sirene)…": "Identifying the dominant contract holders (Sirene)…",
  "L'agent rédige la note pour le décideur public…": "The agent writes the briefing note for the public decision-maker…",
  "Aucune entreprise trouvée": "No company found",
  "Commune introuvable": "Municipality not found",
  "Requête invalide": "Invalid request",
  "Taille inconnue : montants non filtrés": "Size unknown: amounts not filtered",
  "Aucun courriel public trouvé, destinataire à compléter": "No public email found, recipient to fill in",
  "Synthèse et mail rédigés": "Summary and email written",
  "Recommandations rédigées": "Recommendations written",
  "Note rédigée": "Note written",
  "Annuaire des entreprises (data.gouv.fr) + Wikidata": "Company directory (data.gouv.fr) + Wikidata",
  "Annuaire service-public.fr": "service-public.fr directory",
  "IA Featherless": "Featherless AI",
  // Fiches
  "Catégorie": "Category", "Chiffre d'affaires": "Turnover", "Effectifs": "Headcount", "Labels publics": "Public labels",
  "Site web (Wikidata)": "Website (Wikidata)", "Établissements ouverts": "Open sites", "Siège": "Head office", "Dirigeant": "Director",
  "Population": "Population", "Code Insee / SIREN": "Insee code / SIREN", "Dépenses totales 2024": "Total spending 2024",
  "Dépenses d'équipement 2024": "Capital spending 2024", "Capacité de désendettement": "Debt repayment capacity",
  "Marchés analysés": "Contracts analysed", "Montant total": "Total amount", "Montant médian": "Median amount",
  "Départements couverts": "Departments covered", "Part des 5 premiers titulaires": "Share of the top 5 contract holders",
  "Vue nationale de la concurrence": "National view of competition",
  "aucun salarié": "no employees", "10 000 salariés et plus": "10,000 employees or more",
  // Indicateurs et titres
  "Opportunités publiques détectées": "Public opportunities detected",
  "Achats annoncés (milieu de fourchette) + marchés à renouveler, à la taille de l'entreprise": "Announced purchases (mid-range) + contracts up for renewal, sized for the company",
  "Achats annoncés avant appel d'offres": "Purchases announced before the call for tenders",
  "Renouvellements prédits": "Predicted renewals",
  "Marchés de votre secteur à une seule offre": "Contracts in your sector with a single bid",
  "Plus ce taux est haut, plus il y a de place pour un nouvel entrant": "The higher this rate, the more room there is for a newcomer",
  "Montant des opportunités par département": "Amount of opportunities by department",
  "Vos opportunités, triées par chances": "Your opportunities, ranked by chances",
  "Qui gagne les marchés de votre secteur": "Who wins the contracts in your sector",
  "Marchés notifiés récemment": "Contracts awarded recently",
  "Offres reçues en moyenne": "Bids received on average",
  "Marchés avec une seule offre": "Contracts with a single bid",
  "Passés sans publicité": "Awarded without advertising",
  "Projets à venir et marchés à remettre en concurrence": "Upcoming projects and contracts to re-tender",
  "Principaux fournisseurs de la commune": "The municipality's main suppliers",
  "Argent public attribué sur une seule offre": "Public money awarded on a single bid",
  "Marchés à une seule offre": "Contracts with a single bid",
  "Achats annoncés à venir": "Upcoming announced purchases",
  "% de marchés attribués sur une seule offre": "% of contracts awarded on a single bid",
  "Départements où la concurrence est la plus faible": "Departments where competition is weakest",
  "Titulaires dominants du secteur": "Dominant contract holders in the sector",
  // Raisons
  "Annoncé avant appel d'offres : vous avez le temps de vous positionner": "Announced before the call for tenders: you have time to position yourself",
  "Dans le département de votre siège": "In your head office's department",
  "Publication prévue dans moins d'un an": "Publication planned within a year",
  "Une seule offre reçue la dernière fois : concurrence faible": "Only one bid received last time: weak competition",
  "Passé sans publicité : prenez contact en amont": "Awarded without advertising: get in touch early",
  "Projet financé par l'État en 2025 : marchés de travaux à venir": "Project funded by the State in 2025: works contracts to come",
  "Une seule offre reçue : élargir le sourcing au renouvellement": "Only one bid received: widen sourcing at renewal",
  "Non communiqué": "Not disclosed",
  "Titulaire actuel": "Current holder",
  // Secteurs
  "Nettoyage et services aux bâtiments": "Cleaning and building services", "Construction de bâtiments": "Building construction", "Génie civil": "Civil engineering",
  "Travaux de construction spécialisés": "Specialised construction works", "Services informatiques": "IT services", "Services d'information": "Information services",
  "Restauration": "Catering", "Transport": "Transport", "Sécurité": "Security", "Ingénierie": "Engineering", "Conseil": "Consulting", "Énergie": "Energy", "Santé": "Health",
  // Labels et sorts d'amendements
  "bio": "organic", "économie sociale et solidaire": "social and solidarity economy", "insertion par l'activité économique": "work integration",
  "société à mission": "mission-driven company", "label achats responsables": "responsible purchasing label", "entreprise du patrimoine vivant": "living heritage company",
  "Adopté": "Adopted", "Rejeté": "Rejected", "Retiré": "Withdrawn", "Non soutenu": "Not moved", "Tombé": "Lapsed",
  // Agent conversationnel
  "Je n'ai pas trouvé de réponse.": "I could not find an answer.",
  "Je n'ai pas pu terminer la recherche, reformulez la question.": "I could not finish the search, please rephrase the question.",
};

const MOIS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const point = (s: string) => s.replace(/(\d),(\d)/g, "$1.$2");
const milliers = (s: string) => s.replace(/(\d)[\s\u202f\u00a0](?=\d{3}\b)/g, "$1,");

/** Montants, pourcentages et dates au format anglais. */
function chiffres(s: string) {
  return s
    .replace(/(\d+(?:,\d+)?)\s?Md€/g, (_, n) => `€${point(n)}bn`)
    .replace(/(\d+(?:,\d+)?)\s?M€/g, (_, n) => `€${point(n)}M`)
    .replace(/(\d+(?:,\d+)?)\s?k€/g, (_, n) => `€${point(n)}k`)
    .replace(/(\d+(?:[\s\u202f\u00a0]\d{3})*(?:,\d+)?)\s?€/g, (_, n) => `€${point(milliers(n))}`)
    .replace(/(\d)\s%/g, "$1%")
    .replace(/\b(\d{2})\/(\d{2})\/(\d{4})\b/g, (m, j, mo, a) => (MOIS[+mo - 1] ? `${+j} ${MOIS[+mo - 1]} ${a}` : m));
}

const ca = (s: string) => s
  .replace(/^(.+) \(comptes (\d{4})\)$/, "$1 ($2 accounts)")
  .replace(/^environ (.+) \(estimé d'après les effectifs, comptes non publiés\)$/, "about $1 (estimated from headcount, accounts not published)");

const REGLES: [RegExp, (...g: string[]) => string][] = [
  [/^(\d{1,3}(?:[\s\u202f\u00a0]\d{3})+)$/, (a) => milliers(a)],
  [/^(\d+)\s?(k|M|Md)€? - (\d+)\s?(k|M|Md)€$/, (a, b, c, d) => `€${a}${b === "Md" ? "bn" : b} to €${c}${d === "Md" ? "bn" : d}`],
  [/^\+ (\d+)\s?(k|M|Md)€$/, (a, b) => `over €${a}${b === "Md" ? "bn" : b}`],
  [/^- (\d+)\s?(k|M|Md)€$/, (a, b) => `under €${a}${b === "Md" ? "bn" : b}`],
  [/^(\d+) texte\(s\) en vigueur, (\d+) amendement\(s\) récent\(s\)$/, (a, b) => `${a} law(s) in force, ${b} recent amendment(s)`],
  [/^(.*) — (\S+) établissements, NAF (.+)$/, (a, b, c) => `${a} — ${b} sites, NAF ${c}`],
  [/^Chiffre d'affaires : (.+?)(?: · site (\S+))?$/, (a, b) => `Turnover: ${ca(a)}${b ? ` · website ${b}` : ""}`],
  [/^Taille inconnue : montants non filtrés · site (\S+)$/, (a) => `Size unknown: amounts not filtered · website ${a}`],
  [/^(.+ \(comptes \d{4}\)|environ .+ comptes non publiés\))$/, (a) => ca(a)],
  [/^Trop gros pour votre taille : (.+) par an, pour un chiffre d'affaires de (.+)$/, (a, b) => `Too big for your size: ${a} a year, for a turnover of ${b}`],
  [/^(\d+) projets d'achat à venir trouvés$/, (a) => `${a} upcoming purchase projects found`],
  [/^(\d+) marchés attribués analysés$/, (a) => `${a} awarded contracts analysed`],
  [/^(\d+) organisations identifiées$/, (a) => `${a} organisations identified`],
  [/^Marché réservé : (.+)$/, (a) => `Reserved contract: ${a}`],
  [/^Notifié le (\S+) pour (\S+) mois : fin le (\S+)$/, (a, b, c) => `Awarded on ${a} for ${b} months: ends on ${c}`],
  [/^(\d+) offres reçues : marché disputé$/, (a) => `${a} bids received: contested contract`],
  [/^(.+) \(montant actuel\)$/, (a) => `${a} (current amount)`],
  [/^(.+) \((\d+) €\/hab\.\)$/, (a, b) => `${a} (${b} € per capita)`],
  [/^(.*) \((\w+)\) — (.+) habitants$/, (a, b, c) => `${a} (${b}) — ${milliers(c)} inhabitants`],
  [/^Je compare avec les autres acheteurs du département (\S+)…$/, (a) => `Comparing with the other buyers in department ${a}…`],
  [/^(\d+) marchés récents$/, (a) => `${a} recent contracts`],
  [/^(\d+) marchés du département comparés$/, (a) => `${a} contracts in the department compared`],
  [/^(\d+) agrégats 2024$/, (a) => `${a} aggregates for 2024`],
  [/^(\d+) projet\(s\) subventionné\(s\) en 2025$/, (a) => `${a} subsidised project(s) in 2025`],
  [/^(\d+) fournisseurs identifiés$/, (a) => `${a} suppliers identified`],
  [/^(\d+) titulaires identifiés$/, (a) => `${a} contract holders identified`],
  [/^Commune — département (\S+)$/, (a) => `Municipality — department ${a}`],
  [/^(\d+(?:,\d+)?) ans$/, (a) => `${point(a)} years`],
  [/^Moyenne du département : (.+)$/, (a) => `Department average: ${point(a)}`],
  [/^(.+) — subvention (.+)$/, (a, b) => `${a} — grant ${b}`],
  [/^(.+) HT de travaux$/, (a) => `${a} of works excl. VAT`],
  [/^Titulaire : (.+)$/, (a) => `Holder: ${a}`],
  [/^(\S+) offres reçues$/, (a) => `${a} bids received`],
  [/^Fin du marché le (\S+)$/, (a) => `Contract ends on ${a}`],
  [/^Je lis les marchés attribués « (.+) » partout en France…$/, (a) => `Reading awarded contracts for “${a}” across France…`],
  [/^(\d+) marchés analysés$/, (a) => `${a} contracts analysed`],
  [/^(\d+) achats à venir$/, (a) => `${a} upcoming purchases`],
  [/^Secteur « (.+) »$/, (a) => `Sector “${a}”`],
  [/^Département (\S+) : (\d+) marchés, (\d+) % à une seule offre$/, (a, b, c) => `Department ${a}: ${b} contracts, ${c}% with a single bid`],
  [/^(\S+) offres en moyenne$/, (a) => `${point(a)} bids on average`],
  [/^(\d+) % passés sans publicité$/, (a) => `${a}% awarded without advertising`],
  [/^(\d[\d\s\u202f\u00a0]*) à (\d[\d\s\u202f\u00a0]*) salariés?$/, (a, b) => `${milliers(a.trim())} to ${milliers(b.trim())} employees`],
  [/^Activité (\S+)$/, (a) => `Activity ${a}`],
  [/^(.+) → (.+?)( \(règle NAF\))?$/, (a, b, c) => `${phrase(a)} → ${b}${c ? " (NAF rule)" : ""}`],
  [/^Amendement (.*)$/, (a) => `Amendment ${a.replace(" · déposé le ", " · tabled on ").split(" · ").map((x) => EXACT[x] ?? x).join(" · ")}`],
];

function phrase(s: string): string {
  if (EXACT[s]) return EXACT[s];
  for (const [re, f] of REGLES) { const m = s.match(re); if (m) return chiffres(f(...m.slice(1))); }
  if (s.includes(", ") && s.split(", ").every((x) => EXACT[x])) return s.split(", ").map((x) => EXACT[x]).join(", ");
  return chiffres(s);
}
export const phraseEn = (lang: Lang, s: string) => (lang === "en" ? phrase(s) : s);

// Champs jamais retouchés : identifiants, liens, dates.
const INTACTS = new Set(["id", "t", "type", "statut", "format", "lien", "siret", "source", "lu_le", "date", "depts", "focusDept"]);

function visiter(o: any, cle?: string): any {
  if (typeof o === "string") return cle && INTACTS.has(cle) ? o : phrase(o);
  if (Array.isArray(o)) return o.map((x) => visiter(x, cle));
  if (o && typeof o === "object") return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, visiter(v, k)]));
  return o;
}

export function traduireEvenement<T>(e: T, lang: Lang): T {
  if (lang !== "en") return e;
  const ev = e as any;
  // Textes rédigés par l'IA : déjà en anglais.
  if (ev?.t === "synthese") return e;
  // Intitulés des marchés et textes de loi : données publiques, laissées en français.
  if (ev?.t === "leads") return { ...ev, titre: phrase(ev.titre), leads: ev.leads.map((l: any) => ({ ...visiter({ ...l, titre: undefined }), titre: /^Département \S+ : /.test(l.titre) ? phrase(l.titre) : l.titre })) };
  if (ev?.t === "parlement") return { ...ev, items: ev.items.map((x: any) => ({ ...x, titre: /^Amendement /.test(x.titre) ? phrase(x.titre) : x.titre })) };
  return visiter(ev);
}
