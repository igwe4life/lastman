import {
  CanvasTexture,
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  type Texture,
} from 'three';
import type { CityConfig } from '../config/cities';

/**
 * City ground. The central play area is kept flat (it's a paved district), with
 * gentle hills only far out on the periphery for silhouette. `heightAt` is the
 * single source of truth used both to shape the mesh and to resolve the
 * player's / NPCs' ground height.
 */
export class Terrain {
  readonly mesh: Mesh;
  private readonly flatRadius = 70;

  constructor(parent: Object3D, size: number, city: CityConfig) {
    const segments = 160;
    const geo = new PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.heightAt(pos.getX(i), pos.getZ(i)));
    }
    geo.computeVertexNormals();

    const mat = new MeshStandardMaterial({
      map: this.makeGroundTexture(city.ground),
      roughness: 0.97,
      metalness: 0,
      color: city.ground,
    });

    this.mesh = new Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    parent.add(this.mesh);
  }

  heightAt(x: number, z: number): number {
    const d = Math.hypot(x, z);
    if (d < this.flatRadius) return 0;
    const t = (d - this.flatRadius) / 40;
    const hills =
      Math.sin(x * 0.03) * Math.cos(z * 0.026) * 6 + Math.sin(x * 0.07 + z * 0.05) * 1.5;
    return hills * Math.min(t, 1);
  }

  private makeGroundTexture(base: number): Texture {
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d')!;
    const col = new Color(base);
    ctx.fillStyle = `#${col.getHexString()}`;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5000; i++) {
      const s = 0.6 + Math.random() * 0.5;
      const v = col.clone().multiplyScalar(s);
      ctx.fillStyle = `rgba(${(v.r * 255) | 0}, ${(v.g * 255) | 0}, ${(v.b * 255) | 0}, 0.5)`;
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(50, 50);
    tex.anisotropy = 8;
    return tex;
  }
}
