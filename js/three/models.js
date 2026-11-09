// Procedural models for the evolution scene. Units are metres; +z is "forward".
// The perception core approximates the photographed prototype (enclosure, tilt bracket,
// two-lens CSI board, ribbon cable, two antennas). Everything else is a concept model.
import * as THREE from 'three';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// ---------------------------------------------------------------- textures
function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeTextures(loader, base) {
  const soil = loader.load(`${base}assets/textures/soil-diffuse.jpg`);
  soil.colorSpace = THREE.SRGBColorSpace;
  soil.wrapS = soil.wrapT = THREE.RepeatWrapping;
  soil.repeat.set(60, 60);
  soil.anisotropy = 8;
  const soilNormal = loader.load(`${base}assets/textures/soil-normal.jpg`);
  soilNormal.wrapS = soilNormal.wrapT = THREE.RepeatWrapping;
  soilNormal.repeat.set(60, 60);

  const wood = canvasTex(512, 256, (g, w, h) => {
    const r = prng(7);
    g.fillStyle = '#5a311f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 140; i++) {
      const y = r() * h, a = 0.05 + r() * 0.12;
      g.strokeStyle = r() > 0.5 ? `rgba(40,16,6,${a})` : `rgba(170,100,62,${a})`;
      g.lineWidth = 0.6 + r() * 2.2;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.012 + i) * (2 + r() * 3));
      g.stroke();
    }
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(255,220,180,0.05)'); grd.addColorStop(1, 'rgba(0,0,0,0.08)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { repeat: [1, 1] });

  // Far canopy "carpet": rows + noise, matching the instanced crop from a distance.
  const carpet = canvasTex(512, 512, (g, w, h) => {
    const r = prng(11);
    g.fillStyle = '#5c7a3a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(30,46,20,0.3)'; g.fillRect(x, 0, 2, h); }
    for (let i = 0; i < 14000; i++) {
      const x = r() * w, y = r() * h, s = 1 + r() * 2.5;
      const t = r();
      g.fillStyle = t > 0.7 ? 'rgba(150,168,92,0.6)' : t > 0.35 ? 'rgba(96,124,58,0.55)' : 'rgba(38,58,26,0.45)';
      g.fillRect(x, y, s, s * (1.5 + r() * 2.5));
    }
  }, { repeat: [40, 40] });

  return { soil, soilNormal, wood, carpet };
}

export function makeLabelTexture(lines, { w = 256, h = 128, bg = '#F4EFE4', fg = '#1E3A2B', font = 'IBM Plex Mono' } = {}) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => {
      g.font = `${i === 0 ? 600 : 400} ${i === 0 ? 46 : 22}px "${font}", monospace`;
      g.fillText(t, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (i === 0 ? 40 : 34));
    });
  });
}

function tabletTexture() {
  return canvasTex(384, 256, (g, w, h) => {
    g.fillStyle = '#1b2226'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#26453a'; g.fillRect(0, 0, w, 36);
    g.fillStyle = '#e9e3d6'; g.font = '500 18px "IBM Plex Mono", monospace'; g.fillText('STN-03 · V-03-07', 12, 24);
    const grd = g.createLinearGradient(12, 48, 200, 220);
    grd.addColorStop(0, '#516b37'); grd.addColorStop(1, '#2f4423');
    g.fillStyle = grd; g.fillRect(12, 48, 200, 150);
    g.strokeStyle = '#e2a940'; g.lineWidth = 3; g.strokeRect(60, 82, 90, 70);
    g.fillStyle = '#e9e3d6'; g.font = '15px "IBM Plex Mono", monospace';
    g.fillText('Uncertain', 228, 70); g.fillText('→ human review', 228, 94);
    g.fillStyle = '#e2a940'; g.fillRect(228, 160, 140, 36);
    g.fillStyle = '#1b2226'; g.font = '600 15px "IBM Plex Mono", monospace'; g.fillText('Send to review', 236, 184);
    g.fillStyle = 'rgba(233,227,214,.55)'; g.font = '12px "IBM Plex Mono", monospace'; g.fillText('CONCEPT UI · NOT DEVICE OUTPUT', 12, 238);
  });
}

function barcodeTexture() {
  return canvasTex(256, 64, (g, w, h) => {
    const r = prng(19);
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1b1e20';
    for (let x = 12; x < w - 12;) { const bw = 1 + Math.floor(r() * 4); if (r() > 0.45) g.fillRect(x, 8, bw, h - 16); x += bw + 1 + Math.floor(r() * 2); }
  }, { repeat: [3, 1] });
}

/** Label for the flagged-patch sequence: a step line and three progress dots. */
export function makeCueTexture(code, text, step) {
  return canvasTex(512, 168, (g, w, h) => {
    g.fillStyle = 'rgba(251,248,241,0.96)'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#C98A1C'; g.fillRect(0, 0, 10, h);
    g.fillStyle = '#5b5e58'; g.font = '500 22px "IBM Plex Mono", monospace'; g.textBaseline = 'middle';
    g.fillText(`CONCEPT · ${code}`, 34, 40);
    g.fillStyle = '#1E3A2B'; g.font = '600 28px "IBM Plex Mono", monospace';
    g.fillText(text, 34, 92);
    for (let i = 0; i < 3; i++) {
      g.beginPath(); g.arc(44 + i * 30, 138, 8, 0, Math.PI * 2);
      if (i <= step) { g.fillStyle = '#C98A1C'; g.fill(); } else { g.strokeStyle = '#8f918a'; g.lineWidth = 3; g.stroke(); }
    }
  });
}

