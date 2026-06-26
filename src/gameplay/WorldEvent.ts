import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  PointLight,
  Scene,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import type { WorldEventKind } from '../config/cities';
import { damp, smoothstep } from '../utils/math';

/**
 * The dynamic obstacle that blocks the far end of the district until the
 * player has completed the mission objectives. When triggered it plays a short
 * cinematic: the camera sweeps to the obstacle, a particle burst fires, a sound
 * cue plays, and the obstacle animates away — a road clears, a gate opens, or a
 * damaged crossing is restored — revealing the glowing way onward.
 */
export class WorldEvent {
  private group = new Group();
  private barrier!: Group;
  private portal!: Mesh;
  private portalLight!: PointLight;
  private particles!: Points;
  private particleVel: Float32Array;
  private readonly barrierZ = -90;

  private triggered = false;
  private done = false;
  private t = 0;
  private label: string;

  onComplete?: () => void;

  constructor(private scene: Scene, private kind: WorldEventKind) {
    this.label =
      kind === 'road' ? 'The road is cleared!' : kind === 'gate' ? 'The community gate opens!' : 'The crossing is restored!';
    this.buildBarrier();
    this.buildPortal();
    this.particleVel = this.buildParticles();
    scene.add(this.group);
  }

  dispose(): void {
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as { dispose?: () => void } | undefined;
      mat?.dispose?.();
    });
  }

  get bannerText(): string {
    return this.label;
  }

  get portalPosition(): Vector3 {
    return new Vector3(0, 0, -98);
  }

  get isOpen(): boolean {
    return this.done;
  }

  get cinematicActive(): boolean {
    return this.triggered && this.t < 3.2;
  }

  /** True while the obstacle still blocks the path. */
  blocks(next: Vector3): boolean {
    return !this.done && next.z < this.barrierZ;
  }

  private buildBarrier(): void {
    this.barrier = new Group();
    if (this.kind === 'gate') {
      const wallMat = new MeshStandardMaterial({ color: 0x8a7b5c, roughness: 1 });
      const woodMat = new MeshStandardMaterial({ color: 0x5e3f25, roughness: 0.9 });
      for (const side of [-1, 1]) {
        const wall = new Mesh(new BoxGeometry(7, 5, 1), wallMat);
        wall.position.set(side * 5.5, 2.5, this.barrierZ);
        wall.castShadow = wall.receiveShadow = true;
        this.barrier.add(wall);
      }
      for (const hingeX of [-2, 2]) {
        const g = new Group();
        g.position.set(hingeX, 0, this.barrierZ);
        const door = new Mesh(new BoxGeometry(2, 4.4, 0.3), woodMat);
        door.position.set(-Math.sign(hingeX) * 1, 2.2, 0);
        door.castShadow = true;
        g.add(door);
        g.userData.hinge = hingeX;
        this.barrier.add(g);
      }
    } else if (this.kind === 'crossing') {
      // A damaged crossing: support posts intact, planks dropped/tilted.
      const postMat = new MeshStandardMaterial({ color: 0x6e4a28, roughness: 0.95 });
      const plankMat = new MeshStandardMaterial({ color: 0x7a5230, roughness: 0.9 });
      for (const sx of [-2.6, 2.6]) {
        const post = new Mesh(new BoxGeometry(0.3, 2.4, 0.3), postMat);
        post.position.set(sx, 1.0, this.barrierZ);
        post.castShadow = true;
        this.barrier.add(post);
      }
      for (let i = 0; i < 5; i++) {
        const plank = new Mesh(new BoxGeometry(5, 0.22, 1.1), plankMat);
        plank.position.set(0, 0.1 - (2 + i * 0.5), this.barrierZ + 2 - i);
        plank.rotation.x = (i % 2 ? 1 : -1) * 1.0;
        plank.userData.broken = { drop: 2 + i * 0.5, angle: (i % 2 ? 1 : -1) * 1.0, z: this.barrierZ + 2 - i };
        plank.castShadow = true;
        this.barrier.add(plank);
      }
    } else {
      // 'road' — barricades + a pile of crates/rubble blocking the street.
      const barMat = new MeshStandardMaterial({ color: 0xd23b2f, roughness: 0.7 });
      const stripeMat = new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
      for (const sx of [-3, 3]) {
        const bar = new Mesh(new BoxGeometry(5, 0.3, 0.4), barMat);
        bar.position.set(sx, 1.1, this.barrierZ);
        this.barrier.add(bar);
        const legA = new Mesh(new BoxGeometry(0.2, 1.1, 0.2), stripeMat);
        legA.position.set(sx - 2, 0.55, this.barrierZ);
        this.barrier.add(legA);
        const legB = legA.clone();
        legB.position.x = sx + 2;
        this.barrier.add(legB);
      }
      const crateMat = new MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.95 });
      for (let i = 0; i < 7; i++) {
        const c = new Mesh(new BoxGeometry(1.1, 1.1, 1.1), crateMat);
        c.position.set(-2.5 + (i % 4) * 1.6, 0.55 + (i > 3 ? 1.1 : 0), this.barrierZ + (i % 2 ? 0.3 : -0.3));
        c.rotation.y = i * 0.4;
        c.castShadow = true;
        c.userData.crate = true;
        this.barrier.add(c);
      }
    }
    this.group.add(this.barrier);
  }

  private buildPortal(): void {
    this.portal = new Mesh(
      new CylinderGeometry(1.6, 1.6, 0.2, 24),
      new MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.0, fog: false }),
    );
    this.portal.rotation.x = -Math.PI / 2;
    this.portal.position.set(0, 0.12, -98);
    this.group.add(this.portal);

    this.portalLight = new PointLight(0xffe9b0, 0, 18, 2);
    this.portalLight.position.set(0, 4, -98);
    this.group.add(this.portalLight);
  }

  private buildParticles(): Float32Array {
    const count = 240;
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 1.5;
      pos[i * 3 + 2] = this.barrierZ;
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 6;
      vel[i * 3] = Math.cos(a) * sp;
      vel[i * 3 + 1] = 2 + Math.random() * 7;
      vel[i * 3 + 2] = Math.sin(a) * sp;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const mat = new PointsMaterial({
      color: 0xffe6a8,
      size: 0.25,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.particles = new Points(geo, mat);
    this.group.add(this.particles);
    return vel;
  }

  trigger(): void {
    if (this.triggered) return;
    this.triggered = true;
    this.t = 0;
    (this.particles.material as PointsMaterial).opacity = 1;
  }

  update(dt: number, camera: PerspectiveCamera, playerPos: Vector3): void {
    // Idle portal shimmer once open.
    if (this.done) {
      this.portal.rotation.z += dt * 0.6;
      this.portalLight.intensity = 6 + Math.sin(performance.now() * 0.004) * 1.5;
    }
    if (!this.triggered) return;
    this.t += dt;
    const k = smoothstep(0, 2.6, this.t);

    // Animate the obstacle away.
    if (this.kind === 'gate') {
      this.barrier.children.forEach((c) => {
        const hinge = c.userData.hinge as number | undefined;
        if (hinge !== undefined) c.rotation.y = (hinge < 0 ? 1 : -1) * k * Math.PI * 0.62;
      });
    } else if (this.kind === 'crossing') {
      this.barrier.children.forEach((c) => {
        const b = c.userData.broken as { drop: number; angle: number; z: number } | undefined;
        if (b) {
          (c as Mesh).position.y = 0.1 - b.drop * (1 - k);
          (c as Mesh).rotation.x = b.angle * (1 - k);
        }
      });
    } else {
      // Road: crates sink/scatter and barricades fade.
      this.barrier.children.forEach((c, i) => {
        if (c.userData.crate) {
          c.position.y = Math.max(-2, (c.position.y) - dt * 2.2);
          c.position.x += Math.sin(i) * dt * 1.5;
        }
        c.rotation.z += dt * (i % 2 ? 1 : -1);
      });
      this.barrier.scale.y = Math.max(0.001, 1 - k);
    }

    // Reveal the portal.
    (this.portal.material as MeshBasicMaterial).opacity = k * 0.6;
    this.portalLight.intensity = k * 6;

    // Particle burst.
    const pos = this.particles.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += this.particleVel[i] * dt;
      arr[i + 1] += this.particleVel[i + 1] * dt;
      arr[i + 2] += this.particleVel[i + 2] * dt;
      this.particleVel[i + 1] -= 9 * dt; // gravity
    }
    pos.needsUpdate = true;
    (this.particles.material as PointsMaterial).opacity = Math.max(0, 1 - this.t / 2.2);

    // Cinematic camera: sweep to frame the obstacle, then hand back.
    if (this.t < 3.2) {
      const focus = new Vector3(0, 1.6, this.barrierZ + 2);
      const camPos = new Vector3(6, 4, this.barrierZ + 12);
      camera.position.x = damp(camera.position.x, camPos.x, 3, dt);
      camera.position.y = damp(camera.position.y, camPos.y, 3, dt);
      camera.position.z = damp(camera.position.z, camPos.z, 3, dt);
      camera.lookAt(focus);
    }

    if (this.t >= 2.6 && !this.done) {
      this.done = true;
      this.onComplete?.();
    }
    void playerPos;
  }
}
