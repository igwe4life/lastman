import {
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
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
 * Leafy street/park trees (separate from Lagos palms). Instanced trunk +
 * foliage clusters that sway with wind. Kept off the street corridor.
 */
export class Trees {
  readonly group = new Group();
  private readonly uniforms = { uTime: { value: 0 } };

  constructor(parent: Object3D, terrain: Terrain, count: number) {
    if (count <= 0) {
      parent.add(this.group);
      return;
    }
    const trunkGeo = new CylinderGeometry(0.18, 0.32, 2.4, 6);
    trunkGeo.translate(0, 1.2, 0);
    const trunkMat = new MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const leafGeo = new IcosahedronGeometry(1.5, 1);
    const leafMat = new MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.9, flatShading: true });
    this.injectWind(leafMat);

    const trunks = new InstancedMesh(trunkGeo, trunkMat, count);
    const leaves = new InstancedMesh(leafGeo, leafMat, count * 2);
    trunks.castShadow = leaves.castShadow = trunks.receiveShadow = true;

    const rng = makeRng(98765);
    const m = new Matrix4();
    const q = new Quaternion();
    const pos = new Vector3();
    const scl = new Vector3();
    const up = new Vector3(0, 1, 0);

    let leafIdx = 0;
    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * randRange(rng, 9, 55);
      const z = randRange(rng, -100, 18);
      const y = terrain.heightAt(x, z);
      const s = randRange(rng, 0.8, 1.6);
      pos.set(x, y, z);
      q.setFromAxisAngle(up, rng() * Math.PI);
      scl.set(s, s, s);
      m.compose(pos, q, scl);
      trunks.setMatrixAt(i, m);
      for (let k = 0; k < 2; k++) {
        const lp = pos.clone();
        lp.y += 2.4 * s + k * 0.7 * s;
        const ls = s * randRange(rng, 0.7, 1.1);
        m.compose(lp, q, scl.set(ls, ls, ls));
        leaves.setMatrixAt(leafIdx++, m);
      }
    }
    trunks.instanceMatrix.needsUpdate = true;
    leaves.instanceMatrix.needsUpdate = true;
    leaves.count = leafIdx;
    this.group.add(trunks, leaves);
    parent.add(this.group);
  }

  private injectWind(mat: MeshStandardMaterial): void {
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.vertexShader =
        'uniform float uTime;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           float sway = sin(uTime * 0.9 + instanceMatrix[3][0] * 0.2 + instanceMatrix[3][2] * 0.2);
           transformed.x += sway * 0.12;`,
        );
    };
  }

  update(elapsed: number): void {
    this.uniforms.uTime.value = elapsed;
  }
}
