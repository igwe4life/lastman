import { GameConfig } from '../config/gameConfig';

/**
 * Keyboard + pointer input. Movement is exposed as a normalized intent that
 * gameplay reads each frame; the camera reads accumulated mouse deltas.
 * Uses Pointer Lock for mouse-look (released on pause / Esc).
 */
export class Input {
  private keys = new Set<string>();
  private domElement: HTMLElement;
  private locked = false;
  private dragging = false;

  // Accumulated look deltas, consumed each frame by the camera.
  lookDeltaX = 0;
  lookDeltaY = 0;

  // Edge-triggered actions (true for a single frame).
  private pressedThisFrame = new Set<string>();

  onPauseToggle?: () => void;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onLockChange);
    // Two ways to look around so it always works:
    //  - click the canvas to engage immersive Pointer Lock (free mouse-look), OR
    //  - simply click-and-drag anywhere to orbit (robust fallback).
    domElement.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    domElement.addEventListener('dblclick', this.requestLock);
    // Prevent the browser context menu so right-drag can also orbit.
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private requestLock = (): void => {
    if (!this.locked) this.domElement.requestPointerLock?.();
  };

  private onMouseDown = (): void => {
    this.dragging = true;
    this.domElement.style.cursor = 'grabbing';
  };

  private onMouseUp = (): void => {
    this.dragging = false;
    this.domElement.style.cursor = 'grab';
  };

  enableLook(enabled: boolean): void {
    // Don't force Pointer Lock — drag-look works immediately and Pointer Lock
    // is available on demand via double-click. Just reflect the cursor state.
    this.domElement.style.cursor = enabled ? 'grab' : 'default';
    if (!enabled) document.exitPointerLock?.();
  }

  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.domElement;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.locked && !this.dragging) return;
    this.lookDeltaX += e.movementX * GameConfig.camera.sensitivity;
    this.lookDeltaY += e.movementY * GameConfig.camera.sensitivity;
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (code === 'Escape') {
      this.onPauseToggle?.();
      return;
    }
    if (!this.keys.has(code)) this.pressedThisFrame.add(code);
    this.keys.add(code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  /** True only on the frame the key went down. */
  wasPressed(code: string): boolean {
    return this.pressedThisFrame.has(code);
  }

  /** Normalized movement intent in local space (x = strafe, y = forward). */
  moveIntent(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    // Merge the on-screen joystick (analog) with the keyboard.
    x += this.touchMove.x;
    y += this.touchMove.y;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  get running(): boolean {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight') || this.touchRun;
  }

  // --- Touch / virtual input (driven by the on-screen controls) ----------
  private touchMove = { x: 0, y: 0 };
  private touchRun = false;

  setTouchMove(x: number, y: number): void {
    this.touchMove.x = x;
    this.touchMove.y = y;
  }

  setTouchRun(on: boolean): void {
    this.touchRun = on;
  }

  /** Add camera-look delta from a touch drag (already in radians). */
  addLook(dx: number, dy: number): void {
    this.lookDeltaX += dx;
    this.lookDeltaY += dy;
  }

  /** Fire an edge-triggered key press from a virtual button (E, B, Space…). */
  pressVirtual(code: string): void {
    this.pressedThisFrame.add(code);
  }

  /** Consume per-frame look deltas (returns and resets). */
  consumeLook(): { x: number; y: number } {
    const out = { x: this.lookDeltaX, y: this.lookDeltaY };
    this.lookDeltaX = 0;
    this.lookDeltaY = 0;
    return out;
  }

  /** Call at end of each frame to clear edge-triggered state. */
  endFrame(): void {
    this.pressedThisFrame.clear();
  }
}
