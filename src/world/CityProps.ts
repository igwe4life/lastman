import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Vector3,
} from 'three';
import { makeRng, randRange } from '../utils/math';
import type { CityConfig } from '../config/cities';
import type { Terrain } from './Terrain';

export interface SitSpot {
  position: Vector3;
  facing: number;
  occupied: boolean;
}

/**
 * Street furniture and points of interest that make a district legible and give
 * the NPC routine system somewhere to go: benches to sit on, market stalls and
 * shopfronts to visit, street lamps, and a small park. Exposes the sit/visit
 * spots it created so the NPC manager can route people to them.
 */
export class CityProps {
  readonly group = new Group();
  readonly benches: SitSpot[] = [];
  readonly visitSpots: Vector3[] = [];

  constructor(parent: Object3D, city: CityConfig, _terrain: Terrain) {
    const rng = makeRng(city.id.length * 313 + 11);

    this.buildStreetLamps();
    this.buildBenches(rng);
    if (city.props.market) this.buildMarket(rng, city);
    if (city.props.park) this.buildPark(rng);
    // Shopfront visit spots along the sidewalks regardless of city.
    for (let z = 8; z > -90; z -= 12) {
      this.visitSpots.push(new Vector3(7.5, 0, z));
      this.visitSpots.push(new Vector3(-7.5, 0, z));
    }

    parent.add(this.group);
  }

  private buildStreetLamps(): void {
    const poleMat = new MeshStandardMaterial({ color: 0x33363b, roughness: 0.7, metalness: 0.4 });
    for (const side of [-1, 1]) {
      for (let z = 10; z > -96; z -= 16) {
        const lamp = new Group();
        const pole = new Mesh(new CylinderGeometry(0.08, 0.1, 4.5, 6), poleMat);
        pole.position.y = 2.25;
        pole.castShadow = true;
        lamp.add(pole);
        const head = new Mesh(
          new ConeGeometry(0.3, 0.4, 8),
          new MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffe9b0, emissiveIntensity: 1.2 }),
        );
        head.position.y = 4.4;
        lamp.add(head);
        const glow = new PointLight(0xffe6b0, 1.6, 12, 2);
        glow.position.y = 4.2;
        lamp.add(glow);
        lamp.position.set(side * 9, 0.25, z);
        this.group.add(lamp);
      }
    }
  }

  private buildBenches(rng: () => number): void {
    const woodMat = new MeshStandardMaterial({ color: 0x6e4a2c, roughness: 0.9 });
    for (const side of [-1, 1]) {
      for (let z = 0; z > -90; z -= 22) {
        const bench = new Group();
        const seat = new Mesh(new BoxGeometry(2, 0.12, 0.6), woodMat);
        seat.position.y = 0.5;
        seat.castShadow = seat.receiveShadow = true;
        bench.add(seat);
        const back = new Mesh(new BoxGeometry(2, 0.5, 0.1), woodMat);
        back.position.set(0, 0.8, -0.25);
        bench.add(back);
        for (const lx of [-0.85, 0.85]) {
          const leg = new Mesh(new BoxGeometry(0.1, 0.5, 0.5), woodMat);
          leg.position.set(lx, 0.25, 0);
          bench.add(leg);
        }
        const facing = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        bench.position.set(side * 7.6, 0.25, z + randRange(rng, -2, 2));
        bench.rotation.y = facing;
        this.group.add(bench);
        this.benches.push({
          position: new Vector3(bench.position.x - side * 0.4, 0.7, bench.position.z),
          facing: facing + Math.PI,
          occupied: false,
        });
      }
    }
  }

  private buildMarket(rng: () => number, _city: CityConfig): void {
    const canopyColors = [0xd83b3b, 0x3b7cd8, 0xf2c43b, 0x3bc46b, 0xe06bd8];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const z = -8 - i * 6;
      const stall = new Group();
      // Table.
      const table = new Mesh(
        new BoxGeometry(2.2, 0.1, 1.2),
        new MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.9 }),
      );
      table.position.y = 0.9;
      stall.add(table);
      for (const lx of [-1, 1]) {
        for (const lz of [-0.5, 0.5]) {
          const leg = new Mesh(new BoxGeometry(0.1, 0.9, 0.1), new MeshStandardMaterial({ color: 0x5a4028 }));
          leg.position.set(lx, 0.45, lz);
          stall.add(leg);
        }
      }
      // Striped canopy.
      const canopy = new Mesh(
        new BoxGeometry(2.6, 0.08, 1.6),
        new MeshStandardMaterial({ color: canopyColors[(rng() * canopyColors.length) | 0], roughness: 0.8 }),
      );
      canopy.position.y = 2.1;
      canopy.rotation.x = 0.12;
      canopy.castShadow = true;
      stall.add(canopy);
      for (const px of [-1.2, 1.2]) {
        const post = new Mesh(new BoxGeometry(0.08, 2.1, 0.08), new MeshStandardMaterial({ color: 0x4a4a4a }));
        post.position.set(px, 1.05, 0);
        stall.add(post);
      }
      // Produce blobs.
      for (let p = 0; p < 4; p++) {
        const produce = new Mesh(
          new BoxGeometry(0.3, 0.2, 0.3),
          new MeshStandardMaterial({ color: new Color().setHSL(rng(), 0.6, 0.5).getHex(), roughness: 0.7 }),
        );
        produce.position.set(randRange(rng, -0.8, 0.8), 1.05, randRange(rng, -0.4, 0.4));
        stall.add(produce);
      }
      stall.position.set(side * 7.4, 0.25, z);
      stall.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      this.group.add(stall);
      this.visitSpots.push(new Vector3(side * 6.2, 0, z));
    }
  }

  private buildPark(rng: () => number): void {
    // A small green plaza with a fountain near the far end of the street.
    const parkZ = -70;
    const lawn = new Mesh(
      new BoxGeometry(20, 0.1, 18),
      new MeshStandardMaterial({ color: 0x4f8f3f, roughness: 1 }),
    );
    lawn.position.set(0, 0.06, parkZ);
    lawn.receiveShadow = true;
    this.group.add(lawn);

    const fountain = new Group();
    const basin = new Mesh(
      new CylinderGeometry(2.2, 2.4, 0.8, 20),
      new MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.6 }),
    );
    basin.position.y = 0.4;
    fountain.add(basin);
    const water = new Mesh(
      new CylinderGeometry(2.0, 2.0, 0.1, 20),
      new MeshStandardMaterial({ color: 0x4a9fd0, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.85 }),
    );
    water.position.y = 0.75;
    fountain.add(water);
    fountain.position.set(0, 0.1, parkZ);
    this.group.add(fountain);

    // Park benches around the fountain.
    const woodMat = new MeshStandardMaterial({ color: 0x6e4a2c, roughness: 0.9 });
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI * 2;
      const bx = Math.cos(ang) * 5;
      const bz = parkZ + Math.sin(ang) * 5;
      const seat = new Mesh(new BoxGeometry(1.8, 0.12, 0.55), woodMat);
      seat.position.set(bx, 0.6, bz);
      seat.rotation.y = -ang;
      seat.castShadow = true;
      this.group.add(seat);
      this.benches.push({ position: new Vector3(bx, 0.7, bz), facing: -ang + Math.PI, occupied: false });
    }
    void rng;
  }
}
