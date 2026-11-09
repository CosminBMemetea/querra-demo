// 3D scan support (Gaussian splats rendered with Spark, MIT, vendored in vendor/spark/).
// Nothing here runs unless content/site.json → device.scan is set, so the 2.7 MB renderer
// is only downloaded when a real scan of the prototype has been supplied.
import * as THREE from 'three';

const SITE_ROOT = new URL('../../', import.meta.url).href;

export function scanUrl(scan) {
  return new URL(scan.file, SITE_ROOT).href;
}

export async function loadSpark() {
  return import('@sparkjsdev/spark');
}

/**
 * Place a scan in the core's frame: origin at the bottom centre of the enclosure, +y up,
 * +z towards the camera side, metres. `transform.rotationDeg` is applied in XYZ order;
 * many phone captures need [180, 0, 0] because they are stored y-down.
 */
export function applyScanTransform(obj, t = {}) {
  const [px, py, pz] = t.position || [0, 0, 0];
  const [rx, ry, rz] = (t.rotationDeg || [0, 0, 0]).map(THREE.MathUtils.degToRad);
  obj.position.set(px, py, pz);
  obj.rotation.set(rx, ry, rz);
  obj.scale.setScalar(t.scale || 1);
}
