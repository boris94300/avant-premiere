"use client";
import { useEffect, useRef, useState } from "react";

type Appel = { id: string; nom: string; args: any; statut: "run" | "ok" | "err"; ms?: number; lignes?: number; source?: string; detail?: string };
type Msg = { role: "user" | "assistant"; content: string; appels?: Appel[]; ms?: number };

const SUGGESTIONS = [
  "Quels achats de nettoyage sont annoncés dans l'Hérault ?",
  "Quels marchés informatiques ont été attribués avec une seule offre récemment ?",
  "Quelles communes de Charente ont reçu une subvention DSIL en 2025 ?",
  "Qui est Sopra Steria et combien d'établissements a-t-elle ?",
];

function rendre(txt: string) {
  const blocs = txt.replace(/^\s*-{3,}\s*$/gm, "").split(/\n{2,}/).filter((b) => b.trim());
  return blocs.map((b, i) => {
    const lignes = b.split("\n");
    const gras = (s: string) => s.replace(/^\*([^*].*[^*])\*$/, "$1").split(/\*\*(.+?)\*\*/g).map((p, j) => (j % 2 ? <strong key={j}>{p}</strong> : p));
    if (lignes.every((l) => /^\s*[-*•]\s|^\s*\d+\.\s/.test(l) || !l.trim()))
      return <ul key={i}>{lignes.filter((l) => l.trim()).map((l, j) => <li key={j}>{gras(l.replace(/^\s*([-*•]|\d+\.)\s/, ""))}</li>)}</ul>;
    return <p key={i}>{lignes.map((l, j) => <span key={j}>{j > 0 && <br />}{gras(l.replace(/^#+\s*/, ""))}</span>)}</p>;
  });
}

export default function Chat() {
  const [ouvert, setOuvert] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const fil = useRef<HTMLDivElement>(null);
  const champ = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fil.current?.scrollTo({ top: fil.current.scrollHeight, behavior: "smooth" }); }, [msgs]);
  useEffect(() => { if (ouvert) champ.current?.focus(); const esc = (e: KeyboardEvent) => e.key === "Escape" && setOuvert(false); window.addEventListener("keydown", esc); return () => window.removeEventListener("keydown", esc); }, [ouvert]);

  async function envoyer(texte = saisie) {
    const t = texte.trim(); if (!t || enCours) return;
    const histo: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs([...histo, { role: "assistant", content: "", appels: [] }]);
    setSaisie(""); setEnCours(true);
    const maj = (f: (m: Msg) => Msg) => setMsgs((ms) => ms.map((m, i) => (i === ms.length - 1 ? f(m) : m)));
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: histo.map(({ role, content }) => ({ role, content })) }) });
      const lecteur = res.body!.getReader(); const dec = new TextDecoder(); let tampon = "";
      for (;;) {
        const { value, done } = await lecteur.read(); if (done) break;
        tampon += dec.decode(value, { stream: true });
        const parts = tampon.split("\n\n"); tampon = parts.pop() || "";
        for (const p of parts) {
          if (!p.startsWith("data:")) continue;
          const e = JSON.parse(p.slice(5));
          if (e.t === "outil") maj((m) => { const a = m.appels || []; const i = a.findIndex((x) => x.id === e.id); return { ...m, appels: i >= 0 ? a.map((x, j) => (j === i ? e : x)) : [...a, e] }; });
          if (e.t === "reponse") maj((m) => ({ ...m, content: e.texte, ms: e.ms }));
          if (e.t === "erreur") maj((m) => ({ ...m, content: "Désolé, une erreur est survenue : " + e.message }));
        }
      }
    } catch { maj((m) => ({ ...m, content: "Connexion interrompue, réessayez." })); }
    setEnCours(false);
  }

  if (!ouvert) return (
    <button className="chat-bouton" type="button" onClick={() => setOuvert(true)} aria-haspopup="dialog">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
      Demander à l'agent
    </button>
  );

  return (
    <div className="chat-panneau" role="dialog" aria-modal="false" aria-label="Agent de recherche">
      <div className="panneau-tete">
        <div><h2 style={{ fontSize: 15, margin: 0 }}>Agent de recherche</h2><div style={{ fontSize: 12, color: "var(--encre-3)" }}>Choisit lui-même les données publiques à interroger</div></div>
        <button type="button" className="btn btn-fantome" onClick={() => setOuvert(false)} aria-label="Fermer l'agent">Fermer</button>
      </div>
      <div className="chat-fil" ref={fil} aria-live="polite">
        {msgs.length === 0 && (
          <div className="suggestions">
            <p style={{ margin: 0, fontSize: 14, color: "var(--encre-2)" }}>Posez une question sur la commande publique, les entreprises ou les collectivités :</p>
            {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => envoyer(s)}>{s}</button>)}
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "grid", gap: 8 }}>
            {m.appels?.map((a) => (
              <div key={a.id} className="appel-outil">
                <span className={`icone-etat ${a.statut}`} style={{ width: 14, height: 14, flex: "none" }} aria-hidden="true" />
                <span>
                  <b>{a.nom}</b>({a.args?.jeu || a.args?.q || ""}{a.args?.recherche ? ` · « ${a.args.recherche} »` : ""})
                  {a.statut === "ok" && <> → {a.lignes ?? 0} lignes · {((a.ms || 0) / 1000).toFixed(1).replace(".", ",")} s{a.source ? ` · ${a.source}` : ""}</>}
                  {a.statut === "err" && <> → {a.detail}</>}
                </span>
              </div>
            ))}
            {(m.content || m.role === "assistant") && (
              <div className={`bulle ${m.role}`}>
                {m.content ? (m.role === "assistant" ? rendre(m.content) : m.content) : <span style={{ color: "var(--encre-3)" }}>L'agent réfléchit et interroge les sources…</span>}
              </div>
            )}
          </div>
        ))}
      </div>
      <form className="chat-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
        <label htmlFor="chat-q" className="sr">Votre question</label>
        <textarea id="chat-q" ref={champ} rows={1} value={saisie} onChange={(e) => setSaisie(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); envoyer(); } }} placeholder="Ex. : hôpitaux d'Occitanie qui achètent du nettoyage" />
        <button className="btn" type="submit" disabled={enCours || !saisie.trim()}>Envoyer</button>
      </form>
    </div>
  );
}
