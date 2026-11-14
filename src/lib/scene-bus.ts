// Lien entre l'interface et la scène 3D de fond (qui vit dans le layout).
export type Repere = "lanterne" | "arbre" | "pont" | "moulin";
export type Focus = Repere | "overview";
export type LumiereLead = { id: string; score: number; titre: string; rang?: number; etiquette?: string };
export type EtatScene = { focus: Focus; phase: "idle" | "running" | "done"; leads: LumiereLead[]; decaleX: number; decaleY: number };

let etat: EtatScene = { focus: "overview", phase: "idle", leads: [], decaleX: 0, decaleY: 0 };
const abonnes = new Set<(e: EtatScene) => void>();
const surRepere = new Set<(r: Repere) => void>();
const surLead = new Set<(id: string) => void>();

export const scene = {
  lire: () => etat,
  regler(p: Partial<EtatScene>) { etat = { ...etat, ...p }; abonnes.forEach((f) => f(etat)); },
  ecouter(f: (e: EtatScene) => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },
  cliquerRepere(r: Repere) { surRepere.forEach((f) => f(r)); },
  ecouterRepere(f: (r: Repere) => void) { surRepere.add(f); return () => { surRepere.delete(f); }; },
  cliquerLead(id: string) { surLead.forEach((f) => f(id)); },
  ecouterLead(f: (id: string) => void) { surLead.add(f); return () => { surLead.delete(f); }; },
};