// ---------------------------------------------------------------- materials
export function createMaterials(tex) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  return {
    // perception core (fog off: stays crisp through the lab → field dissolve)
    anod: std({ color: 0x18191b, roughness: 0.36, metalness: 0.72, fog: false }),
    anodEdge: std({ color: 0x26282b, roughness: 0.32, metalness: 0.78, fog: false }),
    blackPlastic: std({ color: 0x0e0f10, roughness: 0.6, fog: false }),
    rubber: std({ color: 0x141414, roughness: 0.88, fog: false }),
    pcb: std({ color: 0x15181a, roughness: 0.45, metalness: 0.2, fog: false }),
    lens: std({ color: 0x2a1838, roughness: 0.05, metalness: 0.95, emissive: 0x5b2a80, emissiveIntensity: 0.18, fog: false }),
    steel: std({ color: 0xcfcac1, roughness: 0.28, metalness: 1.0, fog: false }),
    ribbon: std({ color: 0x7a4410, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide, fog: false }),
    ledGreen: new THREE.MeshBasicMaterial({ color: 0x4cf7a0, fog: false }),
    redSmall: std({ color: 0xa01f1f, roughness: 0.5, fog: false }),
    // field unit case
    shell: std({ color: 0xe4ddcc, roughness: 0.6, fog: false }),
    shellInner: std({ color: 0xc9c0ab, roughness: 0.85, fog: false, side: THREE.DoubleSide }),
    trim: std({ color: 0x2c2f31, roughness: 0.62, fog: false }),
    glass: std({ color: 0x0e1316, roughness: 0.04, metalness: 0.5, transparent: true, opacity: 0.38, fog: false, depthWrite: false }),
    // platforms
    alu: std({ color: 0x9aa0a3, roughness: 0.34, metalness: 0.85 }),
    graphite: std({ color: 0x2f3335, roughness: 0.5, metalness: 0.45 }),
    forest: std({ color: 0x214332, roughness: 0.5, metalness: 0.12 }),
    ivoryPaint: std({ color: 0xece6d9, roughness: 0.55 }),
    tyre: std({ color: 0x1b1b1b, roughness: 0.93 }),
    foam: std({ color: 0x161616, roughness: 0.95 }),
    estop: std({ color: 0xb3261e, roughness: 0.4 }),
    estopBase: std({ color: 0xd9a51e, roughness: 0.5 }),
    clay: std({ color: 0xdcd3c3, roughness: 0.86 }),
    // generic carrier (deliberately neutral: it is not a QUERRA product)
    carrierBody: std({ color: 0x33373a, roughness: 0.48, metalness: 0.32 }),
    carrierPanel: std({ color: 0xd6d3cb, roughness: 0.55, side: THREE.DoubleSide }),
    fender: std({ color: 0x4a4f52, roughness: 0.6, metalness: 0.2, side: THREE.DoubleSide }),
    lamp: std({ color: 0xfbf4e6, emissive: 0xfff0d2, emissiveIntensity: 0.9, roughness: 0.3, fog: false }),
    leaf: std({ color: 0x5d8a37, roughness: 0.7, side: THREE.DoubleSide }),
    tube: std({ color: 0xf2efe8, roughness: 0.25, transparent: true, opacity: 0.82 }),
    tubeCap: std({ color: 0x214332, roughness: 0.5 }),
    barcode: std({ map: barcodeTexture(), roughness: 0.6 }),
    // flagged patch overlay (concept sequence)
    flag: new THREE.MeshBasicMaterial({ color: 0xf0b443, transparent: true, opacity: 0.95, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }),
    flagFill: new THREE.MeshBasicMaterial({ color: 0xf0b443, transparent: true, opacity: 0.12, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }),
    flagPin: new THREE.LineBasicMaterial({ color: 0xc98a1c, transparent: true, opacity: 0.9, fog: false, toneMapped: false }),
    tabletScreen: new THREE.MeshBasicMaterial({ map: tabletTexture(), toneMapped: false }),
    // environments
    wood: std({ map: tex.wood, roughness: 0.42, metalness: 0.0, envMapIntensity: 0.6 }),
    deskLeg: std({ color: 0x3a3b3c, roughness: 0.45, metalness: 0.7 }),
    studioFloor: std({ color: 0xece5d8, roughness: 0.96 }),
    // matte (Lambert) ground: no grazing-angle specular glare near the horizon
    soil: new THREE.MeshLambertMaterial({ map: tex.soil, normalMap: tex.soilNormal, normalScale: new THREE.Vector2(0.9, 0.9), color: 0xb8a891 }),
    track: new THREE.MeshLambertMaterial({ map: tex.soil, normalMap: tex.soilNormal, color: 0x8a8474 }),
    canopyFloor: new THREE.MeshLambertMaterial({ color: 0x343a20 }),
    crop: std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, envMapIntensity: 0.18 }),
    carpet: new THREE.MeshLambertMaterial({ map: tex.carpet }),
    // overlays
    amberLine: new THREE.LineBasicMaterial({ color: 0xf0b443, depthTest: false, transparent: true, opacity: 1, fog: false, toneMapped: false }),
    sightLine: new THREE.LineBasicMaterial({ color: 0xe6a93a, transparent: true, opacity: 0.85, fog: false, toneMapped: false }),
    sightFill: new THREE.MeshBasicMaterial({ color: 0xf0b443, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false }),
    path: new THREE.LineDashedMaterial({ color: 0x23282a, dashSize: 0.7, gapSize: 0.45, transparent: true, opacity: 0.7, fog: false }),
    footprint: new THREE.MeshBasicMaterial({ color: 0xfbf8f1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
    footprintEdge: new THREE.LineBasicMaterial({ color: 0xfbf8f1, transparent: true, opacity: 0.75 }),
  };
}

// ---------------------------------------------------------------- primitives
function mesh(geo, mat, { cast = true, receive = false } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
const box = (w, h, d, mat, o) => mesh(new THREE.BoxGeometry(w, h, d), mat, o);
const cyl = (rt, rb, h, mat, seg = 24, o) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, o);

function beam(a, b, size, mat, round = false) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = round ? cyl(size / 2, size / 2, len, mat, 12) : box(size, len, size, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return m;
}

function roundedBoxGeo(w, h, d, r, bevel = 0.0015) {
  const s = new THREE.Shape();
  const x0 = -w / 2 + bevel, x1 = w / 2 - bevel, z0 = -d / 2 + bevel, z1 = d / 2 - bevel;
  const rr = Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2);
  s.moveTo(x0 + rr, z0); s.lineTo(x1 - rr, z0); s.quadraticCurveTo(x1, z0, x1, z0 + rr);
  s.lineTo(x1, z1 - rr); s.quadraticCurveTo(x1, z1, x1 - rr, z1);
  s.lineTo(x0 + rr, z1); s.quadraticCurveTo(x0, z1, x0, z1 - rr);
  s.lineTo(x0, z0 + rr); s.quadraticCurveTo(x0, z0, x0 + rr, z0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}

