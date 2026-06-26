import { PerspectiveCamera, Vector3 } from 'three';
import { GameConfig } from '../config/gameConfig';
import { clamp, damp } from '../utils/math';

/**
 * Orbiting third-person follow camera. Mouse deltas (consumed from Input)
 * rotate yaw/pitch; the camera trails behind the target at a fixed distance and
 * smoothly chases its goal position so motion feels weighty, not rigid.
 */
export class ThirdPersonCamera {
  yaw = Math.PI; // face -Z (down the path) at start
  pitch = 0.15;

  private readonly desired = new Vector3();
  private readonly lookTarget = new Vector3();

  constructor(private readonly camera: PerspectiveCamera) {}

  /** Apply look input. */
  rotate(deltaX: number, deltaY: number): void {
    this.yaw -= deltaX;
    this.pitch = clamp(this.pitch + deltaY, GameConfig.camera.minPitch, GameConfig.camera.maxPitch);
  }

  /** Direction the camera is facing on the ground plane (for movement). */
  getForward(out: Vector3): Vector3 {
    return out.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
  }

  getRight(out: Vector3): Vector3 {
    return out.set(Math.sin(this.yaw + Math.PI / 2), 0, Math.cos(this.yaw + Math.PI / 2)).normalize();
  }

  update(dt: number, target: Vector3, distanceScale = 1): void {
    const { distance, height, smoothing } = GameConfig.camera;
    const dist = distance * distanceScale;
    const cp = Math.cos(this.pitch);
    // Sit BEHIND the player along the forward (yaw) direction and look down it,
    // so the path ahead and its objectives are always in frame. The forward
    // direction is (sin yaw, 0, cos yaw); "behind" negates its horizontal part.
    const offset = new Vector3(
      -Math.sin(this.yaw) * cp * dist,
      height + Math.sin(this.pitch) * dist,
      -Math.cos(this.yaw) * cp * dist,
    );
    this.desired.copy(target).add(offset);

    this.camera.position.x = damp(this.camera.position.x, this.desired.x, smoothing, dt);
    this.camera.position.y = damp(this.camera.position.y, this.desired.y, smoothing, dt);
    this.camera.position.z = damp(this.camera.position.z, this.desired.z, smoothing, dt);

    this.lookTarget.copy(target);
    this.lookTarget.y += 1.4;
    this.camera.lookAt(this.lookTarget);
  }

  /** Snap instantly (used when entering/exiting cinematics). */
  snapTo(position: Vector3, look: Vector3): void {
    this.camera.position.copy(position);
    this.camera.lookAt(look);
  }
}
