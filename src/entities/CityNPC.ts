import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Sprite,
  SpriteMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { GameConfig } from '../config/gameConfig';
import { ResourceIcons, type GospelResource } from '../config/gameConfig';
import { damp } from '../utils/math';

export type NpcState = 'idle' | 'walk' | 'sit' | 'talk' | 'helped';

const REQUEST_LINES: Record<GospelResource, string> = {
  bibles: 'I would like a Bible.',
  magazines: "I'd appreciate a magazine.",
  books: "I'm interested in learning more.",
  prayerPoints: 'Please pray with me.',
};

const THANKS_LINES: Record<GospelResource, string> = {
  bibles: 'Thank you — I will treasure this.',
  magazines: 'Thank you, I’ll read every page.',
  books: 'This means so much. Thank you.',
  prayerPoints: 'Thank you for praying with me.',
};

/**
 * A city dweller. Lightweight jointed body with a procedural walk + sit + idle,
 * a floating "need" icon billboard above the head showing the Gospel resource
 * they're hoping for, and a warm reaction when helped. Movement is driven by a
 * target the NPCManager assigns (routines: wander, visit, sit, talk).
 */
export class CityNPC {
  readonly group = new Group();
  state: NpcState = 'idle';
  need: GospelResource | null = null;
  fulfilled = false;

  private hips: Object3D;
  private torso: Object3D;
  private legL: Object3D;
  private legR: Object3D;
  private armL: Object3D;
  private armR: Object3D;
  private head: Object3D;

  private target: Vector3 | null = null;
  private speed = 1.3;
  private phase = Math.random() * Math.PI * 2;
  private facing = Math.random() * Math.PI * 2;
  private reactTime = 0;

  private icon: Sprite | null = null;
  private iconCanvas?: HTMLCanvasElement;
  private iconBob = Math.random() * Math.PI * 2;

  onArrived?: (npc: CityNPC) => void;

  constructor(position: Vector3, seed = 1) {
    const rng = mulberry(seed);
    const skinTones = [0x8d5a3a, 0xa56b43, 0x6f4327, 0xc89a73, 0x9c6b45];
    const clothTones = [0x3a6ea5, 0xb24a4a, 0x2f8f5a, 0xc9a227, 0x7d4ed8, 0xd86b2e, 0x444c57];
    const skin = new MeshStandardMaterial({ color: skinTones[(rng() * skinTones.length) | 0], roughness: 0.8 });
    const cloth = new MeshStandardMaterial({ color: clothTones[(rng() * clothTones.length) | 0], roughness: 0.85 });
    const pants = new MeshStandardMaterial({ color: new Color(0x2c3138).offsetHSL(0, 0, (rng() - 0.5) * 0.1).getHex(), roughness: 0.85 });

    this.hips = new Object3D();
    this.hips.position.y = 0.85;
    this.group.add(this.hips);

    this.torso = new Object3D();
    this.hips.add(this.torso);
    const chest = new Mesh(new CapsuleGeometry(0.18, 0.42, 5, 10), cloth);
    chest.position.y = 0.32;
    chest.castShadow = true;
    this.torso.add(chest);

    this.head = new Object3D();
    this.head.position.y = 0.72;
    this.torso.add(this.head);
    const headMesh = new Mesh(new SphereGeometry(0.13, 16, 14), skin);
    headMesh.scale.set(0.95, 1.05, 0.95);
    headMesh.castShadow = true;
    this.head.add(headMesh);

    this.armL = this.joint(-0.24, 0.46, this.torso);
    this.armR = this.joint(0.24, 0.46, this.torso);
    this.armL.add(limb(0.055, 0.5, cloth));
    this.armR.add(limb(0.055, 0.5, cloth));

    this.legL = this.joint(-0.1, 0, this.hips);
    this.legR = this.joint(0.1, 0, this.hips);
    this.legL.add(limb(0.075, 0.78, pants));
    this.legR.add(limb(0.075, 0.78, pants));

    this.group.position.copy(position);
    this.group.rotation.y = this.facing;
    this.speed = 1.0 + rng() * 0.8;
  }

  private joint(x: number, y: number, parent: Object3D): Object3D {
    const j = new Object3D();
    j.position.set(x, y, 0);
    parent.add(j);
    return j;
  }

  // --- Need icon ---------------------------------------------------------

  setNeed(need: GospelResource | null): void {
    this.need = need;
    if (this.icon) {
      this.group.remove(this.icon);
      this.icon.material.map?.dispose();
      this.icon.material.dispose();
      this.icon = null;
    }
    if (need) this.icon = this.makeIcon(ResourceIcons[need], '#ffffff');
  }

  private makeIcon(emoji: string, bg: string): Sprite {
    const c = this.iconCanvas ?? document.createElement('canvas');
    this.iconCanvas = c;
    c.width = c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 128, 128);
    // Speech-bubble background.
    ctx.fillStyle = 'rgba(15,20,32,0.82)';
    roundRect(ctx, 14, 10, 100, 86, 22);
    ctx.fill();
    ctx.strokeStyle = bg;
    ctx.lineWidth = 4;
    roundRect(ctx, 14, 10, 100, 86, 22);
    ctx.stroke();
    // Little tail.
    ctx.fillStyle = 'rgba(15,20,32,0.82)';
    ctx.beginPath();
    ctx.moveTo(54, 92);
    ctx.lineTo(74, 92);
    ctx.lineTo(64, 110);
    ctx.closePath();
    ctx.fill();
    // Icon.
    ctx.font = '54px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 50);