function ribbonGeo(curve, width, segs = 24, side = V(1, 0, 0)) {
  const pts = curve.getPoints(segs);
  const pos = [];
  const idx = [];
  pts.forEach((p) => {
    pos.push(p.x - side.x * width / 2, p.y - side.y * width / 2, p.z - side.z * width / 2);
    pos.push(p.x + side.x * width / 2, p.y + side.y * width / 2, p.z + side.z * width / 2);
  });
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function cornerBrackets(min, max, frac, mat) {
  const p = [];
  const L = [(max.x - min.x) * frac, (max.y - min.y) * frac, (max.z - min.z) * frac];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
    const sx = x === min.x ? 1 : -1, sy = y === min.y ? 1 : -1, sz = z === min.z ? 1 : -1;
    p.push(x, y, z, x + sx * L[0], y, z, x, y, z, x, y + sy * L[1], z, x, y, z, x, y, z + sz * L[2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const ls = new THREE.LineSegments(g, mat);
  ls.renderOrder = 20;
  ls.frustumCulled = false;
  return ls;
}

// ---------------------------------------------------------------- fades & assembly helpers
/** Give a group its own material instances so it can fade without affecting others. */
export function ownMaterials(group) {
  const map = new Map();
  group.traverse((o) => {
    if (!o.material) return;
    const swap = (m) => { if (!map.has(m)) map.set(m, m.clone()); return map.get(m); };
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  group.userData.mats = [...map.values()];
  group.userData.mats.forEach((m) => { m.userData.baseOpacity = m.opacity; m.userData.baseTransparent = m.transparent; });
  return group;
}

export function setOpacity(group, o) {
  const mats = group.userData.mats || [];
  group.visible = o > 0.005;
  for (const m of mats) {
    const target = m.userData.baseOpacity * o;
    const trans = m.userData.baseTransparent || o < 0.999;
    if (m.transparent !== trans) { m.transparent = trans; m.needsUpdate = true; }
    m.opacity = target;
    m.depthWrite = !m.userData.baseTransparent && o > 0.6;
  }
}

/** Store exploded offsets for direct children (an exploded-view assembly, not a morph). */
export function prepareAssembly(group, center, spread = 0.3, lift = 0.35, rand = prng(3)) {
  group.children.forEach((c) => {
    if (c.userData.noAssembly) return;
    const b = new THREE.Box3().setFromObject(c);
    const mid = b.isEmpty() ? c.position.clone() : b.getCenter(new THREE.Vector3());
    group.worldToLocal(mid);
    const dir = mid.sub(center);
    if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);
    dir.normalize();
    dir.y += lift + rand() * lift * 0.8;
    c.userData.base = c.position.clone();
    c.userData.offset = dir.normalize().multiplyScalar(spread * (0.8 + rand() * 0.5));
  });
}

export function setAssembly(group, a) {
  const e = 1 - a;
  const k = e * e * (3 - 2 * e);
  group.children.forEach((c) => {
    if (!c.userData.base) return;
    c.position.copy(c.userData.base).addScaledVector(c.userData.offset, k);
  });
}

// ---------------------------------------------------------------- perception core
export const CORE = { W: 0.105, H: 0.058, D: 0.145 };

export function buildCore(M) {
  const { W, H, D } = CORE;
  const g = new THREE.Group();
  g.name = 'core';
  g.add(mesh(roundedBoxGeo(W, H, D, 0.007, 0.0016), M.anod));

  // vent slots on both long sides
  const slots = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0016, 0.026, 0.0022), M.blackPlastic, 32);
  const mtx = new THREE.Matrix4();
  let k = 0;
  for (const sx of [-1, 1]) for (let i = 0; i < 16; i++) { mtx.makeTranslation(sx * (W / 2 + 0.0002), 0.029, -0.045 + i * 0.0048); slots.setMatrixAt(k++, mtx); }
  g.add(slots);

  // fan grille on top
  const grille = new THREE.Group();
  for (const [ri, ro] of [[0.006, 0.0085], [0.012, 0.0145], [0.018, 0.0205]]) {
    for (let q = 0; q < 4; q++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(ri, ro, 20, 1, q * Math.PI / 2 + 0.14, Math.PI / 2 - 0.28), M.blackPlastic);
      ring.rotation.x = -Math.PI / 2;
      grille.add(ring);
    }
  }
  grille.position.set(-0.014, H + 0.0004, -0.038);
  g.add(grille);
  const seam = box(W - 0.008, 0.0006, 0.0012, M.blackPlastic, { cast: false });
  seam.position.set(0, H + 0.0003, 0.018);
  g.add(seam);

  // illuminated power switch on the front face
  const bezel = cyl(0.0078, 0.0078, 0.004, M.steel, 28);
  bezel.rotation.x = Math.PI / 2; bezel.position.set(-0.026, 0.02, D / 2 + 0.0015);
  g.add(bezel);
  const led = new THREE.Mesh(new THREE.TorusGeometry(0.0056, 0.0009, 8, 28), M.ledGreen);
  led.position.set(-0.026, 0.02, D / 2 + 0.0037);
  g.add(led);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const sc = cyl(0.0016, 0.0016, 0.001, M.anodEdge, 10);
    sc.rotation.x = Math.PI / 2; sc.position.set(sx * (W / 2 - 0.006), 0.029 + sy * 0.021, D / 2 + 0.0005);
    g.add(sc);
  }

  // tilt bracket with thumb screw
  const br = new THREE.Group();
  br.position.set(0, H, D / 2 - 0.03);
  g.add(br);
  const basePlate = box(0.09, 0.003, 0.04, M.anodEdge);
  basePlate.position.set(0, 0.0015, -0.006);
  br.add(basePlate);
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.1;
  br.add(tilt);
  const vplate = box(0.098, 0.074, 0.0028, M.anodEdge);
  vplate.position.set(0, 0.039, 0);
  tilt.add(vplate);
  for (const hx of [-0.041, -0.03, 0.03, 0.041]) for (const hy of [0.062, 0.07]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.0015, 10), M.blackPlastic);
    hole.position.set(hx, hy, 0.0015);
    tilt.add(hole);
  }
  const side = box(0.003, 0.05, 0.044, M.anodEdge);
  side.position.set(-0.05, 0.027, -0.014);
  br.add(side);
  const knob = cyl(0.0068, 0.0068, 0.011, M.steel, 20);
  knob.rotation.z = Math.PI / 2; knob.position.set(-0.0575, 0.031, -0.014);
  br.add(knob);

  // two-lens CSI camera board (no stereo capability is implied)
  const cam = new THREE.Group();
  cam.position.set(0, 0.034, 0.0016);
  tilt.add(cam);
  const board = box(0.082, 0.03, 0.0016, M.pcb);
  board.position.z = 0.0008;
  cam.add(board);
  for (const sx of [-1, 1]) {
    const holder = box(0.017, 0.017, 0.007, M.blackPlastic); holder.position.set(sx * 0.03, 0, 0.005); cam.add(holder);
    const barrel = cyl(0.0098, 0.0098, 0.02, M.blackPlastic, 28); barrel.rotation.x = Math.PI / 2; barrel.position.set(sx * 0.03, 0, 0.018); cam.add(barrel);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0089, 0.0011, 8, 28), M.steel); rim.position.set(sx * 0.03, 0, 0.028); cam.add(rim);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.0082, 28), M.lens); glass.position.set(sx * 0.03, 0, 0.0282); cam.add(glass);
    const ir = cyl(0.0042, 0.0042, 0.009, M.blackPlastic, 14); ir.rotation.x = Math.PI / 2; ir.position.set(sx * 0.0135, -0.009, 0.0062); cam.add(ir);
  }
  const sensor = box(0.008, 0.006, 0.003, M.redSmall); sensor.position.set(0, -0.007, 0.003); cam.add(sensor);
  const conn = box(0.026, 0.006, 0.004, M.anodEdge); conn.position.set(0, 0.0125, 0.003); cam.add(conn);
  const loop = new THREE.CubicBezierCurve3(V(0, 0.05, 0.005), V(0, 0.1, 0.012), V(0, 0.1, -0.024), V(0, 0.03, -0.012));
  tilt.add(mesh(ribbonGeo(loop, 0.013), M.ribbon));
  const drop = new THREE.CatmullRomCurve3([
    V(0.014, H + 0.024, D / 2 - 0.027), V(0.014, H + 0.006, D / 2 - 0.004), V(0.014, H - 0.006, D / 2 + 0.004), V(0.014, 0.008, D / 2 + 0.004),
  ]);
  g.add(mesh(ribbonGeo(drop, 0.013, 30), M.ribbon));

  // lens anchor (sightline origin)
  const lens = new THREE.Object3D();
  lens.position.set(0, 0.034, 0.03);
  tilt.add(lens);
  g.userData.lens = lens;

  // two antennas at the rear
  g.userData.antennas = [];
  for (const sx of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(sx * 0.03, H, -D / 2 + 0.018);
    a.rotation.z = -sx * 0.045;
    const base = cyl(0.0065, 0.0065, 0.012, M.anodEdge, 16); base.position.y = 0.006; a.add(base);
    const hinge = cyl(0.006, 0.006, 0.016, M.rubber, 16); hinge.position.y = 0.02; a.add(hinge);
    const body = cyl(0.0042, 0.0068, 0.17, M.rubber, 16); body.position.y = 0.113; a.add(body);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0042, 12, 8), M.rubber); tip.position.y = 0.198; a.add(tip);
    g.add(a);
    g.userData.antennas.push(a);
  }

  // highlight: amber corner brackets, drawn on top of everything
  const hl = cornerBrackets(V(-W / 2 - 0.01, -0.006, -D / 2 - 0.01), V(W / 2 + 0.01, H + 0.088, D / 2 + 0.034), 0.28, M.amberLine);
  hl.name = 'core-highlight';
  g.add(hl);
  g.userData.highlight = hl;

  const label = new THREE.Object3D();
  label.position.set(0, H + 0.1, 0);
  g.add(label);
  g.userData.labelAnchor = label;
  return g;
}

// ---------------------------------------------------------------- protected field unit (concept)
export function buildCase(M) {
  const g = new THREE.Group();
  g.name = 'case';
  const t = 0.006;
  const X = 0.074, Y0 = -0.018, Y1 = 0.168, Z0 = -0.098, Z1 = 0.118;
  const w = 2 * X, hgt = Y1 - Y0, d = Z1 - Z0, cy = (Y0 + Y1) / 2, cz = (Z0 + Z1) / 2;

  const bottom = box(w, t * 1.6, d, M.trim); bottom.position.set(0, Y0, cz); g.add(bottom);
  const top = box(w, t, d, M.shell); top.position.set(0, Y1, cz); g.add(top);
  const back = box(w, hgt, t, M.shell); back.position.set(0, cy, Z0); g.add(back);
  const left = box(t, hgt, d, M.shell); left.position.set(-X, cy, cz); g.add(left);
  // right side left open: a cutaway that keeps the core visible

  // front with a camera window
  const wy0 = 0.07, wy1 = 0.122, wx = 0.054;
  const f1 = box(w, wy0 - Y0, t, M.shell); f1.position.set(0, (Y0 + wy0) / 2, Z1); g.add(f1);
  const f2 = box(w, Y1 - wy1, t, M.shell); f2.position.set(0, (wy1 + Y1) / 2, Z1); g.add(f2);
  for (const sx of [-1, 1]) { const f = box(X - wx, wy1 - wy0, t, M.shell); f.position.set(sx * (wx + (X - wx) / 2), (wy0 + wy1) / 2, Z1); g.add(f); }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(2 * wx, wy1 - wy0), M.glass);
  glass.position.set(0, (wy0 + wy1) / 2, Z1 + 0.001); glass.renderOrder = 5; g.add(glass);
  const hood = box(w * 0.86, 0.004, 0.04, M.trim); hood.position.set(0, wy1 + 0.012, Z1 + 0.02); hood.rotation.x = 0.12; g.add(hood);
  // ring light framing the window: even exposure in sun or cloud (concept addition)
  const ring = new THREE.Group();
  const rz = Z1 + 0.0045, rw = 2 * wx + 0.012, rh = wy1 - wy0 + 0.012, rt = 0.0045;
  for (const sy of [-1, 1]) { const b = box(rw, rt, 0.003, M.lamp, { cast: false }); b.position.set(0, (wy0 + wy1) / 2 + sy * rh / 2, rz); ring.add(b); }
  for (const sx of [-1, 1]) { const b = box(rt, rh, 0.003, M.lamp, { cast: false }); b.position.set(sx * rw / 2, (wy0 + wy1) / 2, rz); ring.add(b); }
  g.add(ring);

  // rugged corner bumpers on all 12 edges
  const bump = new THREE.Group();
  const r = 0.0085;
  for (const sx of [-1, 1]) for (const sy of [Y0, Y1]) { const b = cyl(r, r, d, M.trim, 10); b.rotation.x = Math.PI / 2; b.position.set(sx * X, sy, cz); bump.add(b); }
  for (const sx of [-1, 1]) for (const sz of [Z0, Z1]) { const b = cyl(r, r, hgt, M.trim, 10); b.position.set(sx * X, cy, sz); bump.add(b); }
  for (const sy of [Y0, Y1]) for (const sz of [Z0, Z1]) { const b = cyl(r, r, w, M.trim, 10); b.rotation.z = Math.PI / 2; b.position.set(0, sy, sz); bump.add(b); }
  g.add(bump);

  // carry handle
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.0075, 10, 28, Math.PI), M.trim);
  handle.position.set(0, Y1 + 0.004, cz - 0.01); handle.castShadow = true; g.add(handle);

  // GPS receiver puck on the lid (the real prototype uses a u-blox USB receiver)
  const gps = mesh(roundedBoxGeo(0.044, 0.014, 0.044, 0.008, 0.002), M.trim);
  gps.position.set(0, Y1 + 0.003, Z0 + 0.03); g.add(gps);

  const latch = new THREE.Group();
  for (const sz of [-0.03, 0.06]) { const l = box(0.006, 0.03, 0.016, M.trim); l.position.set(-X - 0.006, Y1 - 0.025, sz); latch.add(l); }
  g.add(latch);
  return g;
}

