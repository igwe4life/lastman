import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  PointLight,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

interface Angel {
  group: Group;
  wingL: Mesh;
  wingR: Mesh;
  radius: number;
  angle: number;
  speed: number;
  height: number;
  bob: number;
}

/**
 * A heavenly celebration for the finale: a host of angels circling the sky above
 * the meeting place — some lifting trumpets, some with arms raised in song —
 * with golden light and drifting sparkles. Built hidden and revealed by `start()`
 * during the closing cinematic.
 */
export class Angels {
  private group = new Group();
  private angels: Angel[] = [];
  private sparkles!: Points;
  private sparkleVel: Float32Array;
  private glow: PointLight;
  private active = false;

  constructor(scene: import('three').Scene, center: Vector3, count = 12) {
    this.group.position.copy(center);
    this.group.visible = false;

    for (let i = 0; i < count; i++) {
      const withTrumpet = i % 2 === 0;
      const angel = this.makeAngel(withTrumpet);
      const a: Angel = {
        group: angel,
        wingL: angel.userData.wingL,
        wingR: angel.userData.wingR,
        radius: 6 + (i % 4) * 3.2,
        angle: (i / count) * Math.PI * 2,
        speed: 0.25 + (i % 3) * 0.08,
        height: 7 + (i % 5) * 2.4,
        bob: Math.random() * Math.PI * 2,
      };
      this.group.add(angel);
      this.angels.push(a);
    }

    this.glow = new PointLight(0xffe9b0, 0, 60, 2);
    this.glow.position.y = 12;
    this.group.add(this.glow);

    this.sparkleVel = this.buildSparkles();
    scene.add(this.group);
  }

  private makeAngel(withTrumpet: boolean): Group {
    const g = new Group();
    const robe = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0d0, emissiveIntensity: 0.5, roughness: 0.6 });
    const skin = new MeshStandardMaterial({ color: 0xf0cba0, roughness: 0.7 });
    const gold = new MeshStandardMaterial({ color: 0xffcf5a, emissive: 0xffb020, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.3 });

    const body = new Mesh(new CapsuleGeometry(0.32, 0.7, 6, 12), robe);
    body.position.y = 0.1;
    g.add(body);
    const head = new Mesh(new SphereGeometry(0.2, 16, 14), skin);
    head.position.y = 0.85;
    g.add(head);
    // Halo.
    const halo = new Mesh(new TorusGeometry(0.22, 0.04, 8, 20), gold);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = 1.12;
    g.add(halo);

    // Wings (flattened cones) hinged at the back, flapping.
    const wingGeo = new ConeGeometry(0.28, 1.3, 4);
    const wingMat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 0.45, roughness: 0.5, flatShading: true });
    const wingL = new Mesh(wingGeo, wingMat);
    wingL.scale.set(0.5, 1, 1.4);
    wingL.position.set(-0.3, 0.3, -0.1);
    wingL.rotation.z = 0.9;
    g.add(wingL);
    const wingR = new Mesh(wingGeo, wingMat);
    wingR.scale.set(0.5, 1, 1.4);
    wingR.position.set(0.3, 0.3, -0.1);
    wingR.rotation.z = -0.9;
    g.add(wingR);
    g.userData.wingL = wingL;
    g.userData.wingR = wingR;

    if (withTrumpet) {
      // A raised golden trumpet.
      const trumpet = new Group();
      const tube = new Mesh(new CylinderGeometry(0.04, 0.04, 0.8, 8), gold);
      tube.rotation.z = Math.PI / 2;
      trumpet.add(tube);
      const bell = new Mesh(new ConeGeometry(0.16, 0.3, 10, 1, true), gold);
      bell.rotation.z = -Math.PI / 2;
      bell.position.x = 0.5;
      trumpet.add(bell);
      trumpet.position.set(0.3, 0.75, 0.25);
      trumpet.rotation.z = 0.5;
      g.add(trumpet);
    } else {
      // Arms raised in song.
      const armMat = robe;
      for (const sx of [-1, 1]) {
        const arm = new Mesh(new CapsuleGeometry(0.07, 0.5, 4, 8), armMat);
        arm.position.set(sx * 0.32, 0.55, 0);
        arm.rotation.z = sx * 0.9;
        g.add(arm);
      }
    }
    return g;
  }

  private buildSparkles(): Float32Array {
    const count = 400;
    const geo = new BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 30 + 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
      vel[i] = 0.4 + Math.random() * 1.2;
    }
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    const mat = new PointsMaterial({
      color: 0xffe9a8,
      size: 0.22,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      fog: false,
    });
    this.sparkles = new Points(geo, mat);
    this.group.add(this.sparkles);
    return vel;
  }

  get isActive(): boolean {
    return this.active;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.group.visible = true;
  }

  update(dt: number, elapsed: number): void {
    if (!this.active) return;
    this.glow.intensity = Math.min(this.glow.intensity + dt * 8, 22);
    (this.sparkles.material as PointsMaterial).opacity = Math.min(
      (this.sparkles.material as PointsMaterial).opacity + dt * 0.5,
      0.9,
    );

    for (const a of this.angels) {
      a.angle += a.speed * dt;
      const x = Math.cos(a.angle) * a.radius;
      const z = Math.sin(a.angle) * a.radius;
      const y = a.height + Math.sin(elapsed * 1.5 + a.bob) * 0.8;
      a.group.position.set(x, y, z);
      // Face along the direction of travel.
      a.group.rotation.y = -a.angle + Math.PI / 2;
      // Flap.
      const flap = Math.sin(elapsed * 6 + a.bob) * 0.5;
      a.wingL.rotation.z = 0.9 + flap;
      a.wingR.rotation.z = -0.9 - flap;
    }

    // Drift sparkles downward, wrapping back to the top.
    const pos = this.sparkles.geometry.attributes.position as BufferAttribute;
    const arr = pos.array as Float32Array;
    for (let i = 0; i < this.sparkleVel.length; i++) {
      arr[i * 3 + 1] -= this.sparkleVel[i] * dt;
      if (arr[i * 3 + 1] < 0) arr[i * 3 + 1] = 30;
    }
    pos.needsUpdate = true;
  }
}
