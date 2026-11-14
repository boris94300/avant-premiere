export type Etape = {
  id: string;
  label: string;
  statut: "run" | "ok" | "err";
  detail?: string;
  outil?: string;
  ms?: number;
  credits?: number;
  lignes?: number | null;
  source?: string | null;
  lu_le?: string;
};

export type Lead = {
  id: string;
  type: "annonce" | "renouvellement" | "subvention";
  titre: string;
  acheteur: string;
  depts: string[];
  date: string;           // date de publication prévue / remise en concurrence estimée
  montant: number;
  montantLibelle: string;
  score: number;
  raisons: string[];
  lien?: string | null;
};

export type Concurrent = { siret: string; nom: string; marches: number; montant: number; offresMoy: number; vous?: boolean };

export type Kpi = { label: string; valeur: number; format: "euros" | "nombre" | "pourcent"; aide?: string };

export type Evenement =
  | { t: "etape"; etape: Etape }
  | { t: "cible"; titre: string; sousTitre: string; details: { label: string; valeur: string }[] }
  | { t: "kpis"; kpis: Kpi[] }
  | { t: "leads"; leads: Lead[]; titre: string }
  | { t: "concurrents"; concurrents: Concurrent[]; titre: string }
  | { t: "parlement"; items: { titre: string; sousTitre: string; lien?: string }[] }
  | { t: "carte"; valeurs: Record<string, number>; legende: string; focus?: { lng: number; lat: number; zoom: number }; focusDept?: string; points?: { lng: number; lat: number; label: string }[] }
  | { t: "synthese"; texte: string; mail?: string; destinataire?: string; cible?: string }
  | { t: "erreur"; message: string }
  | { t: "fin"; credits: number; ms: number; appels: number };