// ---------------------------------------------------------------- wheels
function bikeWheel(R, M) {
  const w = new THREE.Group();
  const spin = new THREE.Group();
  w.add(spin);
  w.userData.spin = spin;
  w.userData.R = R;
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(R - 0.024, 0.024, 10, 48), M.tyre); tyre.rotation.y = Math.PI / 2; tyre.castShadow = true; spin.add(tyre);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R - 0.052, 0.007, 6, 48), M.alu); rim.rotation.y = Math.PI / 2; spin.add(rim);
  const hub = cyl(0.028, 0.028, 0.07, M.alu, 16); hub.rotation.z = Math.PI / 2; spin.add(hub);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const sp = cyl(0.0016, 0.0016, R - 0.08, M.alu, 4, { cast: false });
    sp.position.set(i % 2 ? 0.016 : -0.016, (Math.cos(a) * (R - 0.04)) / 2, (Math.sin(a) * (R - 0.04)) / 2);
    sp.rotation.x = a;
    spin.add(sp);
  }
  return w;
}

function roverWheel(R, width, M) {
  const w = new THREE.Group();
  const spin = new THREE.Group();
  w.add(spin);
  w.userData.spin = spin;
  w.userData.R = R;
  const tyre = cyl(R, R, width, M.tyre, 36); tyre.rotation.z = Math.PI / 2; spin.add(tyre);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const lug = box(width * 0.9, 0.022, 0.03, M.tyre);
    lug.position.set(0, Math.cos(a) * R, Math.sin(a) * R);
    lug.rotation.x = a;
    spin.add(lug);
  }
  for (const sx of [-1, 1]) { const rim = cyl(R * 0.58, R * 0.58, 0.01, M.graphite, 28); rim.rotation.z = Math.PI / 2; rim.position.x = sx * (width / 2 + 0.002); spin.add(rim); }
  return w;
}

// ---------------------------------------------------------------- supervised push cart (concept)
export function buildCart(M) {
  const g = new THREE.Group();
  g.name = 'cart';
  const R = 0.34, TX = 0.9;
  g.userData.wheels = [];
  for (const sx of [-1, 1]) {
    const w = bikeWheel(R, M);
    w.position.set(sx * TX, R, 0);
    g.add(w);
    g.userData.wheels.push(w);
    g.add(beam(V(sx * (TX - 0.055), R, 0), V(sx * (TX - 0.055), 1.16, 0), 0.034, M.alu));
    const ax = cyl(0.012, 0.012, 0.06, M.alu, 10); ax.rotation.z = Math.PI / 2; ax.position.set(sx * (TX - 0.03), R, 0); g.add(ax);
  }
  g.add(beam(V(-TX + 0.04, 1.16, 0), V(TX - 0.04, 1.16, 0), 0.042, M.alu));
  for (const sx of [-1, 1]) g.add(beam(V(sx * 0.3, 1.16, 0), V(sx * 0.3, 1.0, -0.92), 0.03, M.alu));
  const grip = cyl(0.019, 0.019, 0.72, M.foam, 12); grip.rotation.z = Math.PI / 2; grip.position.set(0, 1.0, -0.92); g.add(grip);
  const tab = new THREE.Group();
  tab.position.set(0, 1.09, -0.78); tab.rotation.x = 0.75;
  tab.add(box(0.27, 0.012, 0.19, M.graphite));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.245, 0.165), M.tabletScreen);
  screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0066; tab.add(screen);
  g.add(tab);
  g.add(beam(V(0, 1.0, -0.88), V(0, 1.07, -0.8), 0.02, M.alu));
  // mast and boom carrying the field unit
  g.add(beam(V(0, 1.16, 0), V(0, 1.62, 0), 0.036, M.alu));
  g.add(beam(V(0, 1.62, -0.03), V(0, 1.62, 0.43), 0.032, M.alu));
  g.add(beam(V(0, 1.62, 0.42), V(0, 1.53, 0.42), 0.026, M.alu));
  const clamp = box(0.05, 0.03, 0.07, M.graphite); clamp.position.set(0, 1.525, 0.42); g.add(clamp);
  // the field unit hangs by its carry handle, pitched towards the canopy
  const mount = new THREE.Object3D();
  mount.position.set(0, 1.426, 0.271);
  mount.rotation.x = 1.0;
  g.add(mount);
  g.userData.mount = mount;
  return g;
}

// ---------------------------------------------------------------- tramline carrier (concept, beyond TRL7)
// A generic narrow-track carrier, not a specific product: the plan is to mount QUERRA's payload
// on existing carriers rather than build one. Four steerable wheel modules run in the tramlines
// (1.8 m track), a truss gantry clears the canopy, the field unit hangs from the front truss as a
// payload pod, and a low side camera looks into the lower canopy, where Septoria first appears.
export const CARRIER = { TX: 0.9, TZ: 0.62, R: 0.33, FY: 1.34, ARM: [0.99, 1.29, 0.12], RACK: [1.07, 0.74, 0.5], SIDECAM: [0.62, 0.34, -0.3] };

function narrowWheel(R, width, M) {
  const w = new THREE.Group();
  const spin = new THREE.Group();
  w.add(spin);
  w.userData.spin = spin;
  w.userData.R = R;
  const tyre = cyl(R, R, width, M.tyre, 44); tyre.rotation.z = Math.PI / 2; spin.add(tyre);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const lug = box(width * 0.8, 0.014, 0.022, M.tyre, { cast: false });
    lug.position.set((i % 2 ? 1 : -1) * width * 0.06, Math.cos(a) * (R + 0.003), Math.sin(a) * (R + 0.003));
    lug.rotation.x = a;
    spin.add(lug);
  }
  const hub = cyl(R * 0.56, R * 0.56, width + 0.014, M.carrierBody, 32); hub.rotation.z = Math.PI / 2; spin.add(hub);
  for (const sx of [-1, 1]) {
    const cap = cyl(R * 0.2, R * 0.2, 0.012, M.alu, 20); cap.rotation.z = Math.PI / 2; cap.position.x = sx * (width / 2 + 0.011); spin.add(cap);
    for (let k = 0; k < 5; k++) { const b = cyl(0.008, 0.008, 0.01, M.alu, 8); b.rotation.z = Math.PI / 2; const a = (k / 5) * Math.PI * 2; b.position.set(sx * (width / 2 + 0.01), Math.cos(a) * R * 0.38, Math.sin(a) * R * 0.38); spin.add(b); }
  }
  return w;
}

