import {
  Object3D,
  PMREMGenerator,
  Scene,
  Vector3,
  WebGLRenderer,
  type Texture,
} from 'three';
import { Sky as SkyMesh } from 'three/addons/objects/Sky.js';
import type { CityConfig } from '../config/cities';

/**
 * Physically-based atmospheric sky dome with a per-city sun position and
 * turbidity/rayleigh tuning (tropical noon, warm evening, crisp daylight). The
 * sun direction drives the directional light so shadows and sky always agree.
 * Also bakes a PMREM environment map for image-based lighting / reflections.
 */
export class Sky {
  readonly mesh: SkyMesh;
  readonly sunDirection = new Vector3();
  envMap: Texture | null = null;

  private elevation: number;
  private azimuth: number;

  constructor(city: CityConfig) {
    this.elevation = city.sky.elevation;
    this.azimuth = city.sky.azimuth;
    this.mesh = new SkyMesh();
    this.mesh.scale.setScalar(10000);
    const u = this.mesh.material.uniforms;
    u['turbidity'].value = city.sky.turbidity;
    u['rayleigh'].value = city.sky.rayleigh;
    u['mieCoefficient'].value = 0.005;
    u['mieDirectionalG'].value = 0.8;
    this.updateSun();
  }

  private updateSun(): void {
    const phi = (90 - this.elevation) * (Math.PI / 180);
    const theta = this.azimuth * (Math.PI / 180);
    this.sunDirection.setFromSphericalCoords(1, phi, theta);
    this.mesh.material.uniforms['sunPosition'].value.copy(this.sunDirection);
  }

  /** Build an IBL environment map from the current sky, then park the dome. */
  generateEnvironment(renderer: WebGLRenderer, scene: Scene, parent: Object3D): void {
    const pmrem = new PMREMGenerator(renderer);
    const skyScene = new Scene();
    skyScene.add(this.mesh);
    const rt = pmrem.fromScene(skyScene);
    this.envMap = rt.texture;
    scene.environment = this.envMap;
    parent.add(this.mesh);
    pmrem.dispose();
  }
}
