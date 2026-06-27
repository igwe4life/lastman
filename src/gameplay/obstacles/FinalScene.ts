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
import { Angels } from '../../world/Angels';
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
  private angels!: Angels;

  private active = false;
  private done = false;
  private angelsStarted = false;
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

    // The angelic host (hidden until the celebration beat).
    this.angels = new Angels(scene, this.position.clone());
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
    this.angels.update(dt, elapsed);

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
      this.cinematicCamera(dt, player, 0, 1.4);
    }
    // Phase 2 (3–5.5s): warm greeting.
    else if (this.t < 5.5) {
      player.rig.setState('interact', 0);
      player.rig.root.rotation.y = Math.PI;
      player.rig.update(dt);
      this.lastMan.faceToward(player.position);
      this.cinematicCamera(dt, player, 1, 1.4);
      if (this.t > 4 && this.t < 4.1) this.bus.emit('toast', 'Every person matters.');
    }
    // Phase 3 (5.5–11s): the heavens celebrate — camera cranes back and up to
    // reveal a host of angels with trumpets and song, then complete.
    else {
      player.rig.setState('idle', 0);
      player.rig.update(dt);
      if (!this.angelsStarted) {
        this.angelsStarted = true;
        this.angels.start();
        this.bus.emit('sfx', 'celebrate');
      }
      // Raise the look target into the sky to bring the angels into frame.
      const reveal = smoothstep(5.5, 9, this.t);
      this.cinematicCamera(dt, player, 2, 1.4 + reveal * 7);
      if (!this.done && this.t > 10.5) {
        this.done = true;
        this.active = false;
        this.bus.emit('missionComplete', undefined);
      }
    }
  }

  /** Framing stages for the ending camera; `lookY` lifts the gaze toward the sky. */
  private cinematicCamera(dt: number, player: Player, stage: number, lookY: number): void {
    const mid = player.position.clone().lerp(this.position, 0.5);
    const look = mid.clone();
    look.y += lookY;
    let camPos: Vector3;
    if (stage === 0) {
      camPos = mid.clone().add(new Vector3(4.5, 3.2, 3.5)); // tracking side dolly
    } else if (stage === 1) {
      camPos = mid.clone().add(new Vector3(3.2, 2.8, 2.2)); // over-the-shoulder two-shot
    } else {
      camPos = mid.clone().add(new Vector3(0, 6.5, 14)); // crane back + up for the reveal
    }
    const lambda = stage === 2 ? 1.6 : 3;
    this.camera.position.x = damp(this.camera.position.x, camPos.x, lambda, dt);
    this.camera.position.y = damp(this.camera.position.y, camPos.y, lambda, dt);
    this.camera.position.z = damp(this.camera.position.z, camPos.z, lambda, dt);
    this.camera.lookAt(look);
  }
}
