const MCP_URL = "https://api.hemicycle.ai/mcp";

export type Appel = {
  outil: string;
  ms: number;
  credits: number;
  lignes: number | null;
  source: string | null;
  lu_le: string;
};

export type Resultat<T = any> = { data: T; appel: Appel };

let rpcId = 0;

/** Une source officielle qui ne répond pas est réessayée une fois. */
export async function outil<T = any>(nom: string, args: Record<string, unknown> = {}): Promise<Resultat<T>> {
  try { return await appeler<T>(nom, args); }
  catch (e) {
    if (!/ne répond pas/i.test(String((e as Error)?.message))) throw e;
    await new Promise((r) => setTimeout(r, 900));
    return appeler<T>(nom, args);
  }
}

async function appeler<T = any>(nom: string, args: Record<string, unknown> = {}): Promise<Resultat<T>> {
  const cle = process.env.HEMICYCLE_API_KEY;
  if (!cle) throw new Error("HEMICYCLE_API_KEY manquante");
  const t0 = Date.now();
  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cle}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: nom, arguments: args } }),
    cache: "no-store",
  });
  const brut = await res.text();
  const json = parseRpc(brut);
  if (json.error) throw new Error(json.error.message || "Erreur Hémicycle");
  const r = json.result || {};
  let data: any = r.structuredContent;
  if (!data) {
    const txt = r.content?.find((c: any) => c.type === "text")?.text ?? "{}";
    try { data = JSON.parse(txt); } catch { data = { texte: txt }; }
  }
  if (r.isError) throw new Error(String(r.content?.[0]?.text || data?.texte || "Erreur outil").slice(0, 200));
  const credits = Number(data?.credits?.dus ?? data?.credits ?? 0) || 0;
  const lignes = Array.isArray(data?.lignes) ? data.lignes.length
    : Array.isArray(data?.entreprises) ? data.entreprises.length
    : Array.isArray(data?.data) ? data.data.length : null;
  return {
    data,
    appel: {
      outil: nom,
      ms: Date.now() - t0,
      credits,
      lignes,
      source: data?.source?.nom ?? null,
      lu_le: data?.lu_a_la_source_le || data?.consulte_le || new Date().toISOString(),
    },
  };
}

function parseRpc(brut: string): any {
  const t = brut.trim();
  if (t.startsWith("{")) return JSON.parse(t);
  const lignes = t.split("\n").filter((l) => l.startsWith("data:"));
  const der = lignes[lignes.length - 1]?.slice(5).trim();
  return der ? JSON.parse(der) : { error: { message: "Réponse vide" } };
}

export function interroger(jeu: string, requete: Record<string, unknown>) {
  return outil("interroger", { jeu, ...requete });
}
