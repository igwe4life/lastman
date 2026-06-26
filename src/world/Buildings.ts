import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  type Texture,
} from 'three';
import { makeRng, randRange } from '../utils/math';
import type { CityConfig } from '../config/cities';

/**
 * The city blocks lining the main street. Each city draws from its own palette
 * and height range, and 'modern' districts (Johannesburg) get reflective glass
 * towers with emissive windows while 'mixed' districts (Lagos/Accra) blend
 * high-rises with low painted residential/shop buildings.
 */
export class Buildings {
  constructor(parent: Object3D, city: CityConfig) {
    const windowTex = this.makeWindowTexture();
    const rng = makeRng(city.id.length * 9173 + 7);
    const b = city.buildings;

    let placed = 0;
    let guard = 0;
    while (placed < b.count && guard < b.count * 4) {
      guard++;
      const side = rng() < 0.5 ? -1 : 1;
      const backRow = rng() < 0.5;
      const x = side * randRange(rng, backRow ? 24 : 11, backRow ? 52 : 22);
      const z = randRange(rng, -92, 18);
      const w = randRange(rng, 4, 9);
      const d = randRange(rng, 4, 9);
      const lowRise = b.style === 'mixed' && rng() < 0.45;
      const h = lowRise
        ? randRange(rng, b.minHeight, b.minHeight + 6)
        : backRow
          ? randRange(rng, (b.minHeight + b.maxHeight) / 2, b.maxHeight)
          : randRange(rng, b.minHeight, b.maxHeight * 0.7);

      const color = b.palette[(rng() * b.palette.length) | 0];
      const glass = b.style === 'modern' || (!lowRise && rng() < 0.5);

      const tex = windowTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(Math.max(1, Math.round(w / 2)), Math.max(2, Math.round(h / 3)));

      const mat = glass
        ? new MeshStandardMaterial({
            color,
            roughness: 0.2,
            metalness: 0.8,
            map: tex,
            emissive: 0xffe6a8,
            emissiveMap: tex,
            emissiveIntensity: 0.5,
          })
        : new MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, map: tex });

      const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
      mesh.position.set(x, h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);

      // Rooftop detailing for richer skyline silhouettes.
      this.addRooftop(parent, rng, x, z, w, d, h, glass);

      // Low painted shopfront stripe for character on residential buildings.
      if (lowRise) {
        const stripe = new Mesh(
          new BoxGeometry(w + 0.05, 1.2, d + 0.05),
          new MeshStandardMaterial({ color: new Color(color).offsetHSL(0.5, 0, 0.05).getHex(), roughness: 0.8 }),
        );
        stripe.position.set(x, 0.8, z);
        parent.add(stripe);
      }
      placed++;
    }
  }

  /** Add water tanks, antennas, parapets and stepped setbacks to a rooftop. */
  private addRooftop(
    parent: Object3D,
    rng: () => number,
    x: number,
    z: number,
    w: number,
    d: number,
    h: number,
    glass: boolean,
  ): void {
    const concrete = new MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 });
    const metal = new MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.6, metalness: 0.5 });

    if (glass && h > 24 && rng() < 0.6) {
      // Stepped glass setback (modern tower crown).
      const sw = w * 0.6;
      const sd = d * 0.6;
      const sh = 3 + rng() * 5;
      const step = new Mesh(new BoxGeometry(sw, sh, sd), concrete);
      step.position.set(x, h + sh / 2, z);
      step.castShadow = true;
      parent.add(step);
      if (rng() < 0.7) {
        const mast = new Mesh(new BoxGeometry(0.15, 4 + rng() * 4, 0.15), metal);
        mast.position.set(x, h + sh + 2, z);
        parent.add(mast);
      }
    } else {
      // Parapet rim.
      const rim = new Mesh(new BoxGeometry(w + 0.1, 0.5, d + 0.1), concrete);
      rim.position.set(x, h + 0.25, z);
      parent.add(rim);
      // Water tank.
      if (rng() < 0.5) {
        const tank = new Mesh(new CylinderGeometry(0.5, 0.5, 1.1, 8), concrete);
        tank.position.set(x + (rng() - 0.5) * w * 0.5, h + 0.9, z + (rng() - 0.5) * d * 0.5);
        tank.castShadow = true;
        parent.add(tank);
      }
      // Antenna.
      if (rng() < 0.4) {
        const ant = new Mesh(new BoxGeometry(0.08, 3 + rng() * 3, 0.08), metal);
        ant.position.set(x + (rng() - 0.5) * w * 0.4, h + 1.8, z + (rng() - 0.5) * d * 0.4);
        parent.add(ant);
      }
    }
  }

  private makeWindowTexture(): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#23303f';
    ctx.fillRect(0, 0, 128, 128);
    const cell = 16;
    for (let y = 0; y < 128; y += cell) {
      for (let x = 0; x < 128; x += cell) {
        const lit = Math.random() < 0.4;
        ctx.fillStyle = lit ? '#ffe9b0' : '#3a5570';
        ctx.fillRect(x + 2, y + 2, cell - 4, cell - 5);
      }
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    return tex;
  }
}