function wheelModule(M, R, FY) {
  const g = new THREE.Group();
  const wheel = narrowWheel(R, 0.09, M);
  wheel.position.y = R;
  g.add(wheel);
  g.userData.wheel = wheel;
  const crownY = 2 * R + 0.12;
  for (const sx of [-1, 1]) g.add(beam(V(sx * 0.072, R, 0), V(sx * 0.072, crownY, 0), 0.03, M.carrierBody));
  const crown = mesh(roundedBoxGeo(0.2, 0.05, 0.1, 0.02), M.carrierBody); crown.position.y = crownY - 0.025; g.add(crown);
  // fender band over the top of the wheel
  const fender = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.045, R + 0.045, 0.12, 28, 1, true, 0.18 * Math.PI, 0.64 * Math.PI), M.fender);
  fender.rotation.z = Math.PI / 2; fender.position.y = R; fender.castShadow = true; g.add(fender);
  // leg and steering actuator
  g.add(beam(V(0, crownY, 0), V(0, FY - 0.07, 0), 0.07, M.alu));
  const steer = cyl(0.074, 0.074, 0.15, M.carrierBody, 28); steer.position.y = FY; g.add(steer);
  const cap = cyl(0.076, 0.076, 0.02, M.carrierPanel, 28); cap.position.y = FY + 0.085; g.add(cap);
  return g;
}

function truss(g, z, x0, x1, yb, yt, n, M) {
  g.add(beam(V(x0, yb, z), V(x1, yb, z), 0.042, M.alu, true));
  g.add(beam(V(x0, yt, z), V(x1, yt, z), 0.042, M.alu, true));
  for (let i = 0; i < n; i++) {
    const xa = x0 + ((x1 - x0) * i) / n, xb = x0 + ((x1 - x0) * (i + 1)) / n;
    g.add(i % 2 ? beam(V(xa, yt, z), V(xb, yb, z), 0.022, M.alu, true) : beam(V(xa, yb, z), V(xb, yt, z), 0.022, M.alu, true));
  }
  for (const x of [x0, x1]) g.add(beam(V(x, yb, z), V(x, yt, z), 0.03, M.alu, true));
}

export function buildRover(M) {
  const g = new THREE.Group();
  g.name = 'rover';
  const { TX, TZ, R, FY } = CARRIER;
  g.userData.wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const m = wheelModule(M, R, FY);
    m.position.set(sx * TX, 0, sz * TZ);
    g.add(m);
    g.userData.wheels.push(m.userData.wheel);
  }
  // forward safety scanners, low in each tramline
  for (const sx of [-1, 1]) {
    const sc = new THREE.Group();
    sc.position.set(sx * TX, 2 * R + 0.2, TZ + 0.1);
    const body = cyl(0.04, 0.04, 0.07, M.carrierBody, 20); sc.add(body);
    const win = cyl(0.041, 0.041, 0.022, M.glass, 20); win.position.y = 0.006; sc.add(win);
    sc.add(beam(V(0, 0, -0.1), V(0, 0, -0.02), 0.025, M.carrierBody));
    g.add(sc);
  }
  // side rails and the two cross trusses (bottom chord clears the canopy)
  for (const sx of [-1, 1]) g.add(beam(V(sx * TX, FY, -TZ - 0.05), V(sx * TX, FY, TZ + 0.05), 0.07, M.alu));
  for (const sz of [-1, 1]) truss(g, sz * TZ, -TX + 0.08, TX - 0.08, FY - 0.01, FY + 0.17, 6, M);
  // battery and drive electronics pods ride over the tramlines, keeping weight on the wheels
  for (const sx of [-1, 1]) {
    const pod = mesh(roundedBoxGeo(0.24, 0.19, 0.84, 0.035), M.carrierBody); pod.position.set(sx * TX, FY + 0.04, -0.04); g.add(pod);
    const panel = mesh(roundedBoxGeo(0.2, 0.012, 0.64, 0.02), M.carrierPanel); panel.position.set(sx * TX, FY + 0.229, -0.06); g.add(panel);
    const strip = box(0.004, 0.018, 0.5, M.lamp, { cast: false }); strip.position.set(sx * (TX + 0.121), FY + 0.15, -0.04); g.add(strip);
    for (const sz of [-1, 1]) {
      const base = cyl(0.036, 0.04, 0.035, M.estopBase, 16); base.position.set(sx * TX + sx * 0.06, FY + 0.248, sz * 0.4); g.add(base);
      const btn = cyl(0.03, 0.026, 0.026, M.estop, 16); btn.position.set(sx * TX + sx * 0.06, FY + 0.278, sz * 0.4); g.add(btn);
    }
  }
  // RTK GNSS antenna
  g.add(beam(V(-TX, FY + 0.23, 0.3), V(-TX, FY + 0.5, 0.3), 0.018, M.alu, true));
  const gnss = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.carrierPanel);
  gnss.scale.y = 0.45; gnss.position.set(-TX, FY + 0.5, 0.3); gnss.castShadow = true; g.add(gnss);
  const gnssBase = cyl(0.075, 0.075, 0.012, M.carrierBody, 24); gnssBase.position.set(-TX, FY + 0.5, 0.3); g.add(gnssBase);
  // payload interface: a short boom ahead of the front truss, quick-release clamp
  g.add(beam(V(0, FY + 0.08, TZ), V(0, FY + 0.08, TZ + 0.3), 0.034, M.alu));
  g.add(beam(V(0, FY + 0.08, TZ + 0.29), V(0, FY - 0.01, TZ + 0.29), 0.026, M.alu));
  const plate = box(0.16, 0.018, 0.1, M.carrierBody); plate.position.set(0, FY + 0.08, TZ + 0.02); g.add(plate);
  const clamp = box(0.05, 0.03, 0.07, M.graphite); clamp.position.set(0, FY - 0.015, TZ + 0.29); g.add(clamp);
  const mount = new THREE.Object3D();
  mount.position.set(0, FY - 0.114, TZ + 0.141);
  mount.rotation.x = 1.0;
  g.add(mount);
  g.userData.mount = mount;
  // low side camera on a drop arm in the tramline, looking into the lower canopy (concept)
  const [cx, cy, cz] = CARRIER.SIDECAM;
  g.add(beam(V(TX - 0.04, FY - 0.03, cz), V(cx + 0.06, cy + 0.06, cz), 0.03, M.alu));
  const head = mesh(roundedBoxGeo(0.07, 0.065, 0.11, 0.012), M.carrierBody); head.position.set(cx + 0.04, cy - 0.032, cz); g.add(head);
  const sLens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 20), M.lens); sLens.rotation.y = -Math.PI / 2; sLens.position.set(cx + 0.004, cy, cz); g.add(sLens);
  const sRing = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.004, 8, 24), M.lamp); sRing.rotation.y = -Math.PI / 2; sRing.position.set(cx + 0.003, cy, cz); g.add(sRing);
  const cable = new THREE.CatmullRomCurve3([V(cx + 0.07, cy + 0.02, cz + 0.04), V(cx + 0.12, cy + 0.4, cz + 0.05), V(TX - 0.08, FY - 0.25, cz + 0.06), V(TX - 0.06, FY - 0.02, cz + 0.12)]);
  g.add(mesh(new THREE.TubeGeometry(cable, 24, 0.006, 6), M.rubber));
  const sideCam = new THREE.Object3D();
  sideCam.position.set(cx, cy, cz);
  sideCam.rotation.set(0.1, -Math.PI / 2, 0, 'YXZ');
  g.add(sideCam);
  g.userData.sideCam = sideCam;
  // tool interface plate for the (later) arm, under the right rail
  const [ax, ay, az] = CARRIER.ARM;
  const tp = box(0.2, 0.02, 0.17, M.carrierBody); tp.position.set(ax - 0.04, ay + 0.012, az); g.add(tp);
  return g;
}

