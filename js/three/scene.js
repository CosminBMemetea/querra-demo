// Evolution scene. Stage progress p ∈ [0, 5] comes from page scroll (or the selector).
// 0 desk · 1 field unit · 2 scouting round · 3 rover · 4 rover + aerial scouts · 5 manipulator
// Transitions are exploded-view assemblies and a lab → field dissolve; the core never morphs.
import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/three/RoomEnvironment.js';
import * as MD from './models.js';
import { OrbitOffset } from './orbit.js';

const SITE_ROOT = new URL('../../', import.meta.url).href;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const range = (t, a, b) => clamp((t - a) / (b - a));
const smooth = (t) => t * t * (3 - 2 * t);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Camera framing per stage: target, distance, yaw (from +z towards +x), pitch.
const PRESETS = [
  { target: V(0, 0.83, 0.01), dist: 0.62, yaw: -0.62, pitch: 0.24 },
  { target: V(0, 1.12, 0.35), dist: 3.0, yaw: 0.5, pitch: 0.2 },
  { target: V(0, 1.0, -0.5), dist: 5.4, yaw: 0.52, pitch: 0.2 },
  { target: V(0.1, 0.95, -0.2), dist: 5.6, yaw: 0.34, pitch: 0.3 },
  { target: V(0, 4.2, 1.5), dist: 16.5, yaw: 0.62, pitch: 0.46 },
  { target: V(0.95, 0.95, 0.1), dist: 3.6, yaw: 1.2, pitch: 0.38 },
]
const SHADOW_SIZE = [0.6, 3.2, 5, 5, 16, 3.6];
// The sky shader writes its uniforms to the screen as-is, so its colours are stored
// "display-referred". Fog colours are converted to output space by three.js itself,
// so they use ordinary colours (FOG). Both end up as the same on-screen hex values.
const disp = (hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
const FOG = { ivory: new THREE.Color('#ECE6DA'), horizon: new THREE.Color('#E4E2D6') };
const COLORS = {
  ivory: disp('#ECE6DA'),
  horizon: disp('#E4E2D6'),
  zenith: disp('#B9CAD4'),
  below: disp('#9A967C'),
};

export async function createEvolutionScene(host, opts = {}) {
  const lowPower = !!opts.lowPower;
  // capture mode (headless previews): the page may be 'hidden', where rAF never fires
  const schedule = opts.capture ? (f) => setTimeout(() => f(performance.now()), 16) : (f) => requestAnimationFrame(f);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: lowPower ? 'low-power' : 'high-performance', preserveDrawingBuffer: !!opts.capture });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.fog = new THREE.FogExp2(FOG.ivory.clone(), 0.1);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 600);

  // sky dome
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uHorizon: { value: COLORS.horizon.clone() }, uZenith: { value: COLORS.zenith.clone() }, uBelow: { value: COLORS.below.clone() }, uIvory: { value: COLORS.ivory.clone() }, uMix: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uHorizon; uniform vec3 uZenith; uniform vec3 uBelow; uniform vec3 uIvory; uniform float uMix; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h)); c = mix(c, uBelow, smoothstep(0.0, -0.25, h) * 0.6); c = mix(c, uIvory, uMix); gl_FragColor = vec4(c, 1.0); }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // lights
  const hemi = new THREE.HemisphereLight(0xeef1f2, 0x6d5c47, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);
  const SUN_DIR = V(-0.42, 0.78, 0.46).normalize();

  // assets
  let pending = 0;
  let readyResolve;
  const ready = new Promise((r) => (readyResolve = r));
  const manager = new THREE.LoadingManager(() => { dirty = true; readyResolve(); }, undefined, () => { dirty = true; });
  manager.onStart = () => { pending++; };
  const tex = MD.makeTextures(new THREE.TextureLoader(manager), SITE_ROOT);
  const M = MD.createMaterials(tex);
  // Since r163, envMapIntensity only applies to a material's own envMap, not to scene.environment.
  // Materials tuned with a lower intensity (crop, wood) therefore get the map explicitly.
  Object.values(M).forEach((m) => { if (m.isMeshStandardMaterial && m.envMapIntensity !== 1) m.envMap = scene.environment; });

  // wind sway on the crop
  const windUniforms = { uTime: { value: 0 }, uWind: { value: 0.028 } };
  M.crop.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = windUniforms.uTime;
    shader.uniforms.uWind = windUniforms.uWind;
    shader.vertexShader = 'uniform float uTime;\nuniform float uWind;\n' + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
      #else
        vec3 ip = vec3(0.0);
      #endif
      float hh = max(position.y, 0.0);
      float sw = sin(uTime * 1.6 + ip.x * 0.8 + ip.z * 1.1) * 0.6 + sin(uTime * 2.7 + ip.z * 2.3 + ip.x * 0.4) * 0.4;
      transformed.x += sw * uWind * hh * hh;
      transformed.z += sw * uWind * 0.6 * hh * hh;`);
  };

  // environments
  const studio = MD.buildStudio(M);
  const desk = MD.buildDesk(M);
  scene.add(studio, desk);
  const field = MD.buildField(M, { lowPower });
  scene.add(field);
  const markers = [['STN-02', -6.5], ['STN-03', 1.4], ['STN-04', 9.5]].map(([id, z]) => {
    const m = MD.buildMarker(M, id);
    m.position.set(MD.TRACK_X + 0.5, 0, z);
    m.rotation.y = -0.5;
    field.add(m);
    return m;
  });

  // perception core + protected case = field unit
  const unit = new THREE.Group();
  const core = MD.buildCore(M);
  const kase = MD.ownMaterials(MD.buildCase(M));
  MD.prepareAssembly(kase, V(0, 0.07, 0.01), 0.32);
  unit.add(core, kase);
  scene.add(unit);

  // platforms (each with its own materials so they can fade independently)
  const cart = MD.ownMaterials(MD.buildCart(M));
  MD.prepareAssembly(cart, V(0, 0.8, 0), 0.7, 0.08);
  const rover = MD.ownMaterials(MD.buildRover(M));
  MD.prepareAssembly(rover, V(0, 0.9, 0), 0.8, 0.08);
  // the arm hangs under the right rail (rotated π about z); its targets are given in rover space
  const ARM_P = V(...MD.CARRIER.ARM);
  const arm = MD.ownMaterials(MD.buildArm(M));
  arm.position.copy(ARM_P);
  arm.rotation.z = Math.PI;
  MD.prepareAssembly(arm, V(0, 0.3, 0), 0.4, 0.2);
  arm.userData.noAssembly = true;
  rover.add(arm);
  const RACK_P = V(...MD.CARRIER.RACK);
  const rack = MD.ownMaterials(MD.buildSampleRack(M, MD.CARRIER.FY - 0.035 - RACK_P.y, MD.CARRIER.TX - RACK_P.x));
  rack.position.copy(RACK_P);
  rack.userData.noAssembly = true;
  rover.add(rack);
  const toArm = (x, y, z) => V(-(x - ARM_P.x), -(y - ARM_P.y), z - ARM_P.z);
  const figure = MD.ownMaterials(MD.buildFigure(M));
  scene.add(cart, rover, figure);

  const drones = [0, 1].map(() => { const d = MD.ownMaterials(MD.buildDrone(M)); d.scale.setScalar(1.5); return d; });
  const footprints = drones.map(() => MD.ownMaterials(MD.buildFootprint(M, 4.4, 3.3)));
  const lawn = (x0, x1, z0, z1, legs, alt) => {
    const pts = [];
    for (let i = 0; i < legs; i++) {
      const x = lerp(x0, x1, i / (legs - 1));
      const [za, zb] = i % 2 ? [z1, z0] : [z0, z1];
      pts.push(V(x, alt, za), V(x, alt, zb));
    }
    pts.push(V(x1, alt, z0 - 2), V(x0, alt, z0 - 2), V(x0, alt, z0));
    return pts;
  };
  const ALT = 6.5;
  const paths = [lawn(-6.5, -1.6, -5, 8, 3, ALT), lawn(1.6, 6.5, -4, 9, 3, ALT)].map((pts) => new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.15));
  const pathLines = paths.map((c) => MD.ownMaterials(MD.buildFlightPath(M, c.getSpacedPoints(400))));
  drones.forEach((d, i) => scene.add(d, footprints[i], pathLines[i]));

  const sight = MD.buildSightline(M);
  const sideSight = MD.buildSightline(M);
  scene.add(sight, sideSight);

  // flagged-patch sequence (stage 4): the drone survey flags a patch, the carrier drives to it,
  // the core photographs it, and the record goes to human review. Illustrative, not a disease map.
  const PATCH = V(0, MD.CROP_H * 1.16, 5.4);
  const flag = MD.ownMaterials(MD.buildFlag(M, 1.0, 1.5, 2.5));
  flag.position.copy(PATCH);
  const cueLabel = MD.buildCueLabel('FLAG A-07', ['Flagged from the air', 'Photographed on the ground', 'Sent to human review']);
  cueLabel.scale.set(0.17, 0.056, 1);
  scene.add(flag, cueLabel);
  const L0 = paths[0].getLength();
  let uStar = 0;
  for (let i = 0, best = Infinity; i <= 2000; i++) {
    const pt = paths[0].getPointAt(i / 2000);
    const dd = (pt.x + 1.6) ** 2 + (pt.z - PATCH.z) ** 2;
    if (dd < best) { best = dd; uStar = i / 2000; }
  }
  const DRONE_SPEED = 2.2;
  const clockForCue = (c) => (((uStar + c) % 1) * L0) / DRONE_SPEED;
  const Z_START = -1.6, Z_CHECK = PATCH.z - 1.05, Z_SAMPLE = -2.4;
  function cueState(c) {
    let z = Z_START, flagA = 0, step = 0;
    if (c < 0.06) { flagA = smooth(range(c, 0, 0.06)); }
    else if (c < 0.42) { flagA = 1; z = lerp(Z_START, Z_CHECK, ease(range(c, 0.08, 0.42))); }
    else if (c < 0.82) { flagA = 1; z = Z_CHECK; step = c < 0.56 ? 1 : 2; }
    else { flagA = 1 - smooth(range(c, 0.82, 0.88)); step = 2; z = lerp(Z_CHECK, Z_START, ease(range(c, 0.84, 1))); }
    return { z, flagA, step };
  }

  // orbit
  const orbit = new OrbitOffset(host, () => { dirty = true; ensureLoop(); });

  // state
  let progress = 0;
  let paused = !!opts.paused;
  let reduced = !!opts.reduced;
  let visible = true;
  let inView = true;
  let dirty = true;
  let ambient = 0, roverClock = 0, armClock = 0;
  let droneClock = clockForCue(0); // the sequence starts with the flag as the stage comes in
  // with motion paused or reduced, show a representative moment instead of the start of each cycle
  let clocksRan = false;
  const STILL_CUE = 0.5, STILL_ARM = 7.2;
  let roverZ = 0;
  let raf = 0;
  let last = performance.now();

  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();

  function mountPose(obj) {
    obj.updateWorldMatrix(true, false);
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    obj.matrixWorld.decompose(pos, q, s);
    return { pos, q };
  }

  function framing(preset) {
    return { target: preset.target.clone(), dist: preset.dist, yaw: preset.yaw, pitch: preset.pitch };
  }
  function mixFraming(a, b, u) {
    return {
      target: a.target.clone().lerp(b.target, u),
      dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), u)),
      yaw: lerp(a.yaw, b.yaw, u),
      pitch: lerp(a.pitch, b.pitch, u),
    };
  }

  function apply() {
    const p = clamp(progress, 0, 5);
    const s = Math.min(4, Math.floor(p));
    const t = p - s;

    // --- carrier drive: a slow patrol (stage 3), the flagged-patch run (4), parked for sampling (5)
    const zPatrol = 1.4 * Math.sin((roverClock / 26) * Math.PI * 2);
    const still = (paused || reduced) && !clocksRan;
    const cue = cueState(still ? STILL_CUE : (((droneClock * DRONE_SPEED) / L0 - uStar) % 1 + 1) % 1);
    const w4 = s === 3 ? smooth(t) : s === 4 ? 1 - smooth(t) : 0;
    roverZ = s < 3 ? zPatrol : s === 3 ? lerp(zPatrol, cue.z, smooth(t)) : lerp(cue.z, Z_SAMPLE, smooth(t));
    rover.position.set(0, 0.006 * Math.sin(roverZ * 9) + 0.004 * Math.sin(roverZ * 17 + 1), roverZ);
    rover.rotation.set(0.004 * Math.cos(roverZ * 9), 0, 0.003 * Math.sin(roverZ * 5));
    rover.userData.wheels.forEach((w) => (w.userData.spin.rotation.x = roverZ / w.userData.R));

    // --- environments
    const fieldOn = p >= 0.5;
    studio.visible = !fieldOn;
    desk.visible = !fieldOn;
    field.visible = fieldOn;

    // fog dip for the lab → field dissolve
    let dip = 0;
    if (s === 0) dip = t < 0.5 ? smooth(range(t, 0.18, 0.5)) : 1 - smooth(range(t, 0.5, 0.86));
    const baseDensity = fieldOn ? 0.021 : 0.11;
    scene.fog.density = lerp(baseDensity, 7, Math.pow(dip, 1.6));
    scene.fog.color.copy(fieldOn ? FOG.horizon : FOG.ivory).lerp(FOG.ivory, dip);
    skyMat.uniforms.uMix.value = fieldOn ? dip : 1;

    // --- platform opacities and assemblies
    const cartA = p < 0.5 ? 0 : s <= 1 ? 1 : s === 2 ? 1 - smooth(range(t, 0.12, 0.45)) : 0;
    MD.setOpacity(cart, cartA);
    MD.setAssembly(cart, s === 2 ? cartA : 1);
    cart.userData.wheels.forEach((w) => (w.userData.spin.rotation.x = 0));

    const roverA = s < 2 ? 0 : s === 2 ? smooth(range(t, 0.32, 0.8)) : 1;
    MD.setOpacity(rover, roverA);
    MD.setAssembly(rover, roverA);
    const armA = s < 4 ? 0 : smooth(range(t, 0.3, 0.85));
    MD.setOpacity(arm, roverA * armA);
    MD.setOpacity(rack, roverA * armA);
    MD.setAssembly(arm, armA);
    if (armA > 0) animateArm();

    // drones
    const droneA = s < 3 ? 0 : s === 3 ? smooth(range(t, 0.15, 0.85)) : 1 - smooth(range(t, 0.0, 0.5));
    drones.forEach((d, i) => {
      MD.setOpacity(d, droneA);
      MD.setOpacity(footprints[i], droneA);
      MD.setOpacity(pathLines[i], droneA);
      if (droneA <= 0) return;
      const u = ((droneClock * 2.2) / paths[i].getLength() + i * 0.37) % 1;
      const pt = paths[i].getPointAt(u);
      const ahead = paths[i].getPointAt((u + 0.004) % 1);
      const lift = s === 3 ? (1 - droneA) * 9 : (1 - droneA) * 12;
      d.position.copy(pt).add(V(0, lift, 0));
      d.rotation.set(0.08, Math.atan2(ahead.x - pt.x, ahead.z - pt.z), 0);
      d.userData.props.forEach((pr, k) => (pr.rotation.y = ambient * 40 + k));
      footprints[i].position.set(pt.x, MD.CROP_H * 0.9 + 0.03, pt.z);
      footprints[i].rotation.y = d.rotation.y;
    });

    // flagged patch and its label
    const flagA = droneA * cue.flagA;
    MD.setOpacity(flag, flagA);
    cueLabel.visible = flagA > 0.02;
    if (cueLabel.visible) {
      cueLabel.material.opacity = flagA;
      cueLabel.userData.setStep(cue.step);
      flag.userData.anchor.getWorldPosition(cueLabel.position);
    }

    // scale figure
    let figA = 0, figZ = -1.3, pose = 'push', walk = 0;
    if (s === 1) { figA = smooth(range(t, 0.05, 0.35)); figZ = lerp(-6, -1.3, smooth(range(t, 0.05, 0.9))); walk = figZ * 6.5; }
    else if (s >= 2) {
      figA = 1;
      if (s === 2) { const u = smooth(range(t, 0.1, 0.6)); figZ = lerp(-1.3, -3.7, u); pose = t > 0.1 ? 'tablet' : 'push'; walk = -figZ * 6.5 * (u > 0 && u < 1 ? 1 : 0); }
      else { figZ = s === 4 ? lerp(-3.7, -6.2, smooth(t)) : -3.7; pose = 'tablet'; }
    }
    if (p < 1) figA = 0;
    MD.setOpacity(figure, figA);
    figure.position.set(0, 0, figZ);
    MD.poseFigure(figure, pose, walk);

    // --- the field unit (core + case)
    const deskM = mountPose(desk.userData.mount);
    const cartM = mountPose(cart.userData.mount);
    const roverM = mountPose(rover.userData.mount);
    const caseA = s === 0 ? smooth(range(t, 0.06, 0.42)) : 1;
    MD.setAssembly(kase, caseA);
    MD.setOpacity(kase, caseA);
    // the real scan (if supplied) shows on the desk, then hands over to the model as the case assembles
    const scanA = scanMesh && scanReady && s === 0 ? 1 - smooth(range(t, 0.03, 0.12)) : 0;
    if (scanMesh) { scanMesh.visible = scanA > 0.01; scanMesh.opacity = scanA; }
    const showModel = scanA < 0.5;
    if (showModel !== modelShown) {
      modelShown = showModel;
      core.children.forEach((c) => { if (c !== core.userData.highlight) c.visible = showModel; });
    }

    const lift = V(0, 0.12, 0);
    let upos, uq;
    if (s === 0) {
      if (t < 0.5) {
        upos = deskM.pos.clone().addScaledVector(lift, smooth(range(t, 0.02, 0.2)));
        uq = deskM.q.clone();
      } else {
        upos = cartM.pos.clone().addScaledVector(lift, 1 - smooth(range(t, 0.62, 0.9)));
        uq = deskM.q.clone().slerp(cartM.q, smooth(range(t, 0.55, 0.88)));
      }
    } else if (s === 1) {
      upos = cartM.pos; uq = cartM.q;
    } else if (s === 2) {
      const hoverA = cartM.pos.clone().add(V(0, 0.45, 0.2));
      const hoverB = roverM.pos.clone().add(V(0, 0.3, 0.15));
      if (t < 0.25) upos = cartM.pos.clone().lerp(hoverA, smooth(range(t, 0, 0.25)));
      else if (t < 0.72) upos = hoverA.clone().lerp(hoverB, ease(range(t, 0.25, 0.72)));
      else upos = hoverB.clone().lerp(roverM.pos, smooth(range(t, 0.72, 0.96)));
      uq = cartM.q.clone().slerp(roverM.q, smooth(range(t, 0.25, 0.72)));
    } else {
      upos = roverM.pos; uq = roverM.q;
    }
    unit.position.copy(upos);
    unit.quaternion.copy(uq);
    unit.updateMatrixWorld(true);

    // sightline from the core's lens (illustrative field of view)
    let sightA = 0;
    if (s === 0) sightA = smooth(range(t, 0.86, 1));
    else if (s === 1) sightA = 1;
    else if (s === 2) sightA = Math.max(1 - smooth(range(t, 0, 0.1)), smooth(range(t, 0.94, 1)));
    else sightA = 1;
    sight.visible = sightA > 0.01 && fieldOn;
    if (sight.visible) {
      const lens = core.userData.lens;
      lens.updateWorldMatrix(true, false);
      lens.matrixWorld.decompose(tmpV, tmpQ, tmpS);
      MD.updateSightline(sight, tmpV.clone(), tmpQ.clone(), MD.CROP_H * 0.92);
      M.sightLine.opacity = 0.85 * sightA;
      M.sightFill.opacity = 0.07 * sightA;
    }
    // the low side camera looks sideways into the lower canopy (carrier stages only)
    const sideA = s >= 3 ? roverA : s === 2 ? smooth(range(t, 0.9, 1)) : 0;
    sideSight.visible = sideA > 0.05 && sight.visible;
    if (sideSight.visible) {
      const sc = rover.userData.sideCam;
      sc.updateWorldMatrix(true, false);
      sc.matrixWorld.decompose(tmpV, tmpQ, tmpS);
      MD.updateSightline(sideSight, tmpV.clone(), tmpQ.clone(), 0.02, 0.9, 0.62, 0.62);
    }

    // --- camera
    let fr;
    if (s === 0) {
      const close = (pos) => ({ target: pos.clone().add(V(0, 0.07, 0.02)), dist: 0.85, yaw: 0.45, pitch: 0.16 });
      fr = t < 0.5
        ? mixFraming(framing(PRESETS[0]), close(upos), ease(range(t, 0, 0.5)))
        : mixFraming(close(upos), framing(PRESETS[1]), ease(range(t, 0.5, 1)));
    } else {
      fr = mixFraming(framing(PRESETS[s]), framing(PRESETS[s + 1]), ease(t));
    }
    const follow = clamp(p - 2, 0, 1) * lerp(1, 0.55, w4);
    fr.target.z += roverZ * follow;
    const aspect = camera.aspect;
    const narrow = aspect < 1 ? 1 + (1 - aspect) * 1.05 : 1;
    const yaw = fr.yaw + orbit.yaw;
    const pitch = clamp(fr.pitch + orbit.pitch, 0.02, 1.35);
    const dist = fr.dist * orbit.zoom * narrow;
    camera.position.set(
      fr.target.x + dist * Math.sin(yaw) * Math.cos(pitch),
      fr.target.y + dist * Math.sin(pitch),
      fr.target.z + dist * Math.cos(yaw) * Math.cos(pitch),
    );
    if (camera.position.y < 0.15) camera.position.y = 0.15;
    camera.lookAt(fr.target);
    camera.near = dist < 2 ? 0.01 : 0.05;
    camera.updateProjectionMatrix();
    sky.position.copy(camera.position);

    // sun + shadows follow the framed target
    const sh = lerp(SHADOW_SIZE[s], SHADOW_SIZE[s + 1] ?? SHADOW_SIZE[s], ease(t));
    sun.position.copy(fr.target).addScaledVector(SUN_DIR, Math.max(4, sh * 4));
    sun.target.position.copy(fr.target);
    const sc = sun.shadow.camera;
    sc.left = -sh; sc.right = sh; sc.top = sh; sc.bottom = -sh; sc.near = 0.05; sc.far = Math.max(12, sh * 10);
    sc.updateProjectionMatrix();

    windUniforms.uTime.value = ambient;
  }

  function animateArm() {
    const T = 9;
    const clock = (paused || reduced) && !clocksRan ? STILL_ARM : armClock;
    const c = ((clock % T) + T) % T / T;
    // rover-space tool-tip waypoints: tucked, above the leaf, at the leaf, above the rack, in the rack
    // the arm samples the crop just outside the tramline, then drops the leaf disc into a barcoded tube
    const rest = V(1.03, 0.9, 0.2), above = V(1.37, 0.76, 0.22), leaf = V(1.37, 0.57, 0.22), rackUp = V(RACK_P.x, RACK_P.y + 0.24, RACK_P.z), rackIn = V(RACK_P.x, RACK_P.y + 0.15, RACK_P.z);
    let tgt, grip = 0;
    if (c < 0.22) tgt = rest.clone().lerp(above, smooth(range(c, 0, 0.22)));
    else if (c < 0.34) tgt = above.clone().lerp(leaf, smooth(range(c, 0.22, 0.34)));
    else if (c < 0.44) { tgt = leaf.clone(); grip = smooth(range(c, 0.36, 0.42)); }
    else if (c < 0.56) { tgt = leaf.clone().lerp(above, smooth(range(c, 0.44, 0.56))); grip = 1; }
    else if (c < 0.74) { tgt = above.clone().lerp(rackUp, smooth(range(c, 0.56, 0.74))); grip = 1; }
    else if (c < 0.84) { tgt = rackUp.clone().lerp(rackIn, smooth(range(c, 0.74, 0.8))); grip = 1 - smooth(range(c, 0.8, 0.84)); }
    else tgt = rackIn.clone().lerp(rest, smooth(range(c, 0.86, 1)));
    MD.poseArm(arm, toArm(tgt.x, tgt.y, tgt.z), grip, 1);
  }

  // core label projection
  function emitCore() {
    if (!opts.onCore) return;
    const a = core.userData.labelAnchor;
    a.updateWorldMatrix(true, false);
    tmpV.setFromMatrixPosition(a.matrixWorld).project(camera);
    const w = host.clientWidth, h = host.clientHeight;
    const x = (tmpV.x * 0.5 + 0.5) * w, y = (-tmpV.y * 0.5 + 0.5) * h;
    const onScreen = tmpV.z < 1 && x > 8 && x < w - 8 && y > 40 && y < h - 8;
    opts.onCore({ x, y, visible: onScreen && visible });
  }

  // sizing
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 46 : 38;
    camera.updateProjectionMatrix();
    // the flag label has a constant screen size: keep it legible on short (phone) canvases
    const k = Math.min(2.2, Math.max(1, 560 / h));
    cueLabel.scale.set(0.17 * k, 0.056 * k, 1);
    dirty = true;
    ensureLoop();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) { dirty = true; ensureLoop(); } }, { threshold: 0 });
  io.observe(host);

  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !inView) return;
    const animating = !paused && !reduced;
    if (animating) {
      clocksRan = true;
      ambient += dt;
      if (progress >= 2.99) roverClock += dt;
      if (progress >= 3.0) droneClock += dt;
      if (progress >= 4.6) armClock += dt;
    }
    const orbitMoving = orbit.update(reduced);
    // splat sorting completes asynchronously: keep drawing a few frames after a change
    if (scanMesh?.visible && (dirty || orbitMoving)) warm = Math.max(warm, 20);
    if (animating || dirty || orbitMoving || warm > 0) {
      dirty = false;
      if (warm > 0) warm--;
      apply();
      renderer.render(scene, camera);
      emitCore();
    }
    if (animating || orbitMoving || warm > 0) ensureLoop();
  }
  function ensureLoop() { if (!raf) { last = performance.now(); raf = schedule(frame); } }

  // Optional: a real 3D scan of the prototype (content/site.json → device.scan) replaces the
  // approximated model on the desk at the start of stage 0. Nothing loads without a scan.
  let scanMesh = null, scanReady = false, modelShown = true, warm = 0;
  if (opts.scan) {
    try {
      const { loadSpark, scanUrl, applyScanTransform } = await import('./scan.js');
      const { SparkRenderer, SplatMesh } = await loadSpark();
      scene.add(new SparkRenderer({ renderer }));
      scanMesh = new SplatMesh({ url: scanUrl(opts.scan) });
      applyScanTransform(scanMesh, opts.scan.transform);
      scanMesh.visible = false;
      unit.add(scanMesh);
      scanMesh.initialized
        .then(() => { scanReady = true; dirty = true; warm = 90; ensureLoop(); })
        .catch((err) => { console.warn('3D scan unavailable; using the approximated model.', err); scanMesh.visible = false; scanMesh = null; dirty = true; ensureLoop(); });
    } catch (err) {
      console.warn('3D scan unavailable; using the approximated model.', err);
      scanMesh = null;
    }
  }

  // first render once textures are in (or immediately if they fail)
  await Promise.race([ready, new Promise((r) => setTimeout(r, 2500))]);
  dirty = true;
  ensureLoop();

  const api = {
    setProgress(p) { if (Math.abs(p - progress) > 1e-5) { progress = p; dirty = true; ensureLoop(); } },
    setPaused(v) { paused = v; dirty = true; ensureLoop(); },
    setReduced(v) { reduced = v; dirty = true; ensureLoop(); },
    setVisible(v) { visible = v; dirty = true; if (v) ensureLoop(); else opts.onCore?.({ visible: false }); },
    resetView() { orbit.reset(); dirty = true; ensureLoop(); },
    /** For still generation: set clocks so ambient elements are in a representative pose. */
    setClocks({ rover = 0, drone, cue, arm = 0, wind = 0 } = {}) { roverClock = rover; droneClock = cue !== undefined ? clockForCue(cue) : drone ?? clockForCue(0); armClock = arm; ambient = wind; clocksRan = true; dirty = true; ensureLoop(); },
    renderNow() { apply(); renderer.render(scene, camera); emitCore(); },
    info() { return { crop: field.userData.cropCount, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }; },
    canvas: renderer.domElement,
    ready,
    dispose() { if (opts.capture) clearTimeout(raf); else cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); orbit.dispose(); renderer.dispose(); },
  };
  return api;
}
