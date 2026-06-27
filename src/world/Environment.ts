import {
  Color,
  Fog,
  Group,
  Material,
  Mesh,
  Object3D,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { Sky } from './Sky';
import { Lighting } from './Lighting';
import { Terrain } from './Terrain';
import { Grass } from './Grass';
import { Trees } from './Trees';
import { Palms } from './Palms';
import { Buildings } from './Buildings';
import { Roads } from './Roads';
import { Mountains } from './Mountains';
import { Clouds } from './Clouds';
import { Birds } from './Birds';
import { Vehicles } from './Vehicles';
import { Landmarks } from './Landmarks';
import { CityProps, type SitSpot } from './CityProps';
import type { Engine } from '../core/Engine';
import type { CityConfig } from '../config/cities';

/**
 * Assembles one city into a single disposable group so levels can be torn down
 * and rebuilt cleanly. Composes sky, light, terrain, buildings, streets,
 * vegetation, traffic, atmosphere and street furniture from the per-city
 * CityConfig, and exposes the ground query + NPC routine spots.
 */
export class Environment {
  readonly root = new Group();
  readonly sky: Sky;
  readonly lighting: Lighting;
  readonly terrain: Terrain;
  readonly props: CityProps;

  private readonly grass: Grass;
  private readonly trees: Trees;
  private readonly clouds: Clouds;
  private readonly birds: Birds;
  private readonly vehicles: Vehicles;

  constructor(private engine: Engine, city: CityConfig) {
    const scene = engine.scene;
    scene.background = new Color(city.fog.color);
    scene.fog = new Fog(city.fog.color, city.fog.near, city.fog.far);
    engine.renderer.toneMappingExposure = city.exposure;

    this.sky = new Sky(city);
    this.sky.generateEnvironment(engine.renderer, scene, this.root);

    this.lighting = new Lighting(this.root, city);
    this.lighting.setSunDirection(this.sky.sunDirection);

    this.terrain = new Terrain(this.root, 600, city);
    new Buildings(this.root, city);
    new Roads(this.root);
    if (city.props.mountains) new Mountains(this.root);
    this.grass = new Grass(this.root, this.terrain, 0x5f8f38, city.props.park ? 20000 : 12000);
    this.trees = new Trees(this.root, this.terrain, city.props.trees);
    new Palms(this.root, this.terrain, city.props.palms);
    new Landmarks(this.root, city);
    this.vehicles = new Vehicles(this.root, city);
    this.props = new CityProps(this.root, city, this.terrain);
    this.clouds = new Clouds(this.root);
    this.birds = new Birds(this.root);

    scene.add(this.root);
  }

  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  get benches(): SitSpot[] {
    return this.props.benches;
  }

  get visitSpots(): Vector3[] {
    return this.props.visitSpots;
  }

  update(
    dt: number,
    elapsed: number,
    camera: PerspectiveCamera,
    playerPos: Vector3,
    blockers: Vector3[] = [],
  ): void {
    this.grass.update(elapsed);
    this.trees.update(elapsed);
    this.clouds.update(dt, camera.quaternion);
    this.birds.update(dt, elapsed, playerPos.z);
    this.vehicles.update(dt, blockers);
    this.lighting.follow(playerPos, this.sky.sunDirection);
  }

  /** Tear the whole city down and free GPU resources. */
  dispose(): void {
    const scene = this.engine.scene;
    scene.remove(this.root);
    scene.fog = null;
    scene.environment = null;
    this.root.traverse((o: Object3D) => {
      const mesh = o as Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as Material | Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) mat.dispose();
    });
    this.sky.envMap?.dispose();
  }
}
