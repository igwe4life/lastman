import {
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import type { Terrain } from './Terrain';
import { makeRng, randRange } from '../utils/math';

/**
 * Tropical palm trees that give Lagos (and to a lesser extent Accra) its
 * coastal identity: a tall slightly-leaning trunk topped with a crown of drooping
 * fronds. Trunks and fronds are instanced for performance. Lined along the
 * sidewalks, clear of the street.
 */
export class Palms {
  constructor(parent: Object3D, terrain: Terrain, count: number) {
    if (count <= 0) return;
    const FRONDS = 7;
    const trunkGeo = new CylinderGeometry(0.16, 0.26, 5, 6);
    trunkGeo.translate(0, 2.5, 0);
    const trunkMat = new MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 });
    const frondGeo = new ConeGeometry(0.28, 2.4, 4);
    frondGeo.translate(0, 1.2, 0); // pivot at base of frond
    const frondMat = new MeshStandardMaterial({ color: 0x3f8b3a, roughness: 0.85, flatShading: true });

    const trunks = new InstancedMesh(trunkGeo, trunkMat, count);
    const fronds = new InstancedMesh(frondGeo, frondMat, count * FRONDS);
    trunks.castShadow = fronds.castShadow = true;
    trunks.receiveShadow = true;

    const rng = makeRng(5150);
    const m = new Matrix4();
    const q = new Quaternion();
    const e = new Object3D();
    const pos = new Vector3();
    let fi = 0;

    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * randRange(rng, 8.5, 13);
      const z = randRange(rng, -96, 16);
      const y = terrain.heightAt(x, z);
      const lean = randRange(rng, -0.08, 0.08);
      const s = randRange(rng, 0.85, 1.25);

      e.position.set(x, y, z);
      e.rotation.set(lean, rng() * Math.PI, lean);
      e.scale.setScalar(s);
      e.updateMatrix();
      trunks.setMatrixAt(i, e.matrix);

      // Crown of fronds drooping outward from the trunk top.
      const topY = y + 5 * s;
      for (let f = 0; f < FRONDS; f++) {
        const ang = (f / FRONDS) * Math.PI * 2;
        pos.set(x, topY, z);
        q.setFromEuler(eulerFromYawPitch(ang, 1.05)); // pitch fronds downward
        m.compose(pos, q, new Vector3(s, s, s));
        fronds.setMatrixAt(fi++, m);
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    fronds.instanceMatrix.needsUpdate = true;
    parent.add(trunks, fronds);
  }
}

import { Euler } from 'three';
function eulerFromYawPitch(yaw: number, pitch: number): Euler {
  // Rotate around Y (yaw) then tilt outward (pitch) so the cone points down-out.
  return new Euler(pitch, yaw, 0, 'YXZ');
}
