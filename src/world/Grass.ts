import {
  Color,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Vector3,
} from 'three';
import type { Terrain } from './Terrain';
import { makeRng, randRange } from '../utils/math';

/**
 * Instanced grass for the city's green verges and parks. GPU wind via a shared
 * uTime uniform. Concentrated off the paved street so the road stays clean.
 */
export class Grass {
  readonly mesh: InstancedMesh;
  private readonly uniforms = { uTime: { value: 0 } };

  constructor(parent: Object3D, terrain: Terrain, color = 0x6f9434, count = 16000) {
    const blade = new PlaneGeometry(0.09, 0.45, 1, 3);
    blade.translate(0, 0.22, 0);
    const mat = new MeshStandardMaterial({ color: new Color(color), roughness: 1, side: DoubleSide });
    this.injectWind(mat);

    this.mesh = new InstancedMesh(blade, mat, count);
    this.mesh.receiveShadow = true;

    const rng = makeRng(1337);
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    const up = new Vector3(0, 1, 0);

    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 3) {
      guard++;
      const x = randRange(rng, -60, 60);
      const z = randRange(rng, -100, 22);
      if (Math.abs(x) < 9) continue; // keep the street + sidewalks clear
      const y = terrain.heightAt(x, z);
      pos.set(x, y, z);
      q.setFromAxisAngle(up, rng() * Math.PI);
      const s = randRange(rng, 0.6, 1.5);
      scl.set(s, randRange(rng, 0.7, 1.4), s);
      m.compose(pos, q, scl);
      this.mesh.setMatrixAt(placed, m);
      placed++;
    }
    this.mesh.count = placed;
    this.mesh.instanceMatrix.needsUpdate = true;
    parent.add(this.mesh);
  }

  private injectWind(mat: MeshStandardMaterial): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader =
        'uniform float uTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float windStrength = transformed.y * 0.6;
           float w = sin(uTime * 1.6 + instanceMatrix[3][0] * 0.3 + instanceMatrix[3][2] * 0.3);
           transformed.x += w * windStrength * 0.22;`,
        );
    };
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
