import {
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Scene,
  SphereGeometry,
  Vector3,
} from 'three';
import { makeRng } from '../utils/math';

/**
 * A lightweight standing villager / the Last Man Standing. Simpler than the
 * player rig (no full locomotion) but breathes and can turn to face a target,
 * which is enough for the village and final-greeting beats.
 */
export class NPC {
  readonly group = new Group();
  private torso: Object3D;
  private phase: number;

  constructor(scene: Scene, position: Vector3, robeColor = 0x9c6b3f, seed = 1) {
    const rng = makeRng(seed);
    this.phase = rng() * Math.PI * 2;

    const skin = new MeshStandardMaterial({ color: 0xb98a64, roughness: 0.8 });
    const robe = new MeshStandardMaterial({
      color: new Color(robeColor),
      roughness: 0.85,
    });

    this.torso = new Object3D();
    this.torso.position.y = 0.9;
    this.group.add(this.torso);

    const body = new Mesh(new CapsuleGeometry(0.26, 0.7, 6, 12), robe);
    body.position.y = 0.1;
    body.castShadow = true;
    this.torso.add(body);

    const head = new Mesh(new SphereGeometry(0.16, 16, 14), skin);
    head.position.y = 0.72;
    head.castShadow = true;
    this.torso.add(head);

    this.group.position.copy(position);
    this.group.position.y = position.y;
    scene.add(this.group);
  }

  faceToward(target: Vector3): void {
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    this.group.rotation.y = Math.atan2(dx, dz);
  }

  update(_dt: number, elapsed: number): void {
    this.torso.rotation.z = Math.sin(elapsed * 1.5 + this.phase) * 0.03;
    this.torso.position.y = 0.9 + Math.sin(elapsed * 2 + this.phase) * 0.01;
  }

  get position(): Vector3 {
    return this.group.position;
  }
}
