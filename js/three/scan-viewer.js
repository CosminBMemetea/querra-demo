// Stand-alone viewer for the 3D scan of the prototype (Device section).
// Drag or use the arrow keys to rotate, + / − to zoom, 0 to reset. No autoplay, no wheel capture.
import * as THREE from 'three';
import { OrbitOffset } from './orbit.js';
import { loadSpark, scanUrl, applyScanTransform } from './scan.js';

export async function mountScanViewer(host, scan, { capture = false } = {}) {
  const { SparkRenderer, SplatMesh } = await loadSpark();
  const schedule = capture ? (f) => setTimeout(() => f(performance.now()), 16) : (f) => requestAnimationFrame(f);

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, preserveDrawingBuffer: capture });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new THREE.Color('#EFE8DA'), 1);
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
  const spark = new SparkRenderer({ renderer });
  scene.add(spark);

  const splat = new SplatMesh({ url: scanUrl(scan) });
  applyScanTransform(splat, scan.transform);
  scene.add(splat);

  const v = scan.view || {};
  const target = new THREE.Vector3(...(v.target || [0, 0.06, 0]));
  const base = { dist: v.distance || 0.85, yaw: v.yaw ?? 0.6, pitch: v.pitch ?? 0.25 };

  let raf = 0, warm = 60, inView = true;
  const orbit = new OrbitOffset(host, () => { warm = 30; ensure(); });

  function render() {
    const yaw = base.yaw + orbit.yaw, pitch = Math.max(-0.3, Math.min(1.2, base.pitch + orbit.pitch)), dist = base.dist * orbit.zoom;
    camera.position.set(target.x + dist * Math.sin(yaw) * Math.cos(pitch), target.y + dist * Math.sin(pitch), target.z + dist * Math.cos(yaw) * Math.cos(pitch));
    camera.lookAt(target);
    renderer.render(scene, camera);
  }
  function frame() {
    raf = 0;
    if (!inView) return;
    const moving = orbit.update(false);
    render();
    // splat sorting finishes asynchronously, so keep drawing a few frames after any change
    if (moving || warm-- > 0) ensure();
  }
  function ensure() { if (!raf) raf = schedule(frame); }

  const resize = () => {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    warm = 30; ensure();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; if (inView) { warm = 30; ensure(); } });
  io.observe(host);
  resize();

  await splat.initialized;
  warm = 90; ensure();

  return {
    reset() { orbit.reset(); },
    dispose() { cancelAnimationFrame(raf); clearTimeout(raf); ro.disconnect(); io.disconnect(); orbit.dispose(); splat.dispose?.(); renderer.dispose(); renderer.domElement.remove(); },
  };
}