// ---------------------------------------------------------------- leaf-sampling arm (concept)
// A six-axis arm hung under the carrier's rail. Joint offsets mirror common collaborative arms;
// the inverse kinematics solve the planar shoulder–elbow chain and keep the tool vertical.
export function buildArm(M) {
  const g = new THREE.Group();
  g.name = 'arm';
  const L1 = 0.4, L2 = 0.36, SH = 0.16, OFF = 0.07, TOOL = 0.205;
  const base = cyl(0.064, 0.072, 0.05, M.graphite, 28); base.position.y = 0.025; g.add(base);
  const yaw = new THREE.Group(); yaw.position.y = 0.05; g.add(yaw);
  const j0 = cyl(0.056, 0.056, 0.09, M.ivoryPaint, 28); j0.position.y = 0.045; yaw.add(j0);
  const j0c = cyl(0.058, 0.058, 0.012, M.graphite, 28); j0c.position.y = 0.006; yaw.add(j0c);
  const shoulder = new THREE.Group(); shoulder.position.y = SH - 0.05; yaw.add(shoulder);
  const housing = (r, len, x, cap) => {
    const hz = cyl(r, r, len, M.ivoryPaint, 28); hz.rotation.z = Math.PI / 2; hz.position.x = x;
    const c = cyl(r * 1.03, r * 1.03, 0.012, M.graphite, 28); c.rotation.z = Math.PI / 2; c.position.x = x + cap * (len / 2 + 0.004);
    return [hz, c];
  };
  shoulder.add(...housing(0.055, 0.12, OFF * 0.5, 1));
  const upper = cyl(0.04, 0.04, L1, M.ivoryPaint, 22); upper.position.set(OFF, L1 / 2, 0); shoulder.add(upper);
  const elbow = new THREE.Group(); elbow.position.y = L1; shoulder.add(elbow);
  elbow.add(...housing(0.046, 0.11, OFF * 0.5, 1));
  const fore = cyl(0.032, 0.032, L2, M.ivoryPaint, 20); fore.position.y = L2 / 2; elbow.add(fore);
  const wrist = new THREE.Group(); wrist.position.y = L2; elbow.add(wrist);
  wrist.add(...housing(0.036, 0.085, 0, -1));
  const w2 = cyl(0.034, 0.034, 0.07, M.ivoryPaint, 22); w2.position.y = 0.05; wrist.add(w2);
  const w2c = cyl(0.036, 0.036, 0.012, M.graphite, 22); w2c.position.y = 0.088; wrist.add(w2c);
  const flange = cyl(0.03, 0.03, 0.012, M.alu, 22); flange.position.y = 0.1; wrist.add(flange);
  // leaf-disc sampler: punch jaws, a close-up camera and a small ring light
  const tool = new THREE.Group(); tool.position.y = 0.106; wrist.add(tool);
  const body = mesh(roundedBoxGeo(0.052, 0.06, 0.046, 0.008), M.graphite); tool.add(body);
  const camPod = box(0.024, 0.028, 0.03, M.graphite); camPod.position.set(0.036, 0.03, 0); tool.add(camPod);
  const camLens = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), M.lens); camLens.rotation.x = Math.PI / 2; camLens.position.set(0.036, 0.0445, 0); tool.add(camLens);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.002, 6, 18), M.lamp); ring.rotation.x = Math.PI / 2; ring.position.set(0.036, 0.0448, 0); tool.add(ring);
  const fingers = [];
  for (const sx of [-1, 1]) { const f = box(0.006, 0.05, 0.03, M.alu); f.position.set(sx * 0.014, 0.085, 0); tool.add(f); fingers.push(f); }
  const leafDisc = cyl(0.011, 0.011, 0.002, M.leaf, 16); leafDisc.rotation.z = Math.PI / 2; leafDisc.position.y = 0.098; leafDisc.visible = false; tool.add(leafDisc);
  g.userData = { ...g.userData, yaw, shoulder, elbow, wrist, fingers, leafDisc, L1, L2, SH, TOOL };
  return g;
}

/**
 * Two-link IK in the vertical plane through the shoulder. `tip` is the tool tip in arm-local space.
 * toolSign = +1 keeps the tool along local +y (a hanging arm pointing at the ground), −1 along −y.
 */
export function poseArm(arm, tip, grip = 0, toolSign = -1) {
  const { yaw, shoulder, elbow, wrist, fingers, leafDisc, L1, L2, SH, TOOL } = arm.userData;
  const target = tip.clone().add(V(0, -toolSign * TOOL, 0));
  const dx = target.x, dz = target.z, dy = target.y - SH;
  yaw.rotation.y = Math.atan2(dx, dz);
  const horiz = Math.hypot(dx, dz);
  const dist = Math.max(Math.abs(L1 - L2) + 1e-3, Math.min(Math.hypot(horiz, dy), L1 + L2 - 1e-3));
  const a = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist))));
  const b = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2))));
  const elev = Math.atan2(dy, horiz);
  shoulder.rotation.x = Math.PI / 2 - (elev + a);
  elbow.rotation.x = Math.PI - b;
  wrist.rotation.x = (toolSign > 0 ? 0 : Math.PI) - shoulder.rotation.x - elbow.rotation.x;
  fingers.forEach((f, i) => { f.position.x = (i ? 1 : -1) * (0.006 + 0.012 * (1 - grip)); });
  if (leafDisc) leafDisc.visible = grip > 0.6;
}

/** Barcoded sample tubes on a small rack, hung from the carrier rail (concept). */
export function buildSampleRack(M, railHeight, toRail = -0.17) {
  const g = new THREE.Group();
  g.name = 'sample-rack';
  const tray = mesh(roundedBoxGeo(0.15, 0.04, 0.09, 0.01), M.graphite); g.add(tray);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
    const x = -0.051 + i * 0.034, z = -0.02 + j * 0.04;
    const t = cyl(0.011, 0.011, 0.08, M.tube, 14); t.position.set(x, 0.07, z); g.add(t);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0115, 0.0115, 0.026, 14, 1, true), M.barcode); band.position.set(x, 0.066, z); g.add(band);
    const c = cyl(0.0125, 0.0125, 0.012, M.tubeCap, 14); c.position.set(x, 0.116, z); g.add(c);
  }
  g.add(beam(V(-0.06, 0.02, 0), V(-0.06, railHeight, 0), 0.016, M.alu, true));
  g.add(beam(V(-0.06, railHeight, 0), V(toRail, railHeight, 0), 0.016, M.alu, true));
  return g;
}

// ---------------------------------------------------------------- quadcopter (concept, beyond TRL7)
export function buildDrone(M) {
  const g = new THREE.Group();
  g.name = 'drone';
  const body = box(0.15, 0.05, 0.2, M.graphite); g.add(body);
  const shell = box(0.13, 0.025, 0.16, M.ivoryPaint); shell.position.y = 0.035; g.add(shell);
  g.userData.props = [];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const ax = Math.sin(a) * 0.2, az = Math.cos(a) * 0.2;
    g.add(beam(V(0, 0.01, 0), V(ax, 0.015, az), 0.018, M.graphite));
    const motor = cyl(0.018, 0.02, 0.03, M.graphite, 14); motor.position.set(ax, 0.025, az); g.add(motor);
    const prop = new THREE.Group(); prop.position.set(ax, 0.045, az);
    const blade = box(0.2, 0.002, 0.016, M.graphite, { cast: false }); prop.add(blade);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.1, 24), M.footprint); disc.rotation.x = -Math.PI / 2; prop.add(disc);
    g.add(prop);
    g.userData.props.push(prop);
  }
  for (const sx of [-1, 1]) {
    g.add(beam(V(sx * 0.05, -0.02, 0), V(sx * 0.08, -0.1, 0), 0.01, M.graphite, true));
    const skid = cyl(0.006, 0.006, 0.22, M.graphite, 8); skid.rotation.x = Math.PI / 2; skid.position.set(sx * 0.08, -0.1, 0); g.add(skid);
  }
  const gimbal = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), M.graphite); gimbal.position.set(0, -0.04, 0.07); g.add(gimbal);
  return g;
}

