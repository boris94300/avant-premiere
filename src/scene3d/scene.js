// scene.js - a timber footbridge over a village pond at night. One hung lantern (the only warm
// practical) is the receiver light for deck, rail, stringers, bent, bolts, reeds, bank stones and
// the near water; a cool moon separates leaf masses and draws a glitter path on the water.
// World units are metres, y up. The bridge runs along x; the lantern hangs on the +z side.
import * as THREE from 'three';
import { create as createReeds } from './kits/nature/reeds.js';

export const DECK_Y = 0.62;          // top of deck planks
export const WATER_Y = -0.12;
const POND = { rx: 4.6, rz: 2.6 };
const BRIDGE_HALF = 5.5;
const STRINGER = { h: 0.24, w: 0.14, z: 0.55 };
const POST = { s: 0.09, z: 0.665 };
const LANTERN_X = 2.4;
// Flame position: the PointLight sits exactly here, inside an open-bottomed iron frame.
export const LANTERN_POS = new THREE.Vector3(LANTERN_X, DECK_Y + 1.70, 1.15);

function makeRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// Terrain authority: the pond basin is carved by elliptical distance; every placement uses h().
export function groundHeight(x, z) {
  const r = Math.hypot(x / POND.rx, z / POND.rz);
  const bank = -0.8 + 0.85 * smooth((r - 0.75) / 0.4);
  const noise = 0.05 * Math.sin(x * 1.3 + 0.4) * Math.cos(z * 1.1 - 0.2) + 0.025 * Math.sin(x * 3.1 + z * 2.3);
  return bank + noise * smooth((r - 0.9) / 0.4);
}
// Where the water meets the bank at polar angle a (bisection on the ellipse radius).
export function edgePoint(a, offset = 0) {
  let lo = 0.75, hi = 1.3;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (groundHeight(Math.cos(a) * POND.rx * m, Math.sin(a) * POND.rz * m) < WATER_Y) lo = m; else hi = m;
  }
  const r = lo + offset;
  const x = Math.cos(a) * POND.rx * r, z = Math.sin(a) * POND.rz * r;
  return new THREE.Vector3(x, groundHeight(x, z), z);
}

function canvasTexture(w, h, paint) {
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  paint(canvas.getContext('2d'), w, h);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
// Longitudinal grain: streaks run along u (the member's long axis after construction).
function grainSide(random) {
  return canvasTexture(512, 128, (c, w, h) => {
    c.fillStyle = '#d8d0c4'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      const v = 0.78 + 0.22 * Math.sin(y * 0.55 + Math.sin(y * 0.13) * 3) * (0.6 + random() * 0.4);
      c.fillStyle = `rgba(${Math.round(150 * v)},${Math.round(132 * v)},${Math.round(112 * v)},0.55)`;
      c.fillRect(0, y, w, 1);
    }
    for (let i = 0; i < 40; i++) {           // checks and splits, aligned with the fibre
      c.strokeStyle = 'rgba(40,30,22,0.35)'; c.lineWidth = 1;
      const y = random() * h, x = random() * w, len = 20 + random() * 120;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + (random() - 0.5) * 3); c.stroke();
    }
  });
}
// Crosscut ends show growth rings, not stripes.
function grainEnd() {
  return canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = '#b8a48a'; c.fillRect(0, 0, w, h);
    for (let r = 90; r > 2; r -= 5) {
      c.strokeStyle = r % 10 ? 'rgba(95,70,48,0.45)' : 'rgba(120,92,64,0.35)'; c.lineWidth = 2;
      c.beginPath(); c.arc(w * 0.3, h * 1.1, r * 1.4, 0, Math.PI * 2); c.stroke();
    }
  });
}
function rippleNormalMap(random) {
  const size = 256, data = new Uint8Array(size * size * 4), height = new Float32Array(size * size);
  const waves = Array.from({ length: 14 }, () => ({ kx: Math.round((random() - 0.5) * 18), ky: Math.round((random() - 0.5) * 18), p: random() * 6.28, a: 0.3 + random() }));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let v = 0;
    for (const wv of waves) v += wv.a * Math.sin((wv.kx * x + wv.ky * y) / size * Math.PI * 2 + wv.p);
    height[y * size + x] = v;
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hL = height[y * size + ((x + size - 1) % size)], hR = height[y * size + ((x + 1) % size)];
    const hD = height[((y + size - 1) % size) * size + x], hU = height[((y + 1) % size) * size + x];
    const n = new THREE.Vector3((hL - hR) * 0.35, (hD - hU) * 0.35, 1).normalize();
    const i = (y * size + x) * 4;
    data[i] = (n.x * 0.5 + 0.5) * 255; data[i + 1] = (n.y * 0.5 + 0.5) * 255; data[i + 2] = (n.z * 0.5 + 0.5) * 255; data[i + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.needsUpdate = true;
  return texture;
}
function moonTexture() {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.86, '#e6ebf5'); g.addColorStop(0.95, 'rgba(230,235,245,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(150,160,180,0.22)';
    for (const [x, y, r] of [[52, 50, 14], [80, 70, 10], [60, 84, 8], [84, 44, 6]]) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  });
}
function radialSprite(inner, outer) {
  return canvasTexture(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner); g.addColorStop(1, outer);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}

