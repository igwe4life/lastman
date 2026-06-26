import {
  AdditiveBlending,
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  type Texture,
} from 'three';
import { makeRng, randRange } from '../utils/math';

/**
 * Soft volumetric-looking clouds made from large camera-facing billboards with
 * a radial-gradient texture. They drift slowly with the wind and wrap around.
 */
export class Clouds {
  readonly group = new Group();
  private readonly meshes: Mesh[] = [];

  constructor(parent: Object3D, count = 22) {
    const tex = this.makeCloudTexture();
    const geo = new PlaneGeometry(1, 1);
    const rng = makeRng(555);

    for (let i = 0; i < count; i++) {
      const mat = new MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: randRange(rng, 0.35, 0.8),
        depthWrite: false,
        blending: AdditiveBlending,
        fog: false,
      });
      const m = new Mesh(geo, mat);
      const s = randRange(rng, 40, 120);
      m.scale.set(s, s * 0.55, 1);
      m.position.set(
        randRange(rng, -300, 300),
        randRange(rng, 90, 170),
        randRange(rng, -300, 100),
      );
      this.meshes.push(m);
      this.group.add(m);
    }
    parent.add(this.group);
  }

  private makeCloudTexture(): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    return new CanvasTexture(c);
  }

  update(dt: number, cameraQuaternion: { x: number; y: number; z: number; w: number }): void {
    for (const m of this.meshes) {
      m.position.x += dt * 1.5;
      if (m.position.x > 320) m.position.x = -320;
      // Billboard toward camera.
      m.quaternion.set(cameraQuaternion.x, cameraQuaternion.y, cameraQuaternion.z, cameraQuaternion.w);
    }
  }
}
