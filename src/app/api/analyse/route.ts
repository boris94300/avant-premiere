import { Agent } from "@/lib/agent";
import { analyseCollectivite, analyseEntreprise, analyseEtat } from "@/lib/pipelines";
import type { Evenement } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PIPELINES = { entreprise: analyseEntreprise, collectivite: analyseCollectivite, etat: analyseEtat } as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 120);
  const profil = (url.searchParams.get("profil") || "entreprise") as keyof typeof PIPELINES;
  const pipeline = PIPELINES[profil];
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      const emit = (e: Evenement) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      const agent = new Agent(emit);
      try {
        if (!q || !pipeline) throw new Error("Requête invalide");
        await pipeline(q, agent);
      } catch (e: any) {
        emit({ t: "erreur", message: String(e?.message || e) });
      }
      agent.fin();
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
