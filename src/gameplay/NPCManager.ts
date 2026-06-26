import { Group, Material, Mesh, Object3D, Scene, Vector3 } from 'three';
import { CityNPC } from '../entities/CityNPC';
import type { Environment } from '../world/Environment';
import type { CityConfig } from '../config/cities';
import type { GospelResource } from '../config/gameConfig';
import type { ResourceRequirement } from './Inventory';
import { makeRng, randRange } from '../utils/math';

type BrainKind = 'wander' | 'shop' | 'sit' | 'talk' | 'stand';
interface Brain {
  npc: CityNPC;
  kind: BrainKind;
  timer: number;
  settled: boolean;
}

/**
 * Spawns and runs the living crowd of a city. NPCs follow lightweight daily
 * routines (wander the street, browse shops, sit on benches, chat in pairs,
 * stand outside buildings). A subset carry a "need" (a Gospel resource) shown by
 * the floating icon above their head; the needs are distributed so the level's
 * objectives are always completable, with a small surplus so the player must
 * choose whom to help with limited supplies.
 */
export class NPCManager {
  readonly root = new Group();
  private brains: Brain[] = [];
  private rng: () => number;

  constructor(
    scene: Scene,
    private env: Environment,
    private city: CityConfig,
  ) {
    this.rng = makeRng(city.id.length * 1009 + 17);
    scene.add(this.root);
    this.build();
  }

  private build(): void {
    const needs = this.planNeeds();
    const total = Math.max(this.city.npcCount, needs.length + 6);
    const benches = this.env.benches.filter((b) => !b.occupied);
    let benchIdx = 0;

    for (let i = 0; i < total; i++) {
      const spawn = new Vector3(randRange(this.rng, -6.5, 6.5), 0, randRange(this.rng, 8, -86));
      const npc = new CityNPC(spawn, (i + 1) * 131 + this.city.id.length);
      const need = needs[i] ?? null;
      npc.setNeed(need);
      this.root.add(npc.group);

      // Assign a routine. Needy people mostly wander/stand near the street so
      // they're reachable; ambient people fill benches, shops and chat groups.
      let kind: BrainKind;
      if (need) {
        kind = this.rng() < 0.6 ? 'wander' : 'stand';
      } else {
        const r = this.rng();
        kind = r < 0.3 ? 'sit' : r < 0.55 ? 'shop' : r < 0.8 ? 'wander' : 'talk';
      }

      const brain: Brain = { npc, kind, timer: randRange(this.rng, 0, 3), settled: false };
      npc.onArrived = () => this.onArrived(brain);
      this.brains.push(brain);

      // Kick off bench sitters toward a bench immediately.
      if (kind === 'sit' && benchIdx < benches.length) {
        const bench = benches[benchIdx++];
        bench.occupied = true;
        npc.walkTo(bench.position);
        (brain as Brain & { bench?: Vector3; benchFacing?: number }).bench = bench.position.clone();
        (brain as Brain & { benchFacing?: number }).benchFacing = bench.facing;
      }
    }

    // Pair up talkers so they face each other and gesture.
    this.pairTalkers();
  }

  /** Build the list of needs to assign, satisfying objectives + a surplus. */
  private planNeeds(): GospelResource[] {
    const obj = this.city.objectives as ResourceRequirement;
    const list: GospelResource[] = [];
    (Object.entries(obj) as [GospelResource, number][]).forEach(([type, n]) => {
      const surplus = 1; // a little extra so the player must prioritise
      for (let k = 0; k < n + surplus; k++) list.push(type);
    });
    // Shuffle so needs aren't clustered by type.
    for (let i = list.length - 1; i > 0; i--) {
      const j = (this.rng() * (i + 1)) | 0;
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  private pairTalkers(): void {
    const talkers = this.brains.filter((b) => b.kind === 'talk');
    for (let i = 0; i + 1 < talkers.length; i += 2) {
      const a = talkers[i].npc;
      const b = talkers[i + 1].npc;
      const mid = a.position.clone().add(b.position).multiplyScalar(0.5);
      a.group.position.set(mid.x - 0.6, 0, mid.z);
      b.group.position.set(mid.x + 0.6, 0, mid.z);
      a.startTalk(Math.atan2(b.position.x - a.position.x, b.position.z - a.position.z));
      b.startTalk(Math.atan2(a.position.x - b.position.x, a.position.z - b.position.z));
      talkers[i].settled = talkers[i + 1].settled = true;
    }
  }

  private onArrived(brain: Brain): void {
    const b = brain as Brain & { bench?: Vector3; benchFacing?: number };
    if (brain.kind === 'sit' && b.bench) {
      brain.npc.faceToward(new Vector3(b.bench.x, 0, b.bench.z + Math.cos(b.benchFacing ?? 0)));
      brain.npc.sitDown();
      brain.settled = true;
      return;
    }
    // Otherwise pause a moment before choosing a new destination.
    brain.timer = randRange(this.rng, 1.5, 4.5);
  }

  update(dt: number, elapsed: number): void {
    for (const brain of this.brains) {
      brain.npc.update(dt, elapsed, this.env.heightAt(brain.npc.position.x, brain.npc.position.z));

      if (brain.settled) continue;
      if (brain.npc.state === 'idle') {
        brain.timer -= dt;
        if (brain.timer <= 0) this.assignNext(brain);
      }
    }
  }

  private assignNext(brain: Brain): void {
    if (brain.kind === 'wander') {
      brain.npc.walkTo(new Vector3(randRange(this.rng, -6.5, 6.5), 0, randRange(this.rng, 8, -86)));
    } else if (brain.kind === 'shop') {
      const spots = this.env.visitSpots;
      if (spots.length) brain.npc.walkTo(spots[(this.rng() * spots.length) | 0]);
      else brain.npc.walkTo(new Vector3(randRange(this.rng, -6, 6), 0, randRange(this.rng, 8, -86)));
    } else {
      // 'stand' — small idle shuffle so they don't look frozen.
      brain.timer = randRange(this.rng, 3, 6);
    }
  }

  /** Closest unhelped, needy NPC within range (for the interaction prompt). */
  nearestNeedy(playerPos: Vector3, range: number): CityNPC | null {
    let best: CityNPC | null = null;
    let bestD = range;
    for (const brain of this.brains) {
      const npc = brain.npc;
      if (!npc.need || npc.fulfilled) continue;
      const d = npc.distanceTo(playerPos);
      if (d < bestD) {
        bestD = d;
        best = npc;
      }
    }
    return best;
  }

  dispose(): void {
    (this.root.parent as Object3D | null)?.remove(this.root);
    this.root.traverse((o: Object3D) => {
      const mesh = o as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
  }
}
