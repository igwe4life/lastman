import {
  Color,
  ConeGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { makeRng, randRange } from '../utils/math';

/**
 * A ring of distant mountains on the horizon (used by Johannesburg for its
 * high-veld backdrop). Placed far out so they fade into the atmosphere.
 */
export class Mountains {
  constructor(parent: Object3D) {
    const rng = makeRng(31);
    const radius = 330;
    const count = 36;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + randRange(rng, -0.05, 0.05);
      const r = radius + randRange(rng, -40, 40);
      const h = randRange(rng, 55, 140);
      const baseR = h * randRange(rng, 0.7, 1.1);
      const t = rng();
      const m = new Mesh(
        new ConeGeometry(baseR, h, 6, 1),
        new MeshStandardMaterial({
          color: new Color(0x6a7689).lerp(new Color(0xf4f8ff), t * 0.35),
          roughness: 1,
          flatShading: true,
        }),
      );
      m.position.set(Math.cos(angle) * r, h / 2 - 10, Math.sin(angle) * r);
      m.rotation.y = rng() * Math.PI;
      parent.add(m);
    }
  }
}
