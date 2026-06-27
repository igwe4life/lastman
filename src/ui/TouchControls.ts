import type { Input } from '../core/Input';

/**
 * On-screen touch controls for phones/tablets: a dynamic virtual joystick on the
 * left half for movement, a look area on the right half (drag to orbit the
 * camera), and action buttons (Run toggle, Jump, Help/E, Shop/B). All input is
 * fed into the shared Input so gameplay needs no special-casing. Only shown on
 * touch devices (the `touch` class on <body>).
 */
export class TouchControls {
  private moveId: number | null = null;
  private lookId: number | null = null;
  private moveOrigin = { x: 0, y: 0 };
  private lookLast = { x: 0, y: 0 };
  private readonly maxRadius = 56;
  private readonly lookSensitivity = 0.005;

  private knob!: HTMLElement;
  private stick!: HTMLElement;

  constructor(private input: Input) {
    this.build();
  }

  private build(): void {
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.innerHTML = `
      <div class="touch-zone touch-move" id="touch-move">
        <div class="joystick hidden" id="joystick">
          <div class="joystick-knob" id="joystick-knob"></div>
        </div>
      </div>
      <div class="touch-zone touch-look" id="touch-look"></div>
      <div class="touch-buttons">
        <button class="touch-btn" id="tb-run">RUN</button>
        <button class="touch-btn primary" id="tb-jump">JUMP</button>
        <button class="touch-btn help" id="tb-help">E · HELP</button>
        <button class="touch-btn shop" id="tb-shop">🛒</button>
      </div>`;
    document.body.appendChild(root);

    this.stick = root.querySelector('#joystick')!;
    this.knob = root.querySelector('#joystick-knob')!;

    const moveZone = root.querySelector('#touch-move') as HTMLElement;
    const lookZone = root.querySelector('#touch-look') as HTMLElement;

    moveZone.addEventListener('pointerdown', (e) => this.startMove(e), { passive: false });
    lookZone.addEventListener('pointerdown', (e) => this.startLook(e), { passive: false });
    window.addEventListener('pointermove', (e) => this.onMove(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('pointercancel', (e) => this.onUp(e));

    // Buttons. stopPropagation so they don't also trigger the look drag.
    this.button(root, '#tb-jump', () => this.input.pressVirtual('Space'));
    this.button(root, '#tb-help', () => this.input.pressVirtual('KeyE'));
    this.button(root, '#tb-shop', () => this.input.pressVirtual('KeyB'));
    const runBtn = root.querySelector('#tb-run') as HTMLElement;
    let running = false;
    runBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      running = !running;
      this.input.setTouchRun(running);
      runBtn.classList.toggle('active', running);
    });
  }

  private button(root: HTMLElement, sel: string, fn: () => void): void {
    const el = root.querySelector(sel) as HTMLElement;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      fn();
      el.classList.add('pressed');
      window.setTimeout(() => el.classList.remove('pressed'), 120);
    });
  }

  private startMove(e: PointerEvent): void {
    if (this.moveId !== null) return;
    e.preventDefault();
    this.moveId = e.pointerId;
    this.moveOrigin = { x: e.clientX, y: e.clientY };
    this.stick.style.left = `${e.clientX}px`;
    this.stick.style.top = `${e.clientY}px`;
    this.stick.classList.remove('hidden');
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  private startLook(e: PointerEvent): void {
    if (this.lookId !== null) return;
    e.preventDefault();
    this.lookId = e.pointerId;
    this.lookLast = { x: e.clientX, y: e.clientY };
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId === this.moveId) {
      e.preventDefault();
      let dx = e.clientX - this.moveOrigin.x;
      let dy = e.clientY - this.moveOrigin.y;
      const len = Math.hypot(dx, dy);
      if (len > this.maxRadius) {
        dx = (dx / len) * this.maxRadius;
        dy = (dy / len) * this.maxRadius;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      // Up on screen = forward (+y). Right = +x.
      this.input.setTouchMove(dx / this.maxRadius, -dy / this.maxRadius);
    } else if (e.pointerId === this.lookId) {
      e.preventDefault();
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.input.addLook(dx * this.lookSensitivity, dy * this.lookSensitivity);
    }
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId === this.moveId) {
      this.moveId = null;
      this.input.setTouchMove(0, 0);
      this.stick.classList.add('hidden');
    } else if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }
}
