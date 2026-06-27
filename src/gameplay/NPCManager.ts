import { Group, Material, Mesh, Object3D, Scene, Vector3 } from 'three';
import { CityNPC } from '../entities/CityNPC';
import type { Environment } from '../world/Environment';
import type { CityConfig } from '../config/cities';
import type { GospelResource } from '../config/gameConfig';
import type { ResourceRequirement } from './Inventory';
import { makeRng, randRange } from '../utils/math';
import { STREET, CROSSINGS } from '../config/layout';

type BrainKind = 'wander' | 'shop' | 'sit' | 'talk' | 'stand';
interface Brain {
  npc: CityNPC;
  kind: BrainKind;
  timer: number;
  settled: boolean;
  side: number; // which sidewalk (-1 / +1) this person is on
  blockedTime?: number;
  crossPhase?: 'toCrossing' | 'crossing' | null;
  crossZ?: number;
}

/** True if (ax,az) is close and in front of a person at (px,pz) facing (fx,fz). */
function ahead(
  px: number,
  pz: number,
  fx: number,
  fz: number,
  ax: number,
  az: number,
  radius: number,
): boolean {
  const tx = ax - px;
  const tz = az - pz;
  const d = Math.hypot(tx, tz);
  if (d < 0.35) return true; // overlapping
  if (d > radius) return false;
  return (tx * fx + tz * fz) / d > 0.2; // within the forward cone
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
      // Everyone spawns and lives on a sidewalk, never the open road.
      const side = this.rng() < 0.5 ? -1 : 1;
      const spawn = new Vector3(this.sidewalkX(side), 0, randRange(this.rng, STREET.start - 2, STREET.end + 4));
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

      const brain: Brain = { npc, kind, timer: randRange(this.rng, 0, 3), settled: false, side };
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

  /** Pedestrian lane x for a given side (on the sidewalk, with a little jitter). */
  private sidewalkX(side: number): number {
    return side * (STREET.sidewalkX + randRange(this.rng, 0, STREET.sidewalkOuter - STREET.sidewalkX - 1.5));
  }

  private pairTalkers(): void {
    const talkers = this.brains.filter((b) => b.kind === 'talk');
    for (let i = 0; i + 1 < talkers.length; i += 2) {
      const a = talkers[i].npc;
      const b = talkers[i + 1].npc;
      // Gather the pair onto a sidewalk and face each other.
      const side = talkers[i].side;
      const z = a.position.z;
      const baseX = this.sidewalkX(side);
      a.group.position.set(baseX - side * 0.4, 0, z);
      b.group.position.set(baseX + side * 0.4, 0, z + 0.7);
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
    // Two-step zebra crossing: walk to the crossing on this side, then across.
    if (brain.crossPhase === 'toCrossing') {
      brain.side = -brain.side;
      brain.crossPhase = 'crossing';
      brain.npc.walkTo(new Vector3(this.sidewalkX(brain.side), 0, brain.crossZ ?? brain.npc.position.z));
      return;
    }
    if (brain.crossPhase === 'crossing') {
      brain.crossPhase = null;
    }
    // Otherwise pause a moment before choosing a new destination.
    brain.timer = randRange(this.rng, 1.5, 4.5);
  }

  update(dt: number, elapsed: number, playerPos: Vector3): void {
    // Separation: stop people who would walk into another person or the player.
    this.resolveBlocking(playerPos);

    for (const brain of this.brains) {
      brain.npc.update(dt, elapsed, this.env.heightAt(brain.npc.position.x, brain.npc.position.z));

      // If stuck for a while, give up on this destination and pick another so
      // two people don't stand frozen against each other forever.
      if (brain.npc.blocked && brain.npc.state === 'walk') {
        brain.blockedTime = (brain.blockedTime ?? 0) + dt;
        if (brain.blockedTime > 1.6 && !brain.settled) {
          brain.npc.state = 'idle';
          brain.blockedTime = 0;
          brain.timer = randRange(this.rng, 0.5, 2);
        }
      } else {
        brain.blockedTime = 0;
      }

      if (brain.settled) continue;
      if (brain.npc.state === 'idle') {
        brain.timer -= dt;
        if (brain.timer <= 0) this.assignNext(brain);
      }
    }
  }

  /** Flag NPCs whose path is obstructed by another person or the player. */
  private resolveBlocking(playerPos: Vector3): void {
    for (const b of this.brains) b.npc.blocked = false;
    for (const b of this.brains) {
      const npc = b.npc;
      if (npc.state !== 'walk') continue;
      const px = npc.position.x;
      const pz = npc.position.z;
      const fx = Math.sin(npc.group.rotation.y);
      const fz = Math.cos(npc.group.rotation.y);
      // The player is a larger obstacle.
      if (ahead(px, pz, fx, fz, playerPos.x, playerPos.z, 1.1)) {
        npc.blocked = true;
        continue;
      }
      for (const o of this.brains) {
        if (o === b) continue;
        if (ahead(px, pz, fx, fz, o.npc.position.x, o.npc.position.z, 0.85)) {
          npc.blocked = true;
          break;
        }
      }
    }
  }

  /** Positions of every person (used by the traffic system to stop for crowds). */
  get positions(): Vector3[] {
    return this.brains.map((b) => b.npc.position);
  }

  private assignNext(brain: Brain): void {
    if (brain.kind === 'wander') {
      // Sometimes cross the road — but only at a zebra crossing.
      if (this.rng() < 0.25 && CROSSINGS.length) {
        const crossZ = CROSSINGS[(this.rng() * CROSSINGS.length) | 0];
        brain.crossPhase = 'toCrossing';
        brain.crossZ = crossZ;
        brain.npc.walkTo(new Vector3(this.sidewalkX(brain.side), 0, crossZ));
      } else {
        // Stroll along the current sidewalk.
        brain.crossPhase = null;
        brain.npc.walkTo(
          new Vector3(this.sidewalkX(brain.side), 0, randRange(this.rng, STREET.start - 2, STREET.end + 4)),
        );
      }
    } else if (brain.kind === 'shop') {
      const spots = this.env.visitSpots;
      brain.crossPhase = null;
      if (spots.length) brain.npc.walkTo(spots[(this.rng() * spots.length) | 0]);
      else brain.npc.walkTo(new Vector3(this.sidewalkX(brain.side), 0, randRange(this.rng, STREET.start - 2, STREET.end + 4)));
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