export function createScene({ renderer, look }) {
  const random = makeRandom(20261114);
  const scene = new THREE.Scene();
  const disposables = [];
  const keep = (x) => (disposables.push(x), x);

  // --- sky: screen gradient for the background, the same gradient as a dim environment --------
  const skyTexture = keep(canvasTexture(1, 256, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, look.sky.zenith); g.addColorStop(1, look.sky.horizon);
    c.fillStyle = g; c.fillRect(0, 0, 1, 256);
  }));
  scene.background = skyTexture;
  scene.fog = new THREE.FogExp2(new THREE.Color(look.fog.color), look.fog.density);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { zenith: { value: new THREE.Color(look.sky.zenith) }, horizon: { value: new THREE.Color(look.sky.horizon) }, ground: { value: new THREE.Color('#06080c') } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 zenith, horizon, ground; varying vec3 vDir; void main(){ float y = vDir.y; vec3 c = y > 0.0 ? mix(horizon, zenith, pow(y, 0.6)) : mix(horizon, ground, min(1.0, -y * 4.0)); gl_FragColor = vec4(c, 1.0); }'
  })));
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = keep(pmrem.fromScene(envScene, 0));
  scene.environment = environment.texture;
  envScene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();

  // --- materials ------------------------------------------------------------------------------
  const side = keep(grainSide(random)), end = keep(grainEnd());
  const sideV = keep(side.clone()); sideV.center.set(0.5, 0.5); sideV.rotation = Math.PI / 2;
  const wood = (color, roughness = 0.82) => {
    const s = keep(new THREE.MeshStandardMaterial({ map: side, color, roughness }));
    const e = keep(new THREE.MeshStandardMaterial({ map: end, color, roughness: 0.95 }));
    return [e, e, s, s, s, s];          // BoxGeometry groups: +x, -x, +y, -y, +z, -z
  };
  const M = {
    deck: wood('#8a6a4c', 0.86), beam: wood('#6a5038'), post: wood('#7a5c40'), rail: wood('#94744f', 0.7),
    pile: keep(new THREE.MeshStandardMaterial({ map: sideV, color: '#5a4430', roughness: 0.9 })),
    iron: keep(new THREE.MeshStandardMaterial({ color: '#45403a', metalness: 0.85, roughness: 0.42 })),
    stone: keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9, flatShading: true })),
    ground: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 })),
    leaf: keep(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5, side: THREE.DoubleSide })),
    bark: keep(new THREE.MeshStandardMaterial({ map: sideV, color: '#4a3b2f', roughness: 0.95 })),
    wax: keep(new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.6 })),
    flame: keep(new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffb46b', emissiveIntensity: 4 })),
    glass: keep(new THREE.MeshPhysicalMaterial({ color: '#ffe2b8', roughness: 0.08, transparent: true, opacity: 0.2,
      emissive: '#ffb46b', emissiveIntensity: 0.08, depthWrite: false, side: THREE.DoubleSide }))
  };
  const add = (mesh, { cast = true, receive = true } = {}) => { mesh.castShadow = cast; mesh.receiveShadow = receive; scene.add(mesh); return mesh; };
  // Every timber member is built along x so the grain map follows its fibre, then rotated.
  const timber = (len, h, w, mat, pos, rot = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(len, h, w)), mat);
    mesh.position.set(...pos); mesh.rotation.set(...rot); return add(mesh);
  };

  // --- ground and pond ------------------------------------------------------------------------
  const groundGeo = keep(new THREE.PlaneGeometry(48, 48, 192, 192));
  groundGeo.rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position, colors = new Float32Array(gp.count * 3);
  const mud = new THREE.Color('#1d1912'), wet = new THREE.Color('#2a2a1d'), grass = new THREE.Color('#44523a'), tmp = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), y = groundHeight(x, z);
    gp.setY(i, y);
    tmp.copy(mud).lerp(wet, smooth((y + 0.3) / 0.2)).lerp(grass, smooth((y - 0.0) / 0.08));
    tmp.multiplyScalar(0.85 + 0.3 * random());
    colors.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundGeo.computeVertexNormals();
  add(new THREE.Mesh(groundGeo, M.ground), { cast: false });

  const ripple = keep(rippleNormalMap(random)); ripple.repeat.set(5, 3);
  M.water = keep(new THREE.MeshStandardMaterial({ color: '#0a1820', roughness: 0.14, metalness: 0,
    normalMap: ripple, normalScale: new THREE.Vector2(0.3, 0.3) }));
  const waterGeo = keep(new THREE.CircleGeometry(1, 128)); waterGeo.rotateX(-Math.PI / 2);
  const water = add(new THREE.Mesh(waterGeo, M.water), { cast: false });
  water.scale.set(POND.rx * 1.25, 1, POND.rz * 1.25); water.position.y = WATER_Y;

  // --- bank stones: half-sunk at the waterline, denser near the bridge ends -------------------
  const STONES = 120;
  const stones = new THREE.InstancedMesh(keep(new THREE.DodecahedronGeometry(1, 0)), M.stone, STONES);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (let i = 0; i < STONES; i++) {
    const a = (i / STONES) * Math.PI * 2 + random() * 0.05;
    const p = edgePoint(a, (random() - 0.4) * 0.06);
    const size = 0.12 + random() ** 2 * 0.26;
    s.set(size * (1 + random() * 0.6), size * (0.45 + random() * 0.3), size * (0.8 + random() * 0.5));
    q.setFromEuler(e.set(random() * 0.4, random() * 6.28, random() * 0.4));
    stones.setMatrixAt(i, mtx.compose(v.set(p.x, Math.max(p.y, WATER_Y) - s.y * 0.35, p.z), q, s));
    stones.setColorAt(i, tmp.setHSL(0.09 + random() * 0.04, 0.06 + random() * 0.05, 0.3 + random() * 0.14));
  }
  add(stones);

  // --- bridge ---------------------------------------------------------------------------------
  const stringerTop = DECK_Y - 0.04, stringerY = stringerTop - STRINGER.h / 2, stringerBottom = stringerTop - STRINGER.h;
  for (const sz of [-1, 1]) timber(BRIDGE_HALF * 2, STRINGER.h, STRINGER.w, M.beam, [0, stringerY, sz * STRINGER.z]);
  // abutments: dressed stone footings carry the stringer ends on the bank
  for (const sx of [-1, 1]) {
    const x = sx * (BRIDGE_HALF - 0.25), g = groundHeight(x, 0);
    const foot = new THREE.Mesh(keep(new THREE.BoxGeometry(0.6, stringerBottom - g + 0.15, 1.55)), M.stone);
    foot.position.set(x, (stringerBottom + g - 0.15) / 2, 0); add(foot);
  }
  // deck planks with gaps and per-board variation
  const PLANK_W = 0.21, GAP = 0.014, planks = [];
  for (let x = -BRIDGE_HALF + PLANK_W / 2; x < BRIDGE_HALF; x += PLANK_W + GAP) planks.push(x);
  const deck = new THREE.InstancedMesh(keep(new THREE.BoxGeometry(1.26, 0.04, PLANK_W)), M.deck, planks.length);
  planks.forEach((x, i) => {
    q.setFromEuler(e.set((random() - 0.5) * 0.012, Math.PI / 2 + (random() - 0.5) * 0.01, 0));
    deck.setMatrixAt(i, mtx.compose(v.set(x, DECK_Y - 0.02 + (random() - 0.5) * 0.006, 0), q, s.set(1, 1, 1)));
    deck.setColorAt(i, tmp.setHSL(0.07 + random() * 0.02, 0.25 + random() * 0.1, 0.55 + random() * 0.25));
  });
  add(deck);
  // posts, handrail, mid-rail
  const postXs = [];
  for (let x = -4.8; x <= 4.81; x += 1.2) postXs.push(+x.toFixed(2));
  for (const sz of [-1, 1]) for (const x of postXs) {
    const tall = sz > 0 && x === LANTERN_X;
    const top = DECK_Y + (tall ? 2.12 : 1.0), bottom = stringerBottom;
    timber(top - bottom, POST.s, POST.s, M.post, [x, (top + bottom) / 2, sz * POST.z], [0, 0, Math.PI / 2]);
  }
  for (const sz of [-1, 1]) {
    timber(BRIDGE_HALF * 2 - 0.9, 0.06, 0.13, M.rail, [0, DECK_Y + 1.03, sz * POST.z]);
    timber(BRIDGE_HALF * 2 - 0.9, 0.08, 0.05, M.rail, [0, DECK_Y + 0.5, sz * (POST.z - POST.s / 2 - 0.025)]);
  }
  // two pile bents in the water
  for (const bx of [-1.7, 1.7]) {
    timber(1.6, 0.18, 0.16, M.beam, [bx, stringerBottom - 0.09, 0], [0, Math.PI / 2, 0]);
    for (const sz of [-1, 1]) {
      const top = stringerBottom - 0.18, bottom = groundHeight(bx, sz * STRINGER.z) - 0.1;
      const pile = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.085, 0.095, top - bottom, 14)), M.pile);
      pile.position.set(bx, (top + bottom) / 2, sz * STRINGER.z); add(pile);
    }
  }
  // fasteners: hex bolt heads + washers, splice plates, deck nails
  const bolts = [];
  const bolt = (pos, axis) => bolts.push({ pos, axis });
  for (const sz of [-1, 1]) for (const x of postXs) for (const dy of [-0.10, -0.21]) {
    bolt([x, DECK_Y + dy, sz * (POST.z + POST.s / 2 + 0.008)], [0, 0, sz]);
    bolt([x, DECK_Y + dy, sz * (STRINGER.z - STRINGER.w / 2 - 0.008)], [0, 0, -sz]);
  }
  for (const bx of [-1.7, 1.7]) for (const sz of [-1, 1]) for (const dx of [-1, 1])
    bolt([bx + dx * 0.088, stringerBottom - 0.09, sz * STRINGER.z], [dx, 0, 0]);
  for (const sz of [-1, 1]) {
    const plate = new THREE.Mesh(keep(new THREE.BoxGeometry(0.44, 0.16, 0.008)), M.iron);
    plate.position.set(0.6, stringerY, sz * (STRINGER.z + STRINGER.w / 2 + 0.004)); add(plate);
    for (const dx of [-0.15, 0.15]) for (const dy of [-0.045, 0.045]) bolt([0.6 + dx, stringerY + dy, sz * (STRINGER.z + STRINGER.w / 2 + 0.012)], [0, 0, sz]);
  }
  const headGeo = keep(new THREE.CylinderGeometry(0.019, 0.019, 0.016, 6)), washerGeo = keep(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 18));
  const heads = new THREE.InstancedMesh(headGeo, M.iron, bolts.length), washers = new THREE.InstancedMesh(washerGeo, M.iron, bolts.length);
  const up = new THREE.Vector3(0, 1, 0);
  bolts.forEach(({ pos, axis }, i) => {
    const dir = new THREE.Vector3(...axis).normalize(); q.setFromUnitVectors(up, dir);
    heads.setMatrixAt(i, mtx.compose(v.set(...pos).addScaledVector(dir, 0.006), q, s.set(1, 1, 1)));
    washers.setMatrixAt(i, mtx.compose(v.set(...pos).addScaledVector(dir, -0.004), q, s.set(1, 1, 1)));
  });
  add(heads); add(washers);
  const nails = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.0075, 0.0075, 0.004, 8)), M.iron, planks.length * 4);
  let n = 0;
  for (const x of planks) for (const sz of [-1, 1]) for (const dx of [-0.055, 0.055])
    nails.setMatrixAt(n++, mtx.compose(v.set(x + dx, DECK_Y + 0.001, sz * STRINGER.z), q.identity(), s.set(1, 1, 1)));
  add(nails, { cast: false });

  // --- lantern bracket and fixture --------------------------------------------------------------
  const armY = DECK_Y + 2.06;
  timber(0.7, 0.09, 0.07, M.post, [LANTERN_X, armY, POST.z + 0.31], [0, Math.PI / 2, 0]);
  const ironBar = (a, b, r = 0.008) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
    const mesh = new THREE.Mesh(keep(new THREE.CylinderGeometry(r, r, len, 8)), M.iron);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, B.clone().sub(A).normalize()); return add(mesh);
  };
  ironBar([LANTERN_X, DECK_Y + 1.72, POST.z + POST.s / 2], [LANTERN_X, armY - 0.04, POST.z + 0.44], 0.011);
  const L = LANTERN_POS, body = { top: L.y + 0.16, bottom: L.y - 0.11, half: 0.075 };
  ironBar([L.x, armY - 0.045, L.z], [L.x, body.top + 0.1, L.z], 0.005);
  const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.02, 0.004, 6, 16)), M.iron);
  ring.position.set(L.x, body.top + 0.115, L.z); add(ring);
  const cap = new THREE.Mesh(keep(new THREE.ConeGeometry(0.125, 0.1, 4, 1)), M.iron);
  cap.position.set(L.x, body.top + 0.05, L.z); cap.rotation.y = Math.PI / 4; add(cap);
  const plateTop = new THREE.Mesh(keep(new THREE.BoxGeometry(0.17, 0.012, 0.17)), M.iron);
  plateTop.position.set(L.x, body.top, L.z); add(plateTop);
  const bar = (len, ax, pos) => {
    const g = ax === 'y' ? new THREE.BoxGeometry(0.012, len, 0.012) : ax === 'x' ? new THREE.BoxGeometry(len, 0.012, 0.012) : new THREE.BoxGeometry(0.012, 0.012, len);
    const m = new THREE.Mesh(keep(g), M.iron); m.position.set(...pos); return add(m);
  };
  const H = body.top - body.bottom, cy = (body.top + body.bottom) / 2, k = body.half;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bar(H, 'y', [L.x + sx * k, cy, L.z + sz * k]);
  // Open bottom frame: only a perimeter, so the downward pool reaches the deck edge and water.
  for (const sz of [-1, 1]) bar(2 * k, 'x', [L.x, body.bottom, L.z + sz * k]);
  for (const sx of [-1, 1]) bar(2 * k, 'z', [L.x + sx * k, body.bottom, L.z]);
  for (const [sx, sz, ry] of [[0, 1, 0], [0, -1, 0], [1, 0, Math.PI / 2], [-1, 0, Math.PI / 2]]) {
    const pane = new THREE.Mesh(keep(new THREE.PlaneGeometry(2 * k - 0.01, H - 0.01)), M.glass);
    pane.position.set(L.x + sx * k, cy, L.z + sz * k); pane.rotation.y = ry; add(pane, { cast: false, receive: false });
  }
  const crossbar = bar(2 * k, 'x', [L.x, L.y - 0.075, L.z]); crossbar.castShadow = false;
  const wax = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.018, 0.02, 0.06, 14)), M.wax);
  wax.position.set(L.x, L.y - 0.045, L.z); add(wax, { cast: false });
  const flame = new THREE.Mesh(keep(new THREE.SphereGeometry(0.016, 14, 10)), M.flame);
  flame.scale.set(1, 1.9, 1); flame.position.copy(L); add(flame, { cast: false, receive: false });

  // --- reeds at the pond edge (kit: knowledge.blueprint-reeds, adapted heights) ----------------
  const reedClumps = [];
  for (const [a, count, height] of [[0.42, 46, 1.3], [0.78, 36, 1.1], [1.25, 30, 1.0], [2.4, 40, 1.2], [3.3, 28, 1.0], [4.05, 34, 1.15], [5.35, 40, 1.25], [5.9, 30, 1.05]]) {
    const clump = createReeds({ count, seed: Math.round(a * 100), spread: 0.55, height, blade: '#6f8a4e' });
    const p = edgePoint(a, -0.02);
    clump.group.position.set(p.x, Math.max(p.y, WATER_Y - 0.02), p.z);
    clump.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(clump.group); reedClumps.push(clump);
  }

  // --- trees on the far bank: leaf cards in lobes, so the moon can rim individual masses -------
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.08); leafShape.quadraticCurveTo(0.045, -0.02, 0, 0.08); leafShape.quadraticCurveTo(-0.045, -0.02, 0, -0.08);
  const leafGeo = keep(new THREE.ShapeGeometry(leafShape, 3));
  const trees = [];
  const tree = (x, z, height, lobes, perLobe, seedHue) => {
    const g = groundHeight(x, z);
    const trunk = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.12, 0.2, height * 0.62, 10)), M.bark);
    trunk.position.set(x, g + height * 0.31, z); add(trunk);
    const centers = [];
    for (let i = 0; i < lobes; i++) {
      const a = random() * 6.28, r = random() * 1.1;
      centers.push(new THREE.Vector3(x + Math.cos(a) * r, g + height * (0.62 + random() * 0.32), z + Math.sin(a) * r * 0.8));
    }
    for (const c of centers.slice(0, 3)) ironFreeBranch(new THREE.Vector3(x, g + height * 0.5, z), c);
    const leaves = new THREE.InstancedMesh(leafGeo, M.leaf, lobes * perLobe);
    let i = 0;
    for (const c of centers) {
      const lobeR = 0.55 + random() * 0.4;
      for (let j = 0; j < perLobe; j++) {
        const d = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1).normalize();
        const p = c.clone().addScaledVector(d, lobeR * Math.cbrt(0.35 + random() * 0.65));
        q.setFromEuler(e.set(random() * 6.28, random() * 6.28, random() * 6.28));
        leaves.setMatrixAt(i, mtx.compose(p, q, s.setScalar(0.8 + random() * 0.6)));
        leaves.setColorAt(i++, tmp.setHSL(seedHue + (random() - 0.5) * 0.05, 0.22 + random() * 0.12, 0.17 + random() * 0.1));
      }
    }
    add(leaves); trees.push(leaves);
  };
  function ironFreeBranch(a, b) {
    const len = a.distanceTo(b) * 0.8, mesh = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.08, len, 7)), M.bark);
    const dir = b.clone().sub(a).normalize();
    mesh.position.copy(a).addScaledVector(dir, len / 2); mesh.quaternion.setFromUnitVectors(up, dir); add(mesh);
  }
  tree(-1.6, -4.4, 4.6, 7, 420, 0.32);
  tree(2.8, -5.0, 5.2, 8, 420, 0.3);
  tree(-6.6, -1.6, 3.8, 5, 360, 0.34);

  // --- moon disc and halo (sky objects, not lights) -------------------------------------------
  const moonMat = keep(new THREE.SpriteMaterial({ map: keep(moonTexture()), color: new THREE.Color(2.4, 2.6, 3.0), fog: false }));
  const moonDisc = new THREE.Sprite(moonMat); moonDisc.scale.setScalar(4.2);
  const haloMat = keep(new THREE.SpriteMaterial({ map: keep(radialSprite('rgba(150,170,230,0.22)', 'rgba(150,170,230,0)')), fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  const halo = new THREE.Sprite(haloMat); halo.scale.setScalar(16);
  scene.add(halo, moonDisc);

  // --- lights: one owner each ------------------------------------------------------------------
  const moon = new THREE.DirectionalLight('#9fb4ff', 0.3);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 70 });
  moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  const fill = new THREE.HemisphereLight('#16233f', '#241a12', 0.12); scene.add(fill);
  const lantern = new THREE.PointLight('#ffb46b', 80, 0, 2);
  lantern.position.copy(LANTERN_POS); lantern.castShadow = true;
  lantern.shadow.mapSize.set(1024, 1024); lantern.shadow.camera.near = 0.03; lantern.shadow.camera.far = 14;
  lantern.shadow.bias = -0.0004; lantern.shadow.normalBias = 0.02;
  scene.add(lantern);

  const moonDir = new THREE.Vector3();
  function setMoonDirection(azDeg, elDeg) {
    moonDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elDeg), THREE.MathUtils.degToRad(azDeg));
    moon.position.copy(moonDir).multiplyScalar(35); moon.target.position.set(0, 0, 0);
    moon.target.updateMatrixWorld();
    moonDisc.position.copy(moonDir).multiplyScalar(120); halo.position.copy(moonDisc.position);
  }

  let time = 0;
  return {
    scene, lights: { moon, fill, lantern }, materials: M, moonDisc, halo, setMoonDirection,
    update(dt) {
      if (dt <= 0) return false;
      time += dt;
      ripple.offset.set(time * 0.012, time * 0.007);
      for (const clump of reedClumps) clump.animate(dt, 0.6);
      return true;
    },
    dispose() {
      scene.traverse((o) => { if (o.isInstancedMesh) o.dispose(); o.geometry?.dispose?.(); });
      for (const d of disposables) d.dispose?.();
      lantern.shadow.map?.dispose(); moon.shadow.map?.dispose();
    }
  };
}
