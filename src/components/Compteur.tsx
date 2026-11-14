"use client";
import { useEffect, useState } from "react";

export default function Compteur({ valeur, format }: { valeur: number; format: (n: number) => string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(valeur); return; }
    let raf = 0; const t0 = performance.now(); const d = 1400;
    const pas = (t: number) => { const p = Math.min(1, (t - t0) / d); setV(valeur * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(pas); };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [valeur]);
  return <span aria-label={format(valeur)}>{format(v)}</span>;
}
