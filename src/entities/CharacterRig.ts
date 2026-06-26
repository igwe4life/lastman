import {
  BoxGeometry,
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { damp } from '../utils/math';

export type AnimState = 'idle' | 'walk' | 'run' | 'jump' | 'climb' | 'interact';

/**
 * A fully procedural humanoid rig.
 *
 * This is the POC's stand-in for a GLTF/Mixamo character: the body is built
 * from jointed primitives and every animation (idle, walk, run, jump, climb,
 * interact) is authored procedurally by driving joint rotations. Because the
 * skeleton hierarchy mirrors a real humanoid, swapping in a skinned GLTF later
 * is a localized change in Player.ts — gameplay never references this class's
 * internals.
 *
 * Joint convention: each limb is an Object3D pivot placed at the joint, with
 * the visible segment offset so it "hangs" from the pivot. Rotating the pivot
 * about X swings the limb forward/back.
 */
export class CharacterRig {
  readonly root = new Group();

  private hips: Object3D;
  private torso: Object3D;
  private head: Object3D;
  private armL: Object3D;
  private armR: Object3D;
  private foreArmL: Object3D;
  private foreArmR: Object3D;
  private legL: Object3D;
  private legR: Object3D;
  private shinL: Object3D;
  private shinR: Object3D;

  private state: AnimState = 'idle';
  private phase = 0;
  private speed01 = 0; // 0..1 locomotion blend
  private actionTime = 0; // for one-shot actions (jump/interact)

  constructor() {
    const skin = new MeshStandardMaterial({ color: 0xc89a73, roughness: 0.8 });
    const shirt = new MeshStandardMaterial({ color: 0x3a6ea5, roughness: 0.7 });
    const pants = new MeshStandardMaterial({ color: 0x2c3138, roughness: 0.85 });
    const hair = new MeshStandardMaterial({ color: 0x3a2a1d, roughness: 0.9 });

    // Hips at standing height.
    this.hips = new Object3D();
    this.hips.position.y = 0.95;
    this.root.add(this.hips);

    // Pelvis block.
    this.hips.add(segment(0.18, 0.18, pants, 0));

    // Torso pivots at the waist and rises. Slight taper (wider chest).
    this.torso = new Object3D();
    this.torso.position.y = 0.12;
    this.hips.add(this.torso);
    const chest = segment(0.2, 0.34, shirt, 0.34);
    chest.scale.set(1.18, 1, 0.8);
    this.torso.add(chest);
    const belly = segment(0.18, 0.12, shirt, 0.1);
    belly.scale.set(1, 1, 0.82);
    this.torso.add(belly);

    // Neck.
    const neck = new Mesh(new CapsuleGeometry(0.06, 0.08, 4, 8), skin);
    neck.position.y = 0.55;
    this.torso.add(neck);

    // Head (smaller, more human proportion).
    this.head = new Object3D();
    this.head.position.y = 0.66;
    this.torso.add(this.head);
    const headMesh = new Mesh(new SphereGeometry(0.135, 20, 16), skin);
    headMesh.scale.set(0.92, 1.06, 0.96);
    headMesh.castShadow = true;
    this.head.add(headMesh);
    const hairMesh = new Mesh(new SphereGeometry(0.142, 20, 16), hair);
    hairMesh.scale.set(1, 0.85, 1);
    hairMesh.position.y = 0.035;
    this.head.add(hairMesh);
    // Simple nose to give the face a front.
    const nose = new Mesh(new SphereGeometry(0.028, 8, 8), skin);
    nose.position.set(0, -0.01, 0.135);
    this.head.add(nose);

    const shoe = new MeshStandardMaterial({ color: 0x2a2622, roughness: 0.7 });

    // Arms (shoulder pivots near the top of the chest).
    this.armL = this.makeJoint(-0.28, 0.48, this.torso);
    this.armR = this.makeJoint(0.28, 0.48, this.torso);
    this.armL.add(limbMesh(0.062, 0.3, shirt));
    this.armR.add(limbMesh(0.062, 0.3, shirt));
    this.foreArmL = this.makeJoint(0, -0.32, this.armL);
    this.foreArmR = this.makeJoint(0, -0.32, this.armR);
    this.foreArmL.add(limbMesh(0.052, 0.28, skin));
    this.foreArmR.add(limbMesh(0.052, 0.28, skin));
    // Hands.
    for (const fa of [this.foreArmL, this.foreArmR]) {
      const hand = new Mesh(new SphereGeometry(0.06, 10, 8), skin);
      hand.scale.set(1, 1.2, 0.7);
      hand.position.y = -0.3;
      hand.castShadow = true;
      fa.add(hand);
    }

    // Legs (hip pivots).
    this.legL = this.makeJoint(-0.11, 0, this.hips);
    this.legR = this.makeJoint(0.11, 0, this.hips);
    this.legL.add(limbMesh(0.085, 0.42, pants));
    this.legR.add(limbMesh(0.085, 0.42, pants));
    this.shinL = this.makeJoint(0, -0.44, this.legL);
    this.shinR = this.makeJoint(0, -0.44, this.legR);
    this.shinL.add(limbMesh(0.075, 0.42, pants));
    this.shinR.add(limbMesh(0.075, 0.42, pants));
    // Feet (point forward, +Z).
    for (const shin of [this.shinL, this.shinR]) {
      const foot = new Mesh(new BoxGeometry(0.11, 0.08, 0.26), shoe);
      foot.position.set(0, -0.46, 0.07);
      foot.castShadow = true;
      shin.add(foot);
    }

    this.root.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }

  private makeJoint(x: number, y: number, parent: Object3D): Object3D {
    const j = new Object3D();
    j.position.set(x, y, 0);
    parent.add(j);
    return j;
  }

  setState(state: AnimState, speed01 = 0): void {
    if (state !== this.state) {
      if (state === 'jump' || state === 'interact') this.actionTime = 0;
      this.state = state;
    }
    this.speed01 = speed01;
  }

  get current(): AnimState {
    return this.state;
  }

  update(dt: number): void {
    this.actionTime += dt;
    // Advance locomotion phase proportional to speed.
    const stride = this.state === 'run' ? 11 : 7;
    this.phase += dt * stride * (0.4 + this.speed01);

    switch (this.state) {
      case 'walk':
      case 'run':
        this.animLocomotion(dt);
        break;
      case 'jump':
        this.animJump(dt);
        break;
      case 'climb':
        this.animClimb(dt);
        break;
      case 'interact':
        this.animInteract(dt);
        break;
      default:
        this.animIdle(dt);
    }
  }

  // --- Animation clips (procedural) -------------------------------------

  private animIdle(dt: number): void {
    const breathe = Math.sin(this.phase * 0.25) * 0.04;
    this.lerpRot(this.torso, breathe * 0.5, 0, 0, dt);
    this.lerpRot(this.head, Math.sin(this.phase * 0.2) * 0.05, Math.sin(this.phase * 0.13) * 0.1, 0, dt);
    // Arms rest naturally: slightly out from the body with a relaxed elbow bend.
    const armBreathe = Math.sin(this.phase * 0.25) * 0.03;
    this.lerpRot(this.armL, 0.06 + armBreathe, 0, 0.13, dt);
    this.lerpRot(this.armR, 0.06 + armBreathe, 0, -0.13, dt);
    this.lerpRot(this.foreArmL, 0.22, 0, 0.1, dt);
    this.lerpRot(this.foreArmR, 0.22, 0, -0.1, dt);
    this.lerpRot(this.legL, 0, 0, 0, dt);
    this.lerpRot(this.legR, 0, 0, 0, dt);
    this.lerpRot(this.shinL, 0.02, 0, 0, dt);
    this.lerpRot(this.shinR, 0.02, 0, 0, dt);
    this.hips.position.y = damp(this.hips.position.y, 0.95 + breathe * 0.2, 8, dt);
  }

  private animLocomotion(dt: number): void {
    const swing = this.state === 'run' ? 0.95 : 0.6;
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const lean = this.state === 'run' ? 0.22 : 0.08;

    this.lerpRot(this.torso, lean, 0, 0, dt, 18);
    this.lerpRot(this.head, -lean * 0.5, 0, 0, dt, 18);

    // Arms swing opposite to legs.
    this.lerpRot(this.armL, -s * swing, 0, 0.06, dt, 18);
    this.lerpRot(this.armR, s * swing, 0, -0.06, dt, 18);
    this.lerpRot(this.foreArmL, 0.4 + Math.max(0, -s) * 0.4, 0, 0, dt, 18);
    this.lerpRot(this.foreArmR, 0.4 + Math.max(0, s) * 0.4, 0, 0, dt, 18);

    // Legs.
    this.lerpRot(this.legL, s * swing, 0, 0, dt, 18);
    this.lerpRot(this.legR, -s * swing, 0, 0, dt, 18);
    this.lerpRot(this.shinL, Math.max(0, -s) * 1.1 + 0.05, 0, 0, dt, 18);
    this.lerpRot(this.shinR, Math.max(0, s) * 1.1 + 0.05, 0, 0, dt, 18);

    // Bob the hips with the stride.
    this.hips.position.y = damp(this.hips.position.y, 0.95 - Math.abs(c) * 0.06, 16, dt);
  }

  private animJump(dt: number): void {
    const t = Math.min(this.actionTime * 2.5, 1);
    this.lerpRot(this.torso, 0.15, 0, 0, dt, 22);
    this.lerpRot(this.armL, -2.2 * t, 0, 0.2, dt, 22);
    this.lerpRot(this.armR, -2.2 * t, 0, -0.2, dt, 22);
    this.lerpRot(this.foreArmL, 0.5, 0, 0, dt, 22);
    this.lerpRot(this.foreArmR, 0.5, 0, 0, dt, 22);
    this.lerpRot(this.legL, 0.5 * t, 0, 0, dt, 22);
    this.lerpRot(this.legR, 0.6 * t, 0, 0, dt, 22);
    this.lerpRot(this.shinL, 0.9 * t, 0, 0, dt, 22);
    this.lerpRot(this.shinR, 1.1 * t, 0, 0, dt, 22);
  }

  private animClimb(dt: number): void {
    const s = Math.sin(this.actionTime * 4);
    this.lerpRot(this.torso, 0.1, 0, 0, dt, 14);
    this.lerpRot(this.armL, -2.6 + s * 0.4, 0, 0.1, dt, 14);
    this.lerpRot(this.armR, -2.6 - s * 0.4, 0, -0.1, dt, 14);
    this.lerpRot(this.foreArmL, 0.5, 0, 0, dt, 14);
    this.lerpRot(this.foreArmR, 0.5, 0, 0, dt, 14);
    this.lerpRot(this.legL, 0.6 - s * 0.5, 0, 0, dt, 14);
    this.lerpRot(this.legR, 0.6 + s * 0.5, 0, 0, dt, 14);
    this.lerpRot(this.shinL, 0.8, 0, 0, dt, 14);
    this.lerpRot(this.shinR, 0.8, 0, 0, dt, 14);
  }

  private animInteract(dt: number): void {
    // Reach forward with the right arm, as if placing/offering something.
    const reach = Math.sin(Math.min(this.actionTime * 3, Math.PI));
    this.lerpRot(this.torso, 0.08, 0, 0, dt, 14);
    this.lerpRot(this.armR, -1.4 * reach, 0, -0.1, dt, 12);
    this.lerpRot(this.foreArmR, 0.3 + reach * 0.3, 0, 0, dt, 12);
    this.lerpRot(this.armL, 0.1, 0, 0.1, dt, 12);
    this.lerpRot(this.foreArmL, 0.2, 0, 0, dt, 12);
    this.lerpRot(this.legL, 0, 0, 0, dt, 12);
    this.lerpRot(this.legR, 0, 0, 0, dt, 12);
    this.lerpRot(this.shinL, 0.05, 0, 0, dt, 12);
    this.lerpRot(this.shinR, 0.05, 0, 0, dt, 12);
  }

  private lerpRot(o: Object3D, x: number, y: number, z: number, dt: number, lambda = 12): void {
    o.rotation.x = damp(o.rotation.x, x, lambda, dt);
    o.rotation.y = damp(o.rotation.y, y, lambda, dt);
    o.rotation.z = damp(o.rotation.z, z, lambda, dt);
  }
}

// --- Geometry helpers ---------------------------------------------------

function segment(radius: number, height: number, mat: MeshStandardMaterial, y: number): Mesh {
  const m = new Mesh(new CapsuleGeometry(radius, height, 6, 12), mat);
  m.position.y = y;
  return m;
}

/** A limb segment that hangs DOWN from its pivot (origin at the top). */
function limbMesh(radius: number, length: number, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(new CapsuleGeometry(radius, length, 6, 10), mat);
  m.position.y = -length / 2;
  return m;
}