// ---------------------------------------------------------------- scale figure (architectural style)
export function buildFigure(M) {
  const g = new THREE.Group();
  g.name = 'figure';
  const cap = (r, l) => mesh(new THREE.CapsuleGeometry(r, l, 6, 12), M.clay);
  const hips = new THREE.Group(); hips.position.y = 0.92; g.add(hips);
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(sx * 0.095, 0, 0); hips.add(leg);
    const thigh = cap(0.068, 0.36); thigh.position.y = -0.22; leg.add(thigh);
    const knee = new THREE.Group(); knee.position.y = -0.44; leg.add(knee);
    const shin = cap(0.055, 0.36); shin.position.y = -0.22; knee.add(shin);
    const foot = box(0.09, 0.05, 0.22, M.clay); foot.position.set(0, -0.45, 0.04); knee.add(foot);
    legs.push({ leg, knee });
  }
  const torso = cap(0.16, 0.42); torso.scale.set(1, 1, 0.66); torso.position.y = 0.33; hips.add(torso);
  const neck = cap(0.05, 0.06); neck.position.y = 0.66; hips.add(neck);
  const head = mesh(new THREE.SphereGeometry(0.105, 20, 16), M.clay); head.position.y = 0.8; hips.add(head);
  const arms = [];
  for (const sx of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(sx * 0.21, 0.6, 0); hips.add(sh);
    const up = cap(0.048, 0.26); up.position.y = -0.16; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
    const lo = cap(0.042, 0.24); lo.position.y = -0.14; el.add(lo);
    arms.push({ sh, el });
  }
  const tablet = box(0.24, 0.012, 0.17, M.graphite); tablet.visible = false; hips.add(tablet);
  g.userData = { hips, legs, arms, tablet };
  return g;
}

/** Simple poses: 'push' (hands on a grip in front) or 'tablet' (holding a tablet). */
export function poseFigure(fig, pose, walk = 0) {
  const { arms, legs, tablet } = fig.userData;
  const swing = Math.sin(walk) * 0.35;
  legs[0].leg.rotation.x = swing; legs[1].leg.rotation.x = -swing;
  legs[0].knee.rotation.x = Math.max(0, -Math.sin(walk)) * 0.5; legs[1].knee.rotation.x = Math.max(0, Math.sin(walk)) * 0.5;
  if (pose === 'push') {
    arms.forEach(({ sh, el }) => { sh.rotation.set(-0.95, 0, 0); el.rotation.set(-0.35, 0, 0); });
    arms[0].sh.rotation.z = 0.12; arms[1].sh.rotation.z = -0.12;
    tablet.visible = false;
  } else {
    arms.forEach(({ sh, el }) => { sh.rotation.set(-0.25, 0, 0); el.rotation.set(-1.25, 0, 0); });
    arms[0].sh.rotation.z = 0.28; arms[1].sh.rotation.z = -0.28;
    tablet.visible = true; tablet.position.set(0, 0.33, 0.3); tablet.rotation.x = 0.7;
  }
}

// ---------------------------------------------------------------- environments
export function buildDesk(M) {
  const g = new THREE.Group();
  g.name = 'desk';
  const top = box(1.5, 0.035, 0.85, M.wood, { cast: true, receive: true }); top.position.y = 0.742; g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = box(0.04, 0.725, 0.04, M.deskLeg); l.position.set(sx * 0.68, 0.3625, sz * 0.36); g.add(l); }
  // a coiled power lead for scale, as on the real bench
  const lead = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.006, 8, 48), M.tyre);
  lead.rotation.x = Math.PI / 2; lead.position.set(-0.28, 0.766, 0.14); lead.castShadow = true; g.add(lead);
  const lead2 = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.006, 8, 48), M.tyre);
  lead2.rotation.x = Math.PI / 2; lead2.position.set(-0.26, 0.772, 0.15); g.add(lead2);
  const mount = new THREE.Object3D(); mount.position.set(0, 0.76, 0); mount.rotation.y = 0; g.add(mount);
  g.userData.mount = mount;
  return g;
}

export function buildStudio(M) {
  const g = new THREE.Group();
  g.name = 'studio';
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), M.studioFloor);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  return g;
}

export const CROP_H = 0.78;
export const TRACK_X = 0.9;

function tuftGeometry(rand, stems, leaves, withEars) {
  const pos = [], col = [];
  const c = new THREE.Color();
  const push = (p, color) => { pos.push(p.x, p.y, p.z); col.push(color.r, color.g, color.b); };
  const tri = (a, b, d, ca, cb, cd) => { push(a, ca); push(b, cb); push(d, cd); };
  const stemBase = new THREE.Color('#2f4a22'), stemTop = new THREE.Color('#5f7d36');
  const leafBase = new THREE.Color('#355a29'), leafTip = new THREE.Color('#6f8d40');
  const earCol = new THREE.Color('#7f9246');
  const tops = [];
  for (let i = 0; i < stems; i++) {
    const bx = (rand() - 0.5) * 0.06, bz = (rand() - 0.5) * 0.06;
    const hgt = 0.82 + rand() * 0.18;
    const tx = bx + (rand() - 0.5) * 0.09, tz = bz + (rand() - 0.5) * 0.09;
    const w = 0.0055;
    for (const ang of [0, Math.PI / 2]) {
      const ox = Math.cos(ang) * w, oz = Math.sin(ang) * w;
      const a = V(bx - ox, 0, bz - oz), b = V(bx + ox, 0, bz + oz), d = V(tx + ox * 0.6, hgt, tz + oz * 0.6), e = V(tx - ox * 0.6, hgt, tz - oz * 0.6);
      tri(a, b, d, stemBase, stemBase, stemTop); tri(a, d, e, stemBase, stemTop, stemTop);
    }
    tops.push(V(tx, hgt, tz));
  }
  for (let i = 0; i < leaves; i++) {
    const s = tops[i % tops.length];
    const yb = 0.18 + rand() * 0.55;
    const k = yb / s.y;
    const origin = V(s.x * k, yb, s.z * k);
    const yaw = rand() * Math.PI * 2;
    const dir = V(Math.cos(yaw), 0, Math.sin(yaw));
    const len = 0.16 + rand() * 0.14, rise = 0.12 + rand() * 0.12, droop = 0.1 + rand() * 0.15;
    const segs = 3;
    const side = V(-dir.z, 0, dir.x);
    let prev = null;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      const p = origin.clone().addScaledVector(dir, len * t).add(V(0, rise * t - droop * t * t, 0));
      const w = 0.016 * (1 - t * 0.85);
      const pl = p.clone().addScaledVector(side, -w), pr = p.clone().addScaledVector(side, w);
      c.copy(leafBase).lerp(leafTip, t);
      if (prev) {
        tri(prev.l, prev.r, pr, prev.c, prev.c, c.clone());
        tri(prev.l, pr, pl, prev.c, c.clone(), c.clone());
      }
      prev = { l: pl, r: pr, c: c.clone() };
    }
  }
  if (withEars) {
    tops.forEach((t) => {
      if (rand() < 0.2) return;
      const L = 0.075 + rand() * 0.02, r = 0.0075;
      const top = t.clone().add(V(0, L, 0)), mid = t.clone().add(V(0, L * 0.45, 0));
      const ring = [0, 1, 2, 3].map((q) => mid.clone().add(V(Math.cos(q * Math.PI / 2) * r, 0, Math.sin(q * Math.PI / 2) * r)));
      for (let q = 0; q < 4; q++) {
        const a = ring[q], b = ring[(q + 1) % 4];
        tri(t, a, b, earCol, earCol, earCol);
        tri(a, top, b, earCol, earCol, earCol);
      }
    });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  // canopy-style normals: mostly up, so thin blades light softly like a real stand
  const n = new Float32Array(pos.length);
  for (let i = 0; i < n.length; i += 3) { n[i] = (rand() - 0.5) * 0.5; n[i + 1] = 1; n[i + 2] = (rand() - 0.5) * 0.5; }
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  g.normalizeNormals();
  return g;
}