    const tex = new CanvasTexture(c);
    const mat = new SpriteMaterial({ map: tex, transparent: true, depthTest: true });
    const sprite = new Sprite(mat);
    sprite.scale.set(1.0, 1.0, 1.0);
    sprite.position.y = GameConfig.npc.iconHeight;
    this.group.add(sprite);
    return sprite;
  }

  get requestLine(): string {
    return this.need ? REQUEST_LINES[this.need] : '';
  }

  get thanksLine(): string {
    return this.need ? THANKS_LINES[this.need] : 'Thank you.';
  }

  // --- Behaviour ---------------------------------------------------------

  walkTo(target: Vector3): void {
    this.target = target.clone();
    this.state = 'walk';
  }

  sitDown(): void {
    this.state = 'sit';
    this.target = null;
  }

  startTalk(facing: number): void {
    this.state = 'talk';
    this.target = null;
    this.facing = facing;
  }

  /** Player helped this NPC — play a warm reaction and retire the need. */
  help(): void {
    this.fulfilled = true;
    this.need = null;
    this.state = 'helped';
    this.reactTime = 0;
    // Swap the icon to a grateful heart that fades.
    if (this.icon) {
      this.group.remove(this.icon);
      this.icon.material.dispose();
    }
    this.icon = this.makeIcon('💛', '#ffd27a');
  }

  faceToward(p: Vector3): void {
    this.facing = Math.atan2(p.x - this.group.position.x, p.z - this.group.position.z);
  }

  get position(): Vector3 {
    return this.group.position;
  }

  distanceTo(p: Vector3): number {
    const dx = this.group.position.x - p.x;
    const dz = this.group.position.z - p.z;
    return Math.hypot(dx, dz);
  }

  update(dt: number, elapsed: number, groundY = 0): void {
    // Movement.
    if (this.state === 'walk' && this.target) {
      const dx = this.target.x - this.group.position.x;
      const dz = this.target.z - this.group.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.4) {
        this.state = 'idle';
        this.target = null;
        this.onArrived?.(this);
      } else {
        const vx = (dx / dist) * this.speed;
        const vz = (dz / dist) * this.speed;
        this.group.position.x += vx * dt;
        this.group.position.z += vz * dt;
        this.facing = Math.atan2(vx, vz);
      }
    }
    this.group.position.y = groundY;
    this.group.rotation.y = damp(this.group.rotation.y, this.facing, 8, dt);

    this.animate(dt, elapsed);

    // Icon bob + helped fade.
    if (this.icon) {
      this.icon.position.y = GameConfig.npc.iconHeight + Math.sin(elapsed * 2 + this.iconBob) * 0.08;
      if (this.state === 'helped') {
        this.reactTime += dt;
        this.icon.position.y += this.reactTime * 0.6;
        this.icon.material.opacity = Math.max(0, 1 - this.reactTime * 0.5);
        if (this.reactTime > 2 && this.icon) {
          this.group.remove(this.icon);
          this.icon = null;
        }
      }
    }
  }

  private animate(dt: number, elapsed: number): void {
    if (this.state === 'walk') {
      this.phase += dt * 8;
      const s = Math.sin(this.phase);
      this.legL.rotation.x = damp(this.legL.rotation.x, s * 0.6, 16, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, -s * 0.6, 16, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, -s * 0.5, 16, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, s * 0.5, 16, dt);
      this.hips.position.y = 0.85 - Math.abs(Math.cos(this.phase)) * 0.04;
      this.torso.rotation.x = 0.05;
    } else if (this.state === 'sit') {
      this.hips.position.y = damp(this.hips.position.y, 0.55, 10, dt);
      this.legL.rotation.x = damp(this.legL.rotation.x, -1.4, 10, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, -1.4, 10, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, -0.3, 10, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -0.3, 10, dt);
      this.torso.rotation.x = damp(this.torso.rotation.x, 0.06, 10, dt);
    } else if (this.state === 'talk') {
      const g = Math.sin(elapsed * 3 + this.phase) * 0.25;
      this.armR.rotation.x = damp(this.armR.rotation.x, -0.4 + g, 10, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, 0.05, 10, dt);
      this.legL.rotation.x = damp(this.legL.rotation.x, 0, 10, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0, 10, dt);
      this.hips.position.y = damp(this.hips.position.y, 0.85, 10, dt);
    } else if (this.state === 'helped') {
      // Hands raised in gratitude.
      this.armL.rotation.x = damp(this.armL.rotation.x, -2.2, 10, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -2.2, 10, dt);
      this.legL.rotation.x = damp(this.legL.rotation.x, 0, 10, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0, 10, dt);
      this.hips.position.y = damp(this.hips.position.y, 0.85, 10, dt);
    } else {
      // Idle: settle to neutral with a gentle breathing sway.
      const b = Math.sin(elapsed * 1.5 + this.phase) * 0.03;
      this.legL.rotation.x = damp(this.legL.rotation.x, 0, 8, dt);
      this.legR.rotation.x = damp(this.legR.rotation.x, 0, 8, dt);
      this.armL.rotation.x = damp(this.armL.rotation.x, b, 8, dt);
      this.armR.rotation.x = damp(this.armR.rotation.x, -b, 8, dt);
      this.hips.position.y = damp(this.hips.position.y, 0.85, 8, dt);
      this.torso.rotation.x = damp(this.torso.rotation.x, 0, 8, dt);
    }
  }
}

// --- helpers ------------------------------------------------------------

function limb(radius: number, length: number, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(new CapsuleGeometry(radius, length, 5, 8), mat);
  m.position.y = -length / 2;
  m.castShadow = true;
  return m;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
