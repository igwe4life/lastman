import {
  BoxGeometry,
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
} from 'three';
import { CROSSINGS, SIDE_ROADS, STREET } from '../config/layout';

/**
 * The main boulevard plus raised sidewalks, lane markings, zebra crossings and
 * perpendicular side roads. Geometry matches src/config/layout.ts so pedestrians
 * walk the sidewalks and only cross at the painted crossings.
 */
export class Roads {
  constructor(parent: Object3D) {
    const asphalt = this.asphalt();
    const dashMat = new MeshStandardMaterial({ color: 0xe8e2c0, roughness: 0.8, emissive: 0x161410 });
    const walkMat = new MeshStandardMaterial({ color: 0x9a9488, roughness: 0.95 });

    const length = STREET.start - STREET.end;
    const midZ = (STREET.start + STREET.end) / 2;

    // Main asphalt street.
    const streetGeo = new PlaneGeometry(STREET.roadHalfWidth * 2 + 8, length + 8, 1, 1);
    streetGeo.rotateX(-Math.PI / 2);
    streetGeo.translate(0, 0.02, midZ);
    const street = new Mesh(streetGeo, new MeshStandardMaterial({ map: asphalt, roughness: 0.95 }));
    street.receiveShadow = true;
    parent.add(street);

    // Centre lane dashes.
    for (let z = STREET.start; z > STREET.end; z -= 5) {
      const dash = new Mesh(new BoxGeometry(0.3, 0.02, 2), dashMat);
      dash.position.set(0, 0.06, z);
      parent.add(dash);
    }

    // Raised sidewalks (split around side-road intersections).
    this.buildSidewalks(parent, walkMat, midZ, length);

    // Zebra crossings across the main road.
    for (const z of CROSSINGS) this.zebra(parent, dashMat, z, 'across');

    // Side roads (perpendicular cross-streets) with their own crossings.
    for (const z of SIDE_ROADS) {
      const sideGeo = new PlaneGeometry(90, 8, 1, 1);
      sideGeo.rotateX(-Math.PI / 2);
      sideGeo.translate(0, 0.03, z);
      const side = new Mesh(sideGeo, new MeshStandardMaterial({ map: this.asphalt(), roughness: 0.95 }));
      side.receiveShadow = true;
      parent.add(side);
      // Lane dashes along the side road.
      for (let x = -40; x < 40; x += 5) {
        const dash = new Mesh(new BoxGeometry(2, 0.02, 0.3), dashMat);
        dash.position.set(x, 0.07, z);
        parent.add(dash);
      }
    }
  }

  private buildSidewalks(parent: Object3D, mat: MeshStandardMaterial, midZ: number, length: number): void {
    const width = STREET.sidewalkOuter - STREET.sidewalkX;
    const cx = (STREET.sidewalkX + STREET.sidewalkOuter) / 2;
    // Build each sidewalk as segments so side roads break through.
    const breaks = SIDE_ROADS.map((z) => [z - 5, z + 5] as [number, number]);
    const segments: [number, number][] = [];
    let cursor = STREET.start + 4;
    const sorted = [...breaks].sort((a, b) => b[0] - a[0]);
    for (const [bStart, bEnd] of sorted) {
      segments.push([cursor, bStart]);
      cursor = bEnd;
    }
    segments.push([cursor, STREET.end - 4]);

    for (const side of [-1, 1]) {
      for (const [zHi, zLo] of segments) {
        const segLen = zHi - zLo;
        if (segLen <= 0) continue;
        const walk = new Mesh(new BoxGeometry(width, 0.25, segLen), mat);
        walk.position.set(side * cx, 0.12, (zHi + zLo) / 2);
        walk.receiveShadow = true;
        parent.add(walk);
      }
    }
    void midZ;
    void length;
  }

  /** Paint a zebra crossing. 'across' = stripes spanning the road in x. */
  private zebra(parent: Object3D, mat: MeshStandardMaterial, z: number, _dir: 'across'): void {
    for (let i = -3; i <= 3; i++) {
      const stripe = new Mesh(new BoxGeometry(0.55, 0.02, 4.4), mat);
      stripe.position.set(i * 0.85, 0.06, z);
      parent.add(stripe);
    }
  }

  private asphalt(): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 512;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#3c3c40';
    ctx.fillRect(0, 0, 128, 512);
    for (let i = 0; i < 3000; i++) {
      const s = 40 + Math.random() * 40;
      ctx.fillStyle = `rgba(${s},${s},${s + 6},0.5)`;
      ctx.fillRect(Math.random() * 128, Math.random() * 512, 2, 2);
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(2, 18);
    tex.anisotropy = 8;
    return tex;
  }
}