export function buildField(M, { lowPower = false } = {}) {
  const g = new THREE.Group();
  g.name = 'field';
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), M.soil);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; g.add(ground);

  // tramline wheel tracks run along z
  const trackXs = [];
  for (const base of [0, -24, 24, -48, 48]) for (const sx of [-1, 1]) trackXs.push(base + sx * TRACK_X);
  trackXs.forEach((x) => {
    const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 700), M.track);
    tr.rotation.x = -Math.PI / 2; tr.position.set(x, 0.004, 0); tr.receiveShadow = true; g.add(tr);
  });

  // near crop: instanced tufts
  const rand = prng(42);
  const near = { x0: -7, x1: 7, z0: -15, z1: 12 };
  const dx = lowPower ? 0.24 : 0.17, dz = lowPower ? 0.22 : 0.15;
  const variants = [tuftGeometry(rand, 6, 6, true), tuftGeometry(rand, 5, 7, true), tuftGeometry(rand, 6, 5, true)];
  const placements = variants.map(() => []);
  for (let x = near.x0; x <= near.x1; x += dx) {
    const inTrack = trackXs.some((tx) => Math.abs(x - tx) < 0.36);
    if (inTrack) continue;
    for (let z = near.z0; z <= near.z1; z += dz) {
      const jx = x + (rand() - 0.5) * dx * 0.6, jz = z + (rand() - 0.5) * dz * 0.9;
      placements[Math.floor(rand() * variants.length)].push([jx, jz, rand() * Math.PI * 2, 0.92 + rand() * 0.16]);
    }
  }
  const crop = new THREE.Group();
  crop.name = 'crop';
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  placements.forEach((list, vi) => {
    const im = new THREE.InstancedMesh(variants[vi], M.crop, list.length);
    list.forEach(([x, z, r, s], i) => {
      q.setFromAxisAngle(UP, r);
      sc.set(s, s * CROP_H, s);
      p.set(x, 0, z);
      mtx.compose(p, q, sc);
      im.setMatrixAt(i, mtx);
    });
    im.receiveShadow = true;
    im.castShadow = false;
    im.frustumCulled = false;
    crop.add(im);
  });
  g.add(crop);
  g.userData.cropCount = placements.reduce((a, l) => a + l.length, 0);

  // shaded floor under the near crop
  for (const [x0, x1] of [[near.x0, -TRACK_X - 0.22], [-TRACK_X + 0.22, TRACK_X - 0.22], [TRACK_X + 0.22, near.x1]]) {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, near.z1 - near.z0), M.canopyFloor);
    f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0.006, (near.z0 + near.z1) / 2); f.receiveShadow = true; g.add(f);
  }

  // far canopy carpet with gaps for tramlines and a hole for the near crop
  const cy = CROP_H * 1.0;
  const X0 = -300, X1 = 300, Z0 = -300, Z1 = 300;
  const ov = 0.45; // carpet overlaps the near crop so there is no visible seam
  const cuts = [...trackXs].sort((a, b) => a - b);
  const xIntervals = [];
  let cur = X0;
  cuts.forEach((tx) => { xIntervals.push([cur, tx - 0.25]); cur = tx + 0.25; });
  xIntervals.push([cur, X1]);
  const addCarpet = (x0, x1, z0, z1) => {
    if (x1 - x0 < 0.05 || z1 - z0 < 0.05) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.carpet);
    m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, cy, (z0 + z1) / 2); m.receiveShadow = true;
    // keep texture scale constant regardless of rectangle size
    const uv = m.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x0 + uv.getX(i) * (x1 - x0)) / 6, (z0 + uv.getY(i) * (z1 - z0)) / 6);
    g.add(m);
  };
  xIntervals.forEach(([x0, x1]) => {
    const overlapsNear = x1 > near.x0 && x0 < near.x1;
    if (!overlapsNear) { addCarpet(x0, x1, Z0, Z1); return; }
    addCarpet(x0, x1, Z0, near.z0 + ov);
    addCarpet(x0, x1, near.z1 - ov, Z1);
    if (x0 < near.x0 + ov) addCarpet(x0, Math.min(x1, near.x0 + ov), near.z0 + ov, near.z1 - ov);
    if (x1 > near.x1 - ov) addCarpet(Math.max(x0, near.x1 - ov), x1, near.z0 + ov, near.z1 - ov);
  });
  M.carpet.map.repeat.set(1, 1);
  return g;
}

export function buildMarker(M, id) {
  const g = new THREE.Group();
  g.name = `marker-${id}`;
  const post = cyl(0.012, 0.012, 1.2, M.ivoryPaint, 10); post.position.y = 0.6; g.add(post);
  const tex = makeLabelTexture([id, 'station']);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }));
  plate.position.set(0, 1.12, 0.014); g.add(plate);
  const cap = cyl(0.02, 0.02, 0.03, M.forest, 12); cap.position.y = 1.215; g.add(cap);
  return g;
}

export function buildSightline(M) {
  const g = new THREE.Group();
  g.name = 'sightline';
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
  const lines = new THREE.LineSegments(lineGeo, M.sightLine);
  lines.frustumCulled = false;
  g.add(lines);
  const fillGeo = new THREE.BufferGeometry();
  fillGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18 * 3), 3));
  const fill = new THREE.Mesh(fillGeo, M.sightFill);
  fill.frustumCulled = false;
  fill.renderOrder = 4;
  g.add(fill);
  g.userData = { lines, fill };
  return g;
}

/** Update the illustrative field-of-view pyramid from a lens to the canopy plane. */
export function updateSightline(sl, lensWorld, quat, planeY, hfov = 0.7, vfov = 0.52, maxLen = 2.5) {
  const fwd = V(0, 0, 1).applyQuaternion(quat);
  const right = V(1, 0, 0).applyQuaternion(quat);
  const up = V(0, 1, 0).applyQuaternion(quat);
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    const d = fwd.clone().addScaledVector(right, Math.tan(hfov / 2) * a).addScaledVector(up, Math.tan(vfov / 2) * b).normalize();
    const t = d.y < -0.05 ? (planeY - lensWorld.y) / d.y : maxLen;
    return lensWorld.clone().addScaledVector(d, Math.min(t, maxLen));
  });
  const L = sl.userData.lines.geometry.attributes.position;
  let i = 0;
  const put = (v) => L.setXYZ(i++, v.x, v.y, v.z);
  corners.forEach((c) => { put(lensWorld); put(c); });
  for (let k = 0; k < 4; k++) { put(corners[k]); put(corners[(k + 1) % 4]); }
  L.needsUpdate = true;
  const F = sl.userData.fill.geometry.attributes.position;
  const fp = [corners[0], corners[1], corners[2], corners[0], corners[2], corners[3]];
  for (let k = 0; k < 4; k++) fp.push(lensWorld, corners[k], corners[(k + 1) % 4]);
  fp.forEach((v, j) => F.setXYZ(j, v.x, v.y + (j < 6 ? 0.01 : 0), v.z));
  F.needsUpdate = true;
}

export function buildFlightPath(M, pts) {
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, M.path);
  line.computeLineDistances();
  return line;
}

export function buildFootprint(M, w, d) {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.footprint);
  plane.rotation.x = -Math.PI / 2; g.add(plane);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(w, d)), M.footprintEdge);
  edge.rotation.x = -Math.PI / 2; g.add(edge);
  return g;
}

/** A flagged patch on the canopy: flat amber corner brackets, a faint fill and a pin for the label. */
export function buildFlag(M, w, d, pinH = 1.5) {
  const g = new THREE.Group();
  g.name = 'flag';
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.flagFill);
  fill.rotation.x = -Math.PI / 2; fill.renderOrder = 6; g.add(fill);
  const t = 0.045, L = Math.min(w, d) * 0.32;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new THREE.Mesh(new THREE.PlaneGeometry(L, t), M.flag); a.rotation.x = -Math.PI / 2;
    a.position.set(sx * (w / 2 - L / 2), 0.002, sz * d / 2); a.renderOrder = 7; g.add(a);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(t, L), M.flag); b.rotation.x = -Math.PI / 2;
    b.position.set(sx * w / 2, 0.002, sz * (d / 2 - L / 2)); b.renderOrder = 7; g.add(b);
  }
  const pin = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, pinH, 0)]), M.flagPin);
  g.add(pin);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), M.flag); dot.position.y = pinH; g.add(dot);
  const anchor = new THREE.Object3D(); anchor.position.y = pinH; g.add(anchor);
  g.userData.anchor = anchor;
  return g;
}

/** Constant-screen-size label for the flagged-patch sequence (three steps). */
export function buildCueLabel(code, steps) {
  const textures = steps.map((text, i) => makeCueTexture(code, text, i));
  const mat = new THREE.SpriteMaterial({ map: textures[0], sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true, fog: false, toneMapped: false });
  const sp = new THREE.Sprite(mat);
  sp.center.set(-0.06, 0.5);
  sp.renderOrder = 30;
  sp.userData.textures = textures;
  sp.userData.setStep = (i) => { if (mat.map !== textures[i]) { mat.map = textures[i]; mat.needsUpdate = true; } };
  return sp;
}
