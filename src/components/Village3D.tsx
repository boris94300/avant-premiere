"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { scene as bus, type Focus, type LumiereLead, type Repere } from "@/lib/scene-bus";

type V3 = [number, number, number];
// Coordonnées dans l'espace d'origine du village ; dir = direction caméra depuis la cible, dist en unités monde.
const VUES: Record<Focus, { cible: V3; dir: V3; dist: number }> = {
  overview: { cible: [0, 0.75, 0.1], dir: [0.62, 0.42, 0.78], dist: 0.43 },
  lanterne: { cible: [0.95, 0.5, 2.25], dir: [0.45, 0.42, 1], dist: 0.15 },
  pont: { cible: [0.7, 0.8, 1.1], dir: [0.75, 0.5, 0.9], dist: 0.4 },
  arbre: { cible: [3.72, 0.75, 0.57], dir: [1, 0.4, 0.75], dist: 0.17 },
  moulin: { cible: [-2.0, 0.55, 1.6], dir: [-0.15, 0.4, 1], dist: 0.19 },
};
export const REPERES: { id: Repere; libelle: string; aide: string; ancre: V3 }[] = [
  { id: "lanterne", libelle: "Recherche", aide: "La lanterne", ancre: [0.81, 0.78, 2.43] },
  { id: "arbre", libelle: "Profils", aide: "L'arbre", ancre: [3.72, 1.0, 0.57] },
  { id: "pont", libelle: "Résultats", aide: "Le pont", ancre: [1.8, 0.5, 1.72] },
  { id: "moulin", libelle: "Modèle économique", aide: "Le moulin", ancre: [-2.0, 0.95, 1.6] },
];
const MAX_LUMIERES = 48;

