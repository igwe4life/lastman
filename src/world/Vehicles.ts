import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Vector3,
} from 'three';
import { makeRng, randRange } from '../utils/math';
import type { CityConfig } from '../config/cities';
import { STREET } from '../config/layout';

interface Vehicle {
  group: Group;
  speed: number;
  dir: number; // +1 toward +z, -1 toward -z
  lane: number;
  wheels: Mesh[];
}

/**
 * Traffic that makes the streets feel busy and behave plausibly: a mix of
 * city-coloured buses, cars and vans driving in two lanes, with headlights,
 * taillights and wheels that actually roll. Vehicles stop for pedestrians, the
 * player and the car ahead (so they never drive through anyone), then move on.
 */
export class Vehicles {
  private vehicles: Vehicle[] = [];

  constructor(parent: Object3D, city: CityConfig) {
    const rng = makeRng(city.id.length * 71 + 3);
    const total = city.props.busCount + 5;
    for (let i = 0; i < total; i++) {
      const type: 'bus' | 'car' | 'van' = i < city.props.busCount ? 'bus' : rng() < 0.7 ? 'car' : 'van';
      const dir = i % 2 === 0 ? 1 : -1;
      const lane = dir > 0 ? STREET.laneX : -STREET.laneX;
      const color =
        type === 'bus'
          ? (city.props.busColor ?? 0xffd21f)
          : [0xb23b3b, 0x3b5bb2, 0xdedede, 0x2a2a2a, 0x3b8f5a][(rng() * 5) | 0];
      const v = this.makeVehicle(type, color);
      v.group.position.set(lane, 0, randRange(rng, STREET.end + 4, STREET.start - 4));
      v.group.rotation.y = dir > 0 ? 0 : Math.PI;
      parent.add(v.group);
      this.vehicles.push({ ...v, speed: randRange(rng, 4, 7.5), dir, lane });
    }
  }

  private makeVehicle(type: 'bus' | 'car' | 'van', color: number): { group: Group; wheels: Mesh[] } {
    const g = new Group();
    const wheels: Mesh[] = [];
    const len = type === 'bus' ? 4.4 : type === 'van' ? 3.0 : 2.6;
    const bodyH = type === 'bus' ? 1.7 : type === 'van' ? 1.5 : 1.0;
    const w = 1.7;
    const bodyMat = new MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.3 });
    const glassMat = new MeshStandardMaterial({ color: 0x1c2734, roughness: 0.15, metalness: 0.7 });

    // Lower body.
    const body = new Mesh(new BoxGeometry(w, bodyH, len), bodyMat);
    body.position.y = bodyH / 2 + 0.34;
    body.castShadow = true;
    g.add(body);

    // Cabin / roof for cars (a smaller box on top, set back).
    if (type === 'car') {
      const cabin = new Mesh(new BoxGeometry(w * 0.92, 0.7, len * 0.55), bodyMat);
      cabin.position.set(0, bodyH + 0.34 + 0.35, -0.1);
      cabin.castShadow = true;
      g.add(cabin);
      const cabinGlass = new Mesh(new BoxGeometry(w * 0.94, 0.55, len * 0.5), glassMat);
      cabinGlass.position.set(0, bodyH + 0.34 + 0.38, -0.1);
      g.add(cabinGlass);
    } else {
      // Window band for buses/vans.
      const win = new Mesh(new BoxGeometry(w + 0.02, bodyH * 0.42, len * 0.9), glassMat);
      win.position.y = bodyH * 0.72 + 0.34;
      g.add(win);
    }

    // Headlights (front = +z local) and taillights (back = -z local).
    const head = new MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xfff2c0, emissiveIntensity: 1.4 });
    const tail = new MeshStandardMaterial({ color: 0xff5a4a, emissive: 0xff2a1a, emissiveIntensity: 1.1 });
    for (const sx of [-0.55, 0.55]) {
      const hl = new Mesh(new BoxGeometry(0.28, 0.22, 0.1), head);
      hl.position.set(sx, 0.7, len / 2 + 0.01);
      g.add(hl);
      const tl = new Mesh(new BoxGeometry(0.28, 0.22, 0.1), tail);
      tl.position.set(sx, 0.7, -len / 2 - 0.01);
      g.add(tl);
    }

    // Wheels (cylinders that roll).
    const wheelGeo = new CylinderGeometry(0.36, 0.36, 0.26, 12);
    wheelGeo.rotateZ(Math.PI / 2); // axle along x
    const wheelMat = new MeshStandardMaterial({ color: 0x111317, roughness: 0.9 });
    for (const wx of [-0.85, 0.85]) {
      for (const wz of [-len / 2 + 0.6, len / 2 - 0.6]) {
        const wheel = new Mesh(wheelGeo, wheelMat);
        wheel.position.set(wx, 0.36, wz);
        g.add(wheel);
        wheels.push(wheel);
      }
    }
    return { group: g, wheels };
  }

  update(dt: number, blockers: Vector3[] = []): void {
    for (const v of this.vehicles) {
      if (!this.pathClear(v, blockers)) continue; // stop for people / cars ahead
      const step = v.speed * dt;
      v.group.position.z += v.dir * step;
      // Roll the wheels to match travel.
      const roll = (step / 0.36) * (v.dir > 0 ? 1 : -1);
      for (const wheel of v.wheels) wheel.rotation.x += roll;
      if (v.dir > 0 && v.group.position.z > STREET.start) v.group.position.z = STREET.end;
      if (v.dir < 0 && v.group.position.z < STREET.end) v.group.position.z = STREET.start;
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
