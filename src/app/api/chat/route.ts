import { outil } from "@/lib/hemicycle";
import { chat, MODELE, type Message } from "@/lib/llm";
import { JEUX_AGENT } from "@/config/jeux";
import type { Lang } from "@/lib/i18n";
import { phraseEn } from "@/lib/i18n-evenements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const JEUX = JEUX_AGENT.map((j) => j.jeu);

const TOOLS = [
  {
    type: "function",
    function: {
      name: "interroger",
      description: "Lit un jeu de données public officiel (via Hémicycle) avec filtres, recherche plein texte, tri et limite.",
      parameters: {
        type: "object",
        properties: {
          jeu: { type: "string", enum: JEUX },
          recherche: { type: "string", description: "Un seul mot ou une expression (pas de OR). Uniquement pour les jeux avec recherche plein texte." },
          filtres: { type: "array", items: { type: "object", properties: { colonne: { type: "string" }, op: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"] }, valeur: {} }, required: ["colonne", "op", "valeur"] } },
          colonnes: { type: "array", items: { type: "string" }, description: "Colonnes utiles uniquement (5 à 8)." },
          tri: { type: "string" },
          ordre: { type: "string", enum: ["asc", "desc"] },
          limite: { type: "integer", maximum: 40 },
        },
        required: ["jeu"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "chercher_entreprise",
      description: "Trouve une entreprise par nom ou SIREN : activité, taille, siège, dirigeants.",
      parameters: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
    },
  },
  {
    type: "function",
    function: {
      name: "rechercher",
      description: "Recherche dans les amendements et textes du Parlement.",
      parameters: { type: "object", properties: { q: { type: "string" }, types: { type: "string", description: "amendement, texte, ou les deux séparés par une virgule" } }, required: ["q"] },
    },
  },
];

const systeme = (lang: Lang) => `Tu es l'agent de recherche d'Avant-Première, plateforme de veille sur la commande publique française. Aujourd'hui : ${new Date().toISOString().slice(0, 10)}.
Tu réponds ${lang === "en" ? "en anglais (les intitulés de marchés et noms propres restent en français)" : "en français"}, de façon concise et structurée (listes à puces courtes, montants en €), sans emoji et sans tableau markdown. Tu utilises les outils pour lire les données en direct, puis tu réponds en citant les sources (nom du jeu). N'invente jamais de chiffre. 3 appels d'outils maximum.
Astuces : les achats annoncés avant appel d'offres sont dans projets_achats_publics (filtre date_previsionnelle_de_publication gte, departement_s_d_execution_du_marche like "34" : valeurs multiples séparées par « | »). Les marchés attribués sont dans marches_publics (recherche sur l'objet ; acheteur_id = SIRET). La recherche plein texte n'accepte pas OR.
Jeux disponibles :
${JEUX_AGENT.map((j) => `- ${j.jeu} : ${j.description} Colonnes : ${j.colonnes.join(", ")}. Tris : ${j.tris.join(", ")}.${j.filtre_obligatoire ? ` Filtre obligatoire sur : ${JSON.stringify(j.filtre_obligatoire)}.` : ""} ${j.mode_emploi}`).join("\n")}`;

function compacter(data: any): string {
  const nettoyer = (o: any): any => {
    if (Array.isArray(o)) return o.map(nettoyer);
    if (o && typeof o === "object") {
      const r: any = {};
      for (const [k, v] of Object.entries(o)) {
        if (v === null || v === "CDL" || k === "avertissement" || k === "sources_amont") continue;
        r[k] = nettoyer(v);
      }
      return r;
    }
    return typeof o === "string" && o.length > 300 ? o.slice(0, 300) + "…" : o;
  };
  return JSON.stringify(nettoyer(data)).slice(0, 7000);
}

const fuite = (t?: string | null) => !!t && /<\|[a-z_]+\|>/i.test(t);
const nettoyerFuite = (t: string | null) => (t || "").split(/<\|[a-z_]+\|>/i)[0].trim() || "Je n'ai pas pu terminer la recherche, reformulez la question.";

function depuisFuite(t: string | null): any | null {
  if (!t) return null;
  const debut = t.search(/<\|[a-z_]+\|>/i);
  const nom = ["interroger", "chercher_entreprise", "rechercher"].find((n) => t.slice(Math.max(0, debut - 40)).includes(n));
  if (!nom) return null;
  const args: Record<string, unknown> = {};
  const re = /argument key="([^"]+)"(?: type="([^"]+)")?<\|sep\|>([\s\S]*?)<\|close\|>/g;
  for (let m; (m = re.exec(t)); ) {
    const brut = m[3].trim();
    try { args[m[1]] = m[2] === "string" ? brut : JSON.parse(brut); } catch { args[m[1]] = brut; }
  }
  if (!Object.keys(args).length) return null;
  return { id: `fuite_${Date.now()}`, type: "function", function: { name: nom, arguments: JSON.stringify(args) } };
}

async function executer(nom: string, args: any) {
  const filtres: any[] = Array.isArray(args.filtres) ? args.filtres : [];
  const i = filtres.findIndex((f) => f?.op === "like" && /departement/.test(f.colonne) && String(f.valeur).replace(/[|%]/g, "").length < 3);
  if (nom !== "interroger" || i < 0) return outil(nom, args);
  const d = String(filtres[i].valeur).replace(/[|%]/g, "").padStart(2, "0");
  const avec = (f: any) => ({ ...args, filtres: filtres.map((x, j) => (j === i ? f : x)) });
  const [a, b] = await Promise.all([outil(nom, avec({ colonne: filtres[i].colonne, op: "eq", valeur: d })), outil(nom, avec({ colonne: filtres[i].colonne, op: "like", valeur: `|${d}|` }))]);
  const lignes = [...(a.data?.lignes || []), ...(b.data?.lignes || [])];
  return { data: { ...a.data, lignes }, appel: { ...a.appel, credits: a.appel.credits + b.appel.credits, lignes: lignes.length } };
}

export async function POST(req: Request) {
  const { messages: historique = [], lang: l } = await req.json().catch(() => ({}));
  const lang: Lang = l === "en" ? "en" : "fr";
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (e: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      const messages: Message[] = [
        { role: "system", content: systeme(lang) },
        ...historique.slice(-8).map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: String(m.content).slice(0, 2000) })),
      ];
      let credits = 0;
      try {
        for (let tour = 0; tour < 4; tour++) {
          const t0 = Date.now();
          emit({ t: "pense", modele: MODELE });
          let rep = await chat(messages, { tools: tour < 3 ? TOOLS : undefined, max_tokens: 900 });
          if (!rep.tool_calls?.length && fuite(rep.content)) {
            const appel = depuisFuite(rep.content);
            rep = appel ? { ...rep, content: "", tool_calls: [appel] } : await chat(messages, { tools: tour < 3 ? TOOLS : undefined, max_tokens: 900, temperature: 0.2 });
          }
          if (!rep.tool_calls?.length && fuite(rep.content)) rep = { ...rep, content: phraseEn(lang, nettoyerFuite(rep.content)) };
          if (tour === 3 && rep.tool_calls?.length) rep = { ...rep, tool_calls: undefined, content: "" };
          if (!rep.tool_calls?.length) {
            if (!rep.content?.trim()) {
              messages.push({ role: "user", content: "Réponds maintenant à la question initiale avec les données déjà obtenues, sans appeler d'outil." });
              rep = await chat(messages, { max_tokens: 900 });
              rep = { ...rep, content: fuite(rep.content) ? phraseEn(lang, nettoyerFuite(rep.content)) : rep.content };
            }
            emit({ t: "reponse", texte: rep.content || phraseEn(lang, "Je n'ai pas trouvé de réponse."), ms: Date.now() - t0, credits });
            break;
          }
          messages.push({ role: "assistant", content: rep.content || "", tool_calls: rep.tool_calls });
          await Promise.all(rep.tool_calls.map(async (tc: any) => {
            let args: any = {};
            try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* vide */ }
            if (tc.function.name === "interroger") args.limite = Math.min(Number(args.limite) || 20, 40);
            const debut = Date.now();
            emit({ t: "outil", id: tc.id, nom: tc.function.name, args, statut: "run" });
            let contenu: string;
            try {
              const r = await executer(tc.function.name, args);
              credits += r.appel.credits;
              emit({ t: "outil", id: tc.id, nom: tc.function.name, args, statut: "ok", ms: Date.now() - debut, lignes: r.appel.lignes, source: r.appel.source, credits: r.appel.credits });
              contenu = compacter(r.data);
            } catch (e: any) {
              emit({ t: "outil", id: tc.id, nom: tc.function.name, args, statut: "err", ms: Date.now() - debut, detail: String(e.message).slice(0, 200) });
              contenu = `Erreur : ${e.message}`;
            }
            messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: contenu });
          }));
        }
      } catch (e: any) {
        emit({ t: "erreur", message: String(e?.message || e) });
      }
      emit({ t: "fin" });
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
