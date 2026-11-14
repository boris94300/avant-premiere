import { outil, interroger, type Resultat } from "./hemicycle";
import type { Etape, Evenement } from "./types";
import type { Lang } from "./i18n";
import { traduireEvenement } from "./i18n-evenements";

export class Agent {
  credits = 0;
  appels = 0;
  t0 = Date.now();
  private emit: (e: Evenement) => void;
  constructor(emit: (e: Evenement) => void, public lang: Lang = "fr") { this.emit = (e) => emit(traduireEvenement(e, lang)); }
  /** Langue de rédaction imposée à l'IA. */
  get redaction() { return this.lang === "en" ? "en anglais (rédige en anglais ; garde tels quels, en français, les noms propres, les intitulés de marchés et les titres de textes de loi)" : "en français"; }

  envoyer(e: Evenement) { this.emit(e); }

  async etape<T>(id: string, label: string, fn: () => Promise<{ res?: Resultat | Resultat[]; detail?: string; valeur: T; outil?: string }>): Promise<T | null> {
    const debut = Date.now();
    this.emit({ t: "etape", etape: { id, label, statut: "run" } });
    try {
      const { res, detail, valeur, outil: nomOutil } = await fn();
      const liste = res ? (Array.isArray(res) ? res : [res]) : [];
      const credits = liste.reduce((s, r) => s + (r.appel.credits || 0), 0);
      this.credits += credits;
      this.appels += liste.length;
      const premier = liste[0]?.appel;
      const etape: Etape = {
        id, label, statut: "ok", detail,
        outil: nomOutil || (premier ? [...new Set(liste.map((r) => r.appel.outil))].join(" + ") : "IA Featherless"),
        ms: Date.now() - debut, credits,
        lignes: liste.length ? liste.reduce((s, r) => s + (r.appel.lignes || 0), 0) : null,
        source: premier?.source ?? null,
        lu_le: premier?.lu_le ?? new Date().toISOString(),
      };
      this.emit({ t: "etape", etape });
      return valeur;
    } catch (e: any) {
      this.emit({ t: "etape", etape: { id, label, statut: "err", detail: String(e?.message || e).slice(0, 160), ms: Date.now() - debut } });
      return null;
    }
  }

  fin() { this.emit({ t: "fin", credits: this.credits, ms: Date.now() - this.t0, appels: this.appels }); }
}

const cacheNoms = new Map<string, string>();

/** Résout des SIRET/SIREN en noms via Sirene (Hémicycle), en parallèle. */
export async function nommer(ids: string[]): Promise<{ noms: Record<string, string>; res: Resultat[] }> {
  const uniques = [...new Set(ids.filter((i) => /^\d{9}(\d{5})?$/.test(i)))];
  const res: Resultat[] = [];
  const noms: Record<string, string> = {};
  await Promise.all(uniques.map(async (id) => {
    if (cacheNoms.has(id)) { noms[id] = cacheNoms.get(id)!; return; }
    try {
      const col = id.length === 14 ? "siret" : "siren";
      const r = await interroger("sirene_etablissements", {
        filtres: [{ colonne: col, op: "eq", valeur: id }],
        colonnes: ["denomination", "enseigne", "commune", "siege"],
        limite: col === "siren" ? 20 : 1,
      });
      res.push(r);
      const lignes: any[] = r.data?.lignes || [];
      const l = lignes.find((x) => x.siege) || lignes[0];
      if (l) {
        const nom = [l.denomination, l.enseigne && l.enseigne !== l.denomination ? `(${l.enseigne})` : "", l.commune ? `— ${l.commune}` : ""].filter(Boolean).join(" ");
        noms[id] = nom; cacheNoms.set(id, nom);
      }
    } catch { /* nom inconnu */ }
  }));
  return { noms, res };
}

export { outil, interroger };
