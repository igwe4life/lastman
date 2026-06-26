import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';
import { makeRng, randRange } from '../utils/math';

/**
 * A flock of simple birds circling overhead. Each bird is a two-triangle "V"
 * whose wings flap by animating vertex Y. They drift in a slow circular path so
 * the sky always has motion.
 */
interface Bird {
  mesh: Mesh;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  flapOffset: number;
}

export class Birds {
  readonly group = new Group();
  private birds: Bird[] = [];

  constructor(parent: Object3D, count = 24) {
    const rng = makeRng(2024);
    const mat = new MeshStandardMaterial({ color: 0x22262b, side: DoubleSide, flatShading: true });

    for (let i = 0; i < count; i++) {
      const geo = this.makeBirdGeometry();
      const mesh = new Mesh(geo, mat);
      const bird: Bird = {
        mesh,
        angle: rng() * Math.PI * 2,
        radius: randRange(rng, 30, 120),
        height: randRange(rng, 40, 85),
        speed: randRange(rng, 0.05, 0.15),
        flapOffset: rng() * Math.PI * 2,
      };
      this.birds.push(bird);
      this.group.add(mesh);
    }
    parent.add(this.group);
  }

  private makeBirdGeometry(): BufferGeometry {
    const geo = new BufferGeometry();
    // Two triangles forming wings meeting at the body centre.
    const verts = new Float32Array([
      0, 0, 0, -1.2, 0, -0.4, 0, 0, -0.7,
      0, 0, 0, 1.2, 0, -0.4, 0, 0, -0.7,
    ]);
    geo.setAttribute('position', new BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    return geo;
  }

  update(dt: number, elapsed: number, centerZ: number): void {
    for (const b of this.birds) {
      b.angle += b.speed * dt;
      const x = Math.cos(b.angle) * b.radius;
      const z = Math.sin(b.angle) * b.radius + centerZ;
      b.mesh.position.set(x, b.height, z);
      b.mesh.rotation.y = -b.angle + Math.PI / 2;
      // Flap: move wing tips up/down.
      const pos = b.mesh.geometry.attributes.position as BufferAttribute;
      const flap = Math.sin(elapsed * 8 + b.flapOffset) * 0.5;
      pos.setY(1, flap);
      pos.setY(4, flap);
      pos.needsUpdate = true;
    }
  }
}