export default function Village3D() {
  const boite = useRef<HTMLDivElement>(null);
  const reperes = useRef<(HTMLButtonElement | null)[]>([]);
  const pointeurs = useRef<(HTMLButtonElement | null)[]>([]);
  const [tops, setTops] = useState<LumiereLead[]>([]);
  useEffect(() => bus.ecouter((e) => setTops((t) => { const n = e.leads.filter((l) => l.rang); return n.length === t.length && n.every((l, i) => l.id === t[i].id) ? t : n; })), []);
  const chemin = usePathname();
  const routeur = useRouter();
  const nav = useRef({ chemin, routeur });
  nav.current = { chemin, routeur };

  // Sur les pages secondaires, la caméra se pose sur l'élément correspondant.
  useEffect(() => {
    if (chemin === "/modele") bus.regler({ focus: "moulin", decaleX: 0.45, decaleY: 0 });
  }, [chemin]);

  function clicRepere(r: Repere) {
    if (r === "moulin") return nav.current.routeur.push("/modele");
    if (nav.current.chemin !== "/") { nav.current.routeur.push(`/?vue=${r}`); return; }
    bus.cliquerRepere(r);
  }

  useEffect(() => {
    if (!boite.current) return;
    const el: HTMLDivElement = boite.current;
    let stop = () => {};
    let mort = false;
    (async () => {
      const THREE = await import("three");
      const [{ village }, { createNightLighting }, { RoomEnvironment }, { mergeGeometries }] = await Promise.all([
        import("@/scene3d/village/crafted-village.js"),
        import("@/scene3d/village/night-lighting.js"),
        import("three/addons/environments/RoomEnvironment.js"),
        import("three/addons/utils/BufferGeometryUtils.js"),
      ]);
      if (mort) return;
      const reduit = matchMedia("(prefers-reduced-motion: reduce)").matches;
      const canvas = document.createElement("canvas");
      canvas.className = "fond-canvas";
      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); }
      catch { el.dataset.pret = "0"; return; }
      el.prepend(canvas);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      const sc = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 200);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
      sc.environment = env.texture;

      const modele = village();
      sc.add(modele.group);
      const nuit = createNightLighting(sc, renderer, { key: {}, fill: {}, rim: {}, contact: {} });
      nuit.activate("night-bridge", modele);
      modele.group.updateMatrixWorld(true);
      // Fusion des ~4000 pièces fixes en quelques maillages (un par matériau) : c'est ce qui rend le rendu fluide.
      const fusionnes: InstanceType<typeof THREE.BufferGeometry>[] = [];
      {
        const mobiles = new Set(modele.dynamique);
        const inverse = new THREE.Matrix4().copy(modele.subject.matrixWorld).invert();
        const lots = new Map<string, { mat: InstanceType<typeof THREE.Material>; ombre: boolean; recoit: boolean; geos: InstanceType<typeof THREE.BufferGeometry>[] }>();
        const retirer: InstanceType<typeof THREE.Object3D>[] = [];
        const m4 = new THREE.Matrix4();
        const visite = (o: InstanceType<typeof THREE.Object3D>) => {
          if (mobiles.has(o) || !o.visible) return;
          const me = o as InstanceType<typeof THREE.Mesh>;
          if (me.isMesh && !(me as unknown as { isInstancedMesh?: boolean }).isInstancedMesh && !Array.isArray(me.material) && !me.material.transparent && me.geometry.attributes.position && me.geometry.attributes.normal) {
            let g = me.geometry.index ? me.geometry.toNonIndexed() : me.geometry.clone();
            for (const n of Object.keys(g.attributes)) if (n !== "position" && n !== "normal" && n !== "uv" && n !== "color") g.deleteAttribute(n);
            g.morphAttributes = {};
            m4.multiplyMatrices(inverse, me.matrixWorld); g.applyMatrix4(m4);
            if (m4.determinant() < 0) { const idx = Array.from({ length: g.attributes.position.count }, (_, i) => i - (i % 3) + (2 - (i % 3))); g.setIndex(idx); const h = g.toNonIndexed(); g.dispose(); g = h; }
            const cle = [me.material.uuid, me.castShadow, me.receiveShadow, Object.keys(g.attributes).sort().join("+")].join("|");
            let lot = lots.get(cle); if (!lot) lots.set(cle, (lot = { mat: me.material, ombre: me.castShadow, recoit: me.receiveShadow, geos: [] }));
            lot.geos.push(g); retirer.push(me);
          }
          for (const c of o.children) visite(c);
        };
        visite(modele.subject);
        for (const lot of lots.values()) {
          const g = mergeGeometries(lot.geos as Parameters<typeof mergeGeometries>[0], false); lot.geos.forEach((x) => x.dispose());
          if (!g) continue;
          const m = new THREE.Mesh(g, lot.mat); m.castShadow = lot.ombre; m.receiveShadow = lot.recoit; m.matrixAutoUpdate = false;
          modele.subject.add(m); fusionnes.push(g);
        }
        // Les pièces d'origine sans enfant sont retirées ; celles qui portent des enfants gardent leur place, sans géométrie visible.
        for (const o of retirer) { if (o.children.length === 0) o.removeFromParent(); else (o as InstanceType<typeof THREE.Mesh>).geometry = new THREE.BufferGeometry(); }
        modele.group.updateMatrixWorld(true);
      }
      // Les lumières ne bougent pas : les ombres sont calculées une fois, pas à chaque image.
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = true;
      const monde = (p: V3) => modele.subject.localToWorld(new THREE.Vector3(...p));
      const ancres = REPERES.map((r) => monde(r.ancre));

      // Lumières d'opportunités : lanternes flottantes au-dessus du village.
      const c2 = document.createElement("canvas"); c2.width = c2.height = 64;
      const g2 = c2.getContext("2d")!; const gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,214,150,.95)"); gr.addColorStop(0.5, "rgba(255,170,80,.28)"); gr.addColorStop(1, "rgba(255,150,60,0)");
      g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
      const halo = new THREE.CanvasTexture(c2); halo.colorSpace = THREE.SRGBColorSpace;
      const lumieres = new THREE.Group(); sc.add(lumieres);
      type Lum = { rang?: number; sprite: InstanceType<typeof THREE.Sprite>; base: InstanceType<typeof THREE.Vector3>; id: string; taille: number; naissance: number; phase: number };
      let lums: Lum[] = [];
      let horloge = 0;
      function majLumieres(leads: LumiereLead[]) {
        const garde = new Map(lums.map((l) => [l.id, l]));
        const suivant: Lum[] = [];
        leads.slice(0, MAX_LUMIERES).forEach((ld, i) => {
          let l = garde.get(ld.id);
          if (l) garde.delete(ld.id);
          else {
            const a = i * 2.399, r = 0.9 + (i % 9) * 0.36;
            const base = monde([Math.sin(a) * r, 0.75 + (i % 5) * 0.22, Math.cos(a) * r * 0.78]);
            const mat = new THREE.SpriteMaterial({ map: halo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, color: ld.score >= 75 ? "#ffd9a0" : ld.score >= 55 ? "#ffb868" : "#d98a4a" });
            const sprite = new THREE.Sprite(mat); sprite.position.copy(base); sprite.userData.id = ld.id; lumieres.add(sprite);
            if (ld.rang) { base.copy(monde([[-1.5, 0.3, 1.4][ld.rang - 1] ?? 0, 1.75 + (ld.rang === 1 ? 0.3 : 0), [0.9, -0.6, 0.2][ld.rang - 1] ?? 0])); sprite.position.copy(base); mat.color.set("#fff0d0"); }
            l = { sprite, base, id: ld.id, rang: ld.rang, taille: ld.rang ? 0.05 : 0.012 + (ld.score / 100) * 0.014, naissance: horloge + i * 0.07, phase: i * 1.7 };
          }
          suivant.push(l);
        });
        garde.forEach((l) => { lumieres.remove(l.sprite); l.sprite.material.dispose(); });
        lums = suivant; el.dataset.lums = String(lums.length);
      }

      // Caméra : vol amorti vers la vue demandée, rotation au glisser.
      const pos = new THREE.Vector3(), cible = new THREE.Vector3(), butPos = new THREE.Vector3(), butCible = new THREE.Vector3(), tmp = new THREE.Vector3();
      const Y = new THREE.Vector3(0, 1, 0);
      const dePos = new THREE.Vector3(), deCible = new THREE.Vector3();
      let vol = 1, deX = 0, deY = 0, duree = 1.5, moyenne = 16, ratio = 1, depuisRatio = 0;
      const depart = () => { dePos.copy(pos); deCible.copy(cible); deX = decX; deY = decY; vol = premier ? 1 : 0; };
      let lacet = 0, tangage = 0, lacetVu = 0, tangageVu = 0, decX = 0, decY = 0, L = 1, H = 1, premier = true, etat = bus.lire(), chaleur = 1.2;
      function viser() {
        const v = VUES[etat.focus];
        butCible.copy(monde(v.cible));
        const portrait = H > L ? 1.25 : 1;
        tmp.set(...v.dir).normalize();
        tmp.y = Math.max(0.12, tmp.y + tangageVu); tmp.normalize();
        const derive = reduit ? 0 : Math.sin(horloge * 0.11) * 0.07;
        tmp.applyAxisAngle(Y, lacetVu + derive);
        butPos.copy(butCible).addScaledVector(tmp, v.dist * portrait);
      }
      const arret = bus.ecouter((e) => {
        if (e.focus !== etat.focus) {
          // Le tour le plus court : on ne « rembobine » pas la rotation faite à la main.
          lacet = 0; tangage = 0; lacetVu = Math.atan2(Math.sin(lacetVu), Math.cos(lacetVu));
          const a = monde(VUES[etat.focus].cible), b = monde(VUES[e.focus].cible);
          duree = Math.min(2.1, 1.25 + a.distanceTo(b) * 3.2);
          depart();
        } else if (e.decaleX !== etat.decaleX || e.decaleY !== etat.decaleY) { duree = 0.9; depart(); }
        if (e.leads !== etat.leads) majLumieres(e.leads);
        etat = e; el.dataset.focus = e.focus;
      });
      majLumieres(etat.leads); el.dataset.focus = etat.focus;

      const taille = function () {
        L = el.clientWidth || 1; H = el.clientHeight || 1;
        renderer.setPixelRatio(Math.min(devicePixelRatio, L < 820 ? 1.25 : 1.5) * ratio);
        renderer.setSize(L, H, false);
        camera.aspect = L / H;
      };
      const ro = new ResizeObserver(() => taille()); ro.observe(el); taille();

      let appui: { x: number; y: number; l: number; t: number; bouge: boolean } | null = null;
      const rayon = new THREE.Raycaster(), souris = new THREE.Vector2();
      const viseLead = (ev: PointerEvent) => {
        const b = el.getBoundingClientRect();
        souris.set(((ev.clientX - b.left) / b.width) * 2 - 1, -((ev.clientY - b.top) / b.height) * 2 + 1);
        rayon.setFromCamera(souris, camera);
        const t = rayon.intersectObjects(lumieres.children, false)[0];
        return t ? (t.object.userData.id as string) : null;
      };
      const bas = (ev: PointerEvent) => { appui = { x: ev.clientX, y: ev.clientY, l: lacet, t: tangage, bouge: false }; el.dataset.glisse = "1"; };
      const bouge = (ev: PointerEvent) => {
        if (!appui) { if (ev.target === canvas) canvas.style.cursor = viseLead(ev) ? "pointer" : ""; return; }
        const dx = ev.clientX - appui.x, dy = ev.clientY - appui.y;
        if (Math.abs(dx) + Math.abs(dy) > 6) appui.bouge = true;
        lacet = appui.l - dx * 0.006; tangage = Math.max(-0.25, Math.min(0.5, appui.t + dy * 0.003));
      };
      const haut = (ev: PointerEvent) => {
        if (appui && !appui.bouge && ev.target === canvas) { const id = viseLead(ev); if (id) bus.cliquerLead(id); }
        appui = null; delete el.dataset.glisse;
      };
      canvas.addEventListener("pointerdown", bas); window.addEventListener("pointermove", bouge); window.addEventListener("pointerup", haut); window.addEventListener("pointercancel", haut);

      const proj = new THREE.Vector3();
      let raf = 0, avant = performance.now();
      const boucle = (now: number) => {
        raf = requestAnimationFrame(boucle);
        if (document.hidden) { avant = now; return; }
        const brut = now - avant;
        const dt = Math.min(0.1, brut / 1000); avant = now; horloge += dt;
        // Qualité adaptative : si l'appareil peine, on baisse la résolution plutôt que la fluidité.
        moyenne += (brut - moyenne) * 0.06; depuisRatio += dt;
        if (depuisRatio > 1.5 && !premier) {
          if (moyenne > 24 && ratio > 0.55) { ratio = Math.max(0.55, ratio * 0.8); depuisRatio = 0; taille(); }
          else if (moyenne < 13 && ratio < 1 && depuisRatio > 6) { ratio = Math.min(1, ratio * 1.15); depuisRatio = 0; taille(); }
        }
        modele.update(reduit ? 0 : dt);
        viser();
        const r = reduit ? 1 : 1 - Math.exp(-dt * 9);
        lacetVu += (lacet - lacetVu) * r; tangageVu += (tangage - tangageVu) * r;
        if (premier || reduit) vol = 1;
        if (vol < 1) {
          vol = Math.min(1, vol + dt / duree);
          const e = vol * vol * vol * (vol * (vol * 6 - 15) + 10);
          pos.lerpVectors(dePos, butPos, e); cible.lerpVectors(deCible, butCible, e);
          decX = deX + (etat.decaleX - deX) * e; decY = deY + (etat.decaleY - deY) * e;
        } else { pos.copy(butPos); cible.copy(butCible); decX = etat.decaleX; decY = etat.decaleY; }
        camera.position.copy(pos); camera.lookAt(cible);
        camera.setViewOffset(L, H, (decX * L) / 2, (decY * H) / 2, L, H);
        // Lumière des lanternes : respire pendant l'analyse, monte avec le nombre d'opportunités.
        let but = 1.2;
        if (etat.phase === "running") but = reduit ? 1.3 : 1.0 + 0.55 * (0.5 + 0.5 * Math.sin(horloge * 2.6));
        if (etat.phase === "done") but = 1.25 + 0.6 * Math.min(1, etat.leads.length / MAX_LUMIERES);
        if (Math.abs(but - chaleur) > 0.01 || premier) { chaleur += (but - chaleur) * (premier ? 1 : 0.12); nuit.set({ warm: chaleur }); }
        for (const l of lums) {
          const age = Math.max(0, Math.min(1, (horloge - l.naissance) / 0.9));
          const vie = age * age * (3 - 2 * age);
          const pulse = reduit ? 1 : 0.86 + 0.14 * Math.sin(horloge * 1.6 + l.phase);
          l.sprite.material.opacity = vie * pulse;
          l.sprite.scale.setScalar(l.taille * (0.4 + 0.6 * vie));
          l.sprite.position.copy(l.base); l.sprite.position.y += (reduit ? 0 : Math.sin(horloge * 0.6 + l.phase) * 0.003) + (1 - vie) * -0.02;
        }
        renderer.render(sc, camera);
        ancres.forEach((a, i) => {
          const b = reperes.current[i]; if (!b) return;
          proj.copy(a).project(camera);
          const vu = proj.z < 1 && Math.abs(proj.x) < 1.05 && Math.abs(proj.y) < 1.05;
          b.style.transform = `translate3d(${((proj.x + 1) / 2) * L}px, ${((1 - proj.y) / 2) * H}px, 0)`;
          b.style.visibility = vu ? "visible" : "hidden";
        });
        for (let i = 0; i < 3; i++) {
          const b = pointeurs.current[i]; if (!b) continue;
          const l = lums.find((x) => x.rang === i + 1);
          if (!l) { b.style.visibility = "hidden"; continue; }
          proj.copy(l.sprite.position).project(camera);
          b.style.transform = `translate3d(${((proj.x + 1) / 2) * L}px, ${((1 - proj.y) / 2) * H}px, 0)`;
          b.style.visibility = proj.z < 1 && Math.abs(proj.x) < 1 && Math.abs(proj.y) < 1 ? "visible" : "hidden";
          b.style.opacity = String(l.sprite.material.opacity);
        }
        if (premier) { premier = false; el.dataset.info = `${renderer.info.render.calls} appels, ${renderer.info.render.triangles} triangles`; el.dataset.pret = "1"; (window as unknown as { __sceneReady?: boolean }).__sceneReady = true; }
      };
      raf = requestAnimationFrame(boucle);

      stop = () => {
        cancelAnimationFrame(raf); arret(); ro.disconnect();
        canvas.removeEventListener("pointerdown", bas); window.removeEventListener("pointermove", bouge); window.removeEventListener("pointerup", haut); window.removeEventListener("pointercancel", haut);
        lums.forEach((l) => l.sprite.material.dispose()); halo.dispose();
        fusionnes.forEach((g) => g.dispose()); nuit.dispose(); modele.dispose(); env.dispose(); pmrem.dispose(); renderer.dispose(); canvas.remove();
      };
    })();
    return () => { mort = true; stop(); };
  }, []);

  return (
    <div className="fond" ref={boite} aria-hidden={false}>
      <div className="fond-voile" aria-hidden="true" />
      <nav className="reperes" aria-label="Éléments cliquables du village">
        {REPERES.map((r, i) => (
          <button key={r.id} type="button" className="repere" data-id={r.id} ref={(n) => { reperes.current[i] = n; }} onClick={() => clicRepere(r.id)}>
            <i aria-hidden="true" /><span><small>{r.aide}</small>{r.libelle}</span>
          </button>
        ))}
      </nav>
      <div className="pointeurs">
        {[0, 1, 2].map((i) => (
          <button key={i} type="button" className="pointeur" ref={(n) => { pointeurs.current[i] = n; }} onClick={() => tops[i] && bus.cliquerLead(tops[i].id)} hidden={!tops[i]}>
            <b>{i + 1}</b><span>{tops[i]?.etiquette}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
