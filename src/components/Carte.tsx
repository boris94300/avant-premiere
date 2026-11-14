"use client";
import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";

maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const FRANCE: [number, number] = [2.4, 46.6];

type Props = {
  valeurs: Record<string, number>;
  legende: string;
  focus?: { lng: number; lat: number; zoom: number };
  focusDept?: string;
  points?: { lng: number; lat: number; label: string }[];
  format: (n: number) => string;
  titre?: string;
};

const reduit = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function Carte({ valeurs, legende, focus, focusDept, points, format, titre }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const carte = useRef<maplibregl.Map | null>(null);
  const geo = useRef<any>(null);
  const pret = useRef(false);
  const marqueurs = useRef<maplibregl.Marker[]>([]);
  const appliquerRef = useRef<() => void>(() => {});
  const max = Math.max(1, ...Object.values(valeurs));

  useEffect(() => {
    if (!ref.current) return;
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: ref.current, style: STYLE, center: [10, 44], zoom: 2.2, pitch: 0,
        attributionControl: { compact: true }, cooperativeGestures: true,
      });
    } catch { return; }
    carte.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    m.on("load", async () => {
      const g = await fetch("/departements.geojson").then((r) => r.json());
      geo.current = g;
      m.addSource("dep", { type: "geojson", data: g, promoteId: "code" });
      m.addLayer({
        id: "dep-ext", type: "fill-extrusion", source: "dep",
        paint: {
          "fill-extrusion-color": ["interpolate", ["linear"], ["coalesce", ["feature-state", "v"], 0], 0, "#13223a", 0.15, "#1e3a5f", 0.5, "#0ea5e9", 1, "#fbbf24"],
          "fill-extrusion-height": ["*", ["coalesce", ["feature-state", "v"], 0], 90000],
          "fill-extrusion-opacity": 0.85,
        },
      });
      m.addLayer({ id: "dep-ligne", type: "line", source: "dep", paint: { "line-color": "#334155", "line-width": 0.6 } });
      pret.current = true;
      const fly = { center: FRANCE, zoom: window.innerWidth < 640 ? 4.3 : 4.9, pitch: 42, bearing: -8 };
      if (reduit()) m.jumpTo(fly); else m.flyTo({ ...fly, duration: 2600, essential: true });
      appliquerRef.current();
    });
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false });
    m.on("mousemove", "dep-ext", (e: any) => {
      const f = e.features?.[0]; if (!f) return;
      const v = (f.state as any)?.brut;
      popup.setLngLat(e.lngLat).setHTML(`<strong>${f.properties?.nom} (${f.properties?.code})</strong><br>${v != null ? format(v) : "—"}`).addTo(m);
    });
    m.on("mouseleave", "dep-ext", () => popup.remove());
    return () => { m.remove(); carte.current = null; pret.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = carte.current; if (!m) return;
    const appliquer = () => {
      if (!pret.current || !geo.current) return;
      for (const f of geo.current.features) {
        const c = f.properties.code; const v = valeurs[c];
        m.setFeatureState({ source: "dep", id: c }, { v: v != null ? Math.max(0.04, v / max) : 0, brut: v ?? null });
      }
      marqueurs.current.forEach((mk) => mk.remove());
      marqueurs.current = (points || []).map((p) => {
        const el = document.createElement("div");
        el.style.cssText = "width:16px;height:16px;border-radius:50%;background:#fbbf24;border:3px solid #fff;box-shadow:0 0 0 6px rgba(251,191,36,.3)";
        el.setAttribute("aria-label", p.label);
        return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).setPopup(new maplibregl.Popup().setText(p.label)).addTo(m);
      });
      const cible = focus ? { center: [focus.lng, focus.lat] as [number, number], zoom: focus.zoom, pitch: 50, bearing: -15 } : null;
      if (cible) { setTimeout(() => reduit() ? m.jumpTo(cible) : m.flyTo({ ...cible, duration: 4200, curve: 1.6, essential: true }), 1400); return; }
      if (focusDept) {
        const f = geo.current.features.find((x: any) => x.properties.code === focusDept);
        if (f) {
          const b = new maplibregl.LngLatBounds();
          const parcourir = (c: any) => (typeof c[0] === "number" ? b.extend(c as [number, number]) : c.forEach(parcourir));
          parcourir(f.geometry.coordinates);
          setTimeout(() => {
            m.fitBounds(b, { padding: 60, pitch: 48, bearing: -12, duration: reduit() ? 0 : 3800, maxZoom: 8 });
            setTimeout(() => m.flyTo({ center: FRANCE, zoom: window.innerWidth < 640 ? 4.3 : 4.9, pitch: 42, bearing: -8, duration: reduit() ? 0 : 3200 }), 6500);
          }, 1400);
        }
      }
    };
    appliquerRef.current = appliquer;
    appliquer();
  }, [valeurs, focus, focusDept, points, max]);

  const n = Object.keys(valeurs).length;
  return (
    <div className="carte-zone">
      <div ref={ref} style={{ position: "absolute", inset: 0 }} role="img" aria-label={`Carte de France : ${legende || "zone analysée"}. Le détail est disponible dans les listes ci-dessous.`} />
      {titre && <div className="carte-titre"><span className="pastille-live" aria-hidden="true" />{titre}</div>}
      {n > 0 && (
        <div className="carte-legende" aria-hidden="true">
          {legende}
          <div className="degrade" />
          <div className="bornes"><span>faible</span><span>{format(max)}</span></div>
        </div>
      )}
    </div>
  );
}
