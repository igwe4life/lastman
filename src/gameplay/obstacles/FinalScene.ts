import {
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Scene,
  Vector3,
  type PerspectiveCamera,
} from 'three';
import { NPC } from '../../entities/NPC';
import type { Player } from '../../entities/Player';
import type { GameBus } from '../events';
import { GameConfig } from '../../config/gameConfig';
import { damp, smoothstep } from '../../utils/math';

/**
 * The Final Scene — reaching The Last Man Standing.
 *
 * Not a gated obstacle: when the player enters the destination radius (after the
 * forest is cleared) a scripted cinematic plays. The messenger walks the last
 * steps, the two greet warmly, the caption "Every person matters." appears, and
 * the mission completes. The cinematic drives the camera directly.
 */
export class FinalScene {
  readonly position = GameConfig.mission.finalPosition.clone();
  private lastMan!: NPC;
  private marker!: Mesh;
  private markerLight!: PointLight;

  private active = false;
  private done = false;
  private t = 0;
  private startPos = new Vector3();
  private greetSpot = new Vector3();

  constructor(private camera: PerspectiveCamera, private bus: GameBus) {}

  build(scene: Scene): void {
    // The Last Man Standing, awaiting the messenger.
    this.lastMan = new NPC(scene, this.position.clone(), 0xe8d8b0, 777);

    // A glowing objective marker / pillar of light at the destination.
    const markerMat = new MeshStandardMaterial({
      color: 0xffe9b0,
      emissive: 0xffe9b0,
      emissiveIntensity: 1.4,
      transparent: true,
      opacity: 0.5,
    });
    this.marker = new Mesh(new CylinderGeometry(0.6, 0.6, 30, 16, 1, true), markerMat);
    this.marker.position.copy(this.position).add(new Vector3(0, 15, 0));
    scene.add(this.marker);

    this.markerLight = new PointLight(0xffe9b0, 8, 30, 2);
    this.markerLight.position.copy(this.position).add(new Vector3(0, 4, 0));
    scene.add(this.markerLight);
  }

  get isActive(): boolean {
    return this.active;
  }

  get isDone(): boolean {
    return this.done;
  }

  /** Begin the scripted ending. */
  start(player: Player): void {
    if (this.active || this.done) return;
    this.active = true;
    this.t = 0;
    player.freeze(true);
    this.startPos.copy(player.position);
    // Stop a couple of metres short, facing the Last Man.
    this.greetSpot.copy(this.position).add(new Vector3(0, 0, 2.2));
    this.bus.emit('cinematicChanged', true);
    this.bus.emit('promptChanged', null);
    this.lastMan.faceToward(this.greetSpot);
  }

  update(dt: number, elapsed: number, player: Player): void {
    this.marker.rotation.y += dt * 0.4;
    this.markerLight.intensity = 7 + Math.sin(elapsed * 3) * 1.5;
    this.lastMan.update(dt, elapsed);

    if (!this.active) return;
    this.t += dt;

    // Phase 1 (0–3s): walk the final steps.
    if (this.t < 3) {
      const k = smoothstep(0, 3, this.t);
      player.controller.position.lerpVectors(this.startPos, this.greetSpot, k);
      // Body faces the destination at -Z. facing uses atan2(x,z); -Z => PI.
      player.controller.facing = Math.PI;
      player.rig.setState(k < 0.95 ? 'walk' : 'idle', 0.6);
      player.rig.root.rotation.y = Math.PI;
      player.rig.root.position.copy(player.controller.position);
      player.rig.update(dt);
      this.cinematicCamera(dt, player, 0);
    }
    // Phase 2 (3–6s): warm greeting.
    else if (this.t < 6) {
      player.rig.setState('interact', 0);
      player.rig.root.rotation.y = Math.PI;
      player.rig.update(dt);
      this.lastMan.faceToward(player.position);
      this.cinematicCamera(dt, player, 1);
      if (this.t > 4 && this.t < 4.1) this.bus.emit('toast', 'Every person matters.');
    }
    // Phase 3 (6–8s): hold, then complete.
    else {
      player.rig.setState('idle', 0);
      player.rig.update(dt);
      this.cinematicCamera(dt, player, 2);
      if (!this.done && this.t > 7) {
        this.done = true;
        this.active = false;
        this.bus.emit('missionComplete', undefined);
      }
    }
  }

  /** Three framing stages for the ending camera. */
  private cinematicCamera(dt: number, player: Player, stage: number): void {
    const mid = player.position.clone().lerp(this.position, 0.5);
    mid.y += 1.4;
    let camPos: Vector3;
    if (stage === 0) {
      // Tracking side dolly.
      camPos = mid.clone().add(new Vector3(4.5, 1.8, 3.5));
    } else if (stage === 1) {
      // Over-the-shoulder two-shot.
      camPos = mid.clone().add(new Vector3(3.2, 1.4, 2.2));
    } else {
      // Slow push-in / rise.
      camPos = mid.clone().add(new Vector3(0, 2.6, 5));
    }
    this.camera.position.x = damp(this.camera.position.x, camPos.x, 3, dt);
    this.camera.position.y = damp(this.camera.position.y, camPos.y, 3, dt);
    this.camera.position.z = damp(this.camera.position.z, camPos.z, 3, dt);
    this.camera.lookAt(mid);
  }
}
