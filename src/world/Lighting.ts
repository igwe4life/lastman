import {
  AmbientLight,
  Color,
  DirectionalLight,
  HemisphereLight,
  Object3D,
  Vector3,
} from 'three';
import { GameConfig } from '../config/gameConfig';
import type { CityConfig } from '../config/cities';

/**
 * Dynamic sunlight + sky/ground hemisphere fill + soft ambient, tinted per city
 * so Lagos reads as bright tropical noon, Accra as warm evening and
 * Johannesburg as crisp high-veld daylight. The sun follows the player so the
 * shadow frustum stays tight.
 */
export class Lighting {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly ambient: AmbientLight;

  constructor(parent: Object3D, city: CityConfig) {
    this.sun = new DirectionalLight(city.sun.color, city.sun.intensity);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(
      GameConfig.render.shadowMapSize,
      GameConfig.render.shadowMapSize,
    );
    const cam = this.sun.shadow.camera;
    cam.near = 0.5;
    cam.far = 120;
    cam.left = -45;
    cam.right = 45;
    cam.top = 45;
    cam.bottom = -45;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.025;
    parent.add(this.sun);
    parent.add(this.sun.target);

    this.hemi = new HemisphereLight(city.hemi.sky, city.hemi.ground, city.hemi.intensity);
    parent.add(this.hemi);

    this.ambient = new AmbientLight(0xffffff, 0.16);
    parent.add(this.ambient);
  }

  setSunDirection(dir: Vector3): void {
    this.sun.position.copy(dir).multiplyScalar(60);
  }

  /** Keep the shadow frustum centred on the player. */
  follow(target: Vector3, sunDir: Vector3): void {
    this.sun.target.position.copy(target);
    this.sun.position.copy(target).addScaledVector(sunDir, 60);
    this.sun.target.updateMatrixWorld();
  }
}
