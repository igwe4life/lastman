import { Group, Vector3, type PerspectiveCamera } from 'three';
import { CharacterRig, type AnimState } from './CharacterRig';
import { CharacterController, type GroundProvider } from './CharacterController';
import { ThirdPersonCamera } from './ThirdPersonCamera';
import type { Input } from '../core/Input';

/**
 * High-level player: binds the procedural rig, the kinematic controller and the
 * follow camera together and maps movement state to animation state. This is
 * the one place that would change to drive a skinned GLTF instead of the
 * procedural rig.
 */
export class Player {
  readonly group = new Group();
  readonly rig = new CharacterRig();
  readonly controller: CharacterController;
  readonly camera: ThirdPersonCamera;

  // One-shot action lock (interact/climb) suppresses locomotion anim.
  private actionLock = 0;
  private lockedState: AnimState | null = null;

  // Footstep cadence.
  private stepTimer = 0;
  onFootstep?: (running: boolean) => void;
  onJump?: () => void;

  constructor(
    private input: Input,
    perspective: PerspectiveCamera,
    ground: GroundProvider,
  ) {
    this.camera = new ThirdPersonCamera(perspective);
    this.controller = new CharacterController(input, this.camera, ground);
    this.group.add(this.rig.root);
  }

  get position(): Vector3 {
    return this.controller.position;
  }

  freeze(frozen: boolean): void {
    this.controller.frozen = frozen;
  }

  /** Play a one-shot action animation for `duration` seconds. */
  playAction(state: 'interact' | 'climb', duration: number): void {
    this.lockedState = state;
    this.actionLock = duration;
  }

  setBarrier(check: CharacterController['barrier']): void {
    this.controller.barrier = check;
  }

  update(dt: number): void {
    // Camera look.
    const look = this.input.consumeLook();
    this.camera.rotate(look.x, look.y);

    // Jump.
    if (this.input.wasPressed('Space') && this.controller.tryJump()) {
      this.onJump?.();
    }

    this.controller.update(dt);

    // Drive animation state.
    let state: AnimState;
    if (this.actionLock > 0) {
      this.actionLock -= dt;
      state = this.lockedState ?? 'idle';
    } else if (!this.controller.grounded) {
      state = 'jump';
    } else if (this.controller.isRunning) {
      state = 'run';
    } else if (this.controller.isMoving) {
      state = 'walk';
    } else {
      state = 'idle';
    }
    this.rig.setState(state, this.controller.speed01);
    this.rig.update(dt);

    // Place + orient the rig.
    this.rig.root.position.copy(this.controller.position);
    this.rig.root.rotation.y = this.controller.facing;

    // Camera follow (pull back a little while running).
    const zoom = this.controller.isRunning ? 1.12 : 1;
    this.camera.update(dt, this.controller.position, zoom);

    // Footsteps.
    if (this.controller.grounded && this.controller.isMoving && this.actionLock <= 0) {
      this.stepTimer -= dt;
      const cadence = this.controller.isRunning ? 0.28 : 0.46;
      if (this.stepTimer <= 0) {
        this.stepTimer = cadence;
        this.onFootstep?.(this.controller.isRunning);
      }
    } else {
      this.stepTimer = 0;
    }
  }
}
