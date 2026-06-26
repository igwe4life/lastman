import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  TorusGeometry,
  Vector3,
} from 'three';
import type { CityConfig } from '../config/cities';

/**
 * Recognizable per-city landmarks + entrance signage that give each district an
 * instantly-readable identity (inspired by, not exact replicas of, the real
 * cities):
 *   - Lagos: a cable-stayed bridge pylon and a tall lattice telecom mast.
 *   - Accra: a Black-Star-Gate-style independence arch with a black star.
 *   - Johannesburg: a Hillbrow-style telecom tower among stepped towers.
 * Plus a welcome gateway arch over the street carrying the city's name. The big
 * landmarks sit on the far horizon so they read as the silhouette goal ahead and
 * never block the playable street.
 */
export class Landmarks {
  constructor(parent: Object3D, city: CityConfig) {
    this.buildEntranceGate(parent, city);
    switch (city.id) {
      case 'lagos':
        this.buildLagos(parent);
        break;
      case 'accra':
        this.buildAccra(parent);
        break;
      case 'johannesburg':
        this.buildJohannesburg(parent);
        break;
    }
  }

  // --- Entrance signage --------------------------------------------------

  private buildEntranceGate(parent: Object3D, city: CityConfig): void {
    const accent = city.buildings.palette[0];
    const gate = new Group();
    const pillarMat = new MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.9 });
    for (const sx of [-7.5, 7.5]) {
      const pillar = new Mesh(new BoxGeometry(0.9, 8, 0.9), pillarMat);
      pillar.position.set(sx, 4, 0);
      pillar.castShadow = pillar.receiveShadow = true;
      gate.add(pillar);
    }
    // Top beam.
    const beam = new Mesh(new BoxGeometry(16.5, 1.6, 1.2), new MeshStandardMaterial({ color: accent, roughness: 0.7 }));
    beam.position.set(0, 8.3, 0);
    beam.castShadow = true;
    gate.add(beam);

    // Name banner (readable from both approach directions).
    const tex = this.makeSignTexture(city.name.toUpperCase(), accent);
    for (const ry of [0, Math.PI]) {
      const banner = new Mesh(
        new PlaneGeometry(14, 1.3),
        new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide }),
      );
      banner.position.set(0, 8.3, ry === 0 ? 0.62 : -0.62);
      banner.rotation.y = ry;
      gate.add(banner);
    }
    gate.position.set(0, 0, 3);
    parent.add(gate);
  }

  private makeSignTexture(text: string, accent: number): CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 1024;
    c.height = 96;
    const ctx = c.getContext('2d')!;
    const col = new Color(accent);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.fillStyle = `#${col.clone().multiplyScalar(0.25).getHexString()}`;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#fff7e6';
    ctx.font = 'bold 60px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2 + 4);
    return new CanvasTexture(c);
  }

  // --- Lagos -------------------------------------------------------------

  private buildLagos(parent: Object3D): void {
    // Cable-stayed bridge pylon with fanned cables and a deck (Lekki-inspired).
    const bridge = new Group();
    const pyMat = new MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6, metalness: 0.2 });
    const pylon = new Mesh(new CylinderGeometry(0.8, 1.6, 46, 8), pyMat);
    pylon.position.y = 23;
    bridge.add(pylon);
    const deck = new Mesh(new BoxGeometry(60, 1.2, 4), new MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9 }));
    deck.position.y = 10;
    bridge.add(deck);
    // Cables.
    const pts: number[] = [];
    for (let i = 1; i <= 10; i++) {
      const top = new Vector3(0, 44 - i * 1.5, 0);
      pts.push(top.x, top.y, top.z, -i * 2.6, 10.6, 0);
      pts.push(top.x, top.y, top.z, i * 2.6, 10.6, 0);
    }
    const cg = new BufferGeometry();
    cg.setAttribute('position', new Float32BufferAttribute(pts, 3));
    bridge.add(new LineSegments(cg, new LineBasicMaterial({ color: 0xdddddd })));
    bridge.position.set(26, 0, -150);
    bridge.rotation.y = -0.5;
    parent.add(bridge);

    // Tall red-and-white lattice telecom mast.
    parent.add(this.latticeMast(-28, -145, 64));
  }

  private latticeMast(x: number, z: number, h: number): Group {
    const g = new Group();
    const bandA = new MeshStandardMaterial({ color: 0xd23b2f, roughness: 0.7 });
    const bandB = new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const r0 = 2.2 * (1 - i / segs) + 0.4;
      const seg = new Mesh(new CylinderGeometry(r0 * 0.8, r0, h / segs, 6, 1, true), i % 2 ? bandA : bandB);
      seg.position.y = (i + 0.5) * (h / segs);
      g.add(seg);
    }
    const spike = new Mesh(new CylinderGeometry(0.05, 0.2, 8, 5), bandB);
    spike.position.y = h + 4;
    g.add(spike);
    g.position.set(x, 0, z);
    return g;
  }

  // --- Accra -------------------------------------------------------------

  private buildAccra(parent: Object3D): void {
    // Black Star Gate-style independence arch straddling the avenue axis.
    const arch = new Group();
    const white = new MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.9 });
    for (const sx of [-6, 6]) {
      const leg = new Mesh(new BoxGeometry(2.4, 12, 2.4), white);
      leg.position.set(sx, 6, 0);
      leg.castShadow = true;
      arch.add(leg);
    }
    const top = new Mesh(new BoxGeometry(15, 2.6, 3), white);
    top.position.set(0, 13.3, 0);
    top.castShadow = true;
    arch.add(top);
    // The black star on top.
    const star = new Mesh(
      new ExtrudeGeometry(starShape(1.8, 0.75), { depth: 0.4, bevelEnabled: false }),
      new MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.3 }),
    );
    star.position.set(0, 16.4, -0.2);
    arch.add(star);
    arch.position.set(0, 0, -118);
    parent.add(arch);

    // A slender independence column nearby.
    const col = new Group();
    const colMat = new MeshStandardMaterial({ color: 0xeae4d6, roughness: 0.9 });
    const shaft = new Mesh(new CylinderGeometry(1, 1.4, 24, 10), colMat);
    shaft.position.y = 12;
    col.add(shaft);
    const torch = new Mesh(new CylinderGeometry(1.6, 0.8, 2, 10), new MeshStandardMaterial({ color: 0xffae3b, emissive: 0xff7a1a, emissiveIntensity: 1.0 }));
    torch.position.y = 25;
    col.add(torch);
    col.position.set(20, 0, -132);
    parent.add(col);
  }

  // --- Johannesburg ------------------------------------------------------

  private buildJohannesburg(parent: Object3D): void {
    // Hillbrow-tower-inspired telecom tower: tall shaft, observation bulge, mast.
    const tower = new Group();
    const conc = new MeshStandardMaterial({ color: 0xcdd2d8, roughness: 0.85 });
    const shaft = new Mesh(new CylinderGeometry(2.2, 3.4, 70, 16), conc);
    shaft.position.y = 35;
    shaft.castShadow = true;
    tower.add(shaft);
    const bulge = new Mesh(new CylinderGeometry(5, 5, 6, 16), conc);
    bulge.position.y = 62;
    tower.add(bulge);
    const ring = new Mesh(new TorusGeometry(5, 0.5, 8, 20), new MeshStandardMaterial({ color: 0x6f8294, roughness: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 60;
    tower.add(ring);
    const mast = new Mesh(new CylinderGeometry(0.1, 0.4, 24, 6), new MeshStandardMaterial({ color: 0xd23b2f }));
    mast.position.y = 82;
    tower.add(mast);
    tower.position.set(-24, 0, -150);
    parent.add(tower);

    // A pair of stepped modern towers flanking it.
    for (const [tx, th] of [[20, 64], [30, 52]] as const) {
      parent.add(this.steppedTower(tx, -148, th));
    }
  }

  private steppedTower(x: number, z: number, h: number): Group {
    const g = new Group();
    const glass = new MeshStandardMaterial({ color: 0x8fa3b8, roughness: 0.2, metalness: 0.8 });
    let y = 0;
    let w = 9;
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const sh = h / steps;
      const box = new Mesh(new BoxGeometry(w, sh, w), glass);
      box.position.set(0, y + sh / 2, 0);
      box.castShadow = true;
      g.add(box);
      y += sh;
      w *= 0.78;
    }
    g.position.set(x, 0, z);
    return g;
  }
}

/** Build a 5-pointed star Shape for extrusion. */
function starShape(outer: number, inner: number): Shape {
  const s = new Shape();
  const points = 5;
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
