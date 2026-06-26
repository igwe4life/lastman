import { Vector3 } from 'three';
import { GameConfig } from '../config/gameConfig';
import { damp } from '../utils/math';
import type { ThirdPersonCamera } from './ThirdPersonCamera';
import type { Input } from '../core/Input';

export interface GroundProvider {
  heightAt(x: number, z: number): number;
}

export type BarrierCheck = (next: Vector3) => boolean;

/**
 * Kinematic character physics: camera-relative movement, acceleration/damping,
 * gravity + jumping, ground following from the terrain height field, and a
 * pluggable barrier check so obstacles can block the path until solved.
 *
 * Movement can be frozen (during cinematics / cutscenes) via `frozen`.
 */
export class CharacterController {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  facing = Math.PI; // yaw the body is rendered at
  grounded = true;
  frozen = false;

  /** Returns true if the target position is blocked. */
  barrier: BarrierCheck | null = null;

  private verticalVel = 0;
  private currentSpeed = 0;

  constructor(
    private input: Input,
    private camera: ThirdPersonCamera,
    private ground: GroundProvider,
  ) {
    this.position.copy(GameConfig.player.spawn);
  }

  /** Swap the ground provider (e.g. when loading a new city). */
  setGround(ground: GroundProvider): void {
    this.ground = ground;
  }

  /** Speed normalized 0..1 for animation blending. */
  get speed01(): number {
    return this.currentSpeed / GameConfig.player.runSpeed;
  }

  get isMoving(): boolean {
    return this.currentSpeed > 0.2;
  }

  get isRunning(): boolean {
    return this.input.running && this.currentSpeed > GameConfig.player.walkSpeed * 0.8;
  }

  tryJump(): boolean {
    if (this.grounded && !this.frozen) {
      this.verticalVel = GameConfig.player.jumpVelocity;
      this.grounded = false;
      return true;
    }
    return false;
  }

  update(dt: number): void {
    const p = GameConfig.player;

    let move = new Vector3();
    if (!this.frozen) {
      const intent = this.input.moveIntent();
      const fwd = this.camera.getForward(new Vector3());
      const right = this.camera.getRight(new Vector3());
      move.addScaledVector(fwd, intent.y).addScaledVector(right, intent.x);
      if (move.lengthSq() > 0) move.normalize();
    }

    const targetSpeed = move.lengthSq() > 0 ? (this.input.running ? p.runSpeed : p.walkSpeed) : 0;
    // Accelerate quickly, decelerate a touch softer for a natural stop.
    const lambda = targetSpeed > this.currentSpeed ? p.acceleration * 0.5 : p.acceleration * 0.35;
    this.currentSpeed = damp(this.currentSpeed, targetSpeed, lambda, dt);

    // Horizontal velocity.
    this.velocity.x = move.x * this.currentSpeed;
    this.velocity.z = move.z * this.currentSpeed;

    // Candidate next position with barrier rejection (slide along blocked axis).
    const next = this.position.clone();
    next.x += this.velocity.x * dt;
    next.z += this.velocity.z * dt;
    if (this.barrier && this.barrier(next)) {
      // Try axis-separated movement so the player can slide along walls.
      const tryX = this.position.clone();
      tryX.x = next.x;
      const tryZ = this.position.clone();
      tryZ.z = next.z;
      if (!this.barrier(tryX)) {
        this.position.x = tryX.x;
      } else if (!this.barrier(tryZ)) {
        this.position.z = tryZ.z;
      }
    } else {
      this.position.x = next.x;
      this.position.z = next.z;
    }

    // Gravity + ground.
    this.verticalVel += p.gravity * dt;
    this.position.y += this.verticalVel * dt;
    const groundY = this.ground.heightAt(this.position.x, this.position.z);
    if (this.position.y <= groundY) {
      this.position.y = groundY;
      this.verticalVel = 0;
      this.grounded = true;
    }

    // Face movement direction.
    if (this.isMoving && move.lengthSq() > 0) {
      const targetFacing = Math.atan2(move.x, move.z);
      this.facing = dampAngle(this.facing, targetFacing, 16, dt);
    }
  }
}

/** Angle-aware damping that takes the shortest path around the circle. */
function dampAngle(a: number, b: number, lambda: number, dt: number): number {
  let diff = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return a + diff * (1 - Math.exp(-lambda * dt));
}
