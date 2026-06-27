import {
  BoxGeometry,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { makeRng, randRange } from '../utils/math';
import type { CityConfig } from '../config/cities';

interface Vehicle {
  group: Group;
  speed: number;
  dir: number; // +1 toward +z, -1 toward -z
  lane: number;
}

/**
 * Moving traffic to make the streets feel busy: city-coloured buses (Lagos's
 * iconic yellow danfo, etc.) plus a few cars, looping along two lanes. Wheels
 * are simple; the motion sells it. Pure decoration — no collision with the
 * player (the player walks the sidewalks/plaza).
 */
export class Vehicles {
  private vehicles: Vehicle[] = [];

  constructor(parent: Object3D, city: CityConfig) {
    const rng = makeRng(city.id.length * 71 + 3);
    const total = city.props.busCount + 4;
    for (let i = 0; i < total; i++) {
      const isBus = i < city.props.busCount;
      const dir = i % 2 === 0 ? 1 : -1;
      const lane = dir > 0 ? 2.6 : -2.6;
      const color = isBus
        ? (city.props.busColor ?? 0xffd21f)
        : [0xb23b3b, 0x3b5bb2, 0xdedede, 0x2a2a2a][(rng() * 4) | 0];
      const g = this.makeVehicle(isBus, color);
      g.position.set(lane, 0, randRange(rng, -95, 12));
      g.rotation.y = dir > 0 ? 0 : Math.PI;
      parent.add(g);
      this.vehicles.push({ group: g, speed: randRange(rng, 4, 8), dir, lane });
    }
  }

  private makeVehicle(isBus: boolean, color: number): Group {
    const g = new Group();
    const len = isBus ? 4.2 : 2.6;
    const h = isBus ? 1.8 : 1.2;
    const body = new Mesh(
      new BoxGeometry(1.7, h, len),
      new MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 }),
    );
    body.position.y = h / 2 + 0.35;
    body.castShadow = true;
    g.add(body);
    // Window band.
    const win = new Mesh(
      new BoxGeometry(1.72, h * 0.4, len * 0.92),
      new MeshStandardMaterial({ color: 0x223040, roughness: 0.2, metalness: 0.6 }),
    );
    win.position.y = h * 0.7 + 0.35;
    g.add(win);
    // Wheels.
    const wheelMat = new MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (const wx of [-0.85, 0.85]) {
      for (const wz of [-len / 2 + 0.6, len / 2 - 0.6]) {
        const wheel = new Mesh(new BoxGeometry(0.25, 0.7, 0.7), wheelMat);
        wheel.position.set(wx, 0.35, wz);
        g.add(wheel);
      }
    }
    return g;
  }

  update(dt: number, blockers: Vector3[] = []): void {
    for (const v of this.vehicles) {
      if (!this.pathClear(v, blockers)) continue; // stop for people / cars ahead
      v.group.position.z += v.dir * v.speed * dt;
      if (v.dir > 0 && v.group.position.z > 16) v.group.position.z = -96;
      if (v.dir < 0 && v.group.position.z < -96) v.group.position.z = 16;
    }
  }

  /** A vehicle stops if a person, the player, or another car is just ahead in its lane. */
  private pathClear(v: Vehicle, blockers: Vector3[]): boolean {
    const vz = v.group.position.z;
    const isAhead = (x: number, z: number, near: number, far: number): boolean => {
      if (Math.abs(x - v.lane) > 1.8) return false;
      const rel = (z - vz) * v.dir; // forward distance
      return rel > near && rel < far;
    };
    for (const b of blockers) {
      if (isAhead(b.x, b.z, 0.5, 6)) return false;
    }
    for (const other of this.vehicles) {
      if (other === v) continue;
      if (Math.abs(other.lane - v.lane) > 0.5) continue;
      if (isAhead(other.group.position.x, other.group.position.z, 0.5, 5)) return false;
    }
    return true;
  }
}
